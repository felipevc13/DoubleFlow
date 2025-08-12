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

// ------------------------------------------------------------------------------------------------
// 2. Zod schema for the classifier output
// ------------------------------------------------------------------------------------------------
export const IntentGenericSchema = z.object({
  target: z
    .object({
      type: z.string().optional(), // validated later
      id: z.string().optional(),
    })
    .optional(),
  action: z.string(), // validated later
  args: z.any().optional(),
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
- Se o pedido for para ajudar, refininar ou reescrever conteúdo, defina "refinement": true.
- Se a solicitação for uma ação direta (create/update/delete) SEM pedido explícito de reescrita ou melhoria, mantenha "refinement": false.

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
`.trim();

// ------------------------------------------------------------------------------------------------
// 4. LLM models & cache
// ------------------------------------------------------------------------------------------------
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
    if (!allActions.includes(parsed.action)) {
      parsed.action = "chat";
    }
    if (
      parsed.target?.type &&
      !allNodeTypes.includes(parsed.target.type as any)
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

    // Extra safety: deletar SEM id explícito pode gerar ambiguidade
    if (parsed.action === "delete" && !parsed.target?.id) {
      parsed.action = "chat";
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
