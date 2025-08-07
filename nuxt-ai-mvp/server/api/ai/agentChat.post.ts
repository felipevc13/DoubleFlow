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

export default defineEventHandler(
  async (
    event
  ): Promise<{ sideEffects: SideEffect[]; correlationId: string }> => {
    consola.info("[agentChat] === Novo request iniciado ===");
    const body = await readBody(event);
    let { userInput, taskId, canvasContext, correlationId, resumePayload } =
      body;
    consola.debug("[agentChat] Received body:", body);
    consola.debug("[agentChat] userInput:", userInput);
    consola.debug("[agentChat] resumePayload:", resumePayload);

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
    if (typeof userInput === "string" && userInput.length > 0) {
      messagesForGraph.push(new HumanMessage(userInput));
    }

    const { Pool } = pg;
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const checkpointer = new PostgresSaver(pool);
    await checkpointer.setup();

    const agentGraph = getAgentGraph(checkpointer);
    const config = { configurable: { thread_id: taskId, event } };
    let finalState;

    try {
      if (resumePayload) {
        consola.info(
          "[agentChat] Retomando execução com payload:",
          resumePayload
        );
        finalState = await agentGraph.invoke(
          {
            input: resumePayload,
            messages: initialChatHistory,
            taskId,
            canvasContext,
          },
          config
        );
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
      consola.warn("[agentChat] Grafo interrompido, recuperando estado.");
      finalState = await agentGraph.getState(config);
    }

    const realState = (
      "data" in finalState ? finalState.data : finalState
    ) as PlanExecuteState;

    // Salvar o histórico de chat no final de cada turno bem-sucedido
    const messagesToSave = realState.messages ?? [];
    if (messagesToSave.length > initialChatHistory.length) {
      const newMessages = messagesToSave.slice(initialChatHistory.length);
      await memory.addMessages(newMessages);
      consola.success(
        `[agentChat] ${newMessages.length} nova(s) mensagem(ns) salva(s) no Supabase.`
      );
    }

    let finalSideEffects: SideEffect[] = realState.sideEffects ?? [];

    if (realState.pending_confirmation) {
      if (
        !finalSideEffects.some((effect) => effect.type === "SHOW_CONFIRMATION")
      ) {
        finalSideEffects.push({
          type: "SHOW_CONFIRMATION",
          payload: {
            ...realState.pending_confirmation,
            displayMessage:
              realState.pending_confirmation.displayMessage ||
              "Confirme esta ação proposta.",
          },
        });
      }
    }

    if (realState.response && finalSideEffects.length === 0) {
      finalSideEffects.push({
        type: "POST_MESSAGE",
        payload: { text: realState.response },
      });
    }

    consola.info(
      "[agentChat] Final SideEffects enviados ao frontend:",
      finalSideEffects
    );
    consola.info("[agentChat] === Request FINALIZADO ===");
    return { sideEffects: finalSideEffects, correlationId: correlationId };
  }
);
