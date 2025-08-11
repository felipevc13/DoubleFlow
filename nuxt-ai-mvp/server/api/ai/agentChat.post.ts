import type { PlanExecuteState } from "~/server/utils/agent/graphState";
import { Database } from "~/types/supabase";
import { consola } from "consola";
import type { SideEffect } from "~/lib/sideEffects";
import { getAgentGraph } from "~/server/utils/agent/agentGraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";
import { serverSupabaseClient, serverSupabaseUser } from "#supabase/server";
import { SupabaseChatMessageHistory } from "~/server/utils/agent-tools/supabaseMemory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { randomUUID } from "crypto";
import { Command } from "@langchain/langgraph";

export default defineEventHandler(
  async (
    event
  ): Promise<{ sideEffects: SideEffect[]; correlationId: string }> => {
    consola.info("[agentChat] === Novo request iniciado ===");
    const body = await readBody(event);
    let {
      userInput,
      taskId,
      canvasContext,
      correlationId,
      mode,
      resume,
      interruptId: incomingInterruptId,
    } = body as {
      userInput?: string;
      taskId?: string;
      canvasContext?: any;
      correlationId?: string;
      mode?: "resume" | string;
      resume?: { value?: any };
      interruptId?: string;
    };

    // Garante um correlationId para amarrar a confirmação ao turno interrompido
    if (!correlationId || typeof correlationId !== "string") {
      correlationId = randomUUID();
    }

    consola.debug("[agentChat] Received body:", body);
    consola.debug("[agentChat] userInput:", userInput);
    consola.debug("[agentChat] mode:", mode);
    consola.debug("[agentChat] resume (value only):", resume?.value);

    const user = await serverSupabaseUser(event);

    if (!user) {
      throw createError({ statusCode: 401, message: "Não autorizado" });
    }
    if (!taskId) {
      throw createError({ statusCode: 400, message: "taskId é obrigatório" });
    }

    const supabase = await serverSupabaseClient<Database>(event);
    const memory = new SupabaseChatMessageHistory({
      client: supabase,
      conversationId: taskId,
      userId: user.id,
    });
    const initialChatHistory = await memory.getMessages();

    // Adiciona mensagem de saudação como AIMessage somente na primeira interação real do usuário
    const isFirstRealMessage =
      initialChatHistory.length === 0 &&
      typeof userInput === "string" &&
      userInput.trim().length > 0;

    if (isFirstRealMessage) {
      initialChatHistory.unshift(
        new AIMessage(
          "Olá! Vamos definir o seu Problema Inicial. Para começar, preciso de algumas informações. Qual é o problema que você quer resolver? Seja o mais específico possível."
        )
      );
    }
    // Persistir a saudação no banco na primeira interação real
    if (isFirstRealMessage) {
      await memory.addMessages([
        new AIMessage(
          "Olá! Vamos definir o seu Problema Inicial. Para começar, preciso de algumas informações. Qual é o problema que você quer resolver? Seja o mais específico possível."
        ),
      ]);
    }

    const messagesForGraph = [...initialChatHistory];
    // Só adicionar nova HumanMessage quando NÃO estamos retomando uma interrupção
    if (
      mode !== "resume" &&
      typeof userInput === "string" &&
      userInput.length > 0
    ) {
      messagesForGraph.push(new HumanMessage(userInput));
    }

    const { Pool } = pg;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const checkpointer = new PostgresSaver(pool);
    await checkpointer.setup();

    const agentGraph = getAgentGraph(checkpointer);
    // Use a stable thread id to allow proper resume across requests
    const threadId = taskId; // MUST be stable for the whole conversation/flow
    const config = { configurable: { thread_id: threadId, event } };
    let finalState;
    let interruptId: string | undefined;

    try {
      if (mode === "resume" && resume?.value) {
        consola.debug("[agentChat] === Entrando no modo RESUME ===", {
          correlationId,
          resumeValue: resume.value,
        });
        consola.info(
          "[agentChat] Retomando execução via Command({ resume }) com correlationId:",
          correlationId
        );
        const cmd = new Command({ resume: resume.value });
        await agentGraph.invoke(cmd, config);
        consola.success("[agentChat] RESUME: invoke concluído sem exceções");
        finalState = await agentGraph.getState(config);
        consola.success("[agentChat] RESUME: getState concluído");
      } else {
        consola.info("[agentChat] Invocando grafo com input inicial.");
        finalState = await agentGraph.invoke(
          {
            input: userInput,
            canvasContext,
            messages: messagesForGraph,
            taskId,
          },
          config
        );
      }
    } catch (e: any) {
      consola.error(
        "[agentChat] ERRO durante invoke (resume=",
        mode === "resume" && !!resume?.value,
        ") corr=",
        correlationId,
        e
      );
      consola.warn(
        "[agentChat] Grafo interrompido (ou outro erro). Recuperando estado.",
        e
      );
      finalState = await agentGraph.getState(config);
    }

    const realState = (
      "data" in finalState ? finalState.data : finalState
    ) as PlanExecuteState;

    consola.debug(
      "[agentChat] realState.pending_execute:",
      (realState as any).pending_execute
    );
    consola.info("[agentChat] Estado compactado:", {
      hasPendingConfirmation: Boolean(realState.pending_confirmation),
      hasPendingExecute: Boolean((realState as any).pending_execute),
      sideEffectsCount: (realState.sideEffects || []).length,
    });

    consola.debug(
      "[agentChat] realState.messages length:",
      realState.messages?.length ?? 0
    );
    consola.debug(
      "[agentChat] realState.sideEffects length:",
      realState.sideEffects?.length ?? 0
    );
    consola.debug(
      "[agentChat] realState.pending_confirmation:",
      realState.pending_confirmation
    );
    consola.debug("[agentChat] realState.response:", realState.response);

    // Salvar o histórico de chat no final de cada turno bem-sucedido
    const messagesToSave = realState.messages ?? [];
    if (messagesToSave.length > initialChatHistory.length) {
      const newMessages = messagesToSave.slice(initialChatHistory.length);
      await memory.addMessages(newMessages);
      consola.success(
        `[agentChat] ${newMessages.length} nova(s) mensagem(ns) salva(s) no Supabase.`
      );
    }

    // Aggregate side effects from multiple sources (state, last_tool_result, direct invoke)
    const effectsFromState = Array.isArray(realState.sideEffects)
      ? realState.sideEffects
      : [];
    const effectsFromLastTool = Array.isArray(
      (realState as any)?.last_tool_result?.sideEffects
    )
      ? (realState as any).last_tool_result.sideEffects
      : [];
    const invokeContainer =
      finalState &&
      typeof finalState === "object" &&
      "data" in (finalState as any)
        ? (finalState as any).data
        : finalState;
    const effectsFromInvoke = Array.isArray(
      (invokeContainer as any)?.sideEffects
    )
      ? (invokeContainer as any).sideEffects
      : [];

    let finalSideEffects: SideEffect[] = [
      ...effectsFromState,
      ...effectsFromLastTool,
      ...effectsFromInvoke,
    ];
    // de-duplicate by type + payload
    const seenEffects = new Set<string>();
    finalSideEffects = finalSideEffects.filter((e: any) => {
      try {
        const key = `${e?.type}::${JSON.stringify(e?.payload ?? null)}`;
        if (seenEffects.has(key)) return false;
        seenEffects.add(key);
        return true;
      } catch {
        return true;
      }
    });

    if (realState.pending_confirmation) {
      consola.info(
        "[agentChat] pending_confirmation detectado. Preparando SHOW_CONFIRMATION."
      );
      if (
        !finalSideEffects.some((effect) => effect.type === "SHOW_CONFIRMATION")
      ) {
        consola.debug(
          "[agentChat] Conteúdo de pending_confirmation:",
          realState.pending_confirmation
        );

        const pc: any = realState.pending_confirmation;
        const approvalStyle: "text" | "visual" | undefined =
          pc?.approvalStyle === "visual"
            ? "visual"
            : pc?.approvalStyle === "text"
            ? "text"
            : undefined;
        const diffFields: string[] | undefined = Array.isArray(pc?.diffFields)
          ? pc.diffFields.filter((f: any) => typeof f === "string")
          : undefined;

        finalSideEffects.push({
          type: "SHOW_CONFIRMATION",
          payload: {
            tool_name: pc?.tool_name,
            parameters: pc?.parameters,
            displayMessage:
              pc?.displayMessage || "Confirme esta ação proposta.",
            approvalStyle,
            diffFields,
            originalData: pc?.originalData,
            proposedData: pc?.proposedData,
            nodeId: pc?.nodeId,
            modalTitle: pc?.modalTitle,
            // Dados adicionais para a retomada no cliente
            correlationId,
          },
        });
      }
    }

    // 🔧 pending_execute -> EXECUTE_ACTION (faz a ponte do estado do grafo para a UI)
    if (
      (realState as any).pending_execute &&
      !finalSideEffects.some((e) => e.type === "EXECUTE_ACTION")
    ) {
      const pe = (realState as any).pending_execute; // { tool_name, parameters, nodeId, ... }
      finalSideEffects.push({
        type: "EXECUTE_ACTION",
        payload: {
          ...pe,
          feedbackMessage:
            pe?.tool_name === "problem.update"
              ? "✅ Título atualizado!"
              : "✅ Ação aprovada e executada.",
        },
      });
    }

    if (realState.response && finalSideEffects.length === 0) {
      consola.info(
        "[agentChat] Adicionando POST_MESSAGE por ausência de sideEffects."
      );
      finalSideEffects.push({
        type: "POST_MESSAGE",
        payload: { text: realState.response },
      });
    }

    consola.info(
      "[agentChat] Final SideEffects – resumo:",
      finalSideEffects.map((s) => ({ type: s.type }))
    );
    consola.debug(
      "[agentChat] Final SideEffects – payload completo:",
      finalSideEffects
    );
    consola.info("[agentChat] === Request FINALIZADO ===");
    return { sideEffects: finalSideEffects, correlationId: correlationId };
  }
);
