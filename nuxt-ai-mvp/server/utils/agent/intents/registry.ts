import { problemRefinementAdapter } from "./problemRefinement";

export const INTENTS = {
  problem: {
    refine: problemRefinementAdapter,
  },
};

// Helper simples para descobrir adapter
export function resolveIntent(entity: "problem", action: "refine") {
  return INTENTS[entity][action];
}
