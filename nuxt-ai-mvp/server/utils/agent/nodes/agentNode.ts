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
    if (action === "create") {
      if (filledArgs.sourceNodeId === undefined) {
        filledArgs.sourceNodeId = lastNode?.id ?? problemId ?? undefined;
      }
    } else if (action === "delete" || action === "update") {
      if (!filledArgs.nodeId) {
        const lastOfType = state.canvasContext?.nodes
          ?.slice()
          ?.reverse()
          ?.find((n: any) => n.type === target?.type);
        if (lastOfType) filledArgs.nodeId = lastOfType.id;
      }
    }
    const completeParameters = {
      ...filledArgs,
      taskId: state.taskId,
      nodeId: target?.id,
      canvasContext: state.canvasContext,
    };

    const toolCall = {
      tool_name: actionId,
      parameters: completeParameters,
      displayMessage: `A IA propõe: ${actionId}. Você confirma?`,
      meta: meta,
    };

    const next_step = meta.requiresReplan ? "agentNode" : undefined;

    if (meta.needsApproval) {
      const targetNodeId = target?.id;
      const targetNode = targetNodeId
        ? state.canvasContext?.nodes?.find((n: any) => n.id === targetNodeId)
        : null;

      let proposal: any;

      // Decisão 100% guiada pela configuração!
      if (meta.approvalStyle === "visual" && targetNode) {
        proposal = {
          tool_name: actionId,
          parameters: {
            ...completeParameters,
            isApprovedUpdate: true,
          },
          displayMessage: `A IA propõe as seguintes alterações para '${
            targetNode.data?.title || targetNodeId
          }'. Você aprova?`,
          approvalStyle: "visual",
          nodeId: targetNodeId,
          modalTitle: meta.modalTitle || "Revisar Alterações Propostas",
          originalData: targetNode.data,
          proposedData: args?.newData ?? {},
          diffFields: meta.ui?.diffFields || [],
          meta,
        };
      } else {
        proposal = {
          tool_name: actionId,
          parameters: completeParameters,
          displayMessage: `A IA propõe: ${actionId}. Você confirma?`,
          approvalStyle: "text",
          meta,
        };
      }

      const sideEffects = targetNodeId
        ? generateUiPreparationEffects(state, targetNodeId)
        : [];

      return { sideEffects, pending_confirmation: proposal, next_step };
    } else {
      return { pending_execute: toolCall, next_step };
    }
  }

  // Rota 3: Fallback para Chat
  consola.info("[agentNode] Nenhuma ação clara, roteando para chatNode.");
  return { next_step: "chatNode" as any };
}
