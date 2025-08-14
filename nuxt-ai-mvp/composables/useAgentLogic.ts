import { ref, watch, computed, type Ref } from "vue";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useModalStore, ModalType } from "~/stores/modal";
// A linha de import para useAnimatedFitToNode foi removida daqui.
import * as uuid from "uuid";
const uuidv4 = uuid.v4;
import { z } from "zod";
import { useNuxtApp } from "#imports";

import { effectSchemas } from "~/lib/sideEffects";
import type { SideEffect } from "~/lib/sideEffects";
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

  const executeSideEffects = async (
    effects: SideEffect[],
    correlationId: string
  ) => {
    console.info(
      "[useAgentLogic] executeSideEffects received effects:",
      JSON.stringify(effects, null, 2)
    );
    console.log(
      "[executeSideEffects] ids => incoming:",
      correlationId,
      " current:",
      currentCorrelationId.value,
      " lastServer:",
      lastServerCorrelationId.value
    );
    // Adopt server correlationId if we don't have one yet (e.g., page reload -> modal confirm path)
    if (!currentCorrelationId.value && correlationId) {
      console.log(
        "[executeSideEffects] adopting server correlationId:",
        correlationId
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
    if (correlationId !== currentCorrelationId.value) return;
    // 🔧 Prefer parameters from EXECUTE_ACTION within the same batch (server is source of truth)
    const firstExecuteAction: any =
      Array.isArray(effects) &&
      effects.find((e: any) => e?.type === "EXECUTE_ACTION");
    const preferExecParams: Record<string, any> | undefined =
      firstExecuteAction?.payload?.parameters;
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
    for (const effect of effects) {
      if (correlationId !== currentCorrelationId.value) break;
      const parsedEffect = effectSchemas.safeParse(effect);
      if (!parsedEffect.success) {
        console.error("[SideEffect validation error]", parsedEffect.error);
        messages.value.push({
          role: "system",
          content: `Erro interno: payload inválido para a ação '${effect.type}'.`,
        });
        continue;
      }
      try {
        switch (effect.type) {
          case "POST_MESSAGE":
            messages.value.push({
              role: "agent",
              content: effect.payload.text,
            });
            break;
          case "FOCUS_NODE": {
            // Pede ao TaskFlow.vue para animar quando estiver pronto
            taskFlowStore.nodeToAnimateTo = effect.payload.nodeId;
            await delay(400); // mantém o sequenciamento de efeitos
            break;
          }

          case "OPEN_MODAL": {
            const { nodeId } = effect.payload;
            const node = taskFlowStore.nodes.find((n) => n.id === nodeId);
            if (node && !modalStore.isModalOpen(node.type as ModalType)) {
              modalStore.openModal(
                node.type as ModalType,
                { originalData: node.data },
                nodeId
              );
              await delay(200);
            }
            break;
          }
          case "SHOW_CONFIRMATION": {
            const p = effect.payload;
            const correlationHint =
              correlationId ||
              currentCorrelationId.value ||
              lastServerCorrelationId.value ||
              ""; // ensure string

            // Set approval flags before opening modal or chat confirmation
            awaitingApproval.value = true;
            awaitingApprovalCorrelationId.value =
              correlationHint || correlationId || null;

            // Decide UI a partir do contrato novo
            const isModal = p?.render === "modal";

            // Resolve node & nodeType so we always know which modal to open
            const node = taskFlowStore.nodes.find((n) => n.id === p.nodeId);
            const nodeType = (node?.type as ModalType) ?? ModalType.problem;

            if (isModal) {
              console.log("[SHOW_CONFIRMATION] opening modal with:", {
                nodeType,
                nodeId: p.nodeId,
                summary: p.summary,
                diff: p.diff,
                actionToConfirm: {
                  tool_name: "nodeTool",
                  parameters: preferExecParams ?? p.parameters,
                  nodeId: p.nodeId,
                  correlationId: correlationHint,
                },
              });

              modalStore.openModal(
                nodeType,
                {
                  mode: "confirm",
                  diffMode: true,
                  nodeId: p.nodeId,
                  modalTitle: p.summary,
                  message: p.summary,
                  diff: p.diff,
                  // Nota: o actionToConfirm abaixo usa preferExecParams quando existir,
                  // garantindo que a confirmação aprove a versão mais recente (ex.: newData do EXECUTE_ACTION).
                  originalData: node?.data,
                  actionToConfirm: {
                    tool_name: "nodeTool",
                    parameters: preferExecParams ?? p.parameters,
                    nodeId: p.nodeId,
                    correlationId: correlationHint,
                  },
                  confirmLabel: "Confirmar",
                  cancelLabel: "Cancelar",
                },
                p.nodeId
              );
            } else {
              // Chat approval
              messages.value.push({
                role: "confirmation",
                content: p.summary,
                action: {
                  tool_name: "nodeTool",
                  parameters: preferExecParams ?? p.parameters,
                  nodeId: p.nodeId,
                  correlationId: correlationHint || "",
                },
              });
            }
            break;
          }
          case "EXECUTE_ACTION": {
            const { tool_name, parameters, feedbackMessage } = effect.payload;
            console.log("[EXECUTE_ACTION] tool:", tool_name);
            console.log("[EXECUTE_ACTION] parameters:", parameters);
            // Approval short-circuit
            if (
              awaitingApproval.value &&
              awaitingApprovalCorrelationId.value === correlationId &&
              !(parameters && parameters.isApprovedUpdate === true)
            ) {
              console.warn(
                "[EXECUTE_ACTION] bloqueado: aguardando aprovação do usuário para este correlationId."
              );
              // Não executa a ação ainda; ela será reenviada após o resume com isApprovedUpdate=true
              break;
            }
            isLoading.value = true;
            try {
              switch (tool_name) {
                case "createNode": {
                  const { nodeType, sourceNodeId, newData } = parameters;
                  await runAgentAction({
                    type: "create",
                    nodeType,
                    originId: sourceNodeId,
                    initialData: newData,
                  });
                  break;
                }
                case "datasource.create": {
                  const { sourceNodeId, newData } = parameters;
                  await runAgentAction({
                    type: "create",
                    nodeType: "dataSource",
                    originId: sourceNodeId,
                    initialData: newData,
                  });
                  break;
                }
                case "datasource.delete": {
                  const { nodeId } = parameters;
                  await runAgentAction({ type: "delete", nodeId });
                  break;
                }
                case "updateNode": {
                  const { nodeId, newData } = parameters;
                  await taskFlowStore.updateNodeData(nodeId, newData);
                  modalStore.closeModal(); // fecha o modal após aplicar a atualização
                  break;
                }
                case "problem.update": {
                  // parameters may arrive as { newData: {...}, nodeId, ... } or flattened { title, description, nodeId }
                  const p = parameters as Record<string, any>;

                  // Determine target nodeId (explicit or first problem node)
                  const targetId =
                    p.nodeId ??
                    taskFlowStore.nodes.find((n) => n.type === "problem")?.id;
                  if (!targetId) {
                    console.warn(
                      "problem.update: nó do tipo 'problem' não encontrado."
                    );
                    messages.value.push({
                      role: "system",
                      content:
                        "Não encontrei o card de Problema para atualizar — verifique se ele existe.",
                    });
                    break;
                  }

                  // Normalize payload: prefer p.newData when present; otherwise pick only known fields from flat shape
                  const normalizedData = p.newData ?? {
                    ...(typeof p.title !== "undefined"
                      ? { title: p.title }
                      : {}),
                    ...(typeof p.description !== "undefined"
                      ? { description: p.description }
                      : {}),
                  };

                  console.log("[problem.update] targetId:", targetId);
                  console.log(
                    "[problem.update] normalizedData:",
                    normalizedData
                  );

                  if (
                    !normalizedData ||
                    Object.keys(normalizedData).length === 0
                  ) {
                    console.warn(
                      "problem.update: payload sem campos válidos para atualizar."
                    );
                    messages.value.push({
                      role: "system",
                      content:
                        "Nada para atualizar no Problema (payload vazio).",
                    });
                    break;
                  }

                  await taskFlowStore.updateNodeData(targetId, normalizedData);
                  modalStore.closeModal(); // fecha modal se estiver aberto
                  break;
                }
                case "deleteNode": {
                  const { nodeId } = parameters;
                  await runAgentAction({ type: "delete", nodeId });
                  break;
                }
                case "nodeTool": {
                  const p = parameters as Record<string, any>;
                  const op = p?.operation;
                  const nodeType = p?.nodeType;

                  if (op === "create") {
                    await runAgentAction({
                      type: "create",
                      nodeType: p.nodeType,
                      originId: p.parentId ?? p.sourceNodeId,
                      initialData: p.newData,
                    });
                    break;
                  }

                  if (op === "update") {
                    // If it's the Problem node, reuse the same normalization logic as in "problem.update"
                    if (nodeType === "problem") {
                      const targetId =
                        p.nodeId ??
                        taskFlowStore.nodes.find((n) => n.type === "problem")
                          ?.id;
                      if (!targetId) {
                        console.warn(
                          "nodeTool/update: nó do tipo 'problem' não encontrado."
                        );
                        messages.value.push({
                          role: "system",
                          content:
                            "Não encontrei o card de Problema para atualizar — verifique se ele existe.",
                        });
                        break;
                      }

                      const normalizedData = p.newData ?? {
                        ...(typeof p.title !== "undefined"
                          ? { title: p.title }
                          : {}),
                        ...(typeof p.description !== "undefined"
                          ? { description: p.description }
                          : {}),
                      };

                      if (
                        !normalizedData ||
                        Object.keys(normalizedData).length === 0
                      ) {
                        console.warn(
                          "nodeTool/update: payload sem campos válidos para atualizar."
                        );
                        messages.value.push({
                          role: "system",
                          content:
                            "Nada para atualizar no Problema (payload vazio).",
                        });
                        break;
                      }

                      await taskFlowStore.updateNodeData(
                        targetId,
                        normalizedData
                      );
                      modalStore.closeModal();
                      break;
                    }

                    // Generic update for other node types
                    if (!p?.nodeId) {
                      console.warn(
                        "nodeTool/update: nodeId ausente para atualização genérica."
                      );
                      messages.value.push({
                        role: "system",
                        content:
                          "Não foi possível atualizar: nodeId ausente para o update.",
                      });
                      break;
                    }

                    await taskFlowStore.updateNodeData(
                      p.nodeId,
                      p.newData ?? {}
                    );
                    modalStore.closeModal();
                    break;
                  }

                  if (op === "delete") {
                    const targetId = p?.nodeId;
                    if (!targetId) {
                      console.warn("nodeTool/delete: nodeId ausente.");
                      messages.value.push({
                        role: "system",
                        content: "Não foi possível deletar: nodeId ausente.",
                      });
                      break;
                    }

                    // Salvaguarda: não permitir deletar o nó de problema
                    const targetNode = taskFlowStore.nodes.find(
                      (n) => n.id === targetId
                    );
                    if (targetNode?.type === "problem") {
                      messages.value.push({
                        role: "system",
                        content: "O card de Problema não pode ser deletado.",
                      });
                      break;
                    }

                    await runAgentAction({ type: "delete", nodeId: targetId });
                    modalStore.closeModal();
                    break;
                  }

                  // If other operations arrive via nodeTool in the future, fall back for now
                  console.warn("nodeTool: operação não suportada:", op);
                  messages.value.push({
                    role: "system",
                    content: `nodeTool: operação não suportada: ${op}`,
                  });
                  break;
                }
                default: {
                  console.warn("Ferramenta não mapeada:", tool_name);
                  messages.value.push({
                    role: "system",
                    content: `Ferramenta não suportada: ${tool_name}`,
                  });
                }
              }

              // Clear approval flags if this was an approved update
              if (parameters && parameters.isApprovedUpdate === true) {
                awaitingApproval.value = false;
                awaitingApprovalCorrelationId.value = null;
              }

              // ✅ Mensagem de sucesso no chat (sempre igual)
              const successMsg = {
                role: "agent" as const,
                content: "✅ Ação concluída",
              };
              console.log(
                "[EXECUTE_ACTION] pushing success chat message:",
                successMsg
              );
              // Use immutable update to ensure reactivity in any shallow watchers
              messages.value = [...messages.value, successMsg];
            } catch (e) {
              messages.value.push({
                role: "system",
                content: `Erro ao executar ação: ${(e as Error).message}`,
              });
            } finally {
              isLoading.value = false;
            }
            break;
          }
          case "CLOSE_MODAL":
            modalStore.closeModal();
            break;
          case "REFETCH_TASK_FLOW":
            // Sinal enviado pelo agente para recarregar o flow do Supabase (sem reinicializar watchers)
            if (typeof (taskFlowStore as any).refetchTaskFlow === "function") {
              await (taskFlowStore as any).refetchTaskFlow();
            } else {
              // fallback para compatibilidade antiga
              await taskFlowStore.loadTaskFlow(taskIdRef.value);
            }
            break;
          default: {
            // Isto só acontece se aparecer um novo tipo não contemplado acima
            const _exhaustiveCheck: never = effect;
            messages.value.push({
              role: "system",
              content: `Efeito desconhecido ou não suportado.`,
            });
          }
        }
      } catch (e) {
        messages.value.push({
          role: "system",
          content: `Erro ao executar efeito: ${(e as Error).message}`,
        });
      }
    }
  };

  const sendMessage = async (userInput: string | object) => {
    // Se for string (input humano), adiciona à lista de mensagens locais
    if (typeof userInput === "string") {
      if (!userInput.trim()) return;
      messages.value.push({ role: "user", content: userInput });
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
              type: modalStore.getActiveModalType,
              nodeId: modalStore.getActiveNodeId,
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
      if (
        response.correlationId === currentCorrelationId.value &&
        response.sideEffects
      ) {
        await executeSideEffects(
          response.sideEffects as SideEffect[],
          response.correlationId
        );
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
        await executeSideEffects(
          response.sideEffects as SideEffect[],
          response.correlationId
        );
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

    // 🔧 Mesmo shape do visual: confirmado + approved_action
    const resumeValue = {
      confirmed: true,
      approved_action: {
        tool_name: act.tool_name,
        parameters: {
          ...(act.parameters ?? {}),
          isApprovedUpdate: true,
        },
        nodeId: act.nodeId,
      },
    };

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

    // 🔧 Para cancelamento basta confirmed:false
    const resumeValue = { confirmed: false };

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

    // 🔧 Formato que o humanApprovalNode espera ao retomar do interrupt:
    const resumeValue = {
      confirmed: true,
      approved_action: {
        tool_name: act.tool_name,
        parameters: {
          ...(act.parameters ?? {}),
          isApprovedUpdate: true,
        },
        nodeId: act.nodeId,
      },
    };

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
  };

  return {
    messages,
    isLoading,
    sendMessage,
    fetchHistory,
    handleConfirmation,
    handleCancellation,
    handleModalConfirmation,
  };
}
