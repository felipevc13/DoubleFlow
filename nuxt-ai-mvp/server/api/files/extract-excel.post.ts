import * as XLSX from "xlsx"; // Import xlsx library

function normalizeType(str: string): string {
  const typeStr = String(str || "openText")
    .toLowerCase()
    .replace(/[\s-]/g, "");
  if (typeStr === "multiplechoice") return "multipleChoice";
  if (typeStr === "opentext") return "openText";
  if (typeStr === "opinionscale") return "opinionScale";
  if (typeStr === "rating" || typeStr === "satisfactionscale") return "rating";
  return "openText";
}

// Remove espaços extras, null e undefined; normaliza valores
function cleanCellValue(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// CORREÇÃO APLICADA AQUI
// Se quiser ignorar colunas do sistema, defina por aqui (exemplo)
function isMetadataColumn(header: string): boolean {
  const meta = [
    "id",
    "data",
    "timestamp",
    "participante",
    "respondente",
    "e-mail",
  ];
  if (!header) return true;
  const lowerHeader = header.toLowerCase().trim();
  // Altera de .includes() para uma comparação exata (===)
  return meta.some((m) => lowerHeader === m);
}

// Se quiser agrupar colunas de múltipla escolha ou retornar direto
function groupMultiChoiceColumns(cols: any[]): any[] {
  // Para este pipeline, só retorna o array, mas pode customizar depois
  return cols;
}

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

    const lowerFilename = fileData.filename.toLowerCase();
    if (!lowerFilename.endsWith(".xlsx") && !lowerFilename.endsWith(".xls")) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Tipo de arquivo inválido. Apenas .xlsx e .xls são suportados.",
      });
    }

    // Novo pipeline robusto para processar as sheets
    const workbook = XLSX.read(fileData.data, {
      type: "buffer",
      cellDates: true,
    });
    const sheets = workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: null,
      });

      // Novo parsing: espera-se linha 0 = tipo, linha 1 = pergunta, linha 2+ = respostas
      if (data.length < 2) return { sheetName, columns: [] };

      const typeRowRaw = data[0].map((t) => String(t || "").toLowerCase());
      const typeRow = typeRowRaw.map(normalizeType);
      const headerRow = data[1].map((h) => String(h || ""));

      // Filtrar colunas sem header definido (linha 2)
      const validColIndices = headerRow
        .map((h, idx) => (h.trim() !== "" ? idx : -1))
        .filter((idx) => idx !== -1);

      // Filtrar linhas completamente vazias (após a segunda linha)
      const dataRows = data
        .slice(2)
        .filter((row) =>
          validColIndices.some(
            (colIdx) => row[colIdx] !== null && row[colIdx] !== undefined
          )
        );

      const initialColumns = validColIndices.map((colIdx) => ({
        header: headerRow[colIdx],
        type: typeRow[colIdx] || "openText",
        responses: dataRows.map((row) => cleanCellValue(row[colIdx])),
      }));

      const analysisColumns = initialColumns.filter(
        (col) => !isMetadataColumn(col.header)
      );
      const finalColumns = groupMultiChoiceColumns(analysisColumns);

      return { sheetName, columns: finalColumns };
    });

    // Check if sheets is empty or all sheets have empty columns
    const allSheetsEmpty =
      sheets.length === 0 ||
      sheets.every((sheet) => !sheet.columns || sheet.columns.length === 0);

    if (allSheetsEmpty) {
      console.error(
        "Nenhuma coluna válida encontrada em nenhuma aba da planilha."
      );
      return {
        structured_data: null,
        text: "",
        error: "Nenhuma coluna válida encontrada em nenhuma aba da planilha.",
      };
    }

    // Generate aggregated text from all sheets, columns and responses
    let aggregatedText = "";
    sheets.forEach((sheet) => {
      sheet.columns.forEach((col) => {
        aggregatedText += col.header + ": ";
        if (Array.isArray(col.responses)) {
          aggregatedText += col.responses
            .filter(
              (r: string | number | boolean | null | undefined) =>
                r !== null && r !== undefined && r !== ""
            )
            .join(", ");
        }
        aggregatedText += "\n";
      });
    });

    return { structured_data: { sheets }, text: aggregatedText.trim() };
  } catch (error: any) {
    console.error("Erro ao processar arquivo Excel:", error);
    if (error.statusCode) {
      throw error; // Re-throw H3 errors
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Erro ao processar arquivo Excel: ${
        error.message || "Erro desconhecido"
      }`,
    });
  }
});
