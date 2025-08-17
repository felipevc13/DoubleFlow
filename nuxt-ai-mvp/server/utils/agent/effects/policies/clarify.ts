// policies/clarify.ts
import type { Policy } from "../orchestrator";
import type { PlanExecuteState } from "../../graphState";
import type { SideEffect } from "~/lib/sideEffects";

export const clarifyPolicy: Policy = (
  state: PlanExecuteState
): SideEffect[] => {
  const req = (state as any).clarify_request;
  return req ? [{ type: "SHOW_CLARIFY", payload: req } as any] : [];
};
