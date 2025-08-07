import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterAll,
} from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { TaskFlowNode } from "~/types/taskflow";
import { useTaskFlowStore } from "~/stores/taskFlow";

// Mock Date for deterministic updated_at/version fields
const MOCK_DATE = "2023-01-01T00:00:00.000Z";
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(MOCK_DATE));
});
afterAll(() => {
  vi.useRealTimers();
});

describe("Propagação: Problem Card", () => {
  let store: ReturnType<typeof useTaskFlowStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTaskFlowStore();
    store.clearTaskFlowState();
    store.currentTaskId = "mock-task-id";
  });

  it("cria um nó problem e verifica outputData gerado", async () => {
    const description = "Descrição do problema";
    await store.addNode({
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        title: "Problema Teste",
        description,
        inputData: null,
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: null,
      },
      // Add missing TaskFlowNode properties with default values for testing
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      draggable: true,
      selectable: true,
      dragging: false,
      handleBounds: { source: [], target: [] },
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      extent: undefined,
      expandParent: false,
      hidden: false,
    } as TaskFlowNode); // Cast to TaskFlowNode to satisfy type checker

    // Atualiza o node para simular o fluxo real do handler
    await store.updateNodeData("problem-1", { description });

    // Simula processamento manual se necessário
    await store.requestNodeReprocessing("problem-1");

    const node = store.nodes.find((n) => n.id === "problem-1");
    expect(node).toBeDefined();
    // O problema gera outputData com a estrutura { problem: { title, description } }
    expect(node!.data.outputData).toEqual({
      problem: { title: "Problema Teste", description: description },
    });
  });

  it("propaga output do problem para filho conectado", async () => {
    const description = "Desc";
    // Cria o nó problem e um nó dataSource, conecta ambos
    await store.addNode({
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        title: "Prob",
        description,
        inputData: null,
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      draggable: true,
      selectable: true,
      dragging: false,
      handleBounds: { source: [], target: [] },
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      extent: undefined,
      expandParent: false,
      hidden: false,
    } as TaskFlowNode);

    await store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 200, y: 0 },
      data: {
        inputData: null,
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      draggable: true,
      selectable: true,
      dragging: false,
      handleBounds: { source: [], target: [] },
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      extent: undefined,
      expandParent: false,
      hidden: false,
    } as TaskFlowNode);

    await store.addEdge({
      source: "problem-1",
      target: "data-1",
      type: "smoothstep",
    });

    // Atualiza dados do nó problem (ou reprocessa para garantir outputData atualizado)
    await store.updateNodeData("problem-1", { title: "Prob Atualizado" });
    await store.requestNodeReprocessing("problem-1");

    // Propaga manualmente se necessário
    await store.propagateOutput("problem-1");

    // O nó filho deve receber o output como inputData
    const childNode = store.nodes.find((n) => n.id === "data-1");
    expect(childNode).toBeDefined();
    expect(childNode!.data.inputData!["problem-1"]).toBeDefined();
    // O inputData deve refletir o outputData do problema, que é { problem: { title, description } }
    expect(childNode!.data.inputData!["problem-1"]).toEqual({
      problem: { title: "Prob Atualizado", description: description },
    });
  });

  it("propaga output do problem para filho conectado (estrutura real)", async () => {
    const description = "Desc";
    // Cria o nó problem e um nó dataSource, conecta ambos
    await store.addNode({
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        title: "Prob",
        description,
        inputData: null,
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      draggable: true,
      selectable: true,
      dragging: false,
      handleBounds: { source: [], target: [] },
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      extent: undefined,
      expandParent: false,
      hidden: false,
    } as TaskFlowNode);

    await store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 200, y: 0 },
      data: {
        inputData: null,
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      draggable: true,
      selectable: true,
      dragging: false,
      handleBounds: { source: [], target: [] },
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      extent: undefined,
      expandParent: false,
      hidden: false,
    } as TaskFlowNode);

    await store.addEdge({
      source: "problem-1",
      target: "data-1",
      type: "smoothstep",
    });

    // Atualiza e processa o nó problem
    await store.updateNodeData("problem-1", { title: "Prob Atualizado" });
    await store.requestNodeReprocessing("problem-1");
    await store.propagateOutput("problem-1");

    const childNode = store.nodes.find((n) => n.id === "data-1");
    expect(childNode).toBeDefined();

    // Busca o output real do problema
    const problemNode = store.nodes.find((n) => n.id === "problem-1");
    const output = problemNode!.data.outputData;

    // Espera que o inputData do filho contenha exatamente o output do problem (sem type/version)
    expect(childNode!.data.inputData!["problem-1"]).toEqual(output);
    // Verifica que o cumulativeContext do filho foi inicializado corretamente
    expect(childNode!.data.cumulativeContext).toEqual({
      compressed: false,
      blob: {
        "problem-1": {
          output: problemNode!.data.outputData,
          type: "problem",
          version: new Date(MOCK_DATE).getTime(),
        },
      },
    });
  });

  it("propaga novo output ao editar e salvar o node problem", async () => {
    // 1. Cria nodes e conecta
    const initialDescription = "Desc inicial";
    await store.addNode({
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        title: "Problema Inicial",
        description: initialDescription,
        inputData: null,
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      draggable: true,
      selectable: true,
      dragging: false,
      handleBounds: { source: [], target: [] },
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      extent: undefined,
      expandParent: false,
      hidden: false,
    } as TaskFlowNode);

    await store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 200, y: 0 },
      data: {
        inputData: null,
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      draggable: true,
      selectable: true,
      dragging: false,
      handleBounds: { source: [], target: [] },
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      extent: undefined,
      expandParent: false,
      hidden: false,
    } as TaskFlowNode);

    await store.addEdge({
      source: "problem-1",
      target: "data-1",
      type: "smoothstep",
    });

    // 2. Atualiza o problem como se fosse edição no sidebar
    const editedDescription = "Novo problema editado";
    await store.updateNodeData("problem-1", {
      title: "Problema Editado",
      description: editedDescription,
    });
    await store.requestNodeReprocessing("problem-1");
    await store.propagateOutput("problem-1");

    // 3. Valida
    const problemNode = store.nodes.find((n) => n.id === "problem-1");
    const dataNode = store.nodes.find((n) => n.id === "data-1");
    expect(problemNode).toBeDefined();
    expect(dataNode).toBeDefined();

    // O outputData deve refletir a edição, com a estrutura { problem: { title, description } }
    expect(problemNode!.data.outputData).toEqual({
      problem: { title: "Problema Editado", description: editedDescription },
    });
    // O filho deve receber o input propagado com novo problem_definition
    expect(dataNode!.data.inputData!["problem-1"]).toEqual({
      problem: { title: "Problema Editado", description: editedDescription },
    });
  });
});
