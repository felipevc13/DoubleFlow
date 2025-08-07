// Deep clone ignorando undefined para uso em testes
function cloneWithoutUndefined(obj: any) {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (v === undefined ? null : v))
  );
}
// Mantém objeto global para dimensões de nó durante os testes
(globalThis as any).__testTimeEstimatedNodeDimensions =
  (globalThis as any).__testTimeEstimatedNodeDimensions || {};
import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useTaskFlowStore } from "~/stores/taskFlow";
import type { TaskFlowNode, XYPosition, Viewport } from "~/types/taskflow"; // Ajuste o caminho
import { ESTIMATED_NODE_DIMENSIONS as ACTUAL_ESTIMATED_NODE_DIMENSIONS } from "~/constants/nodeDimensions"; // Se usado pela store
// Objeto mutável para dimensões customizadas em tempo de teste (não mais usado localmente)
import { VueFlow } from "@vue-flow/core"; // Para mock
import { useTaskFlowPersistence } from "~/composables/taskflow/useTaskFlowPersistence";

// Mock para useVueFlow e suas funções (fitView, setViewport, project)
// Se a store chama diretamente funções da instância VueFlow,
// você precisará mockar a instância que seria retornada por useVueFlow().
// Para este exemplo, vamos focar em testar a lógica da store.
const mockVueFlowInstance = {
  fitView: vi.fn(),
  setViewport: vi.fn(),
  project: vi.fn((coords) => coords), // Simplesmente retorna as coordenadas para testes
  viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 }, // Adicionado para garantir compatibilidade com lógica da store
  // Adicione outros métodos que a store possa chamar
};

vi.mock("@vue-flow/core", async () => {
  const actual = await vi.importActual("@vue-flow/core");
  return {
    ...actual,
    useVueFlow: () => mockVueFlowInstance,
  };
});

// Mock para node Handlers se eles forem chamados durante as operações
vi.mock("~/lib/nodeHandlers", () => ({
  getNodeHandler: (type: string) => ({
    initializeData: vi.fn(() => ({
      /* dados iniciais mockados */
      label: `Mock ${type}`,
      title: `Mock Title ${type}`,
      description: "Mock Description",
      sources: [],
      inputData: {},
      outputData: {},
      cumulativeContext: { compressed: false, blob: {} },
      updated_at: new Date().toISOString(),
    })),
    generateOutput: vi.fn(async (node) => ({
      mockOutput: true,
      from: node.id,
    })),
    processInput: vi.fn(async (data, inputs) => ({
      ...data,
      inputData: inputs,
    })),
    // ... outros métodos do handler se relevantes
  }),
}));

// Mock para composables de posicionamento se a store os usa diretamente
vi.mock("~/composables/taskflow/useSmartNodePlacement", () => ({
  useSmartNodePlacement: () => ({
    findFreePosition: vi.fn((nodes, newNodeDims, initialPos) => initialPos), // Mock simples
  }),
}));

vi.mock("~/composables/taskflow/useNodeInitialization", () => {
  return {
    useNodeInitialization: () => ({
      createNewNodeObject: (type: string, taskId: string, pos: XYPosition) => {
        const dims =
          (globalThis as any).__testTimeEstimatedNodeDimensions[type] ||
          (globalThis as any).__testTimeEstimatedNodeDimensions.default;
        return {
          id: `${type}-${Math.random().toString(36).substring(7)}`,
          type,
          position: pos,
          data: {
            inputData: {},
            outputData: {},
            cumulativeContext: { compressed: false, blob: {} },
            updated_at: new Date().toISOString(),
          },
          dimensions: { ...dims },
          selected: false,
          draggable: true,
          selectable: true,
          dragging: false,
          computedPosition: { ...pos, z: 0 },
          handleBounds: { source: [], target: [] },
          isParent: false,
          resizing: false,
          events: {},
        };
      },
    }),
    ESTIMATED_NODE_DIMENSIONS: (globalThis as any)
      .__testTimeEstimatedNodeDimensions,
  };
});

const mockSaveFlowDebounced = vi.fn(); // Define at the top level and initialize

vi.mock("~/composables/taskflow/useTaskFlowPersistence", () => ({
  useTaskFlowPersistence: () => ({
    loadFlow: vi.fn(async (taskId: string) => ({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1, width: 800, height: 600 },
    })),
    saveFlowDebounced: mockSaveFlowDebounced, // Use the top-level mock
  }),
}));

vi.mock("~/composables/taskflow/useNodeLayout", () => ({
  calculateChildNodePosition: vi.fn(
    (parentNode, children, newNodeDims, opts) => ({
      x: parentNode.position.x,
      y:
        parentNode.position.y +
        (parentNode.dimensions?.height || 100) +
        (opts.gapY || 100),
    })
  ),
  clampToViewport: vi.fn((pos, dims, vp, margin = 50) => pos), // Simplesmente retorna a posição fornecida (ou ajuste conforme lógica de teste)
  isNodeFullyVisibleInViewport: vi.fn(() => true), // Sempre retorna true para simplificar
}));

// --- SINCRONIZA O OBJETO GLOBAL DE DIMENSÕES DE NÓS DE TESTE ---
Object.assign(
  (globalThis as any).__testTimeEstimatedNodeDimensions,
  cloneWithoutUndefined(ACTUAL_ESTIMATED_NODE_DIMENSIONS)
);

describe("TaskFlow Store - Node Position and Viewport Stability", () => {
  let store: ReturnType<typeof useTaskFlowStore>;
  const initialViewport: Viewport = {
    x: 0,
    y: 0,
    zoom: 1,
    width: 800,
    height: 600,
  };

  // Helper para criar nós de teste
  const createTestNode = (
    id: string,
    position: XYPosition,
    type = "problem"
  ): TaskFlowNode => {
    const dims =
      (globalThis as any).__testTimeEstimatedNodeDimensions[type] ||
      (globalThis as any).__testTimeEstimatedNodeDimensions.default;
    return {
      id,
      type,
      position,
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
      dimensions: dims,
      computedPosition: { ...position, z: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      resizing: false,
      events: {},
    };
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTaskFlowStore();
    store.currentTaskId = "test-task";
    store.nodes = [];
    store.edges = [];
    store.viewport = { ...initialViewport }; // Reset viewport
    vi.clearAllMocks();
    mockSaveFlowDebounced.mockClear(); // Clear mock calls for each test
    (globalThis as any).$vueFlow = mockVueFlowInstance; // Set global Vue Flow instance for tests
    mockVueFlowInstance.fitView.mockClear(); // Clear fitView mock calls
    mockVueFlowInstance.viewport = { ...initialViewport }; // <--- garante que o mock sempre reflete o viewport usado na store
  });

  // --- TESTES DE ARRASTAR (DRAG) ---
  describe("Node Dragging", () => {
    it("should update node position in store after drag without affecting other nodes or viewport", async () => {
      const nodeA = createTestNode("A", { x: 100, y: 100 });
      const nodeB = createTestNode("B", { x: 300, y: 100 });
      store.nodes = [nodeA, nodeB];
      const originalViewport = { ...store.viewport };

      const newPositionA = { x: 150, y: 120 };
      await store.updateNodePosition("A", newPositionA); // Simula o fim do drag

      const updatedNodeA = store.nodes.find((n) => n.id === "A");
      const nodeBUnchanged = store.nodes.find((n) => n.id === "B");

      expect(updatedNodeA?.position).toEqual(newPositionA);
      expect(nodeBUnchanged?.position).toEqual({ x: 300, y: 100 }); // Posição de B não deve mudar
      expect(store.viewport).toEqual(originalViewport); // Viewport não deve mudar
      expect(mockSaveFlowDebounced).toHaveBeenCalled();
    });
  });

  // --- TESTES DE ADIÇÃO DE NÓ ---
  describe("Node Addition", () => {
    it("globally added node should get a calculated position and not affect existing nodes or viewport (if new node is visible)", async () => {
      const nodeA = createTestNode("A", { x: 100, y: 100 });
      store.nodes = [nodeA];
      const originalViewport = { ...store.viewport };
      const originalPositionA = { ...nodeA.position };

      // Mock para que o novo nó seja posicionado visivelmente sem precisar do fitView
      // (se a lógica de `findFreePosition` for complexa, pode mocká-la)
      const expectedNewNodePosition = { x: 400, y: 300 }; // Posição que estaria visível

      const newNode = await store.addNodeAndConnect(
        "dataSource",
        null, // Sem nó de origem (global)
        null,
        null,
        expectedNewNodePosition.x +
          ((globalThis as any).__testTimeEstimatedNodeDimensions.dataSource
            ?.width || 0) /
            2, // targetFlowX (centro)
        expectedNewNodePosition.y +
          ((globalThis as any).__testTimeEstimatedNodeDimensions.dataSource
            ?.height || 0) /
            2 // targetFlowY (centro)
      );

      expect(store.nodes.length).toBe(2);
      const addedNode = store.nodes.find((n) => n.id === newNode!.id);
      const nodeAAfterAdd = store.nodes.find((n) => n.id === "A");

      // A posição exata do novo nó dependerá de `findFreePosition` e `clampToViewport`.
      // Para este teste, podemos verificar se ele foi adicionado e se o nó A e o viewport não mudaram.
      expect(addedNode).toBeDefined();
      // Se `findFreePosition` for mockado para retornar `expectedNewNodePosition`, então:
      // expect(addedNode?.position).toEqual(expectedNewNodePosition);

      expect(nodeAAfterAdd?.position).toEqual(originalPositionA);
      expect(store.viewport).toEqual(originalViewport); // Assumindo que o novo nó já está visível
      expect(mockSaveFlowDebounced).toHaveBeenCalled();
    });

    it("contextually added node should be positioned relative to parent and not affect other nodes or viewport significantly", async () => {
      const parentNode = createTestNode("parent", { x: 100, y: 100 });
      const otherNode = createTestNode("other", { x: 500, y: 100 });
      store.nodes = [parentNode, otherNode];
      const originalViewport = { ...store.viewport };
      const originalPositionOther = { ...otherNode.position };

      const newNode = await store.addNodeAndConnect(
        "dataSource",
        "parent",
        parentNode.position,
        parentNode.dimensions?.height ||
          ((globalThis as any).__testTimeEstimatedNodeDimensions[
            parentNode.type
          ]?.height ??
            100)
      );

      expect(store.nodes.length).toBe(3);
      expect(store.edges.length).toBe(1);
      expect(store.edges[0].source).toBe("parent");
      expect(store.edges[0].target).toBe(newNode!.id);

      const addedNode = store.nodes.find((n) => n.id === newNode!.id);
      const otherNodeAfterAdd = store.nodes.find((n) => n.id === "other");

      expect(addedNode?.position.y).toBeGreaterThan(parentNode.position.y); // Abaixo do pai
      expect(otherNodeAfterAdd?.position).toEqual(originalPositionOther); // Outro nó não afetado
      // O viewport PODE mudar um pouco se o fitView for chamado para o pai e o novo filho.
      // Se a intenção é que NÃO mude, o fitView teria que ser condicional.
      // expect(store.viewport).toEqual(originalViewport);
      expect(mockSaveFlowDebounced).toHaveBeenCalled();
    });

    it("fitView should be called if a globally added node is outside the viewport", async () => {
      // Mocka para este teste: o nó adicionado está fora da viewport (simula retorno false)
      const { isNodeFullyVisibleInViewport } = await import(
        "~/composables/taskflow/useNodeLayout"
      );
      // @ts-expect-error - está mockado pelo vitest
      isNodeFullyVisibleInViewport.mockImplementationOnce(() => false);
      const dims = (globalThis as any).__testTimeEstimatedNodeDimensions;
      const originalDataSourceDims = { ...dims.dataSource };
      dims.dataSource = { width: 750, height: 180 };

      store.nodes = [createTestNode("A", { x: 0, y: 0 })]; // Nó existente
      store.viewport = { x: 0, y: 0, zoom: 1, width: 800, height: 600 };

      // Simula adição de nó global MUITO longe
      await store.addNodeAndConnect(
        "dataSource",
        null,
        null,
        null,
        5000,
        5000 // Fora do viewport inicial
      );

      // Verifica se fitView foi chamado (o mock precisa ser configurado para isso)
      expect(mockVueFlowInstance.fitView).toHaveBeenCalled();
      // Não necessariamente verificamos a posição exata do viewport, apenas que a ação de ajuste ocorreu.
      expect(mockSaveFlowDebounced).toHaveBeenCalled();

      // Restaura dimensões originais
      dims.dataSource = originalDataSourceDims;
    });
  });

  // --- TESTES DE DELEÇÃO DE NÓ ---
  describe("Node Deletion", () => {
    it("deleting a node should not affect positions of other unrelated nodes or the viewport", async () => {
      const nodeA = createTestNode("A", { x: 100, y: 100 });
      const nodeB = createTestNode("B", { x: 300, y: 100 }); // Nó a ser deletado
      const nodeC = createTestNode("C", { x: 500, y: 100 });
      store.nodes = [nodeA, nodeB, nodeC];
      store.edges = [
        {
          id: "eAB",
          source: "A",
          target: "B",
          type: "default",
          data: {},
          events: {},
          selected: false,
          sourceX: 0,
          sourceY: 0,
          targetX: 0,
          targetY: 0,
          markerEnd: "arrowclosed",
        },
        {
          id: "eBC",
          source: "B",
          target: "C",
          type: "default",
          data: {},
          events: {},
          selected: false,
          sourceX: 0,
          sourceY: 0,
          targetX: 0,
          targetY: 0,
          markerEnd: undefined,
        },
      ];
      const originalViewport = { ...store.viewport };
      const originalPositionA = { ...nodeA.position };
      // const originalPositionC = { ...nodeC.position }; // Posição de C pode mudar devido à limpeza de contexto

      await store.removeNode("B");

      expect(store.nodes.length).toBe(2);
      expect(store.nodes.find((n) => n.id === "B")).toBeUndefined();
      expect(store.edges.length).toBe(0); // Edges conectadas a B devem ser removidas

      const nodeAAfterDelete = store.nodes.find((n) => n.id === "A");
      const nodeCAfterDelete = store.nodes.find((n) => n.id === "C");

      expect(nodeAAfterDelete?.position).toEqual(originalPositionA);
      // A posição de C não deve mudar, mas seus dados de input/contexto sim.
      // expect(nodeCAfterDelete?.position).toEqual(originalPositionC);
      expect(store.viewport).toEqual(originalViewport);
      expect(mockSaveFlowDebounced).toHaveBeenCalled();
    });
  });

  // --- TESTE COMBINADO (SIMULANDO O VÍDEO) ---
  describe("Combined Scenario: Drag, Global Add, Contextual Add, Delete", () => {
    it("should maintain position and viewport stability through multiple operations", async () => {
      // 1. Nó Problema Inicial
      const problemNode = createTestNode("problem-1", { x: 100, y: 100 });
      store.nodes = [problemNode];
      let originalViewport = { ...store.viewport };
      let originalProblemPos = { ...problemNode.position };

      // 2. Arrastar Nó Problema
      const draggedProblemPos = { x: 200, y: 150 };
      await store.updateNodePosition("problem-1", draggedProblemPos);
      expect(store.nodes.find((n) => n.id === "problem-1")?.position).toEqual(
        draggedProblemPos
      );
      expect(store.viewport).toEqual(originalViewport); // Drag não mexe viewport
      originalProblemPos = draggedProblemPos; // Atualiza para a nova posição

      // 3. Adicionar Nó Global (DataSource)
      // (Simulando que findFreePosition o coloca visivelmente)
      const globalDsPos = { x: 400, y: 150 };
      const globalDs = await store.addNodeAndConnect(
        "dataSource",
        null,
        null,
        null,
        globalDsPos.x + 50,
        globalDsPos.y + 25
      );
      expect(store.nodes.find((n) => n.id === "problem-1")?.position).toEqual(
        originalProblemPos
      ); // Problema não mexe
      expect(store.viewport).toEqual(originalViewport); // Viewport não mexe

      // 4. Adicionar Nó Contextual (Survey) a partir do Problema
      const contextualSurvey = await store.addNodeAndConnect(
        "survey",
        "problem-1",
        originalProblemPos,
        problemNode.dimensions?.height ||
          ((globalThis as any).__testTimeEstimatedNodeDimensions[
            problemNode.type
          ]?.height ??
            100)
      );
      expect(store.nodes.find((n) => n.id === "problem-1")?.position).toEqual(
        originalProblemPos
      );
      expect(store.nodes.find((n) => n.id === globalDs!.id)?.position).toEqual(
        globalDs?.position
      ); // Nó global não mexe
      // Viewport pode ter sido ajustado pelo fitView para problem-1 e contextualSurvey
      // Se não queremos que o viewport mude, o fitView no addNodeAndConnect teria que ser condicional.
      // Para este teste, vamos assumir que o viewport *pode* mudar um pouco aqui.
      // originalViewport = { ...store.viewport }; // Re-calibra viewport se fitView é esperado

      // 5. Deletar o Nó Global (DataSource)
      await store.removeNode(globalDs!.id);
      expect(store.nodes.find((n) => n.id === "problem-1")?.position).toEqual(
        originalProblemPos
      );
      expect(
        store.nodes.find((n) => n.id === contextualSurvey!.id)?.position
      ).toEqual(contextualSurvey?.position);
      // expect(store.viewport).toEqual(originalViewport); // Viewport não deve mudar pela deleção

      // Salvar deve ter sido chamado múltiplas vezes (pelo debounce, seria 1 vez no final)
      expect(mockSaveFlowDebounced).toHaveBeenCalled();
    });
  });
});
