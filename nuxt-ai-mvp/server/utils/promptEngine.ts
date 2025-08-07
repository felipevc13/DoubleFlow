// Em server/utils/promptEngine.ts

import { promises as fs } from "fs";
import path from "path";

// --- Constantes de caminho ---
const PROMPTS_DIR = path.resolve(process.cwd(), "lib/prompts");

// --- Cache simples para arquivos lidos ---
const fileCache: Record<string, string> = {};

/**
 * Lê o conteúdo de um arquivo de prompt da pasta 'base', usando cache.
 * @param templateKey - O nome do arquivo sem a extensão .md (ex: "refineProblemStatement")
 */
async function loadPromptTemplate(templateKey: string): Promise<string> {
  const filePath = path.resolve(PROMPTS_DIR, `${templateKey}.md`);
  if (fileCache[filePath]) {
    return fileCache[filePath];
  }
  try {
    const content = await fs.readFile(filePath, "utf-8");
    fileCache[filePath] = content;
    return content;
  } catch (err) {
    throw new Error(`Arquivo de prompt não encontrado: ${filePath}`);
  }
}

/**
 * Gera um prompt final substituindo placeholders em um template.
 * NÃO processa partials ou qualquer outra lógica complexa.
 * @param templateKey - A chave do template a ser carregado (ex: "refineProblemStatement").
 * @param data - Um objeto com os valores para os placeholders (ex: { currentTitle: "..." }).
 */
export async function generateFinalPrompt(
  templateKey: string,
  data: Record<string, any>
): Promise<string> {
  let template = await loadPromptTemplate(templateKey);

  // Substitui placeholders do tipo {{placeholder}}
  template = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : "";
  });

  return template;
}
