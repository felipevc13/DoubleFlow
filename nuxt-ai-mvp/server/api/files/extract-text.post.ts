// server/api/files/extract-text.post.ts
import { defineEventHandler, readMultipartFormData, createError } from "h3";
import mammoth from "mammoth";

export default defineEventHandler(async (event) => {
  try {
    // Lê o FormData enviado pelo cliente
    const formData = await readMultipartFormData(event);
    const fileData = formData?.find((item) => item.name === "file");

    if (!fileData?.data || !fileData?.filename) {
      throw createError({
        statusCode: 400,
        statusMessage: "Nenhum arquivo enviado ou dados inválidos.",
      });
    }

    const filename = fileData.filename;
    const lower = filename.toLowerCase();

    // Apenas .docx aqui — .txt/.md já são lidos direto no cliente
    if (!lower.endsWith(".docx")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Tipo de arquivo inválido. Apenas .docx é suportado.",
      });
    }

    // Extrai texto cru do .docx com o Mammoth
    const result = await mammoth.extractRawText({
      buffer: fileData.data as Buffer,
    });

    // Normaliza e evita undefined
    let text = (result?.value || "").trim();

    // Opcional: normaliza quebras de linha esquisitas
    if (text) {
      // substitui \r\n / \r por \n
      text = text.replace(/\r\n?/g, "\n");
      // colapsa espaços em excesso em linhas vazias
      text = text.replace(/\n{3,}/g, "\n\n");
    }

    // Retorna no CONTRATO esperado pelo frontend
    return { text };
  } catch (error: any) {
    // Se já for um erro H3 que nós jogamos, repassa
    if (error?.statusCode) {
      throw error;
    }

    console.error("[API /extract-text] Erro inesperado:", error);
    throw createError({
      statusCode: 500,
      statusMessage:
        "Erro ao extrair texto do arquivo .docx: " +
        (error?.message || "desconhecido"),
    });
  }
});
