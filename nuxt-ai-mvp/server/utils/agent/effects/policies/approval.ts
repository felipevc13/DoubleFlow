// policies/approval.ts
import type { Policy, EffectContext } from "../orchestrator";
import type { PlanExecuteState } from "../../graphState";
import type { SideEffect } from "~/lib/sideEffects";

export const approvalPolicy: Policy = (
  state: PlanExecuteState,
  ctx: EffectContext
): SideEffect[] => {
  const eff: SideEffect[] = [];
  const approval = (state as any).pending_confirmation;
  const exec = (state as any).pending_execute;

  // Política atualizada: NÃO emite mais SHOW_CONFIRMATION como side-effect.
  // O cliente renderiza confirmação lendo `pending_confirmation` do payload da resposta.

  // Só há qualquer ação de pré-fase se existir uma aprovação pendente.
  if (!approval) return eff;

  // Nunca reemite efeitos de pré-fase durante `resume`.
  if ((ctx as any)?.source === "resume") return eff;

  return eff;
};
