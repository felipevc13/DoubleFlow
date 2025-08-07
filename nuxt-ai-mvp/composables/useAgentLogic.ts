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

  const executeSideEffects = async (
    effects: SideEffect[],
    correlationId: string
  ) => {
    console.info(
      "[useAgentLogic] executeSideEffects received effects:",
      JSON.stringify(effects, null, 2)
    );
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
            const payload = effect.payload;
            if (payload.approvalStyle === "visual" && payload.nodeId) {
              const node = taskFlowStore.nodes.find(
                (n) => n.id === payload.nodeId
              );
              if (node) {
                modalStore.openModal(
                  node.type as ModalType,
                  {
                    diffMode: true,
                    originalData: payload.originalData,
                    proposedData: payload.proposedData,
                    diffFields: payload.diffFields,
                    modalTitle: payload.modalTitle,
                    actionToConfirm: {
                      tool_name: payload.tool_name,
                      parameters: payload.parameters,
                    },
                  },
                  payload.nodeId
                );
              }
            } else {
              // Confirmação no chat (padrão texto)
              messages.value.push({
                role: "confirmation",
                content: payload.displayMessage,
                action: { ...payload },
              });
            }
            break;
          }
          case "EXECUTE_ACTION": {
            const { tool_name, parameters, feedbackMessage } = effect.payload;
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
                case "updateNode": {
                  const { nodeId, newData } = parameters;
                  await taskFlowStore.updateNodeData(nodeId, newData);
                  modalStore.closeModal(); // fecha o modal após aplicar a atualização
                  break;
                }
                case "problem.update": {
                  // parameters may come with or without an explicit nodeId
                  const { nodeId, ...newData } = parameters as {
                    nodeId?: string;
                    title?: string;
                    description?: string;
                    [key: string]: any;
                  };
                  // Fallback: first node of type "problem"
                  const targetId =
                    nodeId ??
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
                  await taskFlowStore.updateNodeData(targetId, newData);
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
                content: "Ação concluída!",
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

  const sendResumePayload = async (payload: any) => {
    isLoading.value = true;
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
    try {
      const response = await $fetch<any>("/api/ai/agentChat", {
        method: "POST",
        body: {
          taskId: taskIdRef.value,
          resumePayload: payload,
          canvasContext,
          correlationId: currentCorrelationId.value,
        },
      });
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

  const handleConfirmation = async (actionProposal: any) => {
    messages.value = messages.value.filter(
      (msg) => msg.role !== "confirmation"
    );
    await sendResumePayload({ confirmed: true, action: actionProposal });
  };

  const handleCancellation = async (actionProposal: any) => {
    messages.value = messages.value.filter(
      (msg) => msg.role !== "confirmation"
    );
    await sendResumePayload({ confirmed: false, action: actionProposal });
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
    modalStore.closeModal();
    // Adiciona o flag isApprovedUpdate para ações de update que exigem aprovação visual
    const actionWithApproval = {
      ...action,
      parameters: {
        ...action.parameters,
        isApprovedUpdate: true,
      },
    };
    await sendResumePayload({ confirmed: true, action: actionWithApproval });
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
