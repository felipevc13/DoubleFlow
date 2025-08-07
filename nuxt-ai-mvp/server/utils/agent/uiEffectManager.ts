// server/utils/agent/uiEffectManager.ts

import { consola } from "consola";
import type { PlanExecuteState } from "./graphState";
import type { SideEffect } from "~/lib/sideEffects";

/**
 * Gera uma sequência de efeitos colaterais para preparar a UI para uma ação.
 * Esta é a única fonte de verdade para a lógica de "focar antes de agir".
 * @param state O estado atual do agente, que inclui o uiContext.
 * @param targetNodeId O ID do nó que é o alvo da ação.
 * @returns Um array de SideEffects ordenados.
 */
export function generateUiPreparationEffects(
  state: PlanExecuteState,
  targetNodeId: string
): SideEffect[] {
  const uiContext = (state as any).uiContext || { activeModal: null };
  const { activeModal } = uiContext;
  const sideEffects: SideEffect[] = [];

  consola.info(
    `[uiEffectManager] Gerando efeitos para o nó ${targetNodeId} com o contexto de UI:`,
    activeModal
  );

  // 1. Se um modal estiver aberto, mas for para o nó errado, fecha primeiro.
  if (activeModal && activeModal.nodeId !== targetNodeId) {
    consola.info(
      `[uiEffectManager] Adicionando CLOSE_MODAL para ${activeModal.nodeId}`
    );
    sideEffects.push({ type: "CLOSE_MODAL", payload: {} });
  }

  // 2. Adiciona o foco no nó alvo.
  sideEffects.push({
    type: "FOCUS_NODE",
    payload: { nodeId: targetNodeId },
  });

  return sideEffects;
}
