// tests/vitest/propagation/dataCardPropagation.spec.ts

import { describe, it, expect, beforeEach } from "vitest";
import { useTaskFlowStore } from "../../../stores/taskFlow";
import { decompress } from "../../../utils/nodeContext";
import type { CumulativeContextBlob } from "../../../types/taskflow";

describe("Propagação: Data Card", () => {
  let store: ReturnType<typeof useTaskFlowStore>;
  beforeEach(() => {
    store = useTaskFlowStore();
    store.clearTaskFlowState();
    store.currentTaskId = "task-test";
  });

  it("cria um DataCard, adiciona dado e verifica output gerado", async () => {
    // Adiciona DataCard isolado
    store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 0, y: 0 },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
      data: {
        inputData: null,
        outputData: null,
        updated_at: null,
        cumulativeContext: { compressed: false, blob: {} },
      },
    });

    // Simula o usuário adicionando um arquivo/dado no DataCard (como feito no modal)
    const fakeFile = {
      id: "file-xyz",
      name: "Planilha.xlsx",
      type: "spreadsheet",
    };
    store.updateNodeData("data-1", {
      outputData: {
        uploaded_files: [
          {
            id: "file-xyz",
            name: "Planilha.xlsx",
            type: "spreadsheet",
            version: 1,
          },
        ],
      },
    });

    const node = store.nodes.find((n) => n.id === "data-1");
    expect(node).toBeDefined();
    expect(node!.data.outputData).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-xyz",
            name: "Planilha.xlsx",
            type: "spreadsheet",
            version: 1,
          }),
        ]),
      })
    );
  });

  it("NodeIOViewer: mostra corretamente inputData e outputData do DataCard", async () => {
    // Arrange: cria DataCard como filho de um Problem (parent)
    // The store is already initialized in the beforeEach of the parent describe block.
    // No need to re-initialize it here.

    // Parent node: Problem
    store.addNode({
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        title: "Problema de Teste",
        description: "Desc X",
        inputData: {},
        outputData: {
          problem: { title: "Problema de Teste", description: "Desc X" },
        },
        updated_at: new Date().toISOString(),
        cumulativeContext: { compressed: false, blob: {} },
        initialized: false,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: {
        source: [],
        target: [],
      },
      isParent: false,
      draggable: true,
      selectable: true,
      connectable: true,
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      isValidTargetPos: undefined,
      isValidSourcePos: undefined,
      extent: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      class: undefined,
      style: undefined,
      hidden: false,
      dragging: false,
    });

    // DataCard node (DataSource)
    store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 200, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        updated_at: new Date().toISOString(),
        cumulativeContext: { compressed: false, blob: {} },
        initialized: false,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 200, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: {
        source: [],
        target: [],
      },
      isParent: false,
      draggable: true,
      selectable: true,
      connectable: true,
      focusable: true,
      deletable: true,
      dragHandle: undefined,
      isValidTargetPos: undefined,
      isValidSourcePos: undefined,
      extent: undefined,
      parentNode: undefined,
      zIndex: 0,
      ariaLabel: undefined,
      class: undefined,
      style: undefined,
      hidden: false,
      dragging: false,
    });

    // Conecta o problem ao data
    store.addEdge({
      id: "e1",
      source: "problem-1",
      target: "data-1",
      type: "smoothstep",
    });

    // Força propagação
    await store.propagateOutput("problem-1");

    // Simula upload de arquivo no DataCard
    const uploadedFile = {
      id: "file-abc",
      name: "Planilha.xlsx",
      type: "spreadsheet",
      version: 1,
    };
    store.updateNodeData("data-1", {
      sources: [uploadedFile],
      outputData: {
        uploaded_files: [uploadedFile],
      },
    });
    // Força propagação do DataCard
    await store.propagateOutput("data-1");

    // Asserts: input e output visíveis para o NodeIOViewer
    const dataNode = store.nodes.find((n) => n.id === "data-1");
    const reportNode = store.nodes.find((n) => n.id === "report-1"); // Caso precise de um filho também

    // INPUT esperado do DataCard (deve vir do parent)
    expect(dataNode?.data.inputData?.["problem-1"]).toMatchObject({
      problem: { title: "Problema de Teste", description: "Desc X" },
    });
    // Verifica o cumulativeContext do DataCard propagado pelo pai (Problem)
    const blobVersion =
      typeof dataNode?.data.cumulativeContext?.blob === "object" &&
      dataNode?.data.cumulativeContext?.blob !== null
        ? dataNode?.data.cumulativeContext?.blob?.["problem-1"]?.version
        : undefined;
    expect(dataNode?.data.cumulativeContext).toEqual({
      compressed: false,
      blob: {
        "problem-1": {
          output: {
            problem: { title: "Problema de Teste", description: "Desc X" },
          },
          type: "problem",
          version: blobVersion,
        },
      },
    });
    // OUTPUT esperado do DataCard (deve ser o arquivo simulado)
    expect(dataNode?.data.outputData).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-abc",
            name: "Planilha.xlsx",
            type: "spreadsheet",
            version: 1,
          }),
        ]),
      })
    );

    // Se quiser simular o que o NodeIOViewer mostra para o filho:
    // expect(reportNode?.data.inputData?.["data-1"]).toEqual({ uploaded_files: [uploadedFile] });
  });

  it("propaga output do DataCard para um filho conectado", async () => {
    // Cria DataCard (pai) e ReportCard (filho)
    store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 0, y: 0 },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
      data: {
        inputData: null,
        outputData: null,
        updated_at: null,
        cumulativeContext: { compressed: false, blob: {} },
      },
    });
    store.addNode({
      id: "report-1",
      type: "reportCard",
      position: { x: 200, y: 0 },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 200, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
      data: {
        inputData: null,
        outputData: null,
        updated_at: null,
        cumulativeContext: { compressed: false, blob: {} },
      },
    });

    // Conecta DataCard ao ReportCard
    store.addEdge({ source: "data-1", target: "report-1", type: "smoothstep" });

    // Simula usuário adicionando dado no DataCard
    const fileData = {
      id: "file-123",
      name: "meuarquivo.csv",
      type: "spreadsheet",
      version: 1,
    };
    store.updateNodeData("data-1", {
      sources: [fileData],
    });
    await store.propagateOutput("data-1");

    // Checa output do DataCard (como aparece no modal)
    const parent = store.nodes.find((n) => n.id === "data-1");
    expect(parent?.data.outputData).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-123",
            name: "meuarquivo.csv",
            type: "spreadsheet",
            version: 1,
          }),
        ]),
      })
    );

    // Checa input recebido pelo filho (como aparece no modal)
    const child = store.nodes.find((n) => n.id === "report-1");
    expect(child?.data.inputData?.["data-1"]).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-123",
            name: "meuarquivo.csv",
            type: "spreadsheet",
            version: 1,
          }),
        ]),
      })
    );

    // Atualiza dado do DataCard (nova versão)
    store.updateNodeData("data-1", {
      sources: [
        {
          id: "file-123",
          name: "meuarquivo.csv",
          type: "spreadsheet",
          version: 2,
        },
      ],
    });
    await store.propagateOutput("data-1");

    // Verifica que o filho recebeu a nova versão no input
    expect(
      store.nodes.find((n) => n.id === "report-1")?.data.inputData?.["data-1"]
    ).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-123",
            name: "meuarquivo.csv",
            type: "spreadsheet",
            version: 2,
          }),
        ]),
      })
    );
  });

  it("integração visual: DataCard recebe input de pai, usuário adiciona arquivo, output e input propagam para filho (simulando modal)", async () => {
    // Cria nó pai Problem
    store.addNode({
      id: "problem-1",
      type: "problem",
      position: { x: -200, y: 0 },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: -200, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
      data: {
        title: "Problema X",
        description: "Descrição X",
        inputData: null,
        outputData: {
          problem: { title: "Problema X", description: "Descrição X" },
        },
        updated_at: null,
        cumulativeContext: { compressed: false, blob: {} },
      },
    });
    // Cria DataCard e simula recebendo input do pai
    store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 0, y: 0 },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
      data: {
        inputData: {
          "problem-1": {
            problem: { title: "Problema X", description: "Descrição X" },
          },
        },
        outputData: null,
        updated_at: null,
        cumulativeContext: { compressed: false, blob: {} },
      },
    });
    // Conecta Problem -> DataCard
    store.addEdge({
      source: "problem-1",
      target: "data-1",
      type: "smoothstep",
    });

    // Checa se o input do DataCard reflete o output do pai (como exibido no modal)
    const dataCard = store.nodes.find((n) => n.id === "data-1");
    expect(dataCard?.data.inputData?.["problem-1"]).toMatchObject({
      problem: { title: "Problema X", description: "Descrição X" },
    });

    // Usuário adiciona arquivo ao DataCard via modal
    const uploadedFile = {
      id: "file-abc",
      name: "Arquivo.xlsx",
      type: "spreadsheet",
      version: 1,
    };
    store.updateNodeData("data-1", {
      sources: [uploadedFile],
    });
    await store.propagateOutput("data-1");

    // Output do DataCard atualizado
    const updatedDataCard = store.nodes.find((n) => n.id === "data-1");
    expect(updatedDataCard?.data.outputData).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-abc",
            name: "Arquivo.xlsx",
            type: "spreadsheet",
            version: 1,
          }),
        ]),
      })
    );

    // Adiciona filho (Report) e conecta DataCard -> Report
    store.addNode({
      id: "report-1",
      type: "reportCard",
      position: { x: 200, y: 0 },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 200, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
      data: {
        inputData: null,
        outputData: null,
        updated_at: null,
        cumulativeContext: { compressed: false, blob: {} },
      },
    });
    await store.addEdge({
      source: "data-1",
      target: "report-1",
      type: "smoothstep",
    });

    // Confirma que o filho recebeu o input do output do DataCard
    const reportNode = store.nodes.find((n) => n.id === "report-1");
    expect(reportNode?.data.inputData?.["data-1"]).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-abc",
            name: "Arquivo.xlsx",
            type: "spreadsheet",
            version: 1,
          }),
        ]),
      })
    );

    // Usuário altera arquivo no DataCard (simula atualização no modal)
    const newFile = {
      id: "file-xyz",
      name: "NovoArquivo.xlsx",
      type: "spreadsheet",
      version: 2,
    };
    store.updateNodeData("data-1", {
      sources: [newFile],
    });
    await store.propagateOutput("data-1");

    // Confirma atualização do output e input no filho
    expect(store.nodes.find((n) => n.id === "data-1")?.data.outputData).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-xyz",
            name: "NovoArquivo.xlsx",
            type: "spreadsheet",
            version: 2,
          }),
        ]),
      })
    );
    expect(
      store.nodes.find((n) => n.id === "report-1")?.data.inputData?.["data-1"]
    ).toEqual(
      expect.objectContaining({
        uploaded_files: expect.arrayContaining([
          expect.objectContaining({
            id: "file-xyz",
            name: "NovoArquivo.xlsx",
            type: "spreadsheet",
            version: 2,
          }),
        ]),
      })
    );
  });
});

describe("Fluxo Completo: Problem -> Data -> Report", () => {
  let store: ReturnType<typeof useTaskFlowStore>;

  beforeEach(() => {
    store = useTaskFlowStore();
    store.clearTaskFlowState();
    store.currentTaskId = "task-test";
  });

  it("fluxo completo: Problem → Data → Report com cumulativeContext correto", async () => {
    // Cria Problem node (raiz)
    store.addNode({
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        title: "Prob X",
        description: "Desc X",
        inputData: {},
        outputData: { problem: { title: "Prob X", description: "Desc X" } },
        updated_at: new Date().toISOString(),
        cumulativeContext: { compressed: false, blob: {} },
        initialized: false,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
    });

    // Cria Data node (filho do Problem)
    store.addNode({
      id: "data-1",
      type: "dataSource",
      position: { x: 200, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        updated_at: new Date().toISOString(),
        cumulativeContext: { compressed: false, blob: {} },
        initialized: false,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 200, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
    });

    // Cria Report node (filho do Data)
    store.addNode({
      id: "report-1",
      type: "reportCard",
      position: { x: 400, y: 0 },
      data: {
        inputData: {},
        outputData: {},
        updated_at: new Date().toISOString(),
        cumulativeContext: { compressed: false, blob: {} },
        initialized: false,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 400, y: 0, z: 0 },
      dimensions: { width: 0, height: 0 },
      handleBounds: { source: [], target: [] },
      isParent: false,
      dragging: false,
    });

    // Conecta Problem → Data → Report
    store.addEdge({
      source: "problem-1",
      target: "data-1",
      type: "smoothstep",
    });
    store.addEdge({ source: "data-1", target: "report-1", type: "smoothstep" });

    // Força propagação do output do Problem
    await store.propagateOutput("problem-1");

    // --- Novo expect intermediário: cumulativeContext do data-1 já contém o "problem-1" ---
    // Aguarda até que o cumulativeContext do data-1 tenha a chave "problem-1"
    const waitForDataContext = async () => {
      let tries = 0;
      while (tries < 10) {
        const dataNode = store.nodes.find((n) => n.id === "data-1");
        const ctx = decompress(dataNode?.data.cumulativeContext);
        if (ctx && ctx["problem-1"]) {
          return;
        }
        // Aguarda microtask
        await new Promise((resolve) => setTimeout(resolve, 0));
        tries++;
        // Opcional: repropage se não chegou
        if (tries === 5) await store.propagateOutput("problem-1");
      }
      throw new Error("cumulativeContext do data-1 não contém problem-1");
    };
    await waitForDataContext();
    // Confirma explicitamente
    {
      const dataNode = store.nodes.find((n) => n.id === "data-1");
      const ctx = decompress(dataNode?.data.cumulativeContext);
      expect(ctx["problem-1"]).toBeDefined();
    }

    // Atualiza output do Data ANTES de propagar
    const uploadedFile = {
      id: "file-xyz",
      name: "Arquivo.xlsx",
      type: "spreadsheet",
      version: 1,
    };
    store.updateNodeData("data-1", {
      sources: [uploadedFile],
      outputData: {
        uploaded_files: [uploadedFile],
      },
    });
    // Agora propaga o output do Data
    await store.propagateOutput("data-1");

    // ---- ASSERTS ----

    // 1. Data node: cumulativeContext deve ter chave do Problem
    const dataNode = store.nodes.find((n) => n.id === "data-1");
    const problemOutput = {
      problem: { title: "Prob X", description: "Desc X" },
    };
    const dataNodeContext = decompress(dataNode?.data.cumulativeContext);
    expect(
      (dataNodeContext as unknown as CumulativeContextBlob)["problem-1"]
    ).toMatchObject({
      output: problemOutput,
      type: "problem",
    });

    // 2. Report node: cumulativeContext deve ter Problem E Data
    const reportNode = store.nodes.find((n) => n.id === "report-1");
    const reportNodeContext = decompress(reportNode?.data.cumulativeContext);
    expect(
      (reportNodeContext as unknown as CumulativeContextBlob)["problem-1"]
    ).toMatchObject({
      output: problemOutput,
      type: "problem",
    });
    expect(
      (reportNodeContext as unknown as CumulativeContextBlob)["data-1"]
    ).toMatchObject({
      output: {
        uploaded_files: [uploadedFile],
      },
      type: "dataSource",
    });

    // E opcionalmente checar os inputData:
    expect(reportNode?.data.inputData?.["data-1"]).toMatchObject({
      uploaded_files: [uploadedFile],
    });
  });
});
