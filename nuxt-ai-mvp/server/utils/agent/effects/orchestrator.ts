// orchestrator.ts
import type { PlanExecuteState } from "../graphState";
import type { SideEffect } from "~/lib/sideEffects";
import nodeTypes from "~/config/nodeTypes-raw";
import { approvalPolicy } from "./policies/approval";
import { clarifyPolicy } from "./policies/clarify";
import { uiHygienePolicy } from "./policies/uiHygiene";

// Sequencing per correlationId (fallback to 'global')
const seqByCorrelation = new Map<string, number>();
function getNextSeq(correlationId?: string) {
  const key = correlationId || "global";
  const v = (seqByCorrelation.get(key) ?? 0) + 1;
  seqByCorrelation.set(key, v);
  return v;
}

export type EffectContext = {
  nodeTypes: typeof nodeTypes;
  source?: "invoke" | "tool" | "resume";
  correlationId?: string; // Used for sequencing effects
};

export type Policy = (
  state: PlanExecuteState,
  ctx: EffectContext
) => SideEffect[];

// Policy that turns last_tool_result into final UI side effects
const executionPolicy: Policy = (state: PlanExecuteState): SideEffect[] => {
  const result: any = (state as any).last_tool_result;
  if (!result || !result.ok) return [];

  const effects: SideEffect[] = [] as any;

  // If tool wants the frontend to execute an action, emit EXECUTE_ACTION
  if (
    result.actionToExecute &&
    result.actionToExecute.type === "EXECUTE_ACTION" &&
    result.actionToExecute.payload
  ) {
    effects.push({
      type: "EXECUTE_ACTION",
      payload: result.actionToExecute.payload,
    } as any);
  }

  // If state/data changed, let the UI refetch
  if (result.updated === true) {
    effects.push({ type: "REFETCH_TASK_FLOW", payload: {} } as any);
  }

  // Post success message if provided
  if (result.uiHints?.successMessage) {
    effects.push({
      type: "POST_MESSAGE",
      payload: { text: result.uiHints.successMessage },
    } as any);
  }

  // Focus a node if requested
  if (result.uiHints?.focusNodeId) {
    effects.push({
      type: "FOCUS_NODE",
      payload: { nodeId: result.uiHints.focusNodeId },
    } as any);
  }

  return effects;
};

const registry: Policy[] = [
  approvalPolicy,
  clarifyPolicy,
  uiHygienePolicy,
  executionPolicy,
];

export function buildEffects(
  state: PlanExecuteState,
  ctx: EffectContext
): SideEffect[] {
  const all = registry.flatMap((p) => p(state, ctx) || []);

  // Determine phase: force POST phase on resume; only PRE when not resuming and there's a pending confirmation
  const phase: "pre" | "post" =
    ctx.source === "resume"
      ? "post"
      : (state as any)?.pending_confirmation
      ? "pre"
      : "post";

  // Logging phase and pending confirmation
  // Prefer consola.info if available, else fallback to console.log
  const log =
    typeof (globalThis as any).consola?.info === "function"
      ? (globalThis as any).consola.info
      : console.log;
  log(
    "[orchestrator] phase:",
    phase,
    "hasPendingConfirmation:",
    !!(state as any)?.pending_confirmation
  );
  log(
    "[orchestrator] effects before filter:",
    all.map((e) => e.type)
  );

  // Attach seq/phase metadata to each effect
  const withMeta = all.map((e) => ({
    ...e,
    seq: getNextSeq(ctx.correlationId),
    phase,
  }));

  log(
    "[orchestrator] effects withMeta:",
    withMeta.map((e) => ({ type: e.type, phase: e.phase }))
  );

  const filtered = withMeta.filter((e) => {
    // Do not focus anything in POST phase (server provides uiHints if needed)
    return true;
  });

  log(
    "[orchestrator] effects after filter:",
    filtered.map((e) => ({ type: e.type, phase: e.phase }))
  );

  return reduceEffects(filtered);
}

function dedupKey(e: SideEffect): string {
  const t = e.type as string;
  const p: any = (e as any).payload || {};
  const node = p.nodeId ?? p.parameters?.nodeId ?? "";
  // Add discriminators by effect type to avoid collapsing distinct actions
  if (t === "EXECUTE_ACTION") {
    const tool = p.tool_name ?? "";
    // parameters may differ even with same nodeId; stringify safely
    const paramsStr = (() => {
      try {
        return JSON.stringify(p.parameters ?? {});
      } catch {
        return "";
      }
    })();
    return `${t}|${tool}|${node}|${paramsStr}`;
  }
  if (t === "POST_MESSAGE") {
    return `${t}|${p.text ?? ""}`;
  }
  if (t === "SHOW_CLARIFY" || t === "OPEN_MODAL" || t === "CLOSE_MODAL") {
    const summary = p.summary ?? p.reason ?? "";
    return `${t}|${node}|${summary}`;
  }
  if (t === "FOCUS_NODE") {
    return `${t}|${node}`;
  }
  if (t === "REFETCH_TASK_FLOW") {
    return t; // single flight
  }
  // Fallback: include node + shallow payload
  const shallow = (() => {
    try {
      return JSON.stringify(p ?? {});
    } catch {
      return "";
    }
  })();
  return `${t}|${node}|${shallow}`;
}

function reduceEffects(effects: SideEffect[]): SideEffect[] {
  // prioridade: maior número = vem primeiro
  const prio: Partial<Record<SideEffect["type"], number>> = {
    CLOSE_MODAL: 10,
    FOCUS_NODE: 9,
    SHOW_CLARIFY: 8,
    OPEN_MODAL: 7,
    EXECUTE_ACTION: 6, // ação antes da mensagem
    POST_MESSAGE: 5, // mensagem depois da ação
    REFETCH_TASK_FLOW: 1,
  };

  const seen = new Map<string, number>();
  const uniq = effects.filter((e) => {
    const key = dedupKey(e);
    const s = typeof e.seq === "number" ? e.seq : -1;
    const last = seen.get(key) ?? -1;
    if (s <= last) return false;
    seen.set(key, s);
    return true;
  });

  // Ordena por prioridade e, em empate, respeita a sequência (seq) crescente
  return uniq.sort((a, b) => {
    const pa = prio[a.type] ?? 0;
    const pb = prio[b.type] ?? 0;
    if (pb !== pa) return pb - pa;
    const sa = typeof a.seq === "number" ? a.seq : 0;
    const sb = typeof b.seq === "number" ? b.seq : 0;
    return sa - sb;
  });
}
