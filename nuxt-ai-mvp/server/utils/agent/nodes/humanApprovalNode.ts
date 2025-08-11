// server/utils/agent/nodes/humanApprovalNode.ts

import { interrupt } from "@langchain/langgraph";
import type { PlanExecuteState } from "../graphState";
import { consola } from "consola";
import type { SideEffect } from "~/lib/sideEffects";

export async function humanApprovalNode(
  state: PlanExecuteState
): Promise<Partial<PlanExecuteState>> {
  consola.info(
    "[humanApprovalNode] Estado RECEBIDO:",
    JSON.stringify(state, null, 2)
  );

  const existingMessages = state.messages || [];
  const proposal = (state as any).pending_confirmation;

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
  consola.debug(
    "[humanApprovalNode] Proposta:",
    JSON.stringify(
      {
        tool_name: (proposal as any)?.tool_name,
        nodeId: (proposal as any)?.nodeId,
        approvalStyle: (proposal as any)?.approvalStyle,
        diffFields: Array.isArray((proposal as any)?.diffFields)
          ? (proposal as any).diffFields
          : undefined,
      },
      null,
      2
    )
  );

  // ⚠️ Padrão correto: Aguardar o resume do client
  const decision = await interrupt(proposal as any);

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

    if (confirmed) {
      const approved = (decision as any).approved_action || null; // { tool_name, parameters, nodeId }
      const ret: Partial<PlanExecuteState> = {
        pending_confirmation: null,
        pending_execute: approved,
        sideEffects: [
          { type: "POST_MESSAGE", payload: { text: "Ação confirmada!" } },
          { type: "CLOSE_MODAL", payload: {} },
        ] as SideEffect[],
        input: "", // evita reprocessar o input anterior
        messages: existingMessages,
      };
      consola.info(
        "[humanApprovalNode] Confirmado. pending_execute montado:",
        JSON.stringify(ret.pending_execute, null, 2)
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
  return { pending_confirmation: proposal };
}
