// server/utils/agent/refinements/problemRefinement.ts

import fs from "node:fs";
import path from "node:path";
import registry from "~/server/utils/agent/registry/nodeTypes.json" assert { type: "json" };
import { consola } from "consola";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cleanToolSchema } from "~/server/utils/cleanToolSchema";
import type { PlanExecuteState, ActionProposal } from "../graphState";

// Carrega o prompt de refinamento do arquivo, como antes
const promptPath = path.resolve(
  "server/utils/agent/prompts",
  registry.problem.actions.update.refinementPrompt
);
const problemSystemPrompt = fs.readFileSync(promptPath, "utf8");

const ProblemRefinementSchema = z.object({
  title: z
    .string()
    .min(3)
    .max(80)
    .describe("O novo título conciso para o problema."),
  description: z
    .string()
    .min(10)
    .max(300)
    .describe("A nova descrição detalhada do problema."),
});

const problemRefinementTool = {
  type: "function" as const,
  function: {
    name: "refine_problem_statement",
    description:
      "Refina o título e a descrição de um problema com base no input do usuário.",
    parameters: cleanToolSchema(zodToJsonSchema(ProblemRefinementSchema)),
  },
};

const problemPrompt = ChatPromptTemplate.fromMessages([
  ["system", problemSystemPrompt],
  ["human", "{userInput}"],
]);

/**
 * Função helper que usa uma LLM para refinar o título e a descrição do Problema Inicial.
 * Não é um nó do grafo, mas um especialista chamado pelo agentNode.
 * @param state O estado atual do agente.
 * @returns Uma proposta de ação para atualizar o nó ou um objeto de erro.
 */
export async function refineProblemHelper(
  state: PlanExecuteState
): Promise<ActionProposal | { error: string }> {
  consola.info("[refineProblemHelper] Iniciado");
  const nodeId = "problem-1";
  const existingProblem =
    state.canvasContext?.nodes?.find?.((n: any) => n.id === nodeId) ?? null;

  if (!existingProblem) {
    const errorMsg =
      "[refineProblemHelper] Nó de problema não encontrado no canvas";
    consola.warn(errorMsg, { nodeId, canvas: state.canvasContext });
    return { error: errorMsg };
  }

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash-latest",
    apiKey: process.env.GEMINI_API_KEY,
    temperature: 0.3,
  }).bind({
    tools: [problemRefinementTool],
    tool_choice: "refine_problem_statement",
  });

  const chain = problemPrompt.pipe(model);
  const raw: any = await chain.invoke({
    userInput: state.input,
    currentTitle: existingProblem?.data?.title ?? "",
    currentDescription: existingProblem?.data?.description ?? "",
  });

  const toolCall = raw.tool_call ?? raw.tool_calls?.[0];

  if (toolCall?.name !== "refine_problem_statement") {
    const errorMsg =
      "[refineProblemHelper] Nome do tool_call inesperado ou ausente";
    consola.error(errorMsg, { toolCall });
    return { error: errorMsg };
  }

  try {
    const parsed = ProblemRefinementSchema.parse(
      toolCall.arguments ?? toolCall.args
    );
    const cleanString = (str: string) =>
      typeof str === "string" ? str.replace(/^"(.*)"$/, "$1").trim() : str;
    parsed.title = cleanString(parsed.title);
    parsed.description = cleanString(parsed.description);

    consola.info(
      "[refineProblemHelper] Proposta de alteração pronta para retorno",
      { parsed }
    );

    // Retorna a proposta de ação para o agentNode lidar com ela
    return {
      tool_name: "problem.update",
      parameters: {
        taskId: state.canvasContext?.task_id,
        nodeId,
        newData: {
          title: parsed.title,
          description: parsed.description,
        },
        isApprovedUpdate: true,
      },
      displayMessage:
        "A IA propõe as seguintes alterações no Problema Inicial. Você aprova?",
    };
  } catch (e) {
    const errorMsg = "[refineProblemHelper] Erro ao parsear dados do modelo";
    consola.error(errorMsg, { error: e, toolCall });
    return { error: errorMsg };
  }
}
