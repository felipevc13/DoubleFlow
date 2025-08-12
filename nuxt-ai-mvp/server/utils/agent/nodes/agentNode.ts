// server/utils/agent/nodes/agentNode.ts

import { consola } from "consola";
import type { PlanExecuteState } from "../graphState";
import {
  classifyIntentGenericRunnable,
  toolLookup,
} from "~/server/api/ai/classifyIntentGeneric";
// ✅ IMPORT CORRIGIDO
import { refineProblemHelper } from "../refinements/problemRefinement";
import type { SideEffect } from "~/lib/sideEffects";
import { generateUiPreparationEffects } from "../uiEffectManager";

export async function agentNode(
  state: PlanExecuteState
): Promise<Partial<PlanExecuteState>> {
  consola.info("[agentNode] Analisando input e contexto...");

  const classification = await classifyIntentGenericRunnable.invoke({
    userInput: state.input,
    canvasContext: state.canvasContext ?? {},
  });

  const { action, target, args, refinement } = classification;

  // Rota 1: Refinamento de Conteúdo
  if (refinement && target?.type === "problem") {
    consola.info(
      "[agentNode] Roteando para lógica de refinamento do problema."
    );

    // ✅ CHAMADA CORRIGIDA para o helper importado
    const proposal = await refineProblemHelper(state);

    if ("error" in proposal) {
      return {
        sideEffects: [
          {
            type: "POST_MESSAGE",
            payload: { text: `❌ Erro no refinamento: ${proposal.error}` },
          },
        ],
      };
    }

    const sideEffects = generateUiPreparationEffects(
      state,
      proposal.parameters.nodeId
    );
    return { sideEffects, pending_confirmation: proposal };
  }

  // ... (o resto do arquivo `agentNode` permanece o mesmo) ...

  // Rota 2: Se a intenção é uma chamada de ferramenta (criar, deletar, etc.)
  // 🚧 Política: nó "problem" não pode ser criado nem deletado
  if (
    target?.type === "problem" &&
    (action === "create" || action === "delete")
  ) {
    return {
      sideEffects: [
        {
          type: "POST_MESSAGE",
          payload: {
            text: "❌ Ação inválida: o nó 'problema' não pode ser criado nem removido.",
          },
        },
      ],
      // mantém fluxo no chat para novas instruções
      next_step: "chatNode" as any,
    };
  }
  const actionId = `${target?.type}.${action}`;
  const meta = toolLookup[actionId];

  if (meta) {
    // Preenchimento básico de parâmetros quando o classificador não forneceu ids
    const lastNode = state.canvasContext?.nodes?.at?.(-1);
    const problemId = state.canvasContext?.problem_statement?.id;
    const filledArgs = { ...(args || {}) };

    // Descobrir nodeId de destino quando não informado (para update/delete)
    let resolvedNodeId = filledArgs.nodeId ?? target?.id;
    if (!resolvedNodeId && (action === "update" || action === "delete")) {
      const lastOfType = state.canvasContext?.nodes
        ?.slice()
        ?.reverse()
        ?.find((n: any) => n.type === target?.type);
      resolvedNodeId = lastOfType?.id;
    }

    // Monta parâmetros esperados pelo nodeTool (server‑driven)
    const parameters: any = {
      taskId: state.taskId,
      nodeType: target?.type,
      operation: action, // "create" | "update" | "patch" | "delete"
    };

    if (action === "create") {
      parameters.newData = filledArgs.newData ?? {};
      parameters.parentId =
        filledArgs.sourceNodeId ?? lastNode?.id ?? problemId ?? null;
    } else if (action === "update") {
      parameters.nodeId = resolvedNodeId;
      parameters.newData = filledArgs.newData ?? args?.newData ?? {};
    } else if (action === "patch") {
      parameters.nodeId = resolvedNodeId;
      parameters.patch = filledArgs.patch ?? args?.patch ?? [];
    } else if (action === "delete") {
      parameters.nodeId = resolvedNodeId;
    }

    // 🔗 encaminha contexto atual para o backend (ajuda a montar diff/approval)
    parameters.canvasContext = state.canvasContext;

    const toolCall = {
      tool_name: "nodeTool", // 🔑 unificada
      parameters,
      displayMessage: `A IA propõe: ${actionId}. Você confirma?`,
      meta,
    };

    // Sempre deixa a aprovação para o servidor (nodeTool)
    const targetNodeId = parameters.nodeId;
    const sideEffects = targetNodeId
      ? generateUiPreparationEffects(state, targetNodeId)
      : [];

    return { sideEffects, pending_execute: toolCall };
  }

  // Rota 3: Fallback para Chat
  consola.info("[agentNode] Nenhuma ação clara, roteando para chatNode.");
  return { next_step: "chatNode" as any };
}
