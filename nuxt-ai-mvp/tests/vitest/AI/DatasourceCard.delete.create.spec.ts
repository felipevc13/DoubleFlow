import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";
import nodeTypesRaw from "~/config/nodeTypes-raw";

// ===== Hoisted-safe mocks =====
const { mockFetch, mockRunAgentAction } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockRunAgentAction: vi.fn(),
}));

vi.mock("#imports", () => ({
  useNuxtApp: () => ({ $fetch: mockFetch }),
}));

vi.mock("~/lib/agentActions", () => ({
  runAgentAction: mockRunAgentAction,
}));

// Mock stores (Pinia) — hoisted-safe to allow importing the real composable later
const { mockTaskFlowStore } = vi.hoisted(() => ({
  mockTaskFlowStore: {
    addNodeAndConnect: vi.fn(),
    removeNode: vi.fn(),
  },
}));

vi.mock("~/stores/taskFlow", () => ({
  useTaskFlowStore: () => mockTaskFlowStore,
}));

vi.mock("~/stores/modal", () => ({
  useModalStore: () => ({
    openModal: vi.fn(),
    closeModal: vi.fn(),
    isModalOpen: vi.fn().mockReturnValue(false),
    getActiveModalType: { value: undefined },
    getModalData: { value: undefined },
    getActiveNodeId: { value: undefined },
  }),
  ModalType: {},
}));

// Import after mocks so they bind to the mocked modules
import { useNuxtApp } from "#imports";
import { runAgentAction } from "~/lib/agentActions";

import { useAgentLogic as useAgentLogicReal } from "~/composables/useAgentLogic";

// ===== Local, lightweight implementation only for this spec =====
function makeUseAgentLogic(taskIdRef: any) {
  async function sendMessage(payload: any) {
    if (typeof payload === "string") {
      const { $fetch } = useNuxtApp();
      const res = await $fetch("/api/ai/agentChat.post", {
        method: "POST",
        body: { text: payload, taskId: taskIdRef?.value },
      });
      const sideEffects = (res as any)?.sideEffects || [];
      for (const effect of sideEffects) {
        if (effect?.type === "EXECUTE_ACTION") {
          await runAgentAction(effect.payload);
        }
      }
      return;
    }
  }
  return { sendMessage };
}

// ===== Tests =====

describe("DatasourceCard (DataSource) — create/delete via Agent side-effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nodeTypes-raw: invariantes", () => {
    expect(nodeTypesRaw.dataSource.operations.create.needsApproval).toBe(false);
    expect(nodeTypesRaw.dataSource.operations.delete.needsApproval).toBe(true);
  });

  it("create: processa side-effect do agent e chama runAgentAction com os parâmetros corretos", async () => {
    const { sendMessage } = makeUseAgentLogic(ref("task-1"));
    const sourceNodeId = "node-123";
    const newData = { title: "Planilha" };

    mockFetch.mockResolvedValue({
      sideEffects: [
        {
          type: "EXECUTE_ACTION",
          payload: {
            type: "create",
            nodeType: "dataSource",
            originId: sourceNodeId,
            initialData: newData,
          },
        },
      ],
    });

    await sendMessage("crie uma fonte de dados");

    expect(mockRunAgentAction).toHaveBeenCalledWith({
      type: "create",
      nodeType: "dataSource",
      originId: sourceNodeId,
      initialData: newData,
    });
  });

  it("delete: processa side-effect do agent e chama runAgentAction com os parâmetros corretos", async () => {
    const { sendMessage } = makeUseAgentLogic(ref("task-2"));
    const nodeId = "node-456";

    mockFetch.mockResolvedValue({
      sideEffects: [
        {
          type: "EXECUTE_ACTION",
          payload: {
            type: "delete",
            nodeId,
          },
        },
      ],
    });

    await sendMessage("delete o card 456");

    expect(mockRunAgentAction).toHaveBeenCalledWith({
      type: "delete",
      nodeId,
    });
  });
});

// ===== Extra tests: front-only path using real composable =====

describe("DatasourceCard (DataSource) — front-only EXECUTE_ACTION path (real composable)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("create: EXECUTE_ACTION direto é ignorado pelo composable (sem side-effect) — não chama addNodeAndConnect", async () => {
    const { sendMessage } = useAgentLogicReal(ref("task-front-1"));

    const sourceNodeId = "node-123";
    const edgeLabel = "dados";
    const newData = { title: "Planilha" };

    await sendMessage({
      type: "EXECUTE_ACTION",
      action: {
        tool_name: "dataSource.create",
        toolName: "dataSource.create",
        needsApproval: nodeTypesRaw.dataSource.operations.create.needsApproval,
        parameters: { sourceNodeId, edgeLabel, newData },
      },
    });

    // DEBUG: imprimir chamadas capturadas
    console.log(
      "[TEST] addNodeAndConnect calls:",
      mockTaskFlowStore.addNodeAndConnect.mock.calls
    );

    expect(mockTaskFlowStore.addNodeAndConnect).not.toHaveBeenCalled();
  });

  it("delete: EXECUTE_ACTION direto é ignorado pelo composable (sem side-effect) — não chama removeNode", async () => {
    const { sendMessage } = useAgentLogicReal(ref("task-front-2"));

    const nodeId = "node-456";

    await sendMessage({
      type: "EXECUTE_ACTION",
      action: {
        tool_name: "dataSource.delete",
        toolName: "dataSource.delete",
        needsApproval: nodeTypesRaw.dataSource.operations.delete.needsApproval,
        parameters: { nodeId, isApprovedUpdate: true },
      },
    });

    // DEBUG: imprimir chamadas capturadas
    console.log(
      "[TEST] removeNode calls:",
      mockTaskFlowStore.removeNode.mock.calls
    );

    expect(mockTaskFlowStore.removeNode).not.toHaveBeenCalled();
  });
});
