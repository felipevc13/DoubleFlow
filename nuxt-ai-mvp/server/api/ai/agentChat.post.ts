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

// Build a coherent confirmation summary/diff using the actual newData that will be executed
function computeConfirmation(payload: any) {
  const params = payload?.parameters ?? {};
  const nodeId = params?.nodeId;
  const ctx = params?.canvasContext ?? {};
  const nodes = Array.isArray(ctx?.nodes) ? ctx.nodes : [];
  const nodeData = nodes.find((n: any) => n?.id === nodeId)?.data ?? {};
  const newData = params?.newData ?? {};
  const diffFields = payload?.meta?.diffFields ?? ["title", "description"]; // fallback

  const diff: Array<{ field: string; from: any; to: any }> = [];
  for (const f of diffFields) {
    if (Object.prototype.hasOwnProperty.call(newData, f)) {
      const fromVal = (nodeData as any)?.[f];
      const toVal = (newData as any)?.[f];
      if (fromVal !== toVal) {
        diff.push({ field: f, from: fromVal, to: toVal });
      }
    }
  }

  // Prefer a meaningful summary for title changes
  let summary = payload?.summary;
  if ("title" in newData && nodeData?.title !== newData.title) {
    summary = `Título → “${newData.title}”`;
  }
  if (!summary || typeof summary !== "string") {
    summary = "Confirme esta ação proposta.";
  }

  return { summary, diff, parameters: params };
}

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

        // Se veio confirmação do modal, dispare a execução diretamente
        const { confirmed, approved_action } = (resume.value as any) || {};
        if (
          confirmed &&
          approved_action?.tool_name &&
          approved_action?.parameters
        ) {
          consola.info(
            "[agentChat] RESUME com confirmação recebida. Disparando EXECUTE_ACTION direto do servidor."
          );

          // Normaliza/garante flags de aprovação para a tool não pedir confirmação de novo
          const normalizedParams = {
            ...approved_action.parameters,
            isApprovedUpdate: true,
            isApprovedOperation: true,
          };

          const nodeId = normalizedParams?.nodeId as string | undefined;
          const op = normalizedParams?.operation as string | undefined;
          const ntype = normalizedParams?.nodeType as string | undefined;
          let feedbackMessage = "✅ Ação aprovada e executada.";
          if (ntype === "problem" && (op === "update" || op === "patch")) {
            feedbackMessage = "✅ Problema atualizado.";
          }

          const immediateEffects: SideEffect[] = [];
          if (nodeId) {
            immediateEffects.push({
              type: "FOCUS_NODE",
              payload: { nodeId },
            } as any);
          }
          immediateEffects.push({
            type: "EXECUTE_ACTION",
            payload: {
              tool_name: approved_action.tool_name,
              parameters: normalizedParams,
              feedbackMessage,
              correlationId,
            },
          } as any);

          consola.info(
            "[agentChat] RESUME: retornando sideEffects imediatos (EXECUTE_ACTION)"
          );
          return { sideEffects: immediateEffects, correlationId };
        }

        // Caso não seja um resume de confirmação, usamos o mecanismo padrão do LangGraph
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
      if (!finalSideEffects.some((e) => e.type === "SHOW_CONFIRMATION")) {
        const pc: any = realState.pending_confirmation;
        const pe: any = (realState as any).pending_execute;
        consola.debug("[agentChat] pending_confirmation payload:", pc);

        // Prefer the pending_execute parameters as the source of truth when present
        const source = pe && pe.parameters ? pe : pc;
        const render: "chat" | "modal" =
          pc?.render === "modal" || source?.approvalRender === "modal"
            ? "modal"
            : "chat";

        const built = computeConfirmation(source);
        const parameters = built.parameters ?? {};
        const nodeId = parameters?.nodeId ?? undefined;

        finalSideEffects.push({
          type: "SHOW_CONFIRMATION",
          payload: {
            render, // "chat" | "modal"
            summary: built.summary, // texto curto para UI
            diff: built.diff, // estrutura de diff recalculada
            parameters, // igual ao que será reenviado na aprovação
            nodeId, // opcional para a UI focar o alvo
            correlationId, // necessário para retomar o turno interrompido
          },
        });
      }
    }

    if (
      (realState as any).pending_execute &&
      !finalSideEffects.some((e) => e.type === "EXECUTE_ACTION")
    ) {
      const pe = (realState as any).pending_execute; // { tool_name, parameters, meta }
      const op = pe?.parameters?.operation;
      const ntype = pe?.parameters?.nodeType;
      const needsApproval =
        pe?.meta?.needsApproval === true &&
        !pe?.parameters?.isApprovedOperation &&
        !pe?.parameters?.isApprovedUpdate;

      // Only enqueue EXECUTE_ACTION automatically if it does NOT need approval
      if (!needsApproval) {
        let feedbackMessage = "✅ Ação aprovada e executada.";
        if (ntype === "problem" && (op === "update" || op === "patch")) {
          feedbackMessage = "✅ Problema atualizado.";
        }

        finalSideEffects.push({
          type: "EXECUTE_ACTION",
          payload: {
            tool_name: pe.tool_name,
            parameters: pe.parameters,
            feedbackMessage,
            correlationId,
          },
        });
      } else {
        consola.debug(
          "[agentChat] EXECUTE_ACTION adiado: aguardando aprovação do usuário."
        );
      }
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
