// lib/nodeHandlers/analysisNodeHandler.ts
import type { INodeHandler, NodeData } from "~/types/nodeHandler";

// Agora extrai tanto dados qualitativos (textos) quanto quantitativos (KPIs)
function aggregateHybridDataFromParentOutputs(
  parentOutputs: Record<string, any>
): {
  qualitativeTexts: string[];
  quantitativeKPIs: any[];
} {
  console.log("Conteúdo de parentOutputs:", parentOutputs);
  const qualitativeTexts: string[] = [];
  const quantitativeKPIs: any[] = [];

  for (const parentId in parentOutputs) {
    const parent = parentOutputs[parentId];
    // ATENÇÃO: Use 'parent?.output' se estiver usando outputs aninhados
    const parentData = parent?.output ?? parent; // fallback para casos antigos

    // Dados qualitativos
    if (
      parentData?.uploaded_files &&
      Array.isArray(parentData.uploaded_files)
    ) {
      parentData.uploaded_files.forEach((file: any) => {
        // Extrai texto puro, se houver
        if (file.content) {
          qualitativeTexts.push(
            `Fonte: ${file.name}\nConteúdo:\n${file.content}`
          );
        }
        // Extrai respostas de texto aberto das colunas inferidas
        if (file.inferred_survey_columns) {
          file.inferred_survey_columns.forEach((col: any) => {
            if (col.questionType === "openText" && col.openTextResponses) {
              const textBlock = `Pergunta: "${
                col.questionText
              }"\nRespostas:\n- ${col.openTextResponses.join("\n- ")}`;
              qualitativeTexts.push(textBlock);
            }
          });
        }
      });
    }

    // Dados quantitativos (KPIs)
    if (parentData?.survey_kpis && Array.isArray(parentData.survey_kpis)) {
      quantitativeKPIs.push(...parentData.survey_kpis);
    }
  }

  return { qualitativeTexts, quantitativeKPIs };
}

export const analysisNodeHandler: INodeHandler = {
  initializeData(config?: any): NodeData {
    return {
      label: "Análise de IA",
      title: "Análise de IA",
      description: "Extrai e categoriza dados de fontes conectadas.",
      inputData: {},
      outputData: {},
      analyzedData: { insights: [] },
      cumulativeContext: { compressed: false, blob: {} },
      updated_at: new Date().toISOString(),
    };
  },

  async processInput(
    currentNodeData: NodeData,
    parentOutputs: Record<string, any>,
    fetchInstance: typeof $fetch
  ): Promise<Partial<NodeData>> {
    const { qualitativeTexts, quantitativeKPIs } =
      aggregateHybridDataFromParentOutputs(parentOutputs);

    const aggregatedText = qualitativeTexts.join("\n\n---\n\n");

    if (!aggregatedText.trim() && quantitativeKPIs.length === 0) {
      return {
        processInputError:
          "Nenhum dado qualitativo ou quantitativo encontrado nos nós conectados para analisar.",
      };
    }

    try {
      // Envia ambos os tipos de dados para a API
      const analysisResult = (await fetchInstance("/api/ai/runAnalysis", {
        method: "POST",
        body: {
          textContent: aggregatedText, // Dados qualitativos
          kpiData: quantitativeKPIs, // Dados quantitativos
        },
      })) as { insights: any[] };

      if (!analysisResult || !Array.isArray(analysisResult.insights)) {
        throw new Error("A resposta da API de análise é inválida.");
      }

      return {
        analyzedData: {
          insights: analysisResult.insights,
          sourceKPIs: quantitativeKPIs,
        },
        processInputError: null,
        updated_at: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("[analysisNodeHandler] Erro ao processar análise:", error);
      return {
        processInputError: error.message || "Falha ao executar a análise.",
      };
    }
  },

  generateOutput(currentNode: any): Record<string, any> | null {
    // O output agora pode conter uma estrutura mais rica
    return {
      analysis_results: currentNode.data.analyzedData,
    };
  },
};
