// server/api/files/extract-excel.post.ts
import * as dfd from "danfojs-node";
import { defineEventHandler, readMultipartFormData, createError } from "h3";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function normalizeType(str: string | number | boolean): string {
  if (typeof str !== "string") return "";
  return str.trim().toLowerCase();
}

function isMetadataColumn(header: string): boolean {
  const meta = [
    "id",
    "data",
    "timestamp",
    "participante",
    "respondente",
    "e-mail",
    "email",
  ];
  if (!header) return true;
  const lowerHeader = header.toLowerCase().trim();
  return meta.some((m) => lowerHeader === m);
}

function cleanCellValue(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sanitizeToken(v: any): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const low = s.toLowerCase();
  if (low === "undefined" || low === "nan" || low === "null") return "";
  return s;
}

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event);
    const fileData = formData?.find((item) => item.name === "file");

    if (!fileData || !fileData.data) {
      throw createError({
        statusCode: 400,
        statusMessage: "Nenhum arquivo enviado.",
      });
    }

    const buffer = fileData.data as Buffer;

    // Salva arquivo temporário
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "excel-"));
    const tmpPath = path.join(tmpDir, "upload.xlsx");
    await writeFile(tmpPath, buffer);

    // Lê primeira planilha
    const df = (await (dfd as any).readExcel(tmpPath, {
      sheet: 0,
    })) as dfd.DataFrame;

    console.log("df shape", df.shape);
    (df as any).head(5).print();

    const typesRaw = df.columns as (string | number | boolean)[];
    const headersRaw = df.iloc({ rows: [0] }).values[0] as (
      | string
      | number
      | boolean
    )[];

    const types = typesRaw.map(normalizeType);
    const headers = headersRaw.map((h) => String(h));

    console.log("Tipos detectados:", types);
    console.log("Perguntas detectadas (headers):", headers);

    // Dados reais a partir da linha 1
    const dataDf = df.iloc({ rows: ["1:"] }) as dfd.DataFrame;
    const renamedDataDf = new dfd.DataFrame(dataDf.values, {
      columns: headers,
    });

    const quantitativeKPIs: any[] = [];
    const qualitativeData: any[] = [];
    const summaryLines: string[] = [];

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (Array.isArray(header)) continue;
      const type = types[i] || "";
      if (!header || isMetadataColumn(header)) continue;

      const series = renamedDataDf.column(header).dropNa();
      const n = series.count();
      if (n === 0) continue;

      summaryLines.push(`${header} — tipo: ${type || "desconhecido"} — N=${n}`);

      // --- Qualitativo: qualquer opentext (com ou sem sufixo) ---
      if (type.startsWith("opentext")) {
        qualitativeData.push({
          pergunta: header,
          respostas: series.values
            .map(cleanCellValue)
            .filter((s: string) => !!s),
          type,
          n,
          order: i,
        });
        continue; // NÃO entra em quantitativeKPIs
      }

      // --- Quantitativo ---
      let distribution: Record<string, number> = {};

      if (type.startsWith("multiplechoice")) {
        // Divide por vírgula ou ponto e vírgula; limpa tokens
        const exploded = series.values.flatMap((v: any) =>
          String(v).split(/[,;]+/).map(sanitizeToken).filter(Boolean)
        );
        const vc = new dfd.Series(exploded).valueCounts() as any;
        if (Array.isArray(vc?.index) && Array.isArray(vc?.values)) {
          for (let j = 0; j < vc.index.length; j++) {
            const key = sanitizeToken(vc.index[j]);
            const count = Number(vc.values[j] ?? 0);
            if (key && count > 0) distribution[key] = count;
          }
        }
      } else {
        const vc = series.valueCounts() as any;

        if (Array.isArray(vc?.columns) && Array.isArray(vc?.values)) {
          // DataFrame: vc.values => [[key, count], ...]
          const keyIdx = 0;
          const countIdx = vc.columns.length > 1 ? 1 : 0;
          for (const row of vc.values as any[][]) {
            const key = sanitizeToken(row[keyIdx]);
            const count = Number(row[countIdx] ?? 0);
            if (key && count > 0) distribution[key] = count;
          }
        } else if (Array.isArray(vc?.index) && Array.isArray(vc?.values)) {
          // Series: index/values
          const keys: any[] = vc.index;
          const counts: any[] = vc.values;
          for (let j = 0; j < keys.length; j++) {
            const key = sanitizeToken(keys[j]);
            const count = Number(counts[j] ?? 0);
            if (key && count > 0) distribution[key] = count;
          }
        }
      }

      const kpi: any = {
        metric: header,
        details: `N=${n} respostas`,
        distribution,
        type,
        n,
        order: i,
      };

      // Escala numérica com média + distribuição
      if (type.startsWith("rating") || type.startsWith("opinionscale")) {
        const numericSeries = (series as unknown as dfd.Series)
          .asType("float32")
          .dropNa();
        if (numericSeries.count() > 0) {
          kpi.value = Number(numericSeries.mean()).toFixed(1);

          const vcNum = (numericSeries as any).valueCounts();
          const dist: Record<string, number> = {};
          if (Array.isArray(vcNum?.index) && Array.isArray(vcNum?.values)) {
            for (let j = 0; j < vcNum.index.length; j++) {
              const key = sanitizeToken(vcNum.index[j]);
              const count = Number(vcNum.values[j] ?? 0);
              if (key && count > 0) dist[key] = count;
            }
          }
          kpi.distribution = dist;
        }
      } else if (type.startsWith("multiplechoice")) {
        if (Object.keys(distribution).length > 0) {
          kpi.value = Object.entries(distribution).sort(
            (a, b) => b[1] - a[1]
          )[0][0];
        } else {
          kpi.value = "";
        }
      }

      quantitativeKPIs.push(kpi);
    }

    const text = [
      "Pesquisa importada via Excel.",
      "Perguntas e amostras detectadas:",
      ...summaryLines,
    ].join("\n");

    const formatted =
      `# Pesquisa importada via Excel\n\n` +
      `## Quantitativo\n` +
      quantitativeKPIs
        .map(
          (kpi) =>
            `**${kpi.metric}** (N=${kpi.n}, tipo: ${kpi.type})\n` +
            (kpi.value ? `Valor: ${kpi.value}\n` : ``) +
            (Object.keys(kpi.distribution || {}).length > 0
              ? "Distribuição:\n" +
                Object.entries(kpi.distribution)
                  .map(([opt, cnt]) => `- ${opt}: ${cnt}`)
                  .join("\n")
              : ``)
        )
        .join("\n\n") +
      `\n\n## Qualitativo\n` +
      qualitativeData
        .map(
          (q) =>
            `**${q.pergunta}** (N=${q.n})\n` +
            q.respostas.map((r: string) => `- ${r}`).join("\n")
        )
        .join("\n\n");

    rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    return {
      text,
      formatted,
      structured_data: { quantitativeKPIs, qualitativeData },
      quantitativeKPIs,
      qualitativeData,
    };
  } catch (error: any) {
    console.error("Erro ao processar arquivo Excel:", error);
    throw createError({
      statusCode: 500,
      statusMessage: `Erro ao processar arquivo Excel: ${error.message}`,
    });
  }
});
