import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockedFunction,
} from "vitest";
import { ref } from "vue";
import { setActivePinia, createPinia } from "pinia";
import { createTestingPinia } from "@pinia/testing";
import { useAgentLogic } from "~/composables/useAgentLogic";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useModalStore } from "~/stores/modal";
import {
  COMMON_TEST_DATA,
  type TestTaskFlowNode,
  type TestNodeData,
  createTestNode,
  createMockTaskFlowStore,
  createMockModalStore,
  assertNodeUpdated,
  assertModalOpened,
  MOCK_RESPONSES,
} from "../__utils__/problemNodeTestUtils";

// Local interface for ChatMessage since it's not exported from useAgentLogic
interface ChatMessage {
  role: "user" | "agent" | "system" | "confirmation";
  content: string;
  action?: any; // Simplified for test purposes
}

// Import the actual store types to ensure our mocks match
type TaskFlowStore = ReturnType<
  typeof import("~/stores/taskFlow").useTaskFlowStore
>;
type ModalStore = ReturnType<typeof import("~/stores/modal").useModalStore>;

// Mock the fetch function
let mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Problem Node Approval Flow", () => {
  let taskFlowStore: ReturnType<typeof createMockTaskFlowStore>;
  let modalStore: ReturnType<typeof createMockModalStore>;
  let testNode: TestTaskFlowNode;
  let agentLogic: ReturnType<typeof useAgentLogic>;
  let updatedNode: TestTaskFlowNode;

  const mockFetchImplementation = async (url: string, options: any = {}) => {
    if (url.includes("/api/agent")) {
      return MOCK_RESPONSES.confirmationRequired;
    }

    // Handle confirmation requests
    if (options.method === "POST" && options.body) {
      const body = JSON.parse(options.body);
      if (body.confirmed) {
        return MOCK_RESPONSES.updateSuccess;
      }
    }

    return { correlationId: COMMON_TEST_DATA.CORRELATION_ID };
  };

  beforeEach(() => {
    // Create a test node
    testNode = createTestNode(COMMON_TEST_DATA.NODE_ID, {
      title: COMMON_TEST_DATA.ORIGINAL_TITLE,
      description: COMMON_TEST_DATA.NODE_DESCRIPTION,
    });

    // Create the updated node based on the test node
    const updatedNode = {
      ...testNode,
      data: {
        ...testNode.data,
        title: COMMON_TEST_DATA.UPDATED_TITLE,
      },
    };

    // Initialize Pinia with testing support
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      stubActions: false,
    });
    setActivePinia(pinia);

    // Create mock stores with proper typing
    taskFlowStore = createMockTaskFlowStore([testNode]);
    modalStore = createMockModalStore();

    // Reset fetch mock
    mockFetch.mockReset();

    // Create a ref for the task ID
    const taskIdRef = ref(COMMON_TEST_DATA.TASK_ID);

    // Create the agent logic
    agentLogic = useAgentLogic(taskIdRef);

    // Ensure the store has the required nodes and edges
    taskFlowStore.setNodes([testNode]);
    taskFlowStore.setEdges([]);

    // Create a mock for $fetch first
    mockFetch = vi.fn().mockImplementation(mockFetchImplementation);
    // @ts-ignore - Mocking global $fetch
    global.$fetch = mockFetch as typeof global.$fetch;

    // Default mock implementation for openModal
    (modalStore.openModal as any).mockImplementation(
      (type: string, options: any) => {
        return {
          onConfirm: options?.onConfirm || vi.fn(),
          onCancel: options?.onCancel || vi.fn(),
        };
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should show confirmation modal when updating node title", async () => {
    // Mock the API response to require confirmation
    mockFetch.mockResolvedValueOnce({
      correlationId: COMMON_TEST_DATA.CORRELATION_ID,
      requiresConfirmation: true,
      message: "Confirmation required",
      sideEffects: [
        {
          type: "SHOW_CONFIRMATION",
          payload: {
            tool_name: "problem.update",
            parameters: {
              nodeId: COMMON_TEST_DATA.NODE_ID,
              newData: { title: COMMON_TEST_DATA.UPDATED_TITLE },
            },
            displayMessage: `Update node title to "${COMMON_TEST_DATA.UPDATED_TITLE}"?`,
            approvalStyle: "visual",
          },
        },
      ],
    });

    // Send the message that should trigger confirmation
    await agentLogic.sendMessage(
      `Update node title to "${COMMON_TEST_DATA.UPDATED_TITLE}"`
    );

    // Verify the confirmation modal was opened with correct parameters
    expect(modalStore.openModal).toHaveBeenCalledWith(
      "confirmation",
      expect.objectContaining({
        title: "Confirmação necessária",
        message: `Update node title to "${COMMON_TEST_DATA.UPDATED_TITLE}"?`,
        confirmText: "Confirmar",
        cancelText: "Cancelar",
        onConfirm: expect.any(Function),
        onCancel: expect.any(Function),
      })
    );
  });

  it("should update node when confirmation is accepted", async () => {
    // Mock the modal open to return handlers
    let confirmHandler: (() => Promise<void>) | null = null;

    // Store the confirm handler in a variable that we can access later
    const modalMock = {
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    };

    (modalStore.openModal as any).mockImplementation(
      (type: string, options: any) => {
        if (options?.onConfirm) {
          modalMock.onConfirm = options.onConfirm;
        }
        confirmHandler = modalMock.onConfirm;
        return modalMock;
      }
    );

    // Mock the API response to require confirmation
    mockFetch.mockResolvedValueOnce({
      correlationId: COMMON_TEST_DATA.CORRELATION_ID,
      requiresConfirmation: true,
      message: "Confirmation required",
      sideEffects: [
        {
          type: "SHOW_CONFIRMATION",
          payload: {
            tool_name: "problem.update",
            parameters: {
              nodeId: COMMON_TEST_DATA.NODE_ID,
              newData: { title: COMMON_TEST_DATA.UPDATED_TITLE },
            },
            displayMessage: "Update node title?",
            approvalStyle: "visual",
          },
        },
      ],
    });

    // Send the message that should trigger confirmation
    await agentLogic.sendMessage(
      `Update node title to "${COMMON_TEST_DATA.UPDATED_TITLE}"`
    );

    // Verify the modal was opened
    expect(modalStore.openModal).toHaveBeenCalled();

    // Get the confirm handler from the mock
    const handler = (modalStore.openModal as any).mock.calls[0][1]?.onConfirm;
    if (!handler) {
      throw new Error("Confirmation handler was not set");
    }

    // Mock the API response for the confirmation
    mockFetch.mockResolvedValueOnce({
      correlationId: COMMON_TEST_DATA.CORRELATION_ID,
      success: true,
      message: "Node updated successfully",
    });

    // Execute the confirmation handler
    await handler();

    // Verify the node was updated
    expect(taskFlowStore.updateNodeData).toHaveBeenCalledWith(
      COMMON_TEST_DATA.NODE_ID,
      expect.objectContaining({
        title: COMMON_TEST_DATA.UPDATED_TITLE,
      })
    );
  });

  it("should handle update errors", async () => {
    const errorMessage = "Failed to update node";

    // Mock the modal open to capture the confirm handler
    let confirmHandler: (() => void) | undefined;
    (modalStore.openModal as any).mockImplementation(
      (type: string, options: any) => {
        if (options?.onConfirm) {
          confirmHandler = options.onConfirm;
        }
        return { onConfirm: options?.onConfirm, onCancel: vi.fn() };
      }
    );

    // Trigger the message that should open the confirmation modal
    await agentLogic.sendMessage(
      `Update node title to "${COMMON_TEST_DATA.UPDATED_TITLE}"`
    );

    // Force an error when updating the node
    (taskFlowStore.updateNodeData as any).mockRejectedValueOnce(
      new Error(errorMessage)
    );

    // Simulate user confirmation
    if (!confirmHandler) {
      throw new Error("Confirmation handler was not set");
    }

    try {
      await confirmHandler();
    } catch (error) {
      // Expected - error will be handled by useAgentLogic
    }

    // Wait for promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify the error modal was opened with the correct message
    expect(modalStore.openModal).toHaveBeenCalledWith("error", {
      title: "Error",
      message: expect.stringContaining(errorMessage),
      confirmText: "OK",
    });
  });

  it("should handle update rejection", async () => {
    // Mock the modal open to capture the cancel handler
    let cancelHandler: (() => void) | undefined;
    (modalStore.openModal as any).mockImplementation(
      (type: string, options: any) => {
        if (options?.onCancel) {
          cancelHandler = options.onCancel;
        }
        return { onConfirm: vi.fn(), onCancel: options?.onCancel };
      }
    );

    // Trigger the message that should open the confirmation modal
    await agentLogic.sendMessage(
      `Update node title to "${COMMON_TEST_DATA.UPDATED_TITLE}"`
    );

    // Verify the modal was opened
    expect(modalStore.openModal).toHaveBeenCalled();

    // Simulate user cancellation
    if (!cancelHandler) {
      throw new Error("Cancel handler was not set");
    }
    await cancelHandler();

    // Wait for promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Verify the node was NOT updated
    expect(taskFlowStore.updateNodeData).not.toHaveBeenCalled();

    // Verify the modal was closed after cancellation
    expect(modalStore.closeModal).toHaveBeenCalled();
  });

  it("should handle invalid data in confirmation", async () => {
    // Configure the mock to simulate modal opening
    (modalStore.openModal as any).mockImplementation(
      (type: string, options: any) => {
        return { onConfirm: options?.onConfirm || vi.fn(), onCancel: vi.fn() };
      }
    );

    // Trigger the message that should open the confirmation modal with invalid data
    await agentLogic.sendMessage('Update node title to ""');

    // Verify the confirmation modal was opened correctly
    expect(modalStore.openModal).toHaveBeenCalled();

    // Simula a confirmação com dados inválidos (título vazio)
    await agentLogic.handleModalConfirmation({
      tool_name: "problem.update",
      parameters: {
        nodeId: COMMON_TEST_DATA.NODE_ID,
        newData: { title: "" }, // Título vazio é inválido
        isApprovedUpdate: true,
      },
    });

    // Verifica se o estado de carregamento foi redefinido
    expect(agentLogic.isLoading.value).toBe(false);

    // Verifica que o nó NÃO foi atualizado devido a dados inválidos
    expect(taskFlowStore.updateNodeData).not.toHaveBeenCalled();

    // Verifica se o modal foi fechado após o erro
    expect(modalStore.closeModal).toHaveBeenCalled();
  });

  it("should handle modal confirmation with valid data", async () => {
    // Simula a abertura do modal e captura a função de confirmação
    vi.mocked(modalStore.openModal).mockImplementation((type, options) => {
      return { onConfirm: options?.onConfirm || vi.fn(), onCancel: vi.fn() };
    });

    // Simulate the agent response with a side effect
    mockFetch.mockResolvedValueOnce({
      correlationId: "test-correlation-id",
      sideEffects: [
        {
          type: "SHOW_CONFIRMATION",
          payload: {
            tool_name: "problem.update",
            parameters: {
              nodeId: COMMON_TEST_DATA.NODE_ID,
              newData: { title: COMMON_TEST_DATA.UPDATED_TITLE },
            },
            displayMessage: "Do you want to update the problem?",
            approvalStyle: "visual",
          },
        },
      ],
    });

    // Simula a confirmação do modal com dados válidos
    await agentLogic.handleModalConfirmation({
      tool_name: "problem.update",
      parameters: {
        nodeId: COMMON_TEST_DATA.NODE_ID,
        newData: { title: COMMON_TEST_DATA.UPDATED_TITLE },
        isApprovedUpdate: true,
      },
    });

    // Verifica se o nó foi atualizado corretamente
    expect(taskFlowStore.updateNodeData).toHaveBeenCalledWith(
      COMMON_TEST_DATA.NODE_ID,
      expect.objectContaining({
        title: COMMON_TEST_DATA.UPDATED_TITLE,
      })
    );

    // Verifica se o modal foi fechado
    expect(modalStore.closeModal).toHaveBeenCalled();

    // Verifica se o estado de carregamento foi redefinido
    expect(agentLogic.isLoading.value).toBe(false);
  });
});
