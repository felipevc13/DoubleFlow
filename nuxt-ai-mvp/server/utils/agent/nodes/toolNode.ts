import type { PlanExecuteState } from "../graphState";
import type { H3Event } from "h3";
import { consola } from "consola";
import { availableTools } from "~/server/utils/agent-tools";

/**
 * Regras importantes:
 * 1) O toolNode NÃO força REFETCH_TASK_FLOW. Ele apenas repassa sideEffects vindos do tool
 *    e, de forma segura, adiciona a mensagem de sucesso.
 * 2) Caso o tool retorne `updated: true` e NÃO tenha incluído REFETCH, adicionamos um REFETCH
 *    como fallback (para manter compatibilidade), mas priorizamos o que o tool decidir.
 * 3) O toolNode não decide sobre aprovação visual. Se a ação exigir aprovação visual,
 *    o caller (ex.: updateNode / orquestrador) deve criar o side effect SHOW_CONFIRMATION
 *    e só colocar a ação em pending_execute depois da confirmação. Aqui apenas executamos
 *    o que chegar em `pending_execute`.
 */
export async function toolNode( // Renomeado de executeNode
  state: PlanExecuteState,
  config: any
): Promise<Partial<PlanExecuteState>> {
  consola.info("[toolNode] Estado RECEBIDO:", JSON.stringify(state, null, 2));
  const actionToExecute = (state as any).pending_execute;

  // Detecta se já houve aprovação prévia (via humanApprovalNode/resume)
  const previouslyApproved = !!(
    (state as any)?.last_tool_result?.approval?.approved === true
  );
  // Em alguns fluxos, `config` volta como booleano true no resume
  const resumeApproved = config === true;
  const isApproved = previouslyApproved || resumeApproved;

  const event: H3Event | null =
    (config as any)?.configurable?.extra?.event ?? null;

  if (!actionToExecute) {
    consola.warn(
      "[toolNode] Chamado sem uma ação pendente para executar. Pulando."
    );
    return {};
  }

  const { tool_name } = actionToExecute;
  consola.info(`[toolNode] Executando a ação '${tool_name}'`);

  const tool = availableTools.find((t) => t.name === tool_name);
  if (!tool) {
    const names = availableTools.map((t) => t.name).join(", ");
    throw new Error(
      `Implementação da ferramenta não encontrada para '${tool_name}'. Disponíveis: [${names}]`
    );
  }

  try {
    consola.info(
      `[toolNode] Executando a ação '${tool_name}' com o objeto completo:`,
      actionToExecute,
      "e config:",
      !!config
    );

    // Constrói parâmetros a serem enviados à tool, propagando aprovação quando existir
    const params = {
      ...(actionToExecute.parameters || {}),
      ...(isApproved ? { isApprovedOperation: true } : {}),
    };

    let result: any;
    if (typeof tool === "function") {
      // Tool exportada como função (ex.: nodeTool)
      result = await (tool as any)({
        ...params,
        event,
      });
    } else if (tool && typeof (tool as any).invoke === "function") {
      // LangChain tool com .invoke
      result = await (tool as any).invoke(params, config);
    } else if (tool && typeof (tool as any).run === "function") {
      // Fallback comum
      result = await (tool as any).run(params);
    } else {
      throw new Error(
        "Tool implementation has no callable signature (function/invoke/run)"
      );
    }

    // Se a tool pediu confirmação, apenas devolvemos o payload e limpamos a execução pendente
    if (result?.pending_confirmation) {
      if (isApproved) {
        consola.warn(
          "[toolNode] Tool retornou pending_confirmation mesmo com aprovação prévia. Verifique a lógica da tool para respeitar 'isApprovedOperation'."
        );
      }
      const ret: Partial<PlanExecuteState> = {
        last_tool_result: { pending_confirmation: result.pending_confirmation },
        pending_confirmation: result.pending_confirmation,
        pending_execute: null,
        input: "",
        messages: state.messages || [],
      };
      consola.info(
        "[toolNode] RET (pending_confirmation, sem efeitos UI):",
        JSON.stringify(ret, null, 2)
      );
      return ret;
    }

    // === Nova abordagem: toolNode não produz mais sideEffects para a UI ===
    // Ele apenas reporta um resultado estruturado para o orquestrador decidir.

    const didSucceed = result?.updated === true || result?.ok === true;

    // Sinal opcional para o orquestrador focar algo
    const focusNodeId =
      (actionToExecute as any)?.parameters?.nodeId ??
      result?.focusNodeId ??
      null;

    // Se a tool retornou efeitos internos, extraia a ação EXECUTE_ACTION (se houver)
    const execAction = Array.isArray(result?.sideEffects)
      ? (result.sideEffects as any[]).find(
          (s: any) => s?.type === "EXECUTE_ACTION"
        )
      : null;

    const actionToExecuteForOrchestrator = execAction
      ? { type: "EXECUTE_ACTION", payload: execAction.payload }
      : null;

    const ret: Partial<PlanExecuteState> = {
      last_tool_result: {
        ok: !!(result?.ok || result?.updated || result?.scheduled),
        updated: !!result?.updated,
        scheduled: !!result?.scheduled,
        // Em vez de enviar sideEffects ao front, fornecemos um fato para o orquestrador
        actionToExecute: actionToExecuteForOrchestrator,
        uiHints: {
          successMessage: didSucceed
            ? `✅ Ação '${tool_name}' concluída!`
            : undefined,
          focusNodeId,
        },
      },
      // Não emitimos sideEffects aqui; a fonte da verdade é o orquestrador
      pending_execute: null,
      input: "",
      messages: state.messages || [],
    };

    consola.info(
      "[toolNode] Estado RETORNADO (sem sideEffects; orquestrador é a fonte):",
      JSON.stringify(ret, null, 2)
    );
    return ret;
  } catch (err: any) {
    consola.error(
      `[toolNode] Erro ao executar a ferramenta '${tool_name}':`,
      err
    );
    const ret: Partial<PlanExecuteState> = {
      last_tool_result: {
        ok: false,
        error: { message: err.message, stack: err.stack },
        uiHints: {
          errorMessage: `❌ Erro ao executar ${tool_name}: ${err.message}`,
        },
      },
      pending_execute: null,
      input: "",
      messages: state.messages || [],
    };
    consola.info(
      "[toolNode] Estado RETORNADO (Erro):",
      JSON.stringify(ret, null, 2)
    );
    return ret;
  }
}
