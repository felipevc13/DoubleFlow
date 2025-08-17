import { ref, watch, computed, type Ref } from "vue";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useModalStore, ModalType } from "~/stores/modal";
// A linha de import para useAnimatedFitToNode foi removida daqui.
import * as uuid from "uuid";
const uuidv4 = uuid.v4;
import { useNuxtApp } from "#imports";
import type { SideEffect } from "~/lib/sideEffects";
import { effectRegistry } from "~/lib/effects/client/registry";
import { runAgentAction } from "~/lib/agentActions";

type ApprovalAction = {
  tool_name: string;
  parameters: Record<string, any>;
  nodeId?: string;
  correlationId: string;
};

interface ChatMessage {
  role: "user" | "agent" | "system" | "confirmation";
  content: string;
  action?: ApprovalAction;
}

const messages = ref<ChatMessage[]>([]);
// Tracks last processed seq per correlationId **and phase** (pre/post) to avoid discarding post-phase effects
// when there was a higher seq in pre-phase.
type PhaseKey = "pre" | "post" | "none";
const lastSeqByCorrPhase = ref<Record<string, Record<PhaseKey, number>>>({});

// Helper: build Authorization header from current Supabase session
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { $supabase } = useNuxtApp();
  const {
    data: { session },
  } = await $supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
};

export function useAgentLogic(taskIdRef: Ref<string>) {
  const isLoading = ref(false);
  const taskFlowStore = useTaskFlowStore();
  const modalStore = useModalStore();
  const currentCorrelationId = ref<string | null>(null);
  const lastServerCorrelationId = ref<string | null>(null);
  const awaitingApproval = ref(false);
  const awaitingApprovalCorrelationId = ref<string | null>(null);
  const clarifyCorrelationId = ref<string | null>(null);
  const clarifyPending = ref<{
    reason?: string;
    questions: Array<{ key: string; label: string; required?: boolean }>;
    context?: Record<string, any>;
  } | null>(null);

  // === DEDUPE STATE & HELPERS (pode ser extraído depois p/ um módulo) ===
  const processedEffectsRef = ref<Set<string>>(new Set());

  type EffectLike = { type: string; payload?: Record<string, any> };

  function isIdempotentEffect(eff: EffectLike) {
    // apenas efeitos idempotentes entram em dedupe
    return (
      eff.type === "POST_MESSAGE" || eff.type === "REFETCH_TASK_FLOW"
      // FOCUS_NODE removido da lista idempotente para permitir foco pós-aprovação
    );
  }

  function effectKey(eff: EffectLike, correlationId?: string) {
    return [
      correlationId ?? "no-corr",
      eff.type,
      eff.payload?.kind ?? "",
      eff.payload?.parameters?.nodeId ?? eff.payload?.nodeId ?? "",
      eff.payload?.summary ?? "",
    ].join("|");
  }

  function normalizeConfirmationPayload(
    eff: EffectLike,
    correlationId?: string
  ) {
    return {
      kind: eff.payload?.kind ?? "PROPOSE_PATCH",
      render: eff.payload?.render ?? "chat",
      summary: eff.payload?.summary ?? "",
      parameters: eff.payload?.parameters ?? {},
      nodeId: eff.payload?.parameters?.nodeId ?? eff.payload?.nodeId ?? null,
      correlationId,
    };
  }

  function mapToolToActionType(tool: string): "delete" | "create" | null {
    switch (tool) {
      case "deleteNode":
        return "delete";
      case "createNode":
        return "create";
      default:
        return null;
    }
  }

  const executeSideEffects: {
    (payload: { effects: SideEffect[]; correlationId: string }): Promise<void>;
    (effects: SideEffect[], correlationId: string): Promise<void>;
  } = async (...args: any[]) => {
    // Support both legacy signature (effects, correlationId)
    // and the new single-payload signature ({ effects, correlationId })
    let effects: SideEffect[] = [];
    let correlationId: string = "";

    if (Array.isArray(args[0])) {
      effects = args[0] as SideEffect[];
      correlationId = args[1] as string;
    } else if (args[0] && typeof args[0] === "object") {
      effects = (args[0] as any).effects;
      correlationId = (args[0] as any).correlationId;
    }

    // A lógica de filtragem foi removida. O código agora continua diretamente daqui.

    console.info(
      "[useAgentLogic] executeSideEffects received effects:",
      JSON.stringify(effects, null, 2)
    );
    try {
      console.log(
        "[executeSideEffects] compact summary:",
        (effects as any[]).map(
          (e: any) => `${e?.type}@${e?.phase ?? "none"}#${e?.seq ?? "?"}`
        )
      );
    } catch {}
    console.log(
      "[executeSideEffects] ids => incoming:",
      correlationId,
      " current:",
      currentCorrelationId.value,
      " lastServer:",
      lastServerCorrelationId.value
    );
    // Adopt/refresh server correlationId if it differs (server as source of truth)
    if (correlationId && currentCorrelationId.value !== correlationId) {
      console.log(
        "[executeSideEffects] adopting/refreshing server correlationId:",
        correlationId,
        "(was:",
        currentCorrelationId.value,
        ")"
      );
      currentCorrelationId.value = correlationId;
    }
    // Reset approval flag if correlationId changed
    if (
      awaitingApprovalCorrelationId.value &&
      awaitingApprovalCorrelationId.value !== correlationId
    ) {
      awaitingApproval.value = false;
      awaitingApprovalCorrelationId.value = null;
    }
    // Track last correlationId we saw from server
    if (correlationId) {
      lastServerCorrelationId.value = correlationId;
    }
    // Ignore effects that don't belong to the active correlation (tolerant check)
    const isSameCorrelation =
      !!correlationId &&
      (correlationId === currentCorrelationId.value ||
        correlationId === lastServerCorrelationId.value ||
        correlationId === awaitingApprovalCorrelationId.value);

    if (!isSameCorrelation) return;

    // Build a context for the registry handlers, desacoplado dos stores reais
    const ctx = {
      modalStore: {
        openModal: modalStore.openModal.bind(modalStore),
        closeModal: modalStore.closeModal.bind(modalStore),
      },
      graphStore: {
        focusNode: (nodeId: string) => {
          // Mantém o comportamento antigo de animar o grafo
          (taskFlowStore as any).nodeToAnimateTo = nodeId;
        },
        refetchTaskFlow: async () => {
          console.log(
            "[graphStore.refetchTaskFlow] invoked (agent-driven refetch)."
          );
          if (typeof (taskFlowStore as any).refetchTaskFlow === "function") {
            await (taskFlowStore as any).refetchTaskFlow();
          } else {
            await taskFlowStore.loadTaskFlow(taskIdRef.value);
          }
        },
      },
      sendResumePayload,
      pushChatMessage: (msg: any) => {
        // garante reatividade em watchers rasos
        messages.value = [...messages.value, msg];
      },
      // aliases diretos por nome (opcional)
      actions: {
        deleteNode: async ({ nodeId }: { nodeId: string }) => {
          console.group("[actions.deleteNode]");
          console.log("nodeId:", nodeId);
          const beforeNodes = (taskFlowStore as any).nodes
            ? (taskFlowStore as any).nodes.length
            : 0;
          const beforeEdges = (taskFlowStore as any).edges
            ? (taskFlowStore as any).edges.length
            : 0;
          const presentBefore = Array.isArray((taskFlowStore as any).nodes)
            ? (taskFlowStore as any).nodes.some((n: any) => n?.id === nodeId)
            : false;
          console.log(
            "before → nodes:",
            beforeNodes,
            "edges:",
            beforeEdges,
            "presentBefore:",
            presentBefore
          );
          try {
            // 1) Tente usar métodos da store, se existirem
            if (typeof (taskFlowStore as any).removeNode === "function") {
              await (taskFlowStore as any).removeNode(nodeId);
              const afterNodes = (taskFlowStore as any).nodes
                ? (taskFlowStore as any).nodes.length
                : 0;
              const afterEdges = (taskFlowStore as any).edges
                ? (taskFlowStore as any).edges.length
                : 0;
              const presentAfter = Array.isArray((taskFlowStore as any).nodes)
                ? (taskFlowStore as any).nodes.some(
                    (n: any) => n?.id === nodeId
                  )
                : false;
              console.log(
                "after  → nodes:",
                afterNodes,
                "edges:",
                afterEdges,
                "presentAfter:",
                presentAfter
              );
              console.groupEnd();
            } else if (
              typeof (taskFlowStore as any).deleteNode === "function"
            ) {
              await (taskFlowStore as any).deleteNode(nodeId);
              const afterNodes = (taskFlowStore as any).nodes
                ? (taskFlowStore as any).nodes.length
                : 0;
              const afterEdges = (taskFlowStore as any).edges
                ? (taskFlowStore as any).edges.length
                : 0;
              const presentAfter = Array.isArray((taskFlowStore as any).nodes)
                ? (taskFlowStore as any).nodes.some(
                    (n: any) => n?.id === nodeId
                  )
                : false;
              console.log(
                "after  → nodes:",
                afterNodes,
                "edges:",
                afterEdges,
                "presentAfter:",
                presentAfter
              );
              console.groupEnd();
            } else {
              // 2) Fallback: mutação direta e reativa
              const prevCount = taskFlowStore.nodes.length;
              (taskFlowStore as any).nodes = taskFlowStore.nodes.filter(
                (n: any) => n.id !== nodeId
              );
              (taskFlowStore as any).edges = taskFlowStore.edges.filter(
                (e: any) => e.source !== nodeId && e.target !== nodeId
              );
              console.info(
                "[useAgentLogic] Fallback delete applied. Nodes:",
                prevCount,
                "→",
                taskFlowStore.nodes.length
              );
              const afterNodes = (taskFlowStore as any).nodes
                ? (taskFlowStore as any).nodes.length
                : 0;
              const afterEdges = (taskFlowStore as any).edges
                ? (taskFlowStore as any).edges.length
                : 0;
              const presentAfter = Array.isArray((taskFlowStore as any).nodes)
                ? (taskFlowStore as any).nodes.some(
                    (n: any) => n?.id === nodeId
                  )
                : false;
              console.log(
                "after  → nodes:",
                afterNodes,
                "edges:",
                afterEdges,
                "presentAfter:",
                presentAfter
              );
              console.groupEnd();
            }
            // 3) Como segurança, limpe alvo de animação se era o nó deletado
            if ((taskFlowStore as any).nodeToAnimateTo === nodeId) {
              (taskFlowStore as any).nodeToAnimateTo = null;
            }
          } catch (e) {
            console.error(
              "[actions.deleteNode] primary path failed, falling back to runAgentAction.",
              e
            );
            // 4) Último fallback: roteador genérico
            try {
              await runAgentAction({ type: "delete", nodeId });
              const afterNodes = (taskFlowStore as any).nodes
                ? (taskFlowStore as any).nodes.length
                : 0;
              const afterEdges = (taskFlowStore as any).edges
                ? (taskFlowStore as any).edges.length
                : 0;
              const presentAfter = Array.isArray((taskFlowStore as any).nodes)
                ? (taskFlowStore as any).nodes.some(
                    (n: any) => n?.id === nodeId
                  )
                : false;
              console.log(
                "after  → nodes:",
                afterNodes,
                "edges:",
                afterEdges,
                "presentAfter:",
                presentAfter
              );
              console.groupEnd();
            } catch (e2) {
              console.error(
                "[actions.deleteNode] runAgentAction fallback failed:",
                e2
              );
              throw e2;
            }
          }
        },
      },
      // utilidades extras para handlers que precisem coordenar aprovação/clarify
      getCorrelation: () => ({
        current: currentCorrelationId.value,
        lastServer: lastServerCorrelationId.value,
        incoming: correlationId,
      }),
      setApprovalState: (on: boolean, corrId?: string) => {
        awaitingApproval.value = on;
        awaitingApprovalCorrelationId.value = on
          ? corrId || correlationId || currentCorrelationId.value || null
          : null;
      },
      setClarify: (
        payload: {
          reason?: string;
          questions: Array<{ key: string; label: string; required?: boolean }>;
          context?: Record<string, any>;
        },
        corrId?: string
      ) => {
        clarifyCorrelationId.value =
          corrId || correlationId || currentCorrelationId.value || null;
        clarifyPending.value = {
          reason: payload?.reason,
          questions: (payload?.questions ?? []).map((q) => ({
            key: q.key,
            label: q.label,
            required: !!q.required,
          })),
          context: payload?.context ?? {},
        };
      },
    } as any;

    // Helper to apply uiHints for post-approval effects (focus, successMessage)
    const applyUiHints = async (effs: SideEffect[]) => {
      for (const ef of effs as any[]) {
        if ((ef as any).phase === "post" && (ef as any).uiHints) {
          const hints = (ef as any).uiHints;
          if (
            hints.focusNodeId &&
            taskFlowStore.nodes.some((n: any) => n.id === hints.focusNodeId)
          ) {
            try {
              console.log(
                "[applyUiHints] focusing via uiHints:",
                hints.focusNodeId
              );
              await ctx.graphStore.focusNode(hints.focusNodeId);
            } catch (e) {
              console.error("[useAgentLogic] uiHints focus failed:", e);
            }
          }
          if (hints.successMessage) {
            console.log("[applyUiHints] successMessage:", hints.successMessage);
            ctx.pushChatMessage?.({
              role: "system",
              content: hints.successMessage,
            });
          }
        }
      }
    };

    try {
      await (effectRegistry as any).dispatch(effects, ctx);
      console.log(
        "[executeSideEffects] effectRegistry.dispatch OK for",
        effects.length,
        "effects."
      );
      // Apply UI hints (focus, success messages) for post-approval effects
      await applyUiHints(effects);
    } catch (err) {
      console.error(
        "[useAgentLogic] effectRegistry.dispatch failed (corr:",
        correlationId,
        ")",
        err
      );
      messages.value.push({
        role: "system",
        content: `Erro ao executar efeitos: ${(err as Error).message}`,
      });
    }
  };

  // Helper: parser para respostas de clarify pelo chat
  const tryConsumeClarifyAnswer = async (raw: string) => {
    if (!clarifyPending.value) return false;
    const questions = clarifyPending.value.questions || [];
    const requiredKeys = new Set(
      questions.filter((q) => q.required).map((q) => q.key)
    );

    // Parse linhas no formato "key: value"
    const entries: Record<string, string> = {};
    raw.split(/\n|\r/).forEach((line) => {
      const m = line.match(/^\s*([^:]+)\s*:\s*(.+)\s*$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2].trim();
        entries[k] = v;
      }
    });

    const providedKeys = Object.keys(entries);
    if (providedKeys.length === 0) return false; // nada pra consumir

    // Restrinja às chaves esperadas
    const answers: Record<string, any> = {};
    for (const q of questions) {
      if (entries[q.key] != null) answers[q.key] = entries[q.key];
    }

    const missing = [...requiredKeys].filter((k) => answers[k] == null);
    if (missing.length > 0) {
      messages.value.push({
        role: "system",
        content: `Faltaram campos obrigatórios: ${missing.join(
          ", "
        )}. Responda novamente com essas chaves no formato 'chave: valor'.`,
      });
      return true; // consumiu, mas incompleto — não envia resume ainda
    }

    // Tudo ok: envia o resume com ASK_CLARIFY_RESULT
    const safeCorrelationId =
      clarifyCorrelationId.value ||
      currentCorrelationId.value ||
      lastServerCorrelationId.value ||
      null;

    await sendResumePayload({
      correlationId: safeCorrelationId || undefined,
      taskId: taskIdRef.value,
      resume: { value: { kind: "ASK_CLARIFY_RESULT", answers } },
    });

    // limpa estado de clarify
    clarifyPending.value = null;
    clarifyCorrelationId.value = null;
    return true;
  };

  const sendMessage = async (userInput: string | object) => {
    // Se for string (input humano), adiciona à lista de mensagens locais
    if (typeof userInput === "string") {
      if (!userInput.trim()) return;
      messages.value.push({ role: "user", content: userInput });
    }
    // Se estamos no fluxo de clarify, tenta consumir esta resposta
    if (clarifyPending.value && typeof userInput === "string") {
      const consumed = await tryConsumeClarifyAnswer(userInput);
      if (consumed) {
        // Já tratou: não mande esta mensagem para o agente agora
        isLoading.value = false;
        return;
      }
    }
    isLoading.value = true;
    const newCorrelationId = uuidv4();
    currentCorrelationId.value = newCorrelationId;
    try {
      const problemNode = taskFlowStore.nodes.find((n) => n.type === "problem");
      // Build richer canvas context for the agent
      const nodesWithPromoted = taskFlowStore.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.data?.title ?? "",
        description: n.data?.description ?? "",
        data: { ...n.data },
      }));

      const countsByType = nodesWithPromoted.reduce(
        (acc: Record<string, number>, n) => {
          acc[n.type] = (acc[n.type] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const canvasContext = {
        goal: "Mapa visual de problema, dados e análises para o produto.",
        problem_statement: problemNode
          ? {
              id: problemNode.id,
              title: problemNode.data?.title || "",
              description: problemNode.data?.description || "",
            }
          : { id: null, title: "", description: "" },

        // Nós com campos promovidos para facilitar o parsing pelo LLM
        nodes: nodesWithPromoted,

        // Relações simples
        edges: taskFlowStore.edges.map((e) => ({
          source: e.source,
          target: e.target,
        })),

        // Resumo rápido por tipo (ajuda o modelo a perceber o estado atual do canvas)
        summary: {
          countsByType,
          existingTypes: Array.from(
            new Set(nodesWithPromoted.map((n) => n.type))
          ),
        },
      };

      const uiContext = {
        activeModal: modalStore.getActiveModalType
          ? {
              type:
                typeof (modalStore as any).getActiveModalType === "function"
                  ? (modalStore as any).getActiveModalType()
                  : (modalStore as any).getActiveModalType,
              nodeId:
                typeof (modalStore as any).getActiveNodeId === "function"
                  ? (modalStore as any).getActiveNodeId()
                  : (modalStore as any).getActiveNodeId,
            }
          : null,
      };
      const response = await $fetch<any>("/api/ai/agentChat", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: {
          userInput,
          taskId: taskIdRef.value,
          canvasContext,
          correlationId: newCorrelationId,
          uiContext,
        },
      });
      // Persist server correlation for possible resume (e.g., modal confirm)
      if (response?.correlationId) {
        lastServerCorrelationId.value = response.correlationId;
        // Always adopt the server correlationId if it differs
        if (currentCorrelationId.value !== response.correlationId) {
          currentCorrelationId.value = response.correlationId;
        }
        console.log(
          "[sendMessage] server correlationId:",
          response.correlationId
        );
      } else {
        console.log("[sendMessage] no correlationId in response");
      }
      // --- Handle pending confirmation from server (render as chat card) ---
      if (
        response?.correlationId === currentCorrelationId.value &&
        response?.pending_confirmation
      ) {
        const proposal = response.pending_confirmation;

        // 1) FOCO ANTES DO CARD (sempre que tivermos um nodeId)
        const toFocus =
          proposal?.parameters?.nodeId ??
          proposal?.parameters?.parameters?.nodeId; // fallback defensivo
        if (toFocus) {
          try {
            (taskFlowStore as any).nodeToAnimateTo = String(toFocus);
            console.log(
              "[sendMessage] Focused node before confirmation:",
              toFocus
            );
          } catch (e) {
            console.warn(
              "[sendMessage] Failed to focus before confirmation:",
              e
            );
          }
        }

        // 2) Monta o payload da ação de aprovação
        const actionPayload = {
          tool_name: proposal?.parameters?.operation ? "nodeTool" : "unknown",
          parameters: proposal?.parameters || {},
          nodeId: proposal?.parameters?.nodeId,
          correlationId: response.correlationId,
        };

        // 3) Agora exibe o card de confirmação no chat
        messages.value = [
          ...messages.value,
          {
            role: "confirmation",
            content: proposal?.summary || "Você confirma a ação proposta?",
            action: actionPayload,
          },
        ];

        // 4) Marca estado de aprovação pendente para esta correlação
        awaitingApproval.value = true;
        awaitingApprovalCorrelationId.value = response.correlationId;
      }
      if (
        response.correlationId === currentCorrelationId.value &&
        response.sideEffects
      ) {
        try {
          const sidefx = Array.isArray(response?.sideEffects)
            ? response.sideEffects.map((e: any) => ({
                type: e?.type,
                seq: e?.seq,
                phase: e?.phase,
              }))
            : [];
          console.log("[sendMessage] server sideEffects:", sidefx);
        } catch {}
        await executeSideEffects({
          effects: response.sideEffects as SideEffect[],
          correlationId: response.correlationId,
        });
      }
    } catch (error: any) {
      messages.value.push({
        role: "system",
        content: `Erro: ${error.data?.message || error.message}`,
      });
    } finally {
      isLoading.value = false;
    }
  };

  const sendResumePayload = async (args: {
    correlationId?: string;
    taskId?: string;
    resume: { value: any };
  }) => {
    isLoading.value = true;
    try {
      const correlationForResume =
        args?.correlationId ||
        currentCorrelationId.value ||
        lastServerCorrelationId.value ||
        null;

      console.log(
        "[sendResumePayload] using correlationId:",
        correlationForResume
      );

      if (!correlationForResume) {
        console.warn(
          "[sendResumePayload] missing correlationId, aborting resume."
        );
        messages.value.push({
          role: "system",
          content:
            "Não foi possível retomar a execução porque faltou o correlationId. Tente confirmar novamente.",
        });
        isLoading.value = false;
        return;
      }

      // Strip possible Vue proxies and ensure a plain object for resume.value
      const safeResumeValue = JSON.parse(
        JSON.stringify(args.resume?.value ?? {})
      );

      const body = {
        mode: "resume",
        taskId: args.taskId ?? taskIdRef.value,
        correlationId: correlationForResume,
        resume: { value: safeResumeValue }, // 🔧 shape esperado pelo humanApprovalNode quando retomado via Command({ resume })
      };

      console.log("[sendResumePayload] posting body:", body);

      const response = await $fetch<any>("/api/ai/agentChat", {
        method: "POST",
        headers: await getAuthHeaders(),
        body,
      });

      console.log("[sendResumePayload] response:", response);
      try {
        const sidefx = Array.isArray(response?.sideEffects)
          ? response.sideEffects.map((e: any) => ({
              type: e?.type,
              seq: e?.seq,
              phase: e?.phase,
            }))
          : [];
        console.log("[sendResumePayload] server sideEffects:", sidefx);
      } catch {}

      if (response?.correlationId) {
        lastServerCorrelationId.value = response.correlationId;
        if (currentCorrelationId.value !== response.correlationId) {
          currentCorrelationId.value = response.correlationId;
        }
        console.log(
          "[sendResumePayload] server correlationId:",
          response.correlationId
        );
      } else {
        console.log("[sendResumePayload] no correlationId in response");
      }

      if (
        response?.correlationId === currentCorrelationId.value &&
        response?.sideEffects
      ) {
        await executeSideEffects({
          effects: response.sideEffects as SideEffect[],
          correlationId: response.correlationId,
        });
      }
    } catch (error: any) {
      messages.value.push({
        role: "system",
        content: `Erro: ${error.data?.message || error.message}`,
      });
    } finally {
      isLoading.value = false;
    }
  };

  const handleConfirmation = async (actionProposal: any) => {
    console.log("[handleConfirmation] Received:", actionProposal);
    messages.value = messages.value.filter(
      (msg) => msg.role !== "confirmation"
    );

    // Normalize action
    const raw = actionProposal;
    const act = raw?.tool_name
      ? raw
      : raw?.action?.tool_name
      ? raw.action
      : undefined;

    if (!act) {
      console.warn("[handleConfirmation] Invalid or missing action:", raw);
      messages.value.push({
        role: "system",
        content:
          "Não foi possível confirmar: payload de ação inválido. Tente novamente.",
      });
      return;
    }

    const safeCorrelationId =
      act?.correlationId ||
      currentCorrelationId.value ||
      lastServerCorrelationId.value ||
      null;

    if (!safeCorrelationId) {
      console.warn(
        "[handleConfirmation] Missing correlationId, aborting resume."
      );
      messages.value.push({
        role: "system",
        content:
          "Não foi possível retomar a execução porque faltou o correlationId. Tente confirmar novamente.",
      });
      return;
    }

    // Resolve safe taskId
    const safeTaskId =
      (taskIdRef && "value" in taskIdRef
        ? (taskIdRef as any).value
        : undefined) ??
      act?.parameters?.taskId ??
      null;

    if (!safeTaskId) {
      console.warn("[handleConfirmation] Missing taskId, aborting resume.");
      messages.value.push({
        role: "system",
        content:
          "Não foi possível retomar a execução porque faltou o taskId. Tente confirmar novamente.",
      });
      return;
    }

    // 🔧 Agora resumeValue é apenas um booleano
    const resumeValue = true;

    console.log("[handleConfirmation] Sending resume with value:", resumeValue);

    await sendResumePayload({
      correlationId: safeCorrelationId,
      taskId: safeTaskId,
      resume: { value: resumeValue },
    });
    // Clear approval flags after sending confirmation
    awaitingApproval.value = false;
    awaitingApprovalCorrelationId.value = null;
  };

  const handleCancellation = async (actionProposal: any) => {
    console.log("[handleCancellation] Received:", actionProposal);
    messages.value = messages.value.filter(
      (msg) => msg.role !== "confirmation"
    );

    // Normalize action
    const raw = actionProposal;
    const act = raw?.tool_name
      ? raw
      : raw?.action?.tool_name
      ? raw.action
      : undefined;

    if (!act) {
      console.warn("[handleCancellation] Invalid or missing action:", raw);
      messages.value.push({
        role: "system",
        content:
          "Não foi possível cancelar: payload de ação inválido. Tente novamente.",
      });
      return;
    }

    const safeCorrelationId =
      act?.correlationId ||
      currentCorrelationId.value ||
      lastServerCorrelationId.value ||
      null;

    if (!safeCorrelationId) {
      console.warn(
        "[handleCancellation] Missing correlationId, aborting resume."
      );
      messages.value.push({
        role: "system",
        content:
          "Não foi possível retomar a execução porque faltou o correlationId. Tente cancelar novamente.",
      });
      return;
    }

    // Resolve safe taskId
    const safeTaskId =
      (taskIdRef && "value" in taskIdRef
        ? (taskIdRef as any).value
        : undefined) ??
      act?.parameters?.taskId ??
      null;

    if (!safeTaskId) {
      console.warn("[handleCancellation] Missing taskId, aborting resume.");
      messages.value.push({
        role: "system",
        content:
          "Não foi possível retomar a execução porque faltou o taskId. Tente cancelar novamente.",
      });
      return;
    }

    // 🔧 Para cancelamento agora resumeValue é apenas false
    const resumeValue = false;

    console.log("[handleCancellation] Sending resume with value:", resumeValue);

    await sendResumePayload({
      correlationId: safeCorrelationId,
      taskId: safeTaskId,
      resume: { value: resumeValue },
    });
    // Clear approval flags after sending cancellation
    awaitingApproval.value = false;
    awaitingApprovalCorrelationId.value = null;
  };

  const fetchHistory = async () => {
    try {
      const response = await $fetch<any>(
        `/api/ai/history?taskId=${encodeURIComponent(taskIdRef.value)}`,
        {
          headers: await getAuthHeaders(),
        }
      );
      if (Array.isArray(response.history) && response.history.length > 0) {
        messages.value = response.history.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.action ? { action: msg.action } : {}),
        }));
      }
      // Caso não haja histórico salvo, não define mensagem inicial do agente
    } catch (error: any) {
      messages.value = [
        {
          role: "system",
          content: "Não foi possível carregar o histórico da conversa.",
        },
      ];
    }
  };

  const handleModalConfirmation = async (action: any) => {
    console.log("[handleModalConfirmation] Recebido action:", action);
    console.log(
      "[handleModalConfirmation] currentCorrelationId:",
      currentCorrelationId.value
    );
    modalStore.closeModal();

    // Normaliza: aceita tanto uma ação direta { tool_name, parameters }
    // quanto wrappers do tipo { action: {...} }
    const raw = action;
    const act = raw?.tool_name
      ? raw
      : raw?.action?.tool_name
      ? raw.action
      : undefined;

    console.log("[handleModalConfirmation] Ação normalizada:", act);

    if (!act) {
      console.warn("[handleModalConfirmation] Ação inválida ou ausente:", raw);
      messages.value.push({
        role: "system",
        content:
          "Não foi possível confirmar: payload de ação inválido. Tente novamente.",
      });
      return;
    }

    const safeCorrelationId =
      act?.correlationId ||
      currentCorrelationId.value ||
      lastServerCorrelationId.value ||
      null;

    if (!safeCorrelationId) {
      console.warn(
        "[handleModalConfirmation] Missing correlationId, aborting resume."
      );
      messages.value.push({
        role: "system",
        content:
          "Não foi possível retomar a execução porque faltou o correlationId. Tente confirmar novamente.",
      });
      return;
    }

    // Resolve safe taskId (evita erro quando taskIdRef não está pronto)
    const safeTaskId =
      (taskIdRef && "value" in taskIdRef
        ? (taskIdRef as any).value
        : undefined) ??
      act?.parameters?.taskId ??
      null;

    if (!safeTaskId) {
      console.warn(
        "[handleModalConfirmation] Missing taskId, aborting resume."
      );
      messages.value.push({
        role: "system",
        content:
          "Não foi possível retomar a execução porque faltou o taskId. Tente confirmar novamente.",
      });
      return;
    }

    // 🔧 Agora resumeValue é apenas um booleano
    const resumeValue = true;

    console.log(
      "[handleModalConfirmation] Enviando resume com value:",
      resumeValue
    );
    console.log(
      "[handleModalConfirmation] will resume with correlation:",
      safeCorrelationId
    );

    await sendResumePayload({
      correlationId: safeCorrelationId,
      taskId: safeTaskId,
      resume: { value: resumeValue },
    });
    // Clear approval flags after sending confirmation (modal path)
    awaitingApproval.value = false;
    awaitingApprovalCorrelationId.value = null;
  };

  return {
    messages,
    isLoading,
    sendMessage,
    fetchHistory,
    handleConfirmation,
    handleCancellation,
    handleModalConfirmation,
    awaitingApproval,
    clarifyPending,
  };
}
