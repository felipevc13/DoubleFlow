/**
 * Generic intent‑classifier that derives valid node/action pairs
 * directly from the node‑catalog (`config/nodeTypes-raw`).
 *
 * It replaces the previous enum‑based classifier, so no code changes
 * are needed when new nodes or actions are added to the catalog.
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RunnablePassthrough } from "@langchain/core/runnables";
import memoizee from "memoizee";
import { z } from "zod";

// ------------------------------------------------------------------------------------------------
// 1. Load catalog and build helper maps
// ------------------------------------------------------------------------------------------------
import nodeTypesRaw from "~/config/nodeTypes-raw";
const nodeCatalog = nodeTypesRaw as Record<string, any>;

type Catalog = typeof nodeCatalog;

export const allNodeTypes = Object.keys(nodeCatalog) as (keyof Catalog)[];

export const allActions = allNodeTypes.flatMap((t) =>
  Object.keys(nodeCatalog[t].operations)
);

export const toolLookup: Record<string, any> = allNodeTypes.reduce(
  (acc, type) => {
    Object.entries(nodeCatalog[type].operations).forEach(([action, spec]) => {
      acc[`${type}.${action}`] = {
        ...(typeof spec === "object" && spec !== null ? spec : {}),
        ui: nodeCatalog[type].ui || {},
      };
    });
    return acc;
  },
  {} as Record<string, any>
);

// Build synonyms from catalog aliases so the model can map natural language to types
const aliasPairs: Array<{ alias: string; type: string }> = [];
for (const type of Object.keys(nodeCatalog)) {
  const aliases: string[] = (nodeCatalog as any)[type]?.aliases ?? [];
  aliases
    .filter((a) => typeof a === "string" && a.trim())
    .forEach((alias) => aliasPairs.push({ alias: alias.toLowerCase(), type }));
}
const synonymsBlock =
  aliasPairs.length > 0
    ? "\nSinônimos (mapear para target.type correspondente):\n" +
      aliasPairs.map((a) => `- "${a.alias}" => "${a.type}"`).join("\n") +
      "\n"
    : "";

// ------------------------------------------------------------------------------------------------
// 2. Zod schema for the classifier output
// ------------------------------------------------------------------------------------------------
const ArgsSchema = z
  .object({
    // quando ação direta:
    newData: z.record(z.any()).optional(),

    // quando refinamento:
    scopedTo: z.enum(["title", "description", "both"]).optional(),
  })
  .partial();

export const IntentGenericSchema = z.object({
  target: z
    .object({
      type: z.string().optional(), // validated later
      id: z.string().optional(),
    })
    .optional(),
  action: z.string(), // validated later
  args: ArgsSchema.optional(),
  refinement: z.boolean().optional().default(false),
});

// ------------------------------------------------------------------------------------------------
// 3. Prompt template
// ------------------------------------------------------------------------------------------------
const promptSystem = `
Você é um classificador de intenções para um canvas visual.
Retorne APENAS um JSON que siga estritamente o schema abaixo.
NÃO escreva explicações fora do bloco JSON.

<schema>
${JSON.stringify(IntentGenericSchema)}
</schema>

Regras:
- "action" DEVE ser um dos seguintes: ${allActions.join(", ")}.
- Se a ação for específica a um nó, inclua "target.type" (por ex.: "problem").
- Se o usuário mencionar um id de nó, inclua "target.id".
- Se a ação for "create" ou "update", TODOS os campos de dados DEVEM estar dentro de "args.newData".
- Se o pedido for para ajudar, refinar, reescrever, melhorar, clarificar, ou pedir sugestões, defina "refinement": true.
- Quando "refinement" for true, inclua em "args.scopedTo" um destes: "title", "description" ou "both".
- Se a solicitação for uma ação direta (create/update/delete) SEM pedido explícito de reescrita ou melhoria, mantenha "refinement": false.
- Se houver menções que sejam sinônimos de tipos conhecidos, mapeie para o tipo correto.
${synonymsBlock}

### Exemplos
Usuário: "mude o título do problema para Mangaba"
Resposta:
{
  "target": { "type": "problem" },
  "action": "update",
  "args": { "newData": { "title": "Mangaba" } },
  "refinement": false
}

Usuário: "crie um data source chamado Arquivos de Pesquisa"
Resposta:
{
  "target": { "type": "dataSource" },
  "action": "create",
  "args": { "newData": { "title": "Arquivos de Pesquisa", "sources": [] } },
  "refinement": false
}

Usuário: "apaga este data source"
Resposta:
{
  "target": { "type": "dataSource", "id": "dataSource-42" },
  "action": "delete",
  "args": {},
  "refinement": false
}

Usuário: "Me ajuda a refinar o problema (só o título)"
Resposta:
{
  "target": { "type": "problem" },
  "action": "update",
  "args": { "scopedTo": "title" },
  "refinement": true
}
`.trim();

// ------------------------------------------------------------------------------------------------
// 4. LLM models & cache
// ------------------------------------------------------------------------------------------------
function pickUniqueNodeId(ctx: any, type: string): string | undefined {
  const nodes: any[] = Array.isArray(ctx?.nodes) ? ctx.nodes : [];
  const hits = nodes.filter((n) => n?.type === type);
  return hits.length === 1 ? hits[0].id : undefined;
}

const modelFlash = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash-latest",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0,
  maxOutputTokens: 120,
});

const classify = memoizee(
  async (userInput: string, canvasContext: any = {}) => {
    const question = `
USER: ${userInput}
CANVAS: ${JSON.stringify(canvasContext)}
    `.trim();

    const resp = await modelFlash.invoke([
      ["system", promptSystem],
      ["human", question],
    ]);

    const rawContent = resp.content?.toString().trim() ?? "";

    // ── Extract JSON ────────────────────────────────────────────────────────────────
    const jsonMatch = rawContent.match(/```(?:json)?\s*({[\s\S]*?})\s*```/s);
    const jsonString = jsonMatch?.[1]
      ? jsonMatch[1]
      : rawContent.slice(
          rawContent.indexOf("{"),
          rawContent.lastIndexOf("}") + 1
        );

    let parsed: z.infer<typeof IntentGenericSchema>;
    try {
      parsed = IntentGenericSchema.parse(JSON.parse(jsonString));
    } catch (err) {
      // Fallback: if output invalid, treat everything as chat
      return {
        action: "chat",
      } as z.infer<typeof IntentGenericSchema>;
    }

    // ── Dynamic validation ─────────────────────────────────────────────────────────
    // Normalize common casing/alias issues: "datasource", "data", "card de dados" => "dataSource"
    if (parsed?.target?.type) {
      const x = String(parsed.target.type).toLowerCase();
      if (
        [
          "datasource",
          "data",
          "data_card",
          "card de dados",
          "card-de-dados",
          "data source",
        ].includes(x)
      ) {
        parsed.target.type = "dataSource";
      }
    }
    // extra normalizações comuns
    if (parsed?.target?.type) {
      const y = String(parsed.target.type).toLowerCase();
      if (["problema", "problem", "issue"].includes(y))
        parsed.target.type = "problem";
      if (["análise", "analise", "analysis"].includes(y))
        parsed.target.type = "analysis";
    }
    if (!allActions.includes(parsed.action)) {
      parsed.action = "chat";
    }
    if (
      parsed.target?.type &&
      !(allNodeTypes as string[]).includes(parsed.target.type as any)
    ) {
      delete parsed.target;
    }

    // If the inferred action needs an explicit target but none was identified,
    // treat the utterance as regular chat to avoid mis‑routing.
    const actionsRequiringTarget = ["create", "update", "delete"];
    if (
      actionsRequiringTarget.includes(parsed.action) &&
      !parsed.target?.type
    ) {
      parsed.action = "chat";
    }

    // se ação exige id e há exatamente um nó do tipo, preenche automaticamente
    const needsId = parsed.action === "delete" || parsed.action === "update";
    if (needsId && parsed.target?.type && !parsed.target?.id) {
      const onlyId = pickUniqueNodeId(canvasContext, parsed.target.type);
      if (onlyId) {
        parsed.target = { ...parsed.target, id: onlyId };
      }
    }

    return parsed;
  },
  { maxAge: 1000 * 60 } // 1 minuto de cache
);

// ------------------------------------------------------------------------------------------------
// 5. Runnable to plug into LangGraph
// ------------------------------------------------------------------------------------------------
export const classifyIntentGenericRunnable = new RunnablePassthrough().pipe(
  async (i: { userInput: string | object; canvasContext?: any }) => {
    if (typeof i.userInput === "object" && i.userInput !== null) {
      try {
        return IntentGenericSchema.parse(i.userInput);
      } catch {
        /* fallthrough */
      }
    }
    const inputString =
      typeof i.userInput === "string"
        ? i.userInput
        : JSON.stringify(i.userInput);

    return classify(inputString, i.canvasContext ?? {});
  }
);
