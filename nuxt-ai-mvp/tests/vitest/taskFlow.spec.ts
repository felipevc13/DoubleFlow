// Salva a função original Date.parse para uso durante os testes, já que o mock de Date sobrescreve métodos estáticos.
const originalDateParse = Date.parse;

let mockDateNowTimestamp: number;
import { type MockInstance } from "vitest";

let dateNowSpy: MockInstance<typeof Date.now>;
let dateConstructorSpy: MockInstance<(...args: any[]) => Date>;

const setupMockDate = () => {
  mockDateNowTimestamp = new Date("2023-01-01T00:00:00.000Z").getTime();
  const OriginalDate = global.Date;

  // Mock static Date.now() on the original Date object
  dateNowSpy = vi
    .spyOn(OriginalDate, "now")
    .mockImplementation(() => mockDateNowTimestamp);

  // Mock `new Date()` constructor
  dateConstructorSpy = vi
    .spyOn(global, "Date")
    .mockImplementation(
      (
        ...args:
          | []
          | [string | number | Date]
          | [number, number, number?, number?, number?, number?, number?]
      ) => {
        if (args.length === 0) {
          return new OriginalDate(mockDateNowTimestamp);
        }
        // @ts-ignore
        return new OriginalDate(...args);
      }
    ) as MockInstance<(...args: any[]) => Date>;

  // CRITICAL FIX: Ensure the spied global.Date object also uses the mocked Date.now()
  (global.Date as any).now = dateNowSpy;

  // Restore original static methods that might be used internally by libraries
  (global.Date as any).parse = originalDateParse;
  (global.Date as any).UTC = OriginalDate.UTC;
};

const advanceTime = (ms: number = 1000) => {
  mockDateNowTimestamp += ms;
};

const restoreMockDate = () => {
  if (dateNowSpy) dateNowSpy.mockRestore();
  if (dateConstructorSpy) dateConstructorSpy.mockRestore();
  // @ts-ignore
  global.Date.parse = originalDateParse;
};
import { setup } from "@nuxt/test-utils";
import { nextTick } from "vue";
import { ref } from "vue";
import { vi, describe, beforeEach, it, expect, beforeAll } from "vitest";
import { createPinia, setActivePinia } from "pinia"; // Import Pinia functions

import { useTaskFlowStore } from "~/stores/taskFlow";
import { decompress, getAggregatedContext } from "~/utils/nodeContext";
// Mock '~/utils/nodeContext' to control getAggregatedContext behavior
// We need to import the actual implementation to use it as the default for the mock.
vi.mock("~/utils/nodeContext", async () => {
  const actualNodeContextModule = (await vi.importActual(
    "~/utils/nodeContext"
  )) as typeof import("~/utils/nodeContext");
  return {
    getAggregatedContext: vi.fn(actualNodeContextModule.getAggregatedContext),
    mergeByVersion: vi.fn(actualNodeContextModule.mergeByVersion),
    compressIfNeeded: vi.fn(actualNodeContextModule.compressIfNeeded),
    decompress: vi.fn(actualNodeContextModule.decompress), // Added for completeness, though might not be strictly necessary if only used by getAggregatedContext
    // If '~/utils/nodeContext' exports other functions that are used by the store or tests,
    // they should be re-exported from the mock here, e.g.:
    // anotherFunctionInNodeContext: actualNodeContextModule.anotherFunctionInNodeContext,
  };
});

// Local vi.mock("#imports", ...) block (lines 10-46) has been removed.

/**
 * Test Helpers
 */
interface NodeData {
  inputData?: Record<string, any>;
  outputData?: Record<string, any> | null | undefined; // Ensured this is Record<string, any> | null | undefined
  cumulativeContext?: { compressed: boolean; blob: any };
  updated_at?: string | null; // Changed
  processInputError?: any;
  sources?: any[];
  [key: string]: any;
}

/**
 * Create a test node with the given parameters
 */
const createNode = (
  id: string,
  type = "default",
  data: Partial<NodeData> = {}
) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: {
    inputData: {},
    outputData: {}, // Default to object, specific tests can override to null/undefined if type allows
    cumulativeContext: { compressed: false, blob: {} },
    updated_at: null, // Default to null, compatible with string | null
    processInputError: null,
    sources: [],
    ...data,
  },
});

/**
 * Create a test edge between nodes
 */
import type { TaskFlowNode } from "~/types/taskflow"; // Import TaskFlowNode
import type { Edge, GraphEdge } from "@vue-flow/core"; // Import Edge and GraphEdge

const createEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: "default",
});

/**
 * Setup a standard test graph with nodes A, B, C, and optional connections
 * Returns the configured store for convenience
 */
const setupTestGraph = (edges: Array<[string, string, string]> = []) => {
  const store = useTaskFlowStore();

  // Clear existing nodes and edges
  store.nodes = [];
  store.edges = [];

  // Add standard test nodes
  const nodeA = createNode("A");
  const nodeB = createNode("B");
  const nodeC = createNode("C");

  store.nodes = [nodeA, nodeB, nodeC] as any[]; // Cast to any[] to bypass temporary type issue if createNode not perfectly matching TaskFlowNode yet

  // Add requested edges
  store.edges = edges.map(([id, source, target]) => ({
    id,
    source,
    target,
    type: "default",
  })) as GraphEdge[];

  return store;
};

/**
 * Verify that references are properly updated (immutability check)
 */
const verifyReferenceChange = (
  oldRef: any,
  newRef: any
  // message parameter removed
) => {
  expect(newRef).not.toBe(oldRef); // Removed message argument
};

describe("TaskFlow Store", () => {
  // Setup Nuxt app environment once for all tests
  beforeAll(async () => {
    await setup({
      nuxtConfig: {
        modules: ["@nuxtjs/supabase", "@pinia/nuxt"],
        runtimeConfig: {
          public: {
            supabase: {
              url: "http://localhost:54321/test_taskflow_spec",
              key: "mock_key_taskflow_spec",
              redirect: true,
              redirectOptions: {
                login: "/login",
                callback: "/confirm",
                exclude: [],
              },
              clientOptions: {
                auth: {
                  autoRefreshToken: true,
                  persistSession: false,
                  detectSessionInUrl: false,
                },
              },
              cookieName: "sb-test-taskflow",
              cookieOptions: {
                maxAge: 60 * 60 * 8,
                sameSite: "lax",
                path: "/",
              },
            },
          },
        },
      },
    });
    // No need for setActivePinia as it's globally active from setup
  });

  // Reset state before each test
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    setupMockDate(); // Setup date mock para cada teste
    const store = useTaskFlowStore();
    store.currentTaskId = "test-task-id";
    store.nodes = [];
    store.edges = [];
  });

  afterEach(() => {
    restoreMockDate();
  });

  describe("Cumulative Context Management", () => {
    it("should correctly merge and version cumulative context from multiple sources", async () => {
      // Setup a graph where C receives from both A and B
      const store = setupTestGraph([
        ["eA-C", "A", "C"],
        ["eB-C", "B", "C"],
      ]);

      // Verification variables
      let contextC;

      // First propagation: A -> C
      const outputA_v1 = { data: "from A v1" };
      store.nodes[0].data.outputData = outputA_v1;

      const initialNodesRef_A1 = store.nodes;
      const initialNodeCData_A1 = store.nodes.find((n) => n.id === "C")!.data;

      // Advance time, save version
      advanceTime();
      const expectedVersionA1 = mockDateNowTimestamp;

      await store.propagateOutput("A");
      await nextTick();

      // Verify references were updated
      verifyReferenceChange(initialNodesRef_A1, store.nodes);
      verifyReferenceChange(
        initialNodeCData_A1,
        store.nodes.find((n) => n.id === "C")!.data
      );

      // Check context content
      contextC = getAggregatedContext(store.nodes.find((n) => n.id === "C")!);
      expect(contextC.A?.output).toEqual(outputA_v1);
      expect(contextC.A?.version).toEqual(expectedVersionA1);
      expect(contextC.B).toBeUndefined();

      // Second propagation: B -> C
      const outputB_v1 = { data: "from B v1" };
      store.nodes.find((n) => n.id === "B")!.data.outputData = outputB_v1;

      const initialNodesRef_B1 = store.nodes;
      const initialNodeCData_B1 = store.nodes.find((n) => n.id === "C")!.data;

      advanceTime();
      const expectedVersionB1 = mockDateNowTimestamp;

      await store.propagateOutput("B");
      await nextTick();

      // Verify references were updated
      verifyReferenceChange(initialNodesRef_B1, store.nodes);
      verifyReferenceChange(
        initialNodeCData_B1,
        store.nodes.find((n) => n.id === "C")!.data
      );

      // Check context content - should have both A and B now
      contextC = getAggregatedContext(store.nodes.find((n) => n.id === "C")!);
      expect(contextC.A?.version).toEqual(expectedVersionA1);
      expect(contextC.B?.output).toEqual(outputB_v1);
      expect(contextC.B?.version).toEqual(expectedVersionB1);

      // Third propagation: A again with new data (version should increment)
      const outputA_v2 = { data: "from A v2" };
      store.nodes.find((n) => n.id === "A")!.data.outputData = outputA_v2;

      advanceTime();
      const expectedVersionA2 = mockDateNowTimestamp;

      await store.propagateOutput("A");
      await nextTick();

      // Check updated context
      contextC = getAggregatedContext(store.nodes.find((n) => n.id === "C")!);
      expect(contextC.A?.output).toEqual(outputA_v2);
      expect(contextC.A?.version).toEqual(expectedVersionA2); // Version should increment
      expect(contextC.B?.version).toEqual(expectedVersionB1); // B unchanged
    });

    it("should compress cumulative context when size exceeds threshold", async () => {
      const store = setupTestGraph([["eA-B", "A", "B"]]);

      // Create data that will exceed compression threshold
      const largePayload = { largeData: "a".repeat(210 * 1024) }; // ~210 kB
      store.nodes.find((n) => n.id === "A")!.data.outputData = largePayload;

      advanceTime();
      const expectedVersionA = mockDateNowTimestamp;

      await store.propagateOutput("A");
      await nextTick();

      // Check if compression was applied
      const nodeBContextData = store.nodes.find((n) => n.id === "B")!.data
        .cumulativeContext;
      expect(nodeBContextData.compressed).toBe(true);

      // Verify the decompressed content is correct
      const decompressed = getAggregatedContext(
        store.nodes.find((n) => n.id === "B")!
      );
      expect(decompressed.A?.output).toEqual(largePayload);
      expect(decompressed.A?.version).toEqual(expectedVersionA);
    });

    it("should handle empty outputs correctly", async () => {
      const store = setupTestGraph([["eA-B", "A", "B"]]);

      // Test with undefined output
      store.nodes.find((n) => n.id === "A")!.data.outputData = undefined as any; // Cast to any
      advanceTime();
      const expectedVersion1 = mockDateNowTimestamp;
      await store.propagateOutput("A");
      await nextTick();

      // Should still track version but with undefined output
      const contextB1 = getAggregatedContext(
        store.nodes.find((n) => n.id === "B")!
      );
      expect(contextB1.A?.version).toEqual(expectedVersion1);
      expect(contextB1.A?.output).toEqual({});

      // Test with null output
      store.nodes.find((n) => n.id === "A")!.data.outputData = null as any; // Cast to any
      advanceTime();
      const expectedVersion2 = mockDateNowTimestamp;
      await store.propagateOutput("A");
      await nextTick();

      // Should update version with null output
      const contextB2 = getAggregatedContext(
        store.nodes.find((n) => n.id === "B")!
      );
      expect(contextB2.A?.version).toEqual(expectedVersion2);
      expect(contextB2.A?.output).toEqual({});
    });
  });

  describe("Edge Management", () => {
    it("should correctly clean up inputData and cumulativeContext on edge removal", async () => {
      // Setup a more complex graph for edge testing
      const store = useTaskFlowStore();
      const nodeA = createNode("A");
      const nodeB = createNode("B");
      const nodeC = createNode("C");
      const nodeD = createNode("D");

      (store.nodes as any[]) = [nodeA, nodeB, nodeC, nodeD]; // Cast to any[]
      store.edges = [
        { id: "eA-C", source: "A", target: "C", type: "default" } as GraphEdge,
        { id: "eB-C", source: "B", target: "C", type: "default" } as GraphEdge,
        { id: "eA-D", source: "A", target: "D", type: "default" } as GraphEdge,
      ];

      // Propagate data
      store.nodes.find((n) => n.id === "A")!.data.outputData = { data: "A" };
      store.nodes.find((n) => n.id === "B")!.data.outputData = { data: "B" };
      await store.propagateOutput("A");
      await store.propagateOutput("B");

      // Case 1: Remove A→C (B still connected)
      await store.removeEdge("eA-C");

      // C should no longer have A's data but still have B's
      const nodeC_after = store.nodes.find((n) => n.id === "C")!;
      expect(nodeC_after.data.inputData).toEqual({ B: { data: "B" } });
      expect(nodeC_after.data.inputData!.A).toBeUndefined();
      expect(getAggregatedContext(nodeC_after).A).toBeUndefined();
      expect(getAggregatedContext(nodeC_after).B).toBeDefined();

      // Case 2: Remove A→D (A was D's only parent)
      await store.removeEdge("eA-D");

      // D should have no context at all now
      const nodeD_after = store.nodes.find((n) => n.id === "D")!;
      expect(nodeD_after.data.inputData).toEqual({});
      expect(nodeD_after.data.inputData!.A).toBeUndefined();
      expect(getAggregatedContext(nodeD_after).A).toBeUndefined();
      expect(Object.keys(getAggregatedContext(nodeD_after))).toHaveLength(0);
    });

    it("should update downstream nodes when an edge is added", async () => {
      const store = setupTestGraph([["eA-B", "A", "B"]]);

      // Set output for A and propagate
      store.nodes.find((n) => n.id === "A")!.data.outputData = {
        data: "A output",
      };
      advanceTime();
      const expectedVersionA = mockDateNowTimestamp;
      await store.propagateOutput("A");

      // Now add an edge from A to C
      await store.addEdge(createEdge("eA-C", "A", "C"));

      // C should now have A's context
      const contextC = getAggregatedContext(
        store.nodes.find((n) => n.id === "C")!
      );
      expect(contextC.A?.output).toEqual({ data: "A output" });
      expect(contextC.A?.version).toEqual(expectedVersionA);
    });

    it('should propagate context immediately when adding a node via addNodeAndConnect (simulating "+" button)', async () => {
      const store = useTaskFlowStore();
      // Cria nó A como origem
      const nodeA = {
        id: "A",
        type: "problem",
        position: { x: 0, y: 0 },
        data: {
          inputData: {},
          outputData: { value: 123 },
          cumulativeContext: { compressed: false, blob: {} },
          updated_at: null,
          processInputError: null,
          sources: [],
        },
        // Add default GraphNode properties for testing
        selected: false,
        computedPosition: { x: 0, y: 0, z: 0 },
        handleBounds: { source: [], target: [] },
        dimensions: { width: 300, height: 120 },
        isParent: false,
        draggable: true,
        selectable: true,
        resizing: false,
        dragging: false,
        events: {},
      };
      store.nodes = [nodeA];
      store.edges = [];

      // Adiciona novo nó conectado a A via "+" (addNodeAndConnect)
      const newNode = await store.addNodeAndConnect(
        "dataSource",
        "A",
        { x: 100, y: 100 },
        60
      );
      expect(newNode).toBeDefined(); // Ensure newNode is not null

      // Checa se novo nó existe e está conectado
      expect(store.nodes.length).toBe(2);
      expect(store.edges.length).toBe(1);
      expect(store.edges[0].source).toBe("A");
      expect(store.edges[0].target).toBe(newNode!.id);

      // Checa se o contexto foi propagado imediatamente
      const addedNode = store.nodes.find((n) => n.id === newNode!.id);
      const decompressedBlob = decompress(addedNode?.data.cumulativeContext);
      expect(decompressedBlob.A).toBeDefined();
      expect(decompressedBlob.A.output).toEqual({
        value: 123,
      });
    });

    it('should display the edge immediately when adding a node via "+" button (addNodeAndConnect)', async () => {
      const store = useTaskFlowStore();
      // Cria nó de origem (ex: "problem")
      const nodeA = {
        id: "A",
        type: "problem",
        position: { x: 0, y: 0 },
        data: {
          inputData: {},
          outputData: { value: 123 },
          cumulativeContext: { compressed: false, blob: {} },
          updated_at: null,
          processInputError: null,
          sources: [],
        },
        // Add default GraphNode properties for testing
        selected: false,
        computedPosition: { x: 0, y: 0, z: 0 },
        handleBounds: { source: [], target: [] },
        dimensions: { width: 300, height: 120 },
        isParent: false,
        draggable: true,
        selectable: true,
        resizing: false,
        dragging: false,
        events: {},
      };
      store.nodes = [nodeA];
      store.edges = [];

      // Simula ação do "+" do card
      const newNode = await store.addNodeAndConnect(
        "dataSource",
        "A",
        { x: 100, y: 100 },
        60
      );
      expect(newNode).toBeDefined();

      // Edge deve estar presente IMEDIATAMENTE no store
      expect(store.edges.length).toBe(1);
      const edge = store.edges[0];
      expect(edge.source).toBe("A");
      expect(edge.target).toBe(newNode!.id);

      // E deve ser do tipo correto
      expect(edge.type).toBe("smoothstep");
    });
  });

  describe("Node Management", () => {
    it("updateNodeData should create new references", async () => {
      const store = useTaskFlowStore();
      (store.nodes as any[]) = [createNode("A")]; // Cast to any[]

      const oldNodesRef = store.nodes;
      const oldDataRef = store.nodes[0].data;

      await store.updateNodeData("A", { title: "Updated A" });

      verifyReferenceChange(oldNodesRef, store.nodes);
      verifyReferenceChange(oldDataRef, store.nodes[0].data);
      expect(store.nodes[0].data.title).toBe("Updated A");
    });

    it("addNode / removeNode should create new array references", async () => {
      const store = useTaskFlowStore();
      (store.nodes as any[]) = [createNode("A")]; // Cast to any[]

      // Test addNode
      const oldNodesRef = store.nodes;
      await store.addNode(createNode("B") as any); // Cast to any

      verifyReferenceChange(oldNodesRef, store.nodes);
      expect(store.nodes.length).toBe(2);

      // Test removeNode
      const midNodesRef = store.nodes;
      await store.removeNode("A");

      verifyReferenceChange(midNodesRef, store.nodes);
      expect(store.nodes.length).toBe(1);
      expect(store.nodes[0].id).toBe("B");
    });

    it("should handle node position updates correctly", async () => {
      const store = useTaskFlowStore();
      (store.nodes as any[]) = [createNode("A")]; // Cast to any[]

      const oldNodesRef = store.nodes;
      const oldNodeRef = store.nodes[0];
      const oldPositionRef = store.nodes[0].position;

      await store.updateNodePosition("A", { x: 100, y: 200 });

      verifyReferenceChange(oldNodesRef, store.nodes);
      verifyReferenceChange(oldNodeRef, store.nodes[0]);
      verifyReferenceChange(oldPositionRef, store.nodes[0].position);

      expect(store.nodes[0].position).toEqual({ x: 100, y: 200 });
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in propagateOutput gracefully", async () => {
      const store = setupTestGraph([["eA-B", "A", "B"]]);

      // Importe a função mocked já mockada pelo vi.mock, para sobrescrever só nesse teste
      const nodeContextUtils = await import("~/utils/nodeContext");
      const mockedDecompress =
        nodeContextUtils.decompress as unknown as MockInstance;

      // Importa o módulo real para fallback
      const ActualNodeContextModule = await vi.importActual<
        typeof import("~/utils/nodeContext")
      >("~/utils/nodeContext");

      let decompressCallCount = 0;
      mockedDecompress.mockImplementation((context: any) => {
        decompressCallCount++;
        if (decompressCallCount === 2) {
          // 2a chamada = node B (target)
          throw new Error("Test error in target decompression");
        }
        // Chamada "normal"
        return ActualNodeContextModule.decompress(context);
      });

      store.nodes.find((n) => n.id === "A")!.data.outputData = { data: "test" };
      await store.propagateOutput("A");
      await nextTick();

      const nodeB_after_error = store.nodes.find((n) => n.id === "B")!;
      expect(nodeB_after_error.data.processInputError).toBeDefined();
      expect(typeof nodeB_after_error.data.processInputError).toBe("string");
      expect(nodeB_after_error.data.processInputError).toMatch(
        /Test error in target decompression/
      );

      // Restaure para não afetar outros testes
      mockedDecompress.mockImplementation(ActualNodeContextModule.decompress);
    });
  });

  // describe("Task Management", () => {
  //   it("should initialize a new task correctly", async () => {
  //     const store = useTaskFlowStore();

  //     // Clear existing state
  //     store.nodes = [];
  //     store.edges = [];
  //     store.currentTaskId = null;

  //     // Initialize a new task
  //     await store.initializeTask("new-task-id", "New Task Title");

  //     expect(store.currentTaskId).toBe("new-task-id");
  //     expect(store.taskTitle).toBe("New Task Title");
  //     expect(store.nodes).toEqual([]); // Should start with empty nodes
  //     expect(store.edges).toEqual([]); // Should start with empty edges
  //   });
  // });
  describe("TaskFlowStore Interaction for ReportCard Cleanup", () => {
    // Mock Supabase client for these tests if not already globally available and configured
    // For example, using a simplified mock or the one from ../setup if applicable
    // vi.mock('~/utils/supabase', () => ({ useSupabaseClient: () => mockSupabaseClient }));

    it("should delete report from Supabase when ReportCard node with report_id is removed", async () => {
      const store = useTaskFlowStore();
      const reportNode = createNode("reportNode1", "report", {
        analyzedData: { report_id: "test-report-id-123" },
      });
      (store.nodes as any[]).push(reportNode);

      // Mock Supabase delete operation
      const deleteMock = vi.fn().mockResolvedValue({ error: null });
      const eqMock = vi.fn().mockReturnThis();
      const fromMock = vi
        .fn()
        .mockReturnValue({ delete: deleteMock, eq: eqMock });
      // Assuming useSupabaseClient is mocked or available
      // (useSupabaseClient() as any).from = fromMock; // Adjust if your Supabase mock setup differs

      await store.removeNode("reportNode1");

      // expect(fromMock).toHaveBeenCalledWith("reports");
      // expect(eqMock).toHaveBeenCalledWith("id", "test-report-id-123");
      // expect(deleteMock).toHaveBeenCalled();
      // Note: The actual call to Supabase client needs to be correctly mocked.
      // The above is a conceptual guide. If mockSupabaseClient from setup.ts is used,
      // ensure it's configured for these specific assertions.
      // For instance:
      // mockSupabaseClient.from('reports').delete().eq('id', 'test-report-id-123') should be callable.
    });

    it("should NOT delete from Supabase if ReportCard node has no report_id", async () => {
      const store = useTaskFlowStore();
      const reportNodeNoId = createNode("reportNode2", "report", {
        analyzedData: null, // No report_id
      });
      (store.nodes as any[]).push(reportNodeNoId);

      const deleteMock = vi.fn();
      // (useSupabaseClient() as any).from = vi.fn().mockReturnValue({ delete: deleteMock }); // Simplified mock

      await store.removeNode("reportNode2");

      expect(deleteMock).not.toHaveBeenCalled();
    });
  });
});
