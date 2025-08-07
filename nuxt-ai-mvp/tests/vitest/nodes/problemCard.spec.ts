// tests/nodes/problemCard.spec.ts
import { setup, useTestContext } from "@nuxt/test-utils/e2e";
import { mount, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import {
  vi,
  describe,
  beforeEach,
  beforeAll,
  afterAll,
  afterEach,
  it,
  expect,
} from "vitest";
import { mockFetch } from "../../mocks/imports"; // Import mockFetch directly

// Types
import { useTaskFlowStore } from "~/stores/taskFlow";
import type { NodeData, TaskFlowNode } from "~/types/taskflow";
import { useSidebarStore } from "~/stores/sidebar";

// Define interface for ProblemCard component instance
interface ProblemCardInstance {
  requestProblemEdit: () => void;
}

/* ────────────────────────────────────────────
   Mocks
   ──────────────────────────────────────────── */

// Mock Vue Flow
vi.mock("@vue-flow/core", async () => {
  const actual = await vi.importActual("@vue-flow/core");
  return {
    ...actual,
    useVueFlow: vi.fn(() => {
      const currentStore = useTaskFlowStore();
      return {
        findNode: vi.fn((id) => {
          const nodesFromStore = currentStore?.nodes || [];
          const node = nodesFromStore.find((n: TaskFlowNode) => n.id === id);
          return node
            ? {
                ...node,
                dimensions: { width: 100, height: 100 },
              }
            : undefined;
        }),
        get nodes() {
          return currentStore?.nodes || [];
        },
        setNodes: vi.fn((newNodes) => {
          if (currentStore) {
            currentStore.nodes = newNodes;
          }
        }),
        addNodes: vi.fn((newNodesParams) => {
          if (currentStore && currentStore.nodes) {
            const nodesToAdd = Array.isArray(newNodesParams)
              ? newNodesParams
              : [newNodesParams];
            currentStore.nodes.push(...nodesToAdd);
          }
        }),
        updateNode: vi.fn((id, nodeUpdate) => {
          if (currentStore && currentStore.nodes) {
            const index = currentStore.nodes.findIndex(
              (n: TaskFlowNode) => n.id === id
            );
            if (index !== -1) {
              if (typeof nodeUpdate === "function") {
                currentStore.nodes[index] = nodeUpdate(
                  currentStore.nodes[index] as TaskFlowNode
                );
              }
            }
          }
        }),
        removeNodes: vi.fn((nodesToRemove) => {
          if (currentStore && currentStore.nodes) {
            const idsToRemove = (
              Array.isArray(nodesToRemove) ? nodesToRemove : [nodesToRemove]
            ).map((n: TaskFlowNode | string) =>
              typeof n === "string" ? n : n.id
            );
            currentStore.nodes = currentStore.nodes.filter(
              (n: TaskFlowNode) => !idsToRemove.includes(n.id)
            );
          }
        }),
      };
    }),
  };
});

// Mock NodeToolbar
vi.mock("@vue-flow/node-toolbar", () => ({
  NodeToolbar: {
    name: "NodeToolbar",
    props: ["isVisible", "position", "align", "offset"],
    template: `
      <div v-if="isVisible" class="node-toolbar">
        <slot />
      </div>
    `,
  },
}));

/* ────────────────────────────────────────────
   Test Setup & Helpers
   ──────────────────────────────────────────── */

// Module references
let store: ReturnType<typeof useTaskFlowStore>;
let problemNodeHandler: any;
let ProblemCardComponent: any;

/**
 * Creates a problem node with default values and optional overrides
 */
const createProblemNode = (
  id: string,
  data: Partial<NodeData> = {}
): TaskFlowNode => {
  const nodeData: NodeData = {
    label: data.label || "Problem Node",
    title: data.title || "Problem Statement",
    description: data.description || "Detailed description of the problem.",
    sources: data.sources || [],
    inputData: data.inputData || {},
    outputData: data.outputData || {},
    cumulativeContext: data.cumulativeContext || {
      compressed: false,
      blob: {},
    },
    analyzedData: data.analyzedData === undefined ? null : data.analyzedData,
    processInputError:
      data.processInputError === undefined ? null : data.processInputError,
    updated_at: data.updated_at || null,
    is_active: data.is_active || false,
    responseCount: data.responseCount || 0,
    isLoadingEdgeConnection: data.isLoadingEdgeConnection || false,
    ...data, // Spread any other custom data provided
  };

  return {
    id,
    type: "problem",
    position: { x: 0, y: 0 },
    data: nodeData,
    selected: false,
    draggable: true,
    selectable: true,
    dragging: false,
    computedPosition: { x: 0, y: 0, z: 0 },
    handleBounds: { source: [], target: [] },
    dimensions: { width: 0, height: 0 },
    isParent: false,
    resizing: false,
    events: {},
  };
};

/**
 * Helper function to mount ProblemCard component with standard configuration
 */
const mountProblemCard = async (nodeId: string, props = {}) => {
  const node = store.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node with id ${nodeId} not found in store`);

  const wrapper = mount(ProblemCardComponent, {
    props: {
      id: nodeId,
      type: "problem",
      data: node.data,
      selected: false,
      isLoading: false,
      hasOutgoingConnection: false,
      ...props,
    },
    global: {
      stubs: {
        ProblemIcon: true,
        OpenRight: true,
        Handle: true,
        PencilSquareIcon: {
          template:
            '<div class="pencil-square-icon" @click="$emit(\'click\')" />',
        },
      },
      provide: {
        "vue-flow__nodes": store.nodes,
        "vue-flow__node": {
          ...node,
          dimensions: { width: 100, height: 100 },
          position: { x: 0, y: 0 },
          id: nodeId,
          type: "problem",
          data: node.data,
        },
      },
    },
  });

  await nextTick();
  return wrapper;
};

/* ────────────────────────────────────────────
   Test Lifecycle
   ──────────────────────────────────────────── */

beforeAll(async () => {
  await setup({
    nuxtConfig: {
      modules: ["@nuxtjs/supabase", "@pinia/nuxt"],
      plugins: ["~/tests/plugins/mock-fetch.client.ts"], // Added our mock fetch plugin
      runtimeConfig: {
        public: {
          supabase: {
            url: "http://localhost:54321/test_problemcard_spec",
            key: "mock_key_problemcard_spec",
          },
        },
      },
    },
  });

  // Import modules dynamically to ensure proper setup
  const handlerMod = await import("~/lib/nodeHandlers/problemNodeHandler");
  problemNodeHandler = handlerMod.problemNodeHandler;

  const compMod = await import("~/components/cards/ProblemCard.vue");
  ProblemCardComponent = compMod.default;
});

afterAll(async () => {
  const ctx = useTestContext();
  await ctx?.nuxt?.close?.();
});

beforeEach(() => {
  // Setup fresh store state for each test
  setActivePinia(createPinia());
  store = useTaskFlowStore();
  store.currentTaskId = "test-task-id";
  store.nodes = [];
  store.edges = [];
  vi.clearAllMocks();
  vi.useFakeTimers(); // Moved here for consistent timer mocking
});

afterEach(async () => {
  vi.runAllTimers(); // Run pending timers
  vi.clearAllTimers(); // Clear them
  vi.useRealTimers(); // Restore real timers
  vi.restoreAllMocks();
  await nextTick();
});

/* ────────────────────────────────────────────
   Tests
   ──────────────────────────────────────────── */

describe("ProblemNodeHandler", () => {
  // beforeEach for vi.useFakeTimers() is removed from here as it's now global for the file

  it("should refine problem statement via AI when text is provided", async () => {
    // Arrange
    const node = createProblemNode("n1", { description: "Initial problem" });
    store.nodes = [node];
    await nextTick();

    // Act
    mockFetch.mockResolvedValueOnce({
      analyzedData: {
        title: "Mocked AI refined problem title",
        description: "Mocked AI refined problem statement",
        recommendations: ["Mocked recommendation 1", "Mocked recommendation 2"],
      },
    });

    const result = await problemNodeHandler.handleAction(
      "refineProblem",
      {},
      node
    );

    // Assert
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/runAnalysis"),
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          analysisKey: "refineProblemStatement",
          nodeData: expect.objectContaining({
            inputData: expect.objectContaining({
              currentTitle: "Problem Statement",
              currentDescription: "Initial problem",
            }),
            cumulativeContext: expect.any(Object),
          }),
        }),
      })
    );
    expect(result.description).toBe("Mocked AI refined problem statement");
  });

  it("should not call AI if description is empty", async () => {
    // Arrange
    const node = createProblemNode("n2", { description: "" });
    store.nodes = [node];
    await nextTick();

    // Act
    const result = await problemNodeHandler.handleAction(
      "refineProblem",
      {},
      node
    );

    // Assert
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

describe("ProblemCard component", () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    const sidebarStore = useSidebarStore();
    sidebarStore.openSidebar = vi.fn();
  });

  afterEach(async () => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it("should render title and description", async () => {
    // Arrange
    const node = createProblemNode("p1", {
      title: "My Test Problem",
      description: "This is a test description.",
    });
    store.addNode(node as any);

    // Act
    wrapper = await mountProblemCard("p1");

    // Assert
    expect(wrapper.html()).toContain("My Test Problem");
    expect(wrapper.html()).toContain("Problema Inicial");
  });

  it("should open modal when edit icon is clicked", async () => {
    // Arrange
    const node = createProblemNode("p2", { title: "Initial Title" });
    store.addNode(node as any);

    // Importação dinâmica para garantir compatibilidade com o ambiente de teste
    const { useModalStore, ModalType } = await import("~/stores/modal");
    const modalStore = useModalStore();
    const openModalSpy = vi.spyOn(modalStore, "openModal");

    wrapper = await mountProblemCard("p2", { selected: true });

    // Act
    const instance = wrapper.vm as ProblemCardInstance;
    instance.requestProblemEdit();

    // Assert
    expect(openModalSpy).toHaveBeenCalledWith(
      ModalType.problem,
      expect.objectContaining({ title: "Initial Title" }),
      "p2"
    );
  });

  it("should handle problem refinement action", async () => {
    // Arrange
    const mockHandleAction = vi.fn().mockResolvedValue({
      description: "Refined description",
    });

    const node = createProblemNode("p3", {
      title: "Refinable Problem",
      description: "Needs refinement",
    });
    store.addNode(node as any);

    // Mock handler
    vi.spyOn(problemNodeHandler, "handleAction").mockImplementation(
      mockHandleAction
    );

    wrapper = await mountProblemCard("p3");

    const result = await problemNodeHandler.handleAction(
      "refineProblem",
      {},
      node
    );

    // Assert
    expect(mockHandleAction).toHaveBeenCalledWith("refineProblem", {}, node);
    expect(result.description).toBe("Refined description");
  });
});
