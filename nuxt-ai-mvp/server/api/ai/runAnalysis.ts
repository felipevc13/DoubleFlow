// lib/server/runAnalysis.ts (ou onde você centraliza isso)
import { decompressContextBlob } from "~/composables/taskflow/useCumulativeContext";
import { GoogleGenerativeAI } from "@google/generative-ai";
import yaml from "js-yaml";
import { readFile } from "fs/promises";
import path from "path";
import { generateFinalPrompt } from "~/server/utils/promptEngine";

const ANALYSIS_CONFIG_PATH = path.resolve(
  process.cwd(),
  "lib/prompts/analysis.yml"
);

interface AnalysisConfig {
  description: string;
  dataSources: Array<{
    from: "cumulativeContext" | "inputData";
    // mantemos por compat, mas não usamos filtros legados aqui
    filterByType?: string[];
    filterByCategory?: string[];
  }>;
  promptTemplate: string;
  output: {
    saveTo: string; // ex: "analysis_results"
    schema: Record<string, any>;
  };
  analysisMode?: string; // "hybrid" recomendado
}

let analysisConfigCache: Record<string, AnalysisConfig> | null = null;

// -------------------- Helpers NOVOS (apenas padrões atuais) --------------------

/**
 * Extrai KPIs de uploaded_files:
 * - structured_data.quantitativeKPIs (preferencial)
 * - content (se for JSON com quantitativeKPIs)
 */
function collectQuantitativeKpis(uploadedFiles: any[]): any[] {
  const kpis: any[] = [];
  for (const f of uploadedFiles) {
    // 1) structured_data
    if (Array.isArray(f?.structured_data?.quantitativeKPIs)) {
      kpis.push(...f.structured_data.quantitativeKPIs);
    }
    // 2) content JSON
    if (typeof f?.content === "string") {
      try {
        const parsed = JSON.parse(f.content);
        if (Array.isArray(parsed?.quantitativeKPIs)) {
          kpis.push(...parsed.quantitativeKPIs);
        }
      } catch {
        // content não era JSON — ok para transcrição
      }
    }
  }
  return kpis;
}

/**
 * Agrega textos qualitativos:
 * - inferred_survey_columns.openTextResponses
 * - structured_data.qualitativeData (pergunta + respostas)
 * - content textual para categorias de texto (transcrição, txt, md)
 */
function collectQualitativeText(uploadedFiles: any[]): string {
  const texts: string[] = [];

  for (const f of uploadedFiles) {
    // a) inferred_survey_columns (quando veio do Excel)
    if (Array.isArray(f?.inferred_survey_columns)) {
      for (const col of f.inferred_survey_columns) {
        if (
          col?.questionType === "openText" &&
          Array.isArray(col.openTextResponses)
        ) {
          for (const resp of col.openTextResponses) {
            if (typeof resp === "string" && resp.trim()) {
              texts.push(resp.trim());
            }
          }
        }
      }
    }

    // b) structured_data.qualitativeData (pergunta + respostas)
    const qd = f?.structured_data?.qualitativeData;
    if (Array.isArray(qd)) {
      for (const blk of qd) {
        const pergunta = blk?.pergunta ? `Pergunta: ${blk.pergunta}` : "";
        const respostas = Array.isArray(blk?.respostas)
          ? blk.respostas.filter((r: any) => typeof r === "string" && r.trim())
          : [];
        if (pergunta || respostas.length) {
          texts.push([pergunta, ...respostas].join("\n").trim());
        }
      }
    }

    // c) conteúdo textual (transcrição/txt/md)
    const cat = String(f?.category || "");
    const isTextLike =
      cat === "transcricao_entrevista" ||
      f?.type === "text" ||
      f?.type === "markdown";
    if (isTextLike && typeof f?.content === "string" && f.content.trim()) {
      texts.push(f.content.trim());
    }
  }

  return texts.join("\n---\n");
}

/**
 * Coleta uploaded_files do contexto cumulativo.
 * Considera nós do tipo dataSource e checa output.uploaded_files.
 */
function getAllUploadedFiles(nodeData: any): any[] {
  const context = decompressContextBlob(nodeData.cumulativeContext);
  const files: any[] = [];
  for (const id in context) {
    const n = context[id];
    if (!n || typeof n !== "object") continue;
    const arr = n?.output?.uploaded_files;
    if (Array.isArray(arr) && arr.length) {
      files.push(...arr);
    }
  }
  return files;
}

// -------------------- Principal --------------------

export async function runAnalysis(
  analysisKey: string,
  nodeData: any
): Promise<any> {
  // Carrega config (analysis.yml) 1x
  if (!analysisConfigCache) {
    const fileContent = await readFile(ANALYSIS_CONFIG_PATH, "utf-8");
    analysisConfigCache = yaml.load(fileContent) as Record<
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

  // 1) Junta todos os arquivos carregados nos nós anteriores
  const uploadedFiles = getAllUploadedFiles(nodeData);

  if (!uploadedFiles.length) {
    return {
      processInputError: "Nenhum arquivo encontrado para análise.",
      analyzedData: null,
      outputData: {},
    };
  }

  // 2) Extrai KPIs + textos
  const quantitativeKpis = collectQuantitativeKpis(uploadedFiles);
  const qualitativeData = collectQualitativeText(uploadedFiles);

  // 3) Se não houver texto qualitativo, não chama LLM
  if (!qualitativeData || qualitativeData.trim() === "") {
    const combined = {
      quantitativeKpis,
      qualitativeInsights: [],
      actionableRecommendations: [],
    };
    return {
      [config.output.saveTo]: combined,
      analyzedData: combined,
      outputData: combined,
      processInputError: null,
      updated_at: new Date().toISOString(),
    };
  }

  // 4) Monta prompt e chama a IA
  const finalPrompt = await generateFinalPrompt(config.promptTemplate, {
    qualitativeData,
    aggregatedData: qualitativeData, // compat com templates antigos
    outputSchema: config.output.schema,
  });

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  let rawText = "";
  try {
    const result = await model.generateContent(finalPrompt);
    rawText = result?.response?.text() ?? "";
  } catch (err: any) {
    console.error("[runAnalysis] Erro ao chamar LLM:", err?.message || err);
    // volta só com KPIs
    const combined = {
      quantitativeKpis,
      qualitativeInsights: [],
      actionableRecommendations: [],
    };
    return {
      [config.output.saveTo]: combined,
      analyzedData: combined,
      outputData: combined,
      processInputError: `Falha na IA: ${err?.message || "erro desconhecido"}`,
      updated_at: new Date().toISOString(),
    };
  }

  // 5) Parse robusto do JSON retornado
  let parsed: any = {};
  try {
    const jsonMatch = rawText.match(/```(?:json)?\s*({[\s\S]*?})\s*```/s);
    const jsonString =
      jsonMatch?.[1] ??
      (rawText.includes("{") && rawText.includes("}")
        ? rawText.substring(rawText.indexOf("{"), rawText.lastIndexOf("}") + 1)
        : "");

    if (!jsonString) {
      throw new Error("Não foi possível isolar um JSON na resposta da IA.");
    }

    parsed = JSON.parse(jsonString);
  } catch (e: any) {
    console.error("[runAnalysis] Falha ao parsear JSON:", e?.message || e);
    // fallback: sem insights, só KPIs
    const combined = {
      quantitativeKpis,
      qualitativeInsights: [],
      actionableRecommendations: [],
    };
    return {
      [config.output.saveTo]: combined,
      analyzedData: combined,
      outputData: combined,
      processInputError: "A resposta da IA não pôde ser convertida para JSON.",
      updated_at: new Date().toISOString(),
    };
  }

  // 6) Normaliza campos esperados
  const combinedResult = {
    quantitativeKpis,
    qualitativeInsights: Array.isArray(parsed?.qualitativeInsights)
      ? parsed.qualitativeInsights
      : [],
    actionableRecommendations: Array.isArray(parsed?.actionableRecommendations)
      ? parsed.actionableRecommendations
      : [],
  };

  return {
    [config.output.saveTo]: combinedResult,
    analyzedData: combinedResult,
    outputData: combinedResult,
    processInputError: null,
    updated_at: new Date().toISOString(),
  };
}
