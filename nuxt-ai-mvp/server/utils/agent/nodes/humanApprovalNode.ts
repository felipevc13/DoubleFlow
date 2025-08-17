import { interrupt } from "@langchain/langgraph";
import type { PlanExecuteState } from "../graphState";
import { consola } from "consola";
import type { ApprovalPending, ClarifyRequest, ClarifyResult } from "../types";

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

  // --- Fluxo ASK_CLARIFY: se houver pedido de esclarecimento, interrompe por respostas ---
  const clarifyReq = (state as any).clarify_request as ClarifyRequest | null;
  if (clarifyReq) {
    consola.info(
      "[humanApprovalNode] Pedido de ASK_CLARIFY detectado. Interrompendo para coletar respostas."
    );
    const result = await interrupt<ClarifyResult>(clarifyReq as any);

    if (!result || result.kind !== "ASK_CLARIFY_RESULT") {
      throw new Error(
        "ASK_CLARIFY retomado sem ClarifyResult válido (kind=ASK_CLARIFY_RESULT)."
      );
    }

    const retForClarify: Partial<PlanExecuteState> = {
      clarify_request: null,
      clarify_result: result,
      // não decide UI aqui; orquestrador monta SHOW_CLARIFY/POST_MESSAGE se quiser
      messages: state.messages || [],
      input: "",
    };

    consola.info(
      "[humanApprovalNode] Respostas de ASK_CLARIFY recebidas e devolvidas ao agente."
    );
    return retForClarify;
  }

  const existingMessages = state.messages || [];
  const proposal = (state as any)
    .pending_confirmation as ApprovalPending | null;

  // Normalize proposal for alignment with pending_execute, if present
  const pendingExec = (state as any).pending_execute;
  let normalizedProposal: any = proposal ? { ...(proposal as any) } : null;

  if (proposal && pendingExec?.parameters) {
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

    consola.debug(
      "[humanApprovalNode] Proposta normalizada para aprovação:",
      JSON.stringify(normalizedProposal, null, 2)
    );
  }

  // 1) Sem proposta → nada a fazer
  if (!proposal) {
    consola.warn(
      "[humanApprovalNode] Chamado sem proposta pendente. Seguindo em frente."
    );
    return {};
  }

  // Preparar payload final da proposta (normalizado) para a UI
  const finalProposal = normalizedProposal ?? proposal;

  // Interrompe aguardando decisão booleana (true=aprovar, false=cancelar)
  consola.info(
    "[humanApprovalNode] Interrompendo para decisão de aprovação (render=%s).",
    (finalProposal as any)?.render || "modal"
  );
  const approved = await interrupt<boolean>({
    kind: "APPROVAL_REQUEST",
    payload: finalProposal,
  } as any);

  consola.info("[humanApprovalNode] Decisão recebida:", approved);

  // 2) Cancelado pelo usuário
  if (approved !== true) {
    consola.info("[humanApprovalNode] Cancelado pelo usuário (boolean=false).");
    const ret: Partial<PlanExecuteState> = {
      pending_confirmation: null,
      pending_execute: null,
      messages: existingMessages,
      input: "",
      last_tool_result: {
        approval: { approved: false, nodeId: (finalProposal as any)?.nodeId },
      } as any,
    };
    consola.debug(
      "[humanApprovalNode] Estado retornado após cancelamento:",
      JSON.stringify(ret, null, 2)
    );
    return ret;
  }

  // 3) Aprovado: não emitir EXECUTE_ACTION aqui; deixar execução ser disparada pelo fluxo externo (resume/handler)
  const execParams =
    (pendingExec as any)?.parameters ||
    (finalProposal as any)?.parameters ||
    {};

  const ret: Partial<PlanExecuteState> = {
    pending_confirmation: null,
    // mantém pending_execute para que o próximo passo/handler saiba o que executar
    pending_execute: (state as any).pending_execute,
    messages: existingMessages,
    input: "",
    last_tool_result: {
      approval: { approved: true, nodeId: (finalProposal as any)?.nodeId },
    } as any,
  };

  consola.debug(
    "[humanApprovalNode] Estado retornado após aprovação:",
    JSON.stringify(ret, null, 2)
  );

  consola.info(
    "[humanApprovalNode] Confirmado. Decisão registrada; execução será tratada fora do node."
  );
  return ret;
}
