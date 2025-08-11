// server/utils/agent/nodes/toolNode.ts

import type { PlanExecuteState } from "../graphState";
import { consola } from "consola";
import { availableTools } from "~/server/utils/agent-tools";
import { autoTools } from "~/server/utils/agent/tools/auto";
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

  if (!actionToExecute) {
    consola.warn(
      "[toolNode] Chamado sem uma ação pendente para executar. Pulando."
    );
    return {};
  }

  const { tool_name } = actionToExecute;
  consola.info(`[toolNode] Executando a ação '${tool_name}'`);

  const meta = autoTools.find((t: any) => t.id === tool_name);
  if (!meta || !meta.langchainTool) {
    throw new Error(
      `Metadados ou langchainTool não encontrados para a ação: ${tool_name}`
    );
  }

  const tool = availableTools.find((t) => t.name === meta.langchainTool);
  if (!tool) {
    throw new Error(
      `Implementação da ferramenta não encontrada: ${meta.langchainTool}`
    );
  }

  try {
    consola.info(
      `[toolNode] Executando a ação '${tool_name}' com o objeto completo:`,
      actionToExecute,
      "e config:",
      !!config
    );

    // Executa a ferramenta
    const result = await (tool as any).invoke(
      actionToExecute.parameters,
      config
    );

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

    const successMessage = `✅ Ação '${tool_name}' concluída!`;
    const finalMessage = new AIMessage(successMessage);

    // --- Persist side effects in the graph state so the handler can read them ---
    // Ensure array
    (state as any).sideEffects = Array.isArray((state as any).sideEffects)
      ? (state as any).sideEffects
      : [];

    const effectsToPersist: SideEffect[] = [
      { type: "POST_MESSAGE", payload: { text: successMessage } },
      ...toolSideEffects,
      ...(shouldAddRefetchFallback
        ? ([{ type: "REFETCH_TASK_FLOW", payload: {} }] as SideEffect[])
        : []),
    ];

    (state as any).sideEffects.push(...effectsToPersist);

    const ret: Partial<PlanExecuteState> = {
      last_tool_result: result,
      sideEffects: effectsToPersist,
      pending_execute: null,
      input: "",
      messages: [...(state.messages || []), finalMessage],
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
