import { ref, watch, computed, type Ref } from "vue";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useModalStore, ModalType } from "~/stores/modal";
// A linha de import para useAnimatedFitToNode foi removida daqui.
import * as uuid from "uuid";
const uuidv4 = uuid.v4;
import { z } from "zod";

import { effectSchemas, ShowConfirm } from "~/lib/sideEffects";
import type { SideEffect } from "~/lib/sideEffects";

interface ChatMessage {
  role: "user" | "agent" | "system" | "confirmation";
  content: string;
  action?: z.infer<typeof ShowConfirm>["payload"];
}

export function useAgentLogic(taskIdRef: Ref<string>) {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const taskFlowStore = useTaskFlowStore();
  const modalStore = useModalStore();
  const currentCorrelationId = ref<string | null>(null);
  const lastServerCorrelationId = ref<string | null>(null);

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
    // Track last correlationId we saw from server
    if (correlationId) {
      lastServerCorrelationId.value = correlationId;
    }
    if (correlationId !== currentCorrelationId.value) return;
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
              null;

            // Decide UI: default to MODAL unless approvalStyle === 'text'
            const forceText = p?.approvalStyle === "text";

            // Resolve node & nodeType so we always know which modal to open
            const node = taskFlowStore.nodes.find((n) => n.id === p.nodeId);
            const nodeType = (node?.type as ModalType) ?? ModalType.problem;

            // Normalize diff/proposed data
            const diffFields = Array.isArray(p?.diffFields)
              ? p.diffFields
              : (p as any)?.meta?.ui?.diffFields ?? [];
            const originalData = p?.originalData ?? node?.data ?? {};
            const proposedData =
              p?.proposedData ?? p?.parameters?.newData ?? {};

            if (!forceText) {
              console.log("[SHOW_CONFIRMATION] opening modal with:", {
                nodeType,
                nodeId: p.nodeId,
                modalTitle: p.modalTitle,
                message: p.displayMessage,
                originalData,
                proposedData,
                diffFields,
                actionToConfirm: {
                  tool_name: p.tool_name,
                  parameters: p.parameters,
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
                  modalTitle: p.modalTitle || "Revisar Alterações Propostas",
                  message:
                    p.displayMessage ||
                    "Revise e confirme as alterações propostas.",
                  originalData,
                  proposedData,
                  diffFields,
                  actionToConfirm: {
                    tool_name: p.tool_name,
                    parameters: p.parameters,
                    nodeId: p.nodeId,
                    correlationId: correlationHint,
                  },
                  confirmLabel: "Confirmar",
                  cancelLabel: "Cancelar",
                },
                p.nodeId
              );
            } else {
              // Chat approval (text-only)
              messages.value.push({
                role: "confirmation",
                content: p.displayMessage,
                action: { ...p },
              });
            }
            break;
          }
          case "EXECUTE_ACTION": {
            const { tool_name, parameters, feedbackMessage } = effect.payload;
            console.log("[EXECUTE_ACTION] tool:", tool_name);
            console.log("[EXECUTE_ACTION] parameters:", parameters);
            if (feedbackMessage) {
              messages.value.push({ role: "agent", content: feedbackMessage });
            }
            isLoading.value = true;
            try {
              switch (tool_name) {
                case "createNode": {
                  const { nodeType, sourceNodeId } = parameters;
                  const sourceNode = taskFlowStore.nodes.find(
                    (n) => n.id === sourceNodeId
                  );
                  await taskFlowStore.addNodeAndConnect(
                    nodeType,
                    sourceNodeId,
                    sourceNode?.position,
                    sourceNode?.dimensions?.height
                  );
                  break;
                }
                case "datasource.create": {
                  // Sem aprovação: cria nó datasource e conecta ao sourceNode (quando houver)
                  const { sourceNodeId } = parameters;
                  const sourceNode = taskFlowStore.nodes.find(
                    (n) => n.id === sourceNodeId
                  );
                  await taskFlowStore.addNodeAndConnect(
                    "datasource",
                    sourceNodeId,
                    sourceNode?.position,
                    sourceNode?.dimensions?.height
                  );
                  break;
                }
                case "datasource.delete": {
                  const { nodeId } = parameters;
                  await taskFlowStore.removeNode(nodeId);
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
                  await taskFlowStore.removeNode(nodeId);
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
              messages.value.push({
                role: "agent",
                content: "Ação de texto concluída!",
              });
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
            // Sinal enviado pelo agente para recarregar o flow do Supabase
            await taskFlowStore.loadTaskFlow(taskIdRef.value);
            // Se quiser exibir um toast ou mensagem, pode adicionar aqui.
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
      const canvasContext = {
        problem_statement: problemNode
          ? {
              title: problemNode.data?.title || "",
              description: problemNode.data?.description || "",
            }
          : { title: "", description: "" },
        nodes: taskFlowStore.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          data: { ...n.data },
        })),
        edges: taskFlowStore.edges.map((e) => ({
          source: e.source,
          target: e.target,
        })),
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
  };

  const fetchHistory = async () => {
    try {
      const response = await $fetch<any>(
        `/api/ai/history?taskId=${encodeURIComponent(taskIdRef.value)}`
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
