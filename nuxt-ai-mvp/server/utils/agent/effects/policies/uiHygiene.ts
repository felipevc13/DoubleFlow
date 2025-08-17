// policies/uiHygiene.ts
import type { Policy } from "../orchestrator";
import type { PlanExecuteState } from "../../graphState";
import type { SideEffect } from "~/lib/sideEffects";

export const uiHygienePolicy: Policy = (
  state: PlanExecuteState
): SideEffect[] => {
  const ui = (state as any).uiContext;
  const target =
    (state as any)?.pending_confirmation?.nodeId ||
    (state as any)?.pending_execute?.parameters?.nodeId;
  const active = ui?.activeModal?.nodeId;
  if (active && target && active !== target) {
    return [{ type: "CLOSE_MODAL", payload: {} } as SideEffect];
  }
  return [];
};
