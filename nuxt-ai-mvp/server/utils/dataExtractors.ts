// server/utils/dataExtractors.ts
import { promises as fs } from "fs";
import path from "path";
import type { Extractor } from "./extractors/types";
import { fileURLToPath } from "url";

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Registry dinâmico de extractors
export const dataExtractors: Record<string, Extractor> = {};

// Extrator de fallback para categorias desconhecidas
export const defaultExtractor: Extractor = {
  category: "default",
  sourceType: "generic_text",
  extract: (ancestorOutput) => {
    const content = JSON.stringify(ancestorOutput);
    console.warn(
      `Usando extrator de fallback para dados: ${content.substring(0, 200)}...`
    );
    return [
      {
        sourceType: "generic_text",
        content,
        preview: `Dados genéricos: ${content.substring(0, 100)}...`,
      },
    ];
  },
};

// Carrega os extractors existentes no diretório ./extractors
async function loadExtractors() {
  const extractorsDir = path.resolve(process.cwd(), "server/utils/extractors");

  try {
    const files = (await fs.readdir(extractorsDir)).filter((f) =>
      f.endsWith(".js")
    );

    for (const file of files) {
      if (file !== "types.js") {
        const modulePath = path.join(extractorsDir, file);
        const mod = await import(modulePath);

        if (mod.default && mod.default.category) {
          dataExtractors[mod.default.category] = mod.default as Extractor;
        }
      }
    }
  } catch (err) {
    console.error("Falha ao carregar extractors:", err);
  }
}

// Dispara o carregamento assíncrono; não precisamos de top‑level await
loadExtractors().catch((err) =>
  console.error("Erro ao inicializar extractors:", err)
);
