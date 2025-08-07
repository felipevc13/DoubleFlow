import { defineEventHandler, readMultipartFormData, createError } from "h3";
import mammoth from "mammoth";

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event);
    const fileData = formData?.find((item) => item.name === "file"); // Key must match FormData append in frontend

    if (!fileData || !fileData.data || !fileData.filename) {
      throw createError({
        statusCode: 400,
        statusMessage: "Nenhum arquivo enviado ou dados inválidos.",
      });
    }

    // Basic check for docx extension (more robust check might be needed)
    if (!fileData.filename.toLowerCase().endsWith(".docx")) {
      throw createError({
        statusCode: 400,
        statusMessage: "Tipo de arquivo inválido. Apenas .docx é suportado.",
      });
    }

    // Extract text using mammoth
    const result = await mammoth.extractRawText({ buffer: fileData.data });
    const text = result.value; // The raw text
    // const messages = result.messages; // Optional: warnings/errors during extraction

    // Optional: Log messages if needed
    // if (messages && messages.length > 0) {
    //   console.warn(`[API /extract-text] Mammoth messages for ${fileData.filename}:`, messages);
    // }

    // Return the extracted text
    return {
      text: text || "", // Return empty string if extraction somehow fails but doesn't throw
    };
  } catch (error: any) {
    console.error("[API /extract-text] Error:", error);

    // Check if it's an H3 error we threw
    if (error.statusCode) {
      throw error;
    }

    // Handle potential mammoth errors or other issues
    throw createError({
      statusCode: 500,
      statusMessage: `Erro ao extrair texto do arquivo: ${
        error.message || "Erro desconhecido"
      }`,
    });
  }
});
