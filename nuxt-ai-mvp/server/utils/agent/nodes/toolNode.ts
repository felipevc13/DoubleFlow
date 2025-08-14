import type { PlanExecuteState } from "../graphState";
import type { H3Event } from "h3";
import { consola } from "consola";
import { availableTools } from "~/server/utils/agent-tools";
import type { SideEffect } from "~/lib/sideEffects";
import { AIMessage } from "@langchain/core/messages";

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

    // Executa a ferramenta (compat: função direta ou LangChain tool)
    let result: any;
    if (typeof tool === "function") {
      // Tool exportada como função (ex.: nodeTool)
      result = await (tool as any)({
        ...(actionToExecute.parameters || {}),
        event,
      });
    } else if (tool && typeof (tool as any).invoke === "function") {
      // LangChain tool com .invoke
      result = await (tool as any).invoke(actionToExecute.parameters, config);
    } else if (tool && typeof (tool as any).run === "function") {
      // Fallback comum
      result = await (tool as any).run(actionToExecute.parameters);
    } else {
      throw new Error(
        "Tool implementation has no callable signature (function/invoke/run)"
      );
    }

    // Se a tool pediu confirmação, primeiro focamos o nó e deixamos o caller abrir o modal
    if (result?.pending_confirmation) {
      const nodeIdToFocus = (actionToExecute as any)?.parameters?.nodeId;
      const focusEffect: SideEffect | null = nodeIdToFocus
        ? { type: "FOCUS_NODE", payload: { nodeId: nodeIdToFocus } }
        : null;

      const effectsToPersist: SideEffect[] = [];
      if (focusEffect) effectsToPersist.push(focusEffect);

      // anexa no state.sideEffects também, mantendo compat com quem lê do estado
      (state as any).sideEffects = Array.isArray((state as any).sideEffects)
        ? (state as any).sideEffects
        : [];
      (state as any).sideEffects.push(...effectsToPersist);

      const ret: Partial<PlanExecuteState> = {
        last_tool_result: { pending_confirmation: result.pending_confirmation },
        pending_confirmation: result.pending_confirmation,
        sideEffects: effectsToPersist,
        pending_execute: null,
        input: "",
        messages: state.messages || [],
      };
      consola.info(
        "[toolNode] RET (pending_confirmation):",
        JSON.stringify(ret, null, 2)
      );
      return ret;
    }

    // Normaliza side effects vindos do tool (se houver)
    const toolSideEffects: SideEffect[] = Array.isArray(result?.sideEffects)
      ? (result.sideEffects as SideEffect[])
      : [];

    // Avalia se já existe um REFETCH do próprio tool
    const hasRefetchFromTool =
      toolSideEffects?.some?.((s) => s?.type === "REFETCH_TASK_FLOW") ?? false;

    // Se o tool indicou que houve atualização mas não pediu refetch,
    // adicionamos um REFETCH como fallback para manter a UI sincronizada.
    const shouldAddRefetchFallback = !!result?.updated && !hasRefetchFromTool;

    const didSucceed = result?.updated === true || result?.ok === true;
    const effectsToPersist: SideEffect[] = [
      ...(didSucceed
        ? ([
            {
              type: "POST_MESSAGE",
              payload: { text: `✅ Ação '${tool_name}' concluída!` },
            },
          ] as SideEffect[])
        : []),
      ...toolSideEffects,
      ...(shouldAddRefetchFallback
        ? ([{ type: "REFETCH_TASK_FLOW", payload: {} }] as SideEffect[])
        : []),
    ];

    (state as any).sideEffects = Array.isArray((state as any).sideEffects)
      ? (state as any).sideEffects
      : [];

    (state as any).sideEffects.push(...effectsToPersist);

    const ret: Partial<PlanExecuteState> = {
      last_tool_result: result,
      sideEffects: effectsToPersist,
      pending_execute: null,
      input: "",
      messages: [
        ...(state.messages || []),
        new AIMessage(`✅ Ação '${tool_name}' concluída!`),
      ],
    };

    consola.info("[toolNode] Estado RETORNADO:", JSON.stringify(ret, null, 2));
    return ret;
  } catch (err: any) {
    consola.error(
      `[toolNode] Erro ao executar a ferramenta '${tool_name}':`,
      err
    );
    const ret: Partial<PlanExecuteState> = {
      sideEffects: [
        {
          type: "POST_MESSAGE",
          payload: { text: `❌ Erro ao executar ${tool_name}: ${err.message}` },
        },
      ] as SideEffect[],
      pending_execute: null,
      input: "",
    };
    consola.info(
      "[toolNode] Estado RETORNADO (Erro):",
      JSON.stringify(ret, null, 2)
    );
    return ret;
  }
}
