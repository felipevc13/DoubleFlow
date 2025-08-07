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
  const userDecision = state.input as any;
  const existingMessages = state.messages || [];

  // FASE 2: Processa a resposta do usuário (retomada do grafo)
  if (userDecision && typeof userDecision.confirmed === "boolean") {
    if (userDecision.confirmed === true) {
      consola.info(
        "[humanApprovalNode] Ação confirmada pelo usuário. Preparando para execução."
      );
      const ret: Partial<PlanExecuteState> = {
        pending_execute: userDecision.action,
        pending_confirmation: null, // Limpa a confirmação pendente
        sideEffects: [
          { type: "POST_MESSAGE", payload: { text: "Ação confirmada!" } },
          { type: "CLOSE_MODAL", payload: {} },
        ] as SideEffect[],
        input: "", // Limpa o input para não ser reprocessado
        messages: existingMessages,
      };
      consola.info(
        "[humanApprovalNode] Estado RETORNADO (Confirmado):",
        JSON.stringify(ret, null, 2)
      );
      consola.info(
        "[humanApprovalNode] pending_execute montado:",
        JSON.stringify(ret.pending_execute, null, 2)
      );
      consola.info(
        "[humanApprovalNode] parâmetros recebidos na confirmação:",
        JSON.stringify(userDecision, null, 2)
      );
      consola.debug("[humanApprovalNode] (CONFIRMADO) Retornando estado:", ret);
      return ret;
    } else {
      consola.info("[humanApprovalNode] Ação cancelada pelo usuário.");
      const ret: Partial<PlanExecuteState> = {
        pending_execute: null,
        pending_confirmation: null,
        sideEffects: [
          { type: "POST_MESSAGE", payload: { text: "Ação cancelada." } },
          { type: "CLOSE_MODAL", payload: {} },
        ] as SideEffect[],
        input: "",
        messages: existingMessages,
      };
      consola.info(
        "[humanApprovalNode] Estado RETORNADO (Cancelado):",
        JSON.stringify(ret, null, 2)
      );
      consola.debug("[humanApprovalNode] (CANCELADO) Retornando estado:", ret);
      return ret;
    }
  }

  // FASE 1: Apresenta a proposta para o usuário (primeira passagem)
  // Apenas pausa a execução do grafo aguardando a resposta do usuário.
  const proposal = (state as any).pending_confirmation;

  if (!proposal) {
    consola.warn(
      "[humanApprovalNode] Chamado sem proposta pendente e sem payload de retomada. Seguindo em frente."
    );
    consola.debug(
      "[humanApprovalNode] (SEM PROPOSTA) Retornando estado vazio: {}"
    );
    return {};
  }

  // **AÇÃO CRÍTICA**: Interrompe o grafo para aguardar a resposta do usuário.
  interrupt(proposal);

  consola.debug(
    "[humanApprovalNode] (INTERROMPIDO) Retornando estado vazio: {}"
  );
  // Retorna vazio pois só pausa a execução para aguardar input do usuário.
  return {};
}
