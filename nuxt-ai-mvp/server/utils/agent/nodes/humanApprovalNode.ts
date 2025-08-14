// server/utils/agent/nodes/humanApprovalNode.ts

import { interrupt } from "@langchain/langgraph";
import type { PlanExecuteState } from "../graphState";
import { consola } from "consola";
import type { SideEffect } from "~/lib/sideEffects";

function buildDiff(currentData: any = {}, newData: any = {}) {
  const diff: Array<{ field: string; from: any; to: any }> = [];
  const keys = Object.keys(newData || {});
  for (const k of keys) {
    const fromVal = currentData?.[k];
    const toVal = (newData as any)[k];
    if (fromVal !== toVal) {
      diff.push({ field: k, from: fromVal, to: toVal });
    }
  }
  return diff;
}

function makeSummary(
  params: any,
  diff: Array<{ field: string; from: any; to: any }>
) {
  try {
    if (diff?.length) {
      const titleChange = diff.find((d) => d.field === "title");
      if (titleChange) return `Título → “${titleChange.to}”`;
    }
    const op = params?.operation || "update";
    const nodeType = params?.nodeType || "node";
    return `${nodeType}.${op}`;
  } catch {
    return "Confirma a alteração?";
  }
}

export async function humanApprovalNode(
  state: PlanExecuteState
): Promise<Partial<PlanExecuteState>> {
  consola.info(
    "[humanApprovalNode] Estado RECEBIDO:",
    JSON.stringify(state, null, 2)
  );

  const existingMessages = state.messages || [];
  const proposal = (state as any).pending_confirmation;
  const proposalKind = (proposal as any)?.kind;
  const isAskClarify = proposalKind === "ASK_CLARIFY";

  // Normalize proposal for alignment with pending_execute, if present
  const pendingExec = (state as any).pending_execute;
  let normalizedProposal: any = proposal ? { ...(proposal as any) } : null;

  if (!isAskClarify && proposal && pendingExec?.parameters) {
    const execParams = pendingExec.parameters;

    // Find current node data to compute proper diff
    const nodes: any[] = (state as any)?.canvasContext?.nodes || [];
    const currentNode = nodes.find((n: any) => n?.id === execParams?.nodeId);
    const currentData = currentNode?.data || {};

    const diff = buildDiff(currentData, execParams?.newData || {});
    const correlationId =
      (state as any).correlationId ||
      (proposal as any).correlationId ||
      (pendingExec as any).correlationId;

    normalizedProposal = {
      render: (proposal as any).render || "modal",
      parameters: execParams, // ← keep EXACTLY the same params as EXECUTE_ACTION
      diff, // ← freshly built diff
      summary: makeSummary(execParams, diff),
      nodeId: execParams?.nodeId,
      ...(correlationId ? { correlationId } : {}),
    };
  }

  // 1) Sem proposta → nada a fazer
  if (!proposal) {
    consola.warn(
      "[humanApprovalNode] Chamado sem proposta pendente. Seguindo em frente."
    );
    return {};
  }

  // 2) Primeira passagem: interrompe para aguardar confirmação do usuário.
  consola.info(
    "[humanApprovalNode] Interrompendo execução para aguardar confirmação do usuário."
  );
  const toLog = normalizedProposal || proposal;
  consola.debug(
    "[humanApprovalNode] Proposta:",
    JSON.stringify(
      {
        render: (toLog as any)?.render, // "chat" | "modal"
        summary: (toLog as any)?.summary,
        kind: (toLog as any)?.kind,
        questionsCount: Array.isArray((toLog as any)?.questions)
          ? (toLog as any)?.questions.length
          : undefined,
        hasDiff: Boolean((toLog as any)?.diff),
        op: (toLog as any)?.parameters?.operation, // create|update|patch|delete
        nodeType: (toLog as any)?.parameters?.nodeType,
        nodeId: (toLog as any)?.parameters?.nodeId,
      },
      null,
      2
    )
  );

  // ⚠️ Padrão correto: Aguardar o resume do client
  const decision = await interrupt((normalizedProposal ?? proposal) as any);

  consola.info(
    "[humanApprovalNode] Decision recebida na retomada:",
    JSON.stringify(decision, null, 2)
  );

  // 3) Processa o valor retornado no resume: { confirmed: boolean, approved_action?: {...} }
  if (
    decision &&
    typeof decision === "object" &&
    "confirmed" in (decision as any)
  ) {
    const confirmed = Boolean((decision as any).confirmed);

    // Handle ASK_CLARIFY flow: do NOT execute tools yet; return answers to the agent
    if (isAskClarify) {
      if (confirmed) {
        const answers = (decision as any)?.answers ?? {};
        const retForClarify: Partial<PlanExecuteState> = {
          pending_confirmation: null,
          pending_execute: null,
          // hand back answers so agentNode can move to PROPOSE_PATCH phase
          // (agentNode should read `clarify_result` if present)
          ...(answers
            ? { clarify_result: { kind: "ASK_CLARIFY", answers } as any }
            : {}),
          sideEffects: [
            { type: "CLOSE_MODAL", payload: {} } as any,
            {
              type: "POST_MESSAGE",
              payload: {
                text: "Obrigado! Vou propor uma atualização com base nas suas respostas.",
              },
            } as any,
          ],
          input: "",
          messages: existingMessages,
        };
        consola.info(
          "[humanApprovalNode] ASK_CLARIFY confirmado. Respostas recebidas e devolvidas ao agente."
        );
        return retForClarify;
      } else {
        const retCanceled: Partial<PlanExecuteState> = {
          pending_confirmation: null,
          pending_execute: null,
          sideEffects: [
            { type: "CLOSE_MODAL", payload: {} } as any,
            {
              type: "POST_MESSAGE",
              payload: {
                text: "Ok! Não vou prosseguir com o refinamento agora.",
              },
            } as any,
          ],
          input: "",
          messages: existingMessages,
        };
        consola.info("[humanApprovalNode] ASK_CLARIFY cancelado pelo usuário.");
        return retCanceled;
      }
    }

    if (confirmed) {
      // Use exactly the approved action coming from the client resume (front-end)
      const approved = (decision as any).approved_action ?? {
        tool_name: "nodeTool",
        parameters: (proposal as any)?.parameters ?? {},
        displayMessage: "Ação aprovada",
      };

      const op = (approved as any)?.parameters?.operation;
      const nodeType = (approved as any)?.parameters?.nodeType;
      const targetNodeId = (approved as any)?.parameters?.nodeId;

      // Front-only path for delete operations (no tool execution)
      if (op === "delete") {
        const retForDelete: Partial<PlanExecuteState> = {
          pending_confirmation: null,
          pending_execute: null,
          sideEffects: [
            { type: "CLOSE_MODAL", payload: {} } as any,
            // Front-end should handle this by removing the node and updating edges/state locally
            {
              type: "DELETE_NODE",
              payload: { nodeId: targetNodeId, nodeType },
            } as any,
            { type: "POST_MESSAGE", payload: { text: "✅ Deletado." } } as any,
          ],
          input: "",
          messages: existingMessages,
        };
        consola.info(
          "[humanApprovalNode] Confirmado (front-only delete). Emitting DELETE_NODE for:",
          JSON.stringify({ nodeType, nodeId: targetNodeId }, null, 2)
        );
        return retForDelete;
      }

      // Strong safety: log what will actually be executed
      try {
        consola.info(
          "[humanApprovalNode] Using approved action from resume.",
          JSON.stringify(
            {
              tool: approved.tool_name,
              nodeType: (approved as any)?.parameters?.nodeType,
              nodeId: (approved as any)?.parameters?.nodeId,
              operation: (approved as any)?.parameters?.operation,
              newData: (approved as any)?.parameters?.newData,
            },
            null,
            2
          )
        );
      } catch {}

      const execEffect: SideEffect = {
        type: "EXECUTE_ACTION",
        payload: {
          tool_name: (approved as any).tool_name,
          parameters: {
            ...(approved as any).parameters,
            // Flags used by the client / tool node to mark approval path
            isApprovedOperation: true,
            isApprovedUpdate: true,
          },
          feedbackMessage:
            (approved as any).displayMessage || "✅ Problema atualizado.",
        },
      } as any;

      const ret: Partial<PlanExecuteState> = {
        // We already scheduled execution via side effect; avoid duplicate runs
        pending_confirmation: null,
        pending_execute: null,
        sideEffects: [
          { type: "CLOSE_MODAL", payload: {} } as SideEffect,
          execEffect,
          {
            type: "POST_MESSAGE",
            payload: { text: "Ação confirmada!" },
          } as SideEffect,
        ],
        input: "", // evita reprocessar o input anterior
        messages: existingMessages,
      };

      consola.info(
        "[humanApprovalNode] Confirmado. EXECUTE_ACTION emitido com:",
        JSON.stringify(execEffect.payload, null, 2)
      );

      return ret;
    } else {
      const ret: Partial<PlanExecuteState> = {
        pending_confirmation: null,
        pending_execute: null,
        sideEffects: [
          { type: "POST_MESSAGE", payload: { text: "Ação cancelada." } },
          { type: "CLOSE_MODAL", payload: {} },
        ] as SideEffect[],
        input: "",
        messages: existingMessages,
      };
      consola.info("[humanApprovalNode] Cancelado pelo usuário.");
      return ret;
    }
  }

  // 4) Se a retomada não trouxe o shape esperado, preserva a proposta
  consola.warn(
    "[humanApprovalNode] Resume sem shape esperado; mantendo proposta pendente."
  );
  return { pending_confirmation: (normalizedProposal ?? proposal) as any };
}
