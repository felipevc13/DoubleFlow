// server/api/ai/runAnalysis.post.ts
import { defineEventHandler, readBody, createError } from "h3";

function buildExtractionUrl(): string {
  const env = process.env.EXTRACTION_SERVICE_URL?.trim();
  if (env) {
    // Normaliza: se a env NÃO termina com /extract, adiciona
    try {
      const u = new URL(env);
      if (!u.pathname || u.pathname === "/" || u.pathname === "") {
        u.pathname = "/extract";
      } else if (!u.pathname.endsWith("/extract")) {
        // Evita duplicar / quando já tem barra no fim/início
        u.pathname = u.pathname.replace(/\/+$/, "") + "/extract";
      }
      return u.toString();
    } catch {
      // Se veio algo sem esquema, tenta montar
      const base = env.replace(/\/+$/, "");
      return base.endsWith("/extract") ? base : base + "/extract";
    }
  }
  // Default local
  return "http://127.0.0.1:8000/extract";
}

export default defineEventHandler(async (event) => {
  const EXTRACT_URL = buildExtractionUrl();
  const body = await readBody<{
    files?: Array<{ filename?: string; content?: string; category?: string }>;
  }>(event);

  if (!body || !Array.isArray(body.files)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Payload inválido. Envie: { files: [{ filename, content, category }] }",
    });
  }

  const files = body.files
    .map((f, idx) => ({
      filename: f?.filename || `file_${idx + 1}`,
      category: f?.category || "generico",
      content: typeof f?.content === "string" ? f.content.trim() : "",
    }))
    .filter((f) => {
      if (!f.content) {
        console.warn(
          `[runAnalysis] Ignorando arquivo sem conteúdo: ${f.filename} (categoria: ${f.category})`
        );
        return false;
      }
      return true;
    });

  if (files.length === 0) {
    return {
      insights: [],
      files: [],
      processInputError:
        "Nenhum arquivo com conteúdo válido para analisar (todos vazios).",
      updated_at: new Date().toISOString(),
    };
  }

  // DEBUG útil
  console.log(
    `[runAnalysis] Enviando ${files.length} arquivo(s) para: ${EXTRACT_URL}`
  );

  try {
    // Usa $fetch.raw pra conseguir status + data em caso de erro
    const res = await $fetch.raw(EXTRACT_URL, {
      method: "POST",
      body: { files },
    });

    let extractionResults: Array<{ filename: string; insights: any[] }> = [];
    try {
      extractionResults = Array.isArray(res._data)
        ? res._data
        : await res.json();
    } catch {
      extractionResults = Array.isArray(res._data) ? res._data : [];
    }

    const unifiedInsights: any[] = [];
    for (const fr of extractionResults || []) {
      const fname = fr?.filename || "desconhecido";
      const insights = Array.isArray(fr?.insights) ? fr.insights : [];
      for (const it of insights) {
        // Garante nome de arquivo "limpo" (apenas basename)
        const cleanName = String(fname).split(/[/\\]/).pop() || String(fname);
        unifiedInsights.push({
          ...it,
          filename: cleanName, // usado pelo filtro e exibição
          _file: cleanName, // mantém compatibilidade com versões anteriores
        });
      }
    }

    return {
      insights: unifiedInsights,
      files: extractionResults,
      updated_at: new Date().toISOString(),
    };
  } catch (err: any) {
    // Tenta extrair detalhes do erro
    const status = err?.response?.status || 502;
    let detail =
      err?.data?.detail ||
      err?.response?._data ||
      err?.message ||
      "Erro desconhecido";

    // Se vier objeto, stringifica
    if (typeof detail !== "string") {
      try {
        detail = JSON.stringify(detail);
      } catch {
        detail = String(detail);
      }
    }

    console.error(
      `[runAnalysis] Falha ao contatar serviço em ${EXTRACT_URL} — status ${status} — detalhe: ${detail}`
    );

    throw createError({
      statusCode: 502,
      statusMessage: `Falha ao contatar o serviço de extração: ${detail}`,
    });
  }
});
