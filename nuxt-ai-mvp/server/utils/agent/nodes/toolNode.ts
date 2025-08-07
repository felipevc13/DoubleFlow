// server/utils/agent/nodes/toolNode.ts

import type { PlanExecuteState } from "../graphState";
import { consola } from "consola";
import { availableTools } from "~/server/utils/agent-tools";
import { autoTools } from "~/server/utils/agent/tools/auto";
import type { SideEffect } from "~/lib/sideEffects";
import { AIMessage } from "@langchain/core/messages";

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
    const result = await (tool as any).invoke(
      actionToExecute.parameters,
      config
    );

    const successMessage = `✅ Ação '${tool_name}' concluída!`;
    const finalMessage = new AIMessage(successMessage);

    const ret: Partial<PlanExecuteState> = {
      last_tool_result: result,
      sideEffects: [
        { type: "POST_MESSAGE", payload: { text: successMessage } },
        { type: "REFETCH_TASK_FLOW", payload: {} },
      ] as SideEffect[],
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
