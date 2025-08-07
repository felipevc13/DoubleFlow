import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTaskFlowStore } from "~/stores/taskFlow";

// Mocks para handlers/composables
vi.mock("~/lib/nodeHandlers", () => ({
  getNodeHandler: (type: string) => ({
    generateOutput: vi.fn(async (node) => ({
      mockOutput: true,
      type,
      id: node.id,
    })),
    processInput: vi.fn(async () => ({ processed: true })),
    handleAction: vi.fn(async () => ({})),
  }),
}));

vi.mock("~/composables/taskflow/useNodeInitialization", () => ({
  useNodeInitialization: () => ({
    createNewNodeObject: (type: string, taskId: string, pos: any) => ({
      id: `${type}-1`,
      type,
      position: pos,
      data: {},
      dimensions: { width: 100, height: 50 },
    }),
  }),
}));

vi.mock("~/composables/taskflow/useGraphOperations", () => ({
  useGraphOperations: () => ({
    addNodeToState: (nodes: any, node: any) => {
      nodes.value.push(node);
    },
    addEdgeToState: (edges: any, nodes: any, edgeData: any) => {
      const id = edgeData.id || `edge-${edgeData.source}-${edgeData.target}`;
      if (!edges.value.some((e: any) => e.id === id)) {
        edges.value.push({ ...edgeData, id });
        return { ...edgeData, id };
      }
      return null;
    },
    removeNodeFromState: (nodes: any, edges: any, nodeId: string) => {
      nodes.value = nodes.value.filter((n: any) => n.id !== nodeId);
      const affectedEdges = edges.value.filter(
        (e: any) => e.source === nodeId || e.target === nodeId
      );
      edges.value = edges.value.filter(
        (e: any) => e.source !== nodeId && e.target !== nodeId
      );
      return { affectedEdges };
    },
    removeEdgeFromState: (edges: any, edgeId: string) => {
      const idx = edges.value.findIndex((e: any) => e.id === edgeId);
      if (idx !== -1) {
        return edges.value.splice(idx, 1)[0];
      }
      return null;
    },
  }),
}));

// Evita warnings de debounce/saves
vi.mock("~/composables/taskflow/useTaskFlowPersistence", () => ({
  useTaskFlowPersistence: () => ({
    loadFlow: vi.fn(async (taskId: string) => ({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
    })),
    saveFlowDebounced: vi.fn(),
  }),
}));

describe("TaskFlowStore (Pinia)", () => {
  let store: ReturnType<typeof useTaskFlowStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTaskFlowStore();
    store.currentTaskId = "task-1";
    store.nodes = [];
    store.edges = [];
  });

  it("adiciona node e atualiza posição", async () => {
    await store.addNode({
      id: "A",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    expect(store.nodes).toHaveLength(1);
    store.updateNodePosition("A", { x: 123, y: 456 });
    expect(store.nodes[0].position).toEqual({ x: 123, y: 456 });
  });

  it("adiciona dois nodes sem sobreposição (findFreePosition mock)", async () => {
    await store.addNode({
      id: "A",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    // Adiciona um novo node do tipo dataSource conectado ao A (mocka lógica de posição)
    const node = await store.addNodeAndConnect(
      "dataSource",
      "A",
      { x: 0, y: 0 },
      50,
      200,
      200
    );
    expect(store.nodes.length).toBeGreaterThanOrEqual(2);
    expect(node).toHaveProperty("type", "dataSource");
  });

  it("adiciona edge e propaga para target", async () => {
    await store.addNode({
      id: "A",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    await store.addNode({
      id: "B",
      type: "dataSource",
      position: { x: 100, y: 100 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    await store.addEdge({ source: "A", target: "B" });
    expect(store.edges).toHaveLength(1);
    // O inputData de B deve ser atualizado
    expect(
      store.nodes.find((n) => n.id === "B")?.data?.inputData?.A
    ).toBeDefined();
  });

  it("remove node e limpa context/input de filhos", async () => {
    await store.addNode({
      id: "A",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    await store.addNode({
      id: "B",
      type: "dataSource",
      position: { x: 100, y: 100 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    await store.addEdge({ source: "A", target: "B" });
    await store.removeNode("A");
    expect(store.nodes.some((n) => n.id === "A")).toBeFalsy();
    expect(store.edges.some((e) => e.source === "A")).toBeFalsy();
    // O inputData/contexto de B deve estar limpo
    expect(
      store.nodes.find((n) => n.id === "B")?.data?.inputData?.A
    ).toBeUndefined();
  });

  it("não duplica edges", async () => {
    await store.addNode({
      id: "A",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    await store.addNode({
      id: "B",
      type: "dataSource",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: new Date().toISOString(),
      },
      selected: false,
      draggable: true,
      selectable: true,
      dragging: false,
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      resizing: false,
      events: {},
      dimensions: { width: 0, height: 0 },
      isParent: false,
    });
    await store.addEdge({ source: "A", target: "B" });
    await store.addEdge({ source: "A", target: "B" });
    expect(
      store.edges.filter((e) => e.source === "A" && e.target === "B")
    ).toHaveLength(1);
  });

  it("clearTaskFlowState zera nodes, edges, viewport", () => {
    store.nodes = [
      {
        id: "X",
        type: "problem",
        position: { x: 0, y: 0 },
        data: {
          inputData: {},
          outputData: {},
          cumulativeContext: { compressed: false, blob: {} },
          updated_at: new Date().toISOString(),
        },
        selected: false,
        draggable: true,
        selectable: true,
        dragging: false,
        computedPosition: { x: 0, y: 0, z: 0 },
        handleBounds: { source: [], target: [] },
        resizing: false,
        events: {},
        dimensions: { width: 0, height: 0 },
        isParent: false,
      },
    ];
    store.edges = [{ id: "E", source: "X", target: "X" } as any];
    store.clearTaskFlowState();
    expect(store.nodes).toHaveLength(0);
    expect(store.edges).toHaveLength(0);
    expect(store.viewport.x).toBe(0);
  });
});
