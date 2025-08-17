import type { PlanExecuteState } from "~/server/utils/agent/graphState";
import { Database } from "~/types/supabase";
import { consola } from "consola";
import type { SideEffect } from "~/lib/sideEffects";
import { getAgentGraph } from "~/server/utils/agent/agentGraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import pg from "pg";
import { getSupabaseWithAuth } from "~/server/utils/supabase";
import { SupabaseChatMessageHistory } from "~/server/utils/agent-tools/supabaseMemory";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { randomUUID } from "crypto";
import { Command } from "@langchain/langgraph";
import nodeTypesRaw from "~/config/nodeTypes-raw";
import { buildEffects } from "~/server/utils/agent/effects/orchestrator";

export default defineEventHandler(
  async (
    event
  ): Promise<{
    sideEffects: SideEffect[];
    correlationId: string;
    pending_confirmation: any | null;
    pending_execute?: any | null;
  }> => {
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

    const { supabase, user } = await getSupabaseWithAuth(event);

    if (!user) {
      throw createError({ statusCode: 401, message: "Não autorizado" });
    }
    if (!taskId) {
      throw createError({ statusCode: 400, message: "taskId é obrigatório" });
    }

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
    const config = { configurable: { thread_id: threadId, extra: { event } } };
    let finalState;
    let interruptId: string | undefined;

    try {
      if (mode === "resume" && resume?.value) {
        consola.debug("[agentChat] === Entrando no modo RESUME ===", {
          correlationId,
          resumeValue: resume.value,
        });

        const resumeVal: any = resume.value;

        // (A) RESUME boolean (modal aprovação via boolean)
        if (typeof resumeVal === "boolean") {
          consola.info("[agentChat] RESUME boolean recebido:", resumeVal);
          const cmd = new Command({ resume: resumeVal });
          finalState = await agentGraph.invoke(cmd, config);
          consola.success("[agentChat] RESUME boolean: invoke concluído");
          if (!finalState) {
            finalState = await agentGraph.getState(config);
            consola.success(
              "[agentChat] RESUME boolean: getState concluído (fallback)"
            );
          }

          // (B) RESUME Clarify (ASK_CLARIFY_RESULT)
        } else if (resumeVal && resumeVal.kind === "ASK_CLARIFY_RESULT") {
          consola.info("[agentChat] RESUME ASK_CLARIFY_RESULT recebido.");
          const cmd = new Command({ resume: resumeVal });
          finalState = await agentGraph.invoke(cmd, config);
          consola.success("[agentChat] RESUME clarify: invoke concluído");
          if (!finalState) {
            finalState = await agentGraph.getState(config);
            consola.success(
              "[agentChat] RESUME clarify: getState concluído (fallback)"
            );
          }

          // (D) Default: encaminha o resume qualquer para o grafo
        } else {
          consola.info(
            "[agentChat] Retomando execução via Command({ resume }) com correlationId:",
            correlationId
          );
          const cmd = new Command({ resume: resumeVal });
          finalState = await agentGraph.invoke(cmd, config);
          consola.success("[agentChat] RESUME: invoke concluído sem exceções");
          if (!finalState) {
            finalState = await agentGraph.getState(config);
            consola.success(
              "[agentChat] RESUME: getState concluído (fallback)"
            );
          }
        }
      } else {
        consola.info("[agentChat] Invocando grafo com input inicial.");
        // Enriquecer o canvasContext com catálogo e títulos/descrições promovidos
        const catalogSummary = Object.fromEntries(
          Object.keys(nodeTypesRaw).map((t) => [
            t,
            {
              purpose: (nodeTypesRaw as any)[t]?.purpose ?? "",
              aliases: (nodeTypesRaw as any)[t]?.aliases ?? [],
              operations: Object.keys(
                (nodeTypesRaw as any)[t]?.operations ?? {}
              ),
            },
          ])
        );

        const canvasContextRich = {
          ...(canvasContext || {}),
          nodes: Array.isArray(canvasContext?.nodes)
            ? (canvasContext.nodes as any[]).map((n: any) => ({
                ...n,
                title: n?.title ?? n?.data?.title ?? "",
                description: n?.description ?? n?.data?.description ?? "",
              }))
            : [],
          catalog: catalogSummary,
        };
        finalState = await agentGraph.invoke(
          {
            input: userInput,
            canvasContext: canvasContextRich,
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

    // Construir efeitos via orquestrador (config-driven)
    const effectsBuilt =
      buildEffects(realState, {
        nodeTypes: nodeTypesRaw,
        source: mode === "resume" ? "resume" : "invoke",
        correlationId,
      }) ?? [];

    // 🔒 Fonte única da verdade: os efeitos vêm apenas do orquestrador.
    // Se o grafo pedir confirmação, ele mesmo não deve ter gerado efeitos "post".
    const hasPendingConfirmation = Boolean(
      (realState as any).pending_confirmation
    );
    consola.info(
      "[orchestrator] phase: pre hasPendingConfirmation:",
      hasPendingConfirmation
    );

    // Use somente os efeitos produzidos nesta rodada pelo orquestrador
    const effectsToReturn: SideEffect[] = effectsBuilt;

    consola.info(
      "[agentChat] Final SideEffects – resumo:",
      effectsToReturn.map((s: any) => ({ type: s.type }))
    );
    consola.debug(
      "[agentChat] Final SideEffects – payload completo:",
      effectsToReturn
    );
    consola.debug(
      "[agentChat] realState.last_tool_result:",
      (realState as any).last_tool_result
    );
    consola.info("[agentChat] === Request FINALIZADO ===");
    return {
      sideEffects: effectsToReturn,
      correlationId,
      pending_confirmation: (realState as any).pending_confirmation ?? null,
      pending_execute: (realState as any).pending_execute ?? null,
    };
  }
);
