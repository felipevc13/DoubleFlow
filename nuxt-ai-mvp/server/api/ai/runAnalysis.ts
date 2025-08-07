import { decompressContextBlob } from "~/composables/taskflow/useCumulativeContext";
import { dataExtractors, defaultExtractor } from "../../utils/dataExtractors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import yaml from "js-yaml";
import { generateFinalPrompt } from "~/server/utils/promptEngine";
import { readFile } from "fs/promises";
import path from "path";

const ANALYSIS_CONFIG_PATH = path.resolve(
  process.cwd(),
  "lib/prompts/analysis.yml"
);

// --- Interfaces Auxiliares ---
interface DataSourceRule {
  from: "cumulativeContext" | "inputData";
  filterByType?: string[];
  filterByCategory?: string[];
  filterByQuestionType?: string[];
}

// Exporta explicitamente as funções auxiliares usadas nos testes
export {
  extractQuantitativeKpisFromContext,
  aggregateQualitativeTextsFromContext,
};

interface AnalysisConfig {
  description: string;
  dataSources: DataSourceRule[];
  promptTemplate: string;
  output: {
    saveTo: string;
    schema: Record<string, any>;
    postProcess?: {
      createOutputFrom: string;
      renameTo: string;
    };
  };
  analysisMode?: string;
}

// NEW HELPER: Safely get a nested value from an object using a dot-notation string.
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((currentObject, key) => {
    return currentObject &&
      typeof currentObject === "object" &&
      key in currentObject
      ? currentObject[key]
      : undefined;
  }, obj);
}

// --- Cache ---
let analysisConfigCache: Record<string, AnalysisConfig> | null = null;

// --- Função de agregação de dados (simplificada) ---
function aggregateDataForAI(nodeData: any, rules: DataSourceRule[]): any[] {
  const collectedData: any[] = [];
  // CORREÇÃO: Usar decompressContextBlob diretamente, que aceita o objeto de contexto.
  const context = decompressContextBlob(nodeData.cumulativeContext);

  // DEBUG: list all ancestors reaching the aggregation step
  console.log(
    "[DEBUG ancestors]",
    Object.entries(context).map(([id, a]: [string, any]) => ({
      id,
      type: (a as any).type,
      category: (a as any).category,
      hasFiles: !!(a as any).output?.uploaded_files?.length,
    }))
  );

  for (const rule of rules) {
    if (rule.from === "cumulativeContext") {
      for (const ancestorId in context) {
        const ancestor = context[ancestorId];

        // Lógica especializada para dataSource para olhar DENTRO dos arquivos, executa apenas se a regra pede dataSource em filterByType
        if (
          ancestor.type === "dataSource" &&
          rule.filterByType?.includes("dataSource")
        ) {
          const output = ancestor.output; // Pega o output corretamente!
          // Processa uploaded_files se existirem
          if (output && Array.isArray(output.uploaded_files)) {
            output.uploaded_files.forEach((file: any) => {
              console.log(
                "[aggregateDataForAI] Avaliando arquivo:",
                file.name,
                "| Categoria do arquivo:",
                file.category,
                "| Categorias da regra:",
                rule.filterByCategory
              );
              if (
                !rule.filterByCategory ||
                (typeof file.category === "string" &&
                  rule.filterByCategory.includes(file.category ?? ""))
              ) {
                let processedColumns = false;
                // 1. Priorize colunas inferidas do Excel se existirem
                if (
                  Array.isArray(file.inferred_survey_columns) &&
                  file.inferred_survey_columns.length > 0
                ) {
                  file.inferred_survey_columns.forEach((col: any) => {
                    if (
                      col.questionType === "openText" &&
                      Array.isArray(col.openTextResponses)
                    ) {
                      col.openTextResponses.forEach((resp: string) => {
                        if (typeof resp === "string" && resp.trim()) {
                          collectedData.push(resp.trim());
                        }
                      });
                    }
                  });
                  processedColumns = true;
                }

                // 2. Só utiliza content se não processou colunas inferidas
                if (
                  !processedColumns &&
                  file.content &&
                  typeof file.content === "string" &&
                  file.content.trim()
                ) {
                  collectedData.push(file.content.trim());
                }
              }
            });
          }
          // Processa 'content' do nó DataSource para notas rápidas (apenas para compatibilidade)
          else if (
            "content" in ancestor &&
            typeof ancestor.content === "string" &&
            (!rule.filterByCategory ||
              ("category" in ancestor &&
                typeof ancestor.category === "string" &&
                rule.filterByCategory.includes(ancestor.category)))
          ) {
            collectedData.push(ancestor.content);
          }
          continue; // Já processou este dataSource, vai para o próximo ancestor.
        }

        // PATCH: Suporte para filterByQuestionType em surveys
        if (
          rule.filterByType &&
          ancestor.type === "survey" &&
          rule.filterByQuestionType &&
          Array.isArray(rule.filterByQuestionType)
        ) {
          // 1. IDs das perguntas do tipo desejado
          const structure = ancestor.output?.survey_structure || [];
          const questionIds = structure
            .filter((q: any) => rule.filterByQuestionType!.includes(q.type))
            .map((q: any) => q.id);

          // 2. Para cada submission, pega só as respostas dessas perguntas
          const submissions =
            ancestor.output?.survey_results?.submissions || [];
          for (const submission of submissions) {
            if (submission.answers) {
              for (const qid of questionIds) {
                if (submission.answers[qid]) {
                  collectedData.push(submission.answers[qid]);
                }
              }
            }
          }
          continue; // Já processou esse ancestor para essa regra
        }

        if (
          rule.filterByType &&
          !rule.filterByType.includes(ancestor.type ?? "")
        )
          continue;
        if (
          rule.filterByCategory &&
          (!("category" in ancestor) ||
            !(
              typeof ancestor.category === "string" &&
              rule.filterByCategory.includes(ancestor.category)
            ))
        )
          continue;
        if (
          rule.filterByQuestionType &&
          (!("questionType" in ancestor) ||
            typeof ancestor.questionType !== "string" ||
            !rule.filterByQuestionType.includes(ancestor.questionType))
        )
          continue;

        // Nenhuma extração universal de extractField aqui: apenas agregação direta conforme filtros e extratores.
        // Dependendo do tipo de ancestor, pode-se agregar um campo padrão, ou todo o output, conforme padrão do projeto.
        // Exemplo: para outros tipos, pode-se coletar ancestor.output, se existir.
        if (
          ancestor.output &&
          typeof ancestor.output === "object" &&
          Object.keys(ancestor.output).length > 0
        ) {
          collectedData.push({
            type: ancestor.type,
            data: ancestor.output,
          });
        }
      }
    }
    if (rule.from === "inputData") {
      // Agrega todo o inputData se existir (sem extractField)
      if (nodeData.inputData && typeof nodeData.inputData === "object") {
        collectedData.push(nodeData.inputData);
      }
    }
  }
  return collectedData;
}

// --- Nova função: extrai KPIs quantitativos diretamente do output dos dataSources e surveys (sem recalcular) ---
function extractQuantitativeKpisFromContext(contextBlob: any): any[] {
  const kpis: any[] = [];
  if (!contextBlob || typeof contextBlob !== "object") return kpis;

  for (const nodeId in contextBlob) {
    const node = contextBlob[nodeId];
    if (!node || typeof node !== "object" || !node.output) continue;

    const surveyKpis = (node as any).output.survey_kpis;
    if (Array.isArray(surveyKpis)) {
      kpis.push(...surveyKpis);
    }
  }
  return kpis;
}

// --- Função para agregar textos qualitativos a partir do contextBlob ---
function aggregateQualitativeTextsFromContext(contextBlob: any): string {
  const qualitativeTexts: string[] = [];

  if (!contextBlob || typeof contextBlob !== "object") return "";

  for (const nodeId in contextBlob) {
    const node = contextBlob[nodeId];
    if (!node || typeof node !== "object") continue;

    let category: string | null = null;

    // Heurística simples de categoria
    if (node.type === "survey") category = "pesquisa_usuario";
    else if (node.type === "dataSource" && typeof node.category === "string")
      category = node.category;

    const extractor =
      (category && dataExtractors[category]) || defaultExtractor;

    if (node.output) {
      const extracted = extractor.extract(node.output);
      extracted.forEach((item) => {
        if (typeof item.content === "string" && item.content.trim()) {
          qualitativeTexts.push(item.content.trim());
        }
      });
    }
  }

  return qualitativeTexts.join("\n---\n");
}

// --- Função Principal de Orquestração ---
// Função auxiliar para coletar instruções dinâmicas dos partials de prompt
async function getDynamicInstructions(
  analysisConfig: AnalysisConfig,
  aggregatedData: any[]
) {
  const partialsDir = path.resolve(process.cwd(), "lib/prompts");
  const usedPartials = new Set<string>();
  const partialTexts: string[] = [];

  // Associa cada regra ao dado agregado correspondente (por índice)
  for (let idx = 0; idx < analysisConfig.dataSources.length; idx++) {
    const rule = analysisConfig.dataSources[idx];
    if (
      aggregatedData[idx] !== undefined &&
      (rule as any).promptPartial &&
      !usedPartials.has((rule as any).promptPartial)
    ) {
      usedPartials.add((rule as any).promptPartial);
      try {
        const fullPath = path.join(partialsDir, (rule as any).promptPartial);
        const text = await readFile(fullPath, "utf-8");
        partialTexts.push(text);
      } catch (e) {
        console.warn("Partial não encontrado:", (rule as any).promptPartial);
      }
    }
  }
  return partialTexts.join("\n---\n");
}

export async function runAnalysis(
  analysisKey: string,
  nodeData: any
): Promise<any> {
  // 1. Carrega analysis.yml
  if (!analysisConfigCache) {
    // Usar readFile para ler o arquivo de configuração
    const fileContent = await readFile(ANALYSIS_CONFIG_PATH, "utf-8");
    if (!fileContent) {
      throw new Error(
        `Arquivo de configuração de análise não encontrado: ${ANALYSIS_CONFIG_PATH}`
      );
    }
    analysisConfigCache = yaml.load(fileContent as string) as Record<
      string,
      AnalysisConfig
    >;
  }
  const config = analysisConfigCache[analysisKey];
  if (!config) {
    throw new Error(
      `Configuração de análise não encontrada para: ${analysisKey}`
    );
  }

  // NOVO FLUXO PARA analysisMode === "hybrid"
  if (config.analysisMode === "hybrid") {
    try {
      // Sempre descomprime o contexto antes de passar para o extrator
      const contextBlob = decompressContextBlob(nodeData.cumulativeContext);

      // 1. Extrai KPIs quantitativos prontos do contexto
      const quantitativeKpis = extractQuantitativeKpisFromContext(contextBlob);

      // 2. Extrai textos qualitativos
      const qualitativeData = aggregateQualitativeTextsFromContext(contextBlob);

      // Se não houver texto qualitativo, retorna apenas os KPIs e arrays vazios
      if (!qualitativeData || qualitativeData.trim() === "") {
        const combinedResult = {
          quantitativeKpis,
          qualitativeInsights: [],
          actionableRecommendations: [],
        };
        return {
          [config.output.saveTo]: combinedResult,
          analyzedData: combinedResult,
          outputData: combinedResult,
          processInputError: null,
          updated_at: new Date().toISOString(),
        };
      }

      // Passa qualitativeData em ambas as chaves para compatibilidade com templates antigos
      const finalPrompt = await generateFinalPrompt(config.promptTemplate, {
        qualitativeData,
        aggregatedData: qualitativeData,
        outputSchema: config.output.schema,
      });

      // --- INÍCIO DO LOG DO PROMPT ---
      console.log("--- PROMPT DE IA ENVIADO (HYBRID) ---");
      console.log(`[Análise: ${analysisKey}]`);
      console.log("Qualitative Data:", qualitativeData);
      console.log(finalPrompt);
      console.log("----------------------------");
      // --- FIM DO LOG DO PROMPT ---

      // 4. Chama a IA Gemini diretamente
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash-latest",
      });
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const rawText = response.text();

      // --- INÍCIO DO LOG DA RESPOSTA ---
      console.log("--- RESPOSTA BRUTA DA IA RECEBIDA (HYBRID) ---");
      console.log(`[Análise: ${analysisKey}]`);
      console.log(rawText);
      console.log("---------------------------------");
      // --- FIM DO LOG DA RESPOSTA ---

      // Parsing robusto da resposta da IA:
      let analysisResult;
      try {
        const jsonMatch = rawText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/s);
        let jsonString: string;

        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1];
        } else {
          const firstBrace = rawText.indexOf("{");
          const lastBrace = rawText.lastIndexOf("}");
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            jsonString = rawText.substring(firstBrace, lastBrace + 1);
          } else {
            throw new Error(
              "Não foi possível encontrar um objeto JSON válido na resposta da IA."
            );
          }
        }

        analysisResult = JSON.parse(jsonString);
      } catch (parseError: any) {
        console.error(
          "Falha ao parsear JSON da resposta da IA (hybrid):",
          parseError.message
        );
        throw new Error(
          `A resposta da IA não pôde ser convertida para JSON. Texto retornado: ${rawText}`
        );
      }

      // 5. Monta objeto combinado com KPIs quantitativos e insights qualitativos
      const combinedResult = {
        quantitativeKpis,
        qualitativeInsights: analysisResult.qualitativeInsights || [],
        actionableRecommendations:
          analysisResult.actionableRecommendations || [],
      };

      // 6. Retorna objeto esperado
      return {
        [config.output.saveTo]: combinedResult,
        analyzedData: combinedResult,
        outputData: combinedResult,
        processInputError: null,
        updated_at: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`Erro na análise híbrida para '${analysisKey}':`, error);
      return {
        processInputError: `Erro na análise híbrida: ${error.message}`,
        analyzedData: null,
        outputData: {},
      };
    }
  }

  // 2. Agrega dados conforme a receita
  const aggregatedData = aggregateDataForAI(nodeData, config.dataSources);
  // Adiciona coleta de instruções dinâmicas dos partials
  const dynamicInstructions = await getDynamicInstructions(
    config,
    aggregatedData
  );
  if (
    !aggregatedData ||
    (Array.isArray(aggregatedData) && aggregatedData.length === 0)
  ) {
    console.log(
      `---- [runAnalysis] aggregatedData vazio para ${analysisKey} ----`
    );
    console.log("analysisKey:", analysisKey);
    console.log("nodeData:", JSON.stringify(nodeData, null, 2));
    console.log("rules:", JSON.stringify(config.dataSources, null, 2));
    console.log("aggregatedData:", JSON.stringify(aggregatedData, null, 2));
    console.log("------------------------------------------------");
    return {
      processInputError: "Nenhum dado válido encontrado para análise.",
      analyzedData: null,
      outputData: {},
    };
  }

  // 3. Monta prompt usando promptAssembler
  let finalPrompt;
  if (analysisKey === "refineProblemStatement") {
    // Espera [currentTitle, currentDescription] na ordem dos dataSources do analysis.yml
    const [currentTitle, currentDescription] = aggregatedData;
    finalPrompt = await generateFinalPrompt(config.promptTemplate, {
      currentTitle: currentTitle ?? "",
      currentDescription: currentDescription ?? "",
    });
  } else {
    finalPrompt = await generateFinalPrompt(config.promptTemplate, {
      aggregatedData,
      dynamicInstructions,
      outputSchema: config.output.schema,
    });
  }

  // --- INÍCIO DO LOG DO PROMPT ---
  console.log("--- PROMPT DE IA ENVIADO ---");
  console.log(`[Análise: ${analysisKey}]`);
  console.log("Aggregated Data:", JSON.stringify(aggregatedData, null, 2));
  console.log(finalPrompt);
  console.log("----------------------------");
  // --- FIM DO LOG DO PROMPT ---

  // 4. Chama a IA Gemini diretamente
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const rawText = response.text();

    // --- INÍCIO DO LOG DA RESPOSTA ---
    console.log("--- RESPOSTA BRUTA DA IA RECEBIDA ---");
    console.log(`[Análise: ${analysisKey}]`);
    console.log(rawText);
    console.log("---------------------------------");
    // --- FIM DO LOG DA RESPOSTA ---

    // Novo bloco robusto de parsing de resposta da IA:
    let analysisResult;
    try {
      // Etapa 1: Tenta encontrar JSON dentro de um bloco de código Markdown.
      // A flag 's' (dotAll) permite que '.' corresponda a novas linhas, o que é crucial.
      const jsonMatch = rawText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/s);
      let jsonString: string;

      if (jsonMatch && jsonMatch[1]) {
        // Se encontrou JSON dentro de ```...```, use esse conteúdo.
        jsonString = jsonMatch[1];
      } else {
        // Fallback: Se não houver blocos de código, encontre o primeiro '{' e o último '}'
        // Isso ajuda a limpar texto extra que a IA possa ter adicionado antes ou depois.
        const firstBrace = rawText.indexOf("{");
        const lastBrace = rawText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonString = rawText.substring(firstBrace, lastBrace + 1);
        } else {
          // Se nenhum objeto JSON puder ser razoavelmente encontrado, lance um erro.
          throw new Error(
            "Não foi possível encontrar um objeto JSON válido na resposta da IA."
          );
        }
      }

      // Agora, faça o parse da string JSON extraída.
      analysisResult = JSON.parse(jsonString);
    } catch (parseError: any) {
      console.error(
        "Falha ao parsear JSON da resposta da IA:",
        parseError.message
      );
      // Inclui a resposta bruta no erro para facilitar a depuração.
      throw new Error(
        `A resposta da IA não pôde ser convertida para JSON. Texto retornado: ${rawText}`
      );
    }

    // 5. Pós-processamento para outputData, se definido
    let finalOutputData = {};
    if (config.output.postProcess) {
      finalOutputData = {
        [config.output.postProcess.renameTo]: analysisResult,
      };
    }

    // Padronização para AffinityMap: sempre garantir { clusters: [...] }
    if (analysisKey === "affinityMapAnalysis") {
      if (Array.isArray(analysisResult)) {
        analysisResult = { clusters: analysisResult };
      } else if (
        analysisResult &&
        !Array.isArray(analysisResult.clusters) &&
        Array.isArray(analysisResult.affinityMap)
      ) {
        // Caso venha como { affinityMap: [...] }, renomeia para clusters
        analysisResult = { clusters: analysisResult.affinityMap };
      }
    }

    // Garante que outputData sempre contenha o resultado final
    let outputDataMerged = { ...finalOutputData };
    if (analysisKey === "reportGeneration") {
      const context = decompressContextBlob(nodeData.cumulativeContext);
      const blocks = [];
      for (const nodeId in context) {
        const node = context[nodeId];
        if (!node || typeof node !== "object" || !node.type || !node.output)
          continue;
        let blockType = null;
        let blockData = null;
        if (node.type === "problem") {
          blockType = "problem_context";
          blockData = node.output.problem;
        } else if (node.type === "insights") {
          blockType = "insights_block";
          blockData = node.output.insights_results;
        } else if (node.type === "empathMap") {
          blockType = "empathy_map_block";
          blockData = node.output?.empathy_map || node.output;
        } else if (node.type === "affinityMap") {
          blockType = "affinity_map_block";
          blockData = node.output?.affinity_map_clusters || node.output;
        }
        if (blockType && blockData) {
          blocks.push({ type: blockType, data: blockData });
        }
      }
      outputDataMerged = { ...outputDataMerged, blocks };
    }
    if (
      config.output.saveTo &&
      typeof analysisResult !== "undefined" &&
      analysisResult !== null
    ) {
      // Se saveTo já está em finalOutputData, não sobrescreve
      if (!(config.output.saveTo in outputDataMerged)) {
        (outputDataMerged as Record<string, any>)[config.output.saveTo] =
          analysisResult;
      }
    }

    if (analysisKey === "affinityMapAnalysis") {
      console.log(
        "[runAnalysis][FINAL] analysisResult padronizado:",
        JSON.stringify(analysisResult, null, 2)
      );
      console.log(
        "[runAnalysis][FINAL] objeto retornado:",
        JSON.stringify(
          {
            [config.output.saveTo]: analysisResult,
            outputData: outputDataMerged,
            processInputError: null,
            updated_at: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }

    return {
      [config.output.saveTo]: analysisResult,
      outputData: outputDataMerged,
      processInputError: null,
      updated_at: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`Erro na análise de IA para '${analysisKey}':`, error);
    return {
      processInputError: `Erro na análise: ${error.message}`,
      analyzedData: null,
      outputData: {},
    };
  }
}
