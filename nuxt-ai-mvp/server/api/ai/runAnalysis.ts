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
function collectQualitativeTextWithSections(uploadedFiles: any[]): {
  joined: string;
  sections: Array<{ name: string; text: string }>;
} {
  const sections: Array<{ name: string; text: string }> = [];

  for (const f of uploadedFiles) {
    const texts: string[] = [];

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

    // Cria seção somente se houver conteúdo
    if (texts.length) {
      const basename = String(
        f?.filename || f?.name || f?.path || f?.source_name || ""
      )
        .split(/[/\\]/)
        .pop() as string;
      const text = texts.join("\n---\n");
      sections.push({ name: basename || "(desconhecido)", text });
    }
  }

  // Monta o joined com marcadores explícitos por arquivo
  const joined = sections
    .map((s) => `=== SOURCE: ${s.name} ===\n${s.text}`)
    .join("\n\n");

  return { joined, sections };
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

  const fileBasenames = Array.from(
    new Set(
      uploadedFiles
        .map((f: any) =>
          String(f?.filename || f?.name || f?.path || f?.source_name || "")
            .split(/[/\\]/)
            .pop()
        )
        .filter(Boolean)
    )
  ) as string[];

  const quantitativeKpis = collectQuantitativeKpis(uploadedFiles);

  if (!uploadedFiles.length) {
    return {
      processInputError: "Nenhum arquivo encontrado para análise.",
      analyzedData: null,
      outputData: {},
    };
  }

  // 2) Extrai KPIs + textos
  const { joined: qualitativeData, sections: fileSections } =
    collectQualitativeTextWithSections(uploadedFiles);

  // 3) Se não houver texto qualitativo, não chama LLM
  if (!qualitativeData || qualitativeData.trim() === "") {
    const combined = {
      quantitativeKpis,
      qualitativeInsights: [],
      actionableRecommendations: [],
      insights: [], // compat: front espera analyzedData.insights
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
    // Dica ao modelo: inclua `filename` por insight usando os marcadores `=== SOURCE: <nome> ===` acima
    qualitativeData: `Instrução: Ao gerar cada item em qualitativeInsights, inclua o campo \"filename\" com o nome após o marcador \"=== SOURCE: <nome> ===\" que corresponde ao trecho de onde o insight foi derivado.\n\n${qualitativeData}`,
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
      insights: [], // compat: front espera analyzedData.insights
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
      insights: [], // compat: front espera analyzedData.insights
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
  // Base arrays from model
  const baseInsights: any[] = Array.isArray(parsed?.qualitativeInsights)
    ? parsed.qualitativeInsights
    : [];

  // If only one source file is present and insights don't carry filename, attach it for filtering
  const enrichedInsights = baseInsights.map((it: any) => {
    if (it && (it.filename || it.file || it.source_name)) return it;

    // 1) Se só existe um arquivo, atribui direto
    if (fileBasenames.length === 1) {
      return { ...it, filename: fileBasenames[0] };
    }

    // 2) Heurística: tenta localizar a citação/texto no bloco da seção correspondente
    const needle =
      (typeof it?.quote === "string" && it.quote) ||
      (typeof it?.text === "string" && it.text) ||
      (typeof it?.content === "string" && it.content) ||
      "";

    if (needle) {
      const lower = needle.toLowerCase();
      const found = fileSections.find((s) =>
        s.text.toLowerCase().includes(lower)
      );
      if (found) {
        return { ...it, filename: found.name };
      }
    }

    return it;
  });

  const combinedResult = {
    quantitativeKpis,
    qualitativeInsights: enrichedInsights,
    actionableRecommendations: Array.isArray(parsed?.actionableRecommendations)
      ? parsed.actionableRecommendations
      : [],
    insights: enrichedInsights, // compat: front espera analyzedData.insights
  };

  return {
    [config.output.saveTo]: combinedResult,
    analyzedData: combinedResult,
    outputData: combinedResult,
    processInputError: null,
    updated_at: new Date().toISOString(),
  };
}
