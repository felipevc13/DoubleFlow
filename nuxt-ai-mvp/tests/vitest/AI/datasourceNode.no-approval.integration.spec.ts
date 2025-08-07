import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { ref, nextTick } from "vue";
import { useAgentLogic } from "~/composables/useAgentLogic";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useModalStore } from "~/stores/modal";

// Mocks
vi.mock("~/stores/taskFlow");
vi.mock("~/stores/modal");

// Cria um mock para o $fetch
const mockFetch = vi.fn();

// Substitui o $fetch global pelo nosso mock
// @ts-ignore - Ignorando erros de tipo para simplificar
global.$fetch = mockFetch;

// Mock para o nanoid
vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-123'
}));

describe('Agent actions without approval (datasource node)', () => {
  let mockTaskFlowStore: any;
  let mockModalStore: any;
  let agentLogic: ReturnType<typeof useAgentLogic>;
  const taskId = "task-123";
  const nodeId = "datasource-1";
  const datasourceData = { 
    name: "API Data", 
    type: "api", 
    url: "https://api.example.com" 
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    
    // Setup task flow store
    mockTaskFlowStore = {
      nodes: [],
      edges: [],
      currentTaskId: taskId,
      addNode: vi.fn().mockImplementation((node) => {
        mockTaskFlowStore.nodes.push(node);
        return Promise.resolve();
      }),
      removeNode: vi.fn().mockImplementation((nodeId: string) => {
        mockTaskFlowStore.nodes = mockTaskFlowStore.nodes.filter((n: any) => n.id !== nodeId);
        return Promise.resolve();
      }),
      updateNodeData: vi.fn().mockResolvedValue(undefined),
      addNodeAndConnect: vi.fn().mockImplementation((nodeType, sourceNodeId, position) => {
        const newNode = { 
          id: `node-${Math.random().toString(36).substr(2, 9)}`,
          type: nodeType,
          data: { ...datasourceData, updated_at: new Date().toISOString() },
          position: position || { x: 0, y: 0 },
          dimensions: { width: 200, height: 100 }
        };
        mockTaskFlowStore.nodes.push(newNode);
        return Promise.resolve(newNode);
      }),
      loadTaskFlow: vi.fn().mockResolvedValue(undefined),
      saveTaskFlow: vi.fn().mockResolvedValue(undefined)
    };
    
    // Setup modal store
    mockModalStore = {
      openModal: vi.fn(),
      closeModal: vi.fn(),
      isModalOpen: vi.fn().mockReturnValue(false)
    };
    
    vi.mocked(useTaskFlowStore).mockReturnValue(mockTaskFlowStore);
    vi.mocked(useModalStore).mockReturnValue(mockModalStore);
    
    agentLogic = useAgentLogic(ref(taskId));
    
    // Reset mocks
    mockFetch.mockClear();
    mockTaskFlowStore.addNode.mockClear();
    mockTaskFlowStore.removeNode.mockClear();
    mockModalStore.openModal.mockClear();
    mockModalStore.closeModal.mockClear();
  });

  it("cria nó datasource sem aprovação", async () => {
    // Configura o mock para retornar um side effect de EXECUTE_ACTION
    const mockResponse = {
      correlationId: "test-123",
      sideEffects: [{
        type: "EXECUTE_ACTION",
        payload: {
          tool_name: "createNode",
          parameters: {
            nodeType: "datasource",
            sourceNodeId: undefined,
            position: { x: 100, y: 100 },
            nodeData: datasourceData
          },
          feedbackMessage: "Data source criado com sucesso!"
        }
      }]
    };
    
    // Configura o mock para o $fetch
    mockFetch.mockResolvedValueOnce(mockResponse);
    
    // Configura o mock para o addNodeAndConnect
    const newNode = { 
      id: nodeId,
      type: "datasource",
      data: { ...datasourceData, updated_at: new Date().toISOString() },
      position: { x: 100, y: 100 },
      dimensions: { width: 200, height: 100 }
    };
    
    mockTaskFlowStore.addNodeAndConnect.mockResolvedValueOnce(newNode);

    // Envia a mensagem com a ação
    await agentLogic.sendMessage({
      role: "agent",
      content: "Criando data source...",
      action: {
        tool_name: "datasource.create",
        parameters: { 
          nodeType: "datasource", 
          nodeData: datasourceData,
          position: { x: 100, y: 100 }
        },
        needsApproval: false,
      },
    });

    // Aguarda a próxima atualização do ciclo de vida do Vue
    await nextTick();
    
    // Verifica se o $fetch foi chamado corretamente
    expect(mockFetch).toHaveBeenCalled();
    
    // Verifica se o addNodeAndConnect foi chamado com os parâmetros corretos
    expect(mockTaskFlowStore.addNodeAndConnect).toHaveBeenCalledWith(
      "datasource",
      undefined,
      { x: 100, y: 100 },
      undefined
    );
    
    // Verifica se o nó foi adicionado à lista de nós
    expect(mockTaskFlowStore.nodes).toHaveLength(1);
    expect(mockTaskFlowStore.nodes[0].type).toBe("datasource");
    expect(mockTaskFlowStore.nodes[0].data).toEqual(expect.objectContaining(datasourceData));
    
    // Verifica se a mensagem de feedback foi adicionada
    const messages = Array.isArray(agentLogic.messages) 
      ? agentLogic.messages 
      : agentLogic.messages.value;
    
    expect(messages.some((m: any) => 
      m.role === 'assistant' && 
      m.content === 'Data source criado com sucesso!'
    )).toBe(true);
  });

  it("deleta nó datasource sem aprovação", async () => {
    // Adiciona um nó para ser deletado
    const nodeToDelete = { 
      id: nodeId, 
      type: "datasource", 
      data: { ...datasourceData, updated_at: new Date().toISOString() },
      position: { x: 100, y: 100 },
      dimensions: { width: 200, height: 100 }
    };
    mockTaskFlowStore.nodes = [nodeToDelete];
    
    // Configura o mock para retornar um side effect de EXECUTE_ACTION
    const mockResponse = {
      correlationId: "test-456",
      sideEffects: [{
        type: "EXECUTE_ACTION",
        payload: {
          tool_name: "deleteNode",
          parameters: { nodeId },
          feedbackMessage: "Data source removido com sucesso!"
        }
      }]
    };
    
    // Configura o mock para o $fetch
    mockFetch.mockResolvedValueOnce(mockResponse);
    
    // Configura o mock para o removeNode
    mockTaskFlowStore.removeNode.mockImplementationOnce(() => {
      mockTaskFlowStore.nodes = [];
      return Promise.resolve();
    });
    
    // Envia a mensagem com a ação
    await agentLogic.sendMessage({
      role: "agent",
      content: "Removendo data source...",
      action: {
        tool_name: "datasource.delete",
        parameters: { nodeId },
        needsApproval: false,
      },
    });

    // Aguarda a próxima atualização do ciclo de vida do Vue
    await nextTick();
    
    // Verifica se o $fetch foi chamado corretamente
    expect(mockFetch).toHaveBeenCalled();
    
    // Verifica se o removeNode foi chamado com o ID correto
    expect(mockTaskFlowStore.removeNode).toHaveBeenCalledWith(nodeId);
    
    // Verifica se a mensagem de feedback foi adicionada
    const messages = Array.isArray(agentLogic.messages) 
      ? agentLogic.messages 
      : agentLogic.messages.value;
    
    expect(messages.some((m: any) => 
      m.role === 'assistant' && 
      m.content === 'Data source removido com sucesso!'
    )).toBe(true);
    
    expect(mockTaskFlowStore.nodes).toHaveLength(0);
    
    // Verifica se a mensagem de sucesso foi adicionada
    expect(messages.some((m: any) => 
      m.role === 'agent' && m.content === 'Ação concluída!'
    )).toBe(true);
  });
});
