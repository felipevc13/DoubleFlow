// lib/nodeHandlers/analysisNodeHandler.ts
import type { INodeHandler, NodeData } from "~/types/nodeHandler";

type ParentOutputs = Record<string, any>;
type AggregatedFile = {
  filename: string;
  content: string;
  category: string;
  structured_data?: any;
};

function aggregateDataForAnalysis(
  parentOutputs: Record<string, any>
): { filename: string; content: string; category: string }[] {
  const files: { filename: string; content: string; category: string }[] = [];

  for (const parentId in parentOutputs) {
    const parentData =
      parentOutputs[parentId]?.output ?? parentOutputs[parentId];

    if (
      parentData?.uploaded_files &&
      Array.isArray(parentData.uploaded_files)
    ) {
      parentData.uploaded_files.forEach((file: any) => {
        if (!file?.category) return;

        const filename = file.name || file.id || "file";
        const category = String(file.category);

        // 🔧 PONTO-CHAVE:
        // Para pesquisa em planilha, envie o structured_data (JSON)
        // como content stringificado. É isso que o FastAPI espera.
        if (
          category === "pesquisa_usuario" &&
          file.structured_data &&
          typeof file.structured_data === "object"
        ) {
          files.push({
            filename,
            category,
            content: JSON.stringify(file.structured_data), // << aqui a magia
          });
          return;
        }

        // Para transcrição/qualquer outro texto, mantenha o content textual
        const textContent =
          typeof file.content === "string" ? file.content.trim() : "";
        if (textContent) {
          files.push({ filename, category, content: textContent });
        }
      });
    }
  }

  return files;
}

// 🔧 Novo: mapeia diversos formatos para uma lista de insights
function coerceInsightsFromItem(item: any): any[] {
  if (!item || typeof item !== "object") return [];

  // 1) Caso direto
  if (Array.isArray(item.insights)) return item.insights;

  // 2) Formatos “híbridos” do seu runAnalysis
  const out: any[] = [];

  // qualitativeInsights -> viram insights de tipo 'qualitative'
  if (Array.isArray(item.qualitativeInsights)) {
    for (const q of item.qualitativeInsights) {
      if (!q) continue;
      if (typeof q === "string") {
        out.push({ type: "qualitative", text: q });
      } else if (q.text || q.summary) {
        out.push({
          type: "qualitative",
          text: q.text ?? q.summary,
          ...q,
        });
      }
    }
  }

  // actionableRecommendations -> viram insights de tipo 'recommendation'
  if (Array.isArray(item.actionableRecommendations)) {
    for (const r of item.actionableRecommendations) {
      if (!r) continue;
      if (typeof r === "string") {
        out.push({ type: "recommendation", text: r });
      } else if (r.text || r.action) {
        out.push({
          type: "recommendation",
          text: r.text ?? r.action,
          ...r,
        });
      }
    }
  }

  // 3) Fallbacks comuns: { summary, kpis }
  if (typeof item.summary === "string" && item.summary.trim()) {
    out.push({ type: "summary", text: item.summary.trim() });
  }
  if (Array.isArray(item.kpis)) {
    for (const k of item.kpis.slice(0, 5)) {
      if (k?.metric && (k.value ?? k.mode ?? k.mean)) {
        out.push({
          type: "kpi",
          metric: k.metric,
          value: k.value ?? k.mode ?? k.mean,
          details: k.details,
        });
      }
    }
  }

  return out;
}

function normalizeAnalysisResponse(resp: any): any[] {
  // 0) Proteção
  if (resp == null) return [];

  // 1) Array direto
  if (Array.isArray(resp)) {
    return resp.flatMap(coerceInsightsFromItem);
  }

  // 2) Objeto com insights diretos
  if (Array.isArray(resp.insights)) {
    return resp.insights;
  }

  // 3) Seu padrão híbrido: analyzedData/ outputData / saveTo dinâmico
  // 3a) analyzedData.insights
  if (resp.analyzedData && Array.isArray(resp.analyzedData.insights)) {
    return resp.analyzedData.insights;
  }
  // 3b) analyzedData com campos híbridos
  if (resp.analyzedData) {
    const merged = coerceInsightsFromItem(resp.analyzedData);
    if (merged.length) return merged;
  }
  // 3c) outputData com chaves dentro
  if (resp.outputData && typeof resp.outputData === "object") {
    const inner: any[] = [];
    for (const k of Object.keys(resp.outputData)) {
      inner.push(...coerceInsightsFromItem(resp.outputData[k]));
    }
    if (inner.length) return inner;
  }
  // 3d) saveTo dinâmico (qualquer chave de nível superior que contenha o resultado)
  for (const k of Object.keys(resp)) {
    if (
      [
        "outputData",
        "analyzedData",
        "processInputError",
        "updated_at",
      ].includes(k)
    )
      continue;
    const coerced = coerceInsightsFromItem(resp[k]);
    if (coerced.length) return coerced;
  }

  // 4) “results” / “files”
  const container = Array.isArray(resp?.results)
    ? resp.results
    : Array.isArray(resp?.files)
    ? resp.files
    : null;

  if (container) {
    return container.flatMap(coerceInsightsFromItem);
  }

  // 5) Última tentativa: coagir o próprio objeto como 1 item
  return coerceInsightsFromItem(resp);
}

export const analysisNodeHandler: INodeHandler = {
  initializeData(_config?: any): NodeData {
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
    const files = aggregateDataForAnalysis(parentOutputs);

    if (!files.length) {
      return {
        processInputError:
          "Nenhum dado válido encontrado nos nós conectados para analisar.",
      };
    }

    try {
      const analysisResults = await fetchInstance("/api/ai/runAnalysis", {
        method: "POST",
        body: { files }, // OK se o endpoint ignorar; seguimos tolerantes
      });

      const allInsights = normalizeAnalysisResponse(analysisResults);

      if (!allInsights.length) {
        const snippet =
          typeof analysisResults === "string"
            ? analysisResults.slice(0, 400)
            : JSON.stringify(analysisResults)?.slice(0, 400);
        throw new Error(
          `A análise não retornou insights válidos. Resposta: ${snippet}`
        );
      }

      return {
        analyzedData: { insights: allInsights },
        processInputError: null,
        updated_at: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("[analysisNodeHandler] Erro:", error);
      return {
        processInputError: error?.message || "Falha ao executar a análise.",
      };
    }
  },

  generateOutput(currentNode: any): Record<string, any> | null {
    return {
      analysis_results: currentNode.data.analyzedData,
    };
  },
};
