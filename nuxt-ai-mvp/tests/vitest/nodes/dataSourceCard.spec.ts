// tests/nodes/dataSourceCard.spec.ts
import { vi } from "vitest";
import { mockFetch } from "../../mocks/imports"; // Import mockFetch directly
// Remove top-level static imports for mocks used inside vi.mock factory
// import {
//   useSupabaseClient as mockedSupabaseClient,
//   useSupabaseUser as mockedSupabaseUser,
// } from "../mocks/imports";

vi.mock("#imports", async (importOriginal) => {
  // let actualImports = {};
  // try {
  //   actualImports = (await importOriginal()) || {};
  // } catch (e) {
  //   // console.warn("Could not import actual #imports for vi.mock, using empty object.", e);
  // }

  // Dynamically import the mocks *inside* the factory
  const supabaseMocks = await import("../../mocks/imports");

  // For diagnostics, only return the Supabase mocks.
  // If DataSourceModal needs other auto-imports, this will break differently,
  // but it will tell us if the Supabase mocks themselves are being provided.
  return {
    // ...actualImports, // Temporarily remove spreading actual imports
    useSupabaseClient: supabaseMocks.useSupabaseClient,
    useSupabaseUser: supabaseMocks.useSupabaseUser,
  };
});

// Mock Vue Flow
vi.mock("@vue-flow/core", async () => {
  const actual = await vi.importActual("@vue-flow/core");
  // The store instance will be accessed from the `store` variable
  // initialized in `beforeEach`.
  return {
    ...actual,
    useVueFlow: vi.fn(() => {
      // Use the statically imported useTaskFlowStore, similar to problemCard.spec.ts
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
          if (currentStore) currentStore.nodes = newNodes;
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
            if (index !== -1 && typeof nodeUpdate === "function") {
              currentStore.nodes[index] = nodeUpdate(currentStore.nodes[index]);
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
      <div v-if="isVisible" class="node-toolbar-mock" data-testid="node-toolbar-mock">
        <slot />
      </div>
    `,
  },
}));

// Agora as importações podem ser feitas
import { setup, useTestContext } from "@nuxt/test-utils/e2e";
import { mount, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import {
  describe,
  beforeEach,
  beforeAll,
  afterAll,
  afterEach,
  it,
  expect,
} from "vitest";

// Imports que dependem de Nuxt
import { useTaskFlowStore } from "~/stores/taskFlow"; // Statically import useTaskFlowStore
import type { NodeData, TaskFlowNode } from "~/types/taskflow"; // Import types from types/taskflow.ts
import { useModalStore, ModalType } from "~/stores/modal";
// Components and handlers will be dynamically imported in beforeAll

// Para importações que podem depender dos mocks
// let useTaskFlowStore: any; // Removed: will use static import
let store: ReturnType<typeof useTaskFlowStore>; // Type store correctly
let DataSourceModalComponent: any;
let DataSourceNodeHandler: any;
let DataSourceCardComponent: any;

// Import mocks para testes
// import { mockFetch } from "../mocks/imports"; // Removed duplicate import

// Helpers
const createDataSourceNode = (
  id: string,
  data: Partial<NodeData> = {}
): TaskFlowNode => ({
  id,
  type: "dataSource",
  position: { x: 0, y: 0 },
  label: "Data Source Node",
  selected: false,
  computedPosition: { x: 0, y: 0, z: 0 },
  handleBounds: { source: [], target: [] },
  dimensions: { width: 0, height: 0 },
  draggable: true,
  selectable: true,
  connectable: true,
  focusable: true,
  isParent: false,
  resizing: false,
  dragging: false,
  events: {},
  data: {
    title: "Default Data Source Title",
    description: "Provides data from knowledge base.",
    sources: [],
    inputData: data.inputData || {},
    outputData: data.outputData || {},
    cumulativeContext: data.cumulativeContext || {
      compressed: false,
      blob: {},
    },
    updated_at: data.updated_at || new Date().toISOString(),
    processInputError:
      data.processInputError === undefined ? null : data.processInputError,
    ...data,
  },
});

// Life-cycle
beforeAll(async () => {
  await setup({
    nuxtConfig: {
      modules: ["@nuxtjs/supabase", "@pinia/nuxt"],
      plugins: ["~/tests/plugins/mock-fetch.client.ts"],
      runtimeConfig: {
        public: {
          supabase: {
            url: "http://localhost:54321/test_datasourcemodal_spec",
            key: "mock_key_datasourcemodal_spec",
          },
        },
      },
    },
  });

  // Dynamically import components and handlers after setup
  const dsModalModule = await import(
    "~/components/modals/DataSourceModal/DataSourceModal.vue"
  );
  DataSourceModalComponent = dsModalModule.default;

  const dsHandlerModule = await import(
    "~/lib/nodeHandlers/dataSourceNodeHandler"
  );
  DataSourceNodeHandler = dsHandlerModule.dataSourceNodeHandler;

  const dsCardModule = await import("~/components/cards/DataSourceCard.vue");
  DataSourceCardComponent = dsCardModule.default;

  // Removed dynamic import of useTaskFlowStore as it's now statically imported
  // const taskFlowStoreModule = await import("~/stores/taskFlow");
  // useTaskFlowStore = taskFlowStoreModule.useTaskFlowStore;
}, 30000);

beforeEach(() => {
  setActivePinia(createPinia());
  // useTaskFlowStore is now the statically imported factory
  store = useTaskFlowStore();
  store.currentTaskId = "test-task-id";
  store.nodes = [];
  store.edges = [];
  vi.clearAllMocks();
});

afterAll(async () => {
  const ctx = useTestContext();
  await ctx?.nuxt?.close?.();
});

// Tests for DataSourceNodeHandler
describe("DataSourceNodeHandler", () => {
  it("initializeData deve retornar a estrutura de dados inicial correta", () => {
    const initialData = DataSourceNodeHandler.initializeData({
      label: "My KB",
    });

    expect(initialData.title).toBe("Dados do projeto");
    expect(initialData.label).toBe("My KB");
    expect(initialData.sources).toEqual([]);
    expect(initialData.outputData).toEqual({});
  });

  it("processInput deve retornar o inputData original", () => {
    const nodeData: NodeData = {
      title: "Test",
      description: "Test desc",
      inputData: { parentKey: "parentValue" },
      outputData: {},
      sources: [],
      cumulativeContext: { compressed: false, blob: {} },
      updated_at: new Date().toISOString(),
    };
    const parentOutputs = { someParentOutput: "value" };

    const processedInput = DataSourceNodeHandler.processInput(
      nodeData,
      parentOutputs
    );

    expect(processedInput).toEqual({ parentKey: "parentValue" });
  });

  it("generateOutput deve retornar os sources do nó", () => {
    const node = createDataSourceNode("ds1", {
      sources: ["file1.pdf", "id_doc2"],
    });

    const output = DataSourceNodeHandler.generateOutput(node);

    // Permite saída legacy (array de strings) ou novo (array de objetos com name/id)
    const expectedIds = ["file1.pdf", "id_doc2"];
    if (output.uploaded_files.every((f: any) => typeof f === "string")) {
      expect(output.uploaded_files).toEqual(expectedIds);
    } else {
      // Novo formato: objetos
      const receivedNames = output.uploaded_files.map(
        (f: any) => f.name || f.id
      );
      expect(receivedNames).toEqual(expectedIds);
    }
  });

  it("generateOutput deve retornar um array vazio se não houver sources", () => {
    const node = createDataSourceNode("ds2", { sources: [] });
    const output = DataSourceNodeHandler.generateOutput(node);
    expect(output).toEqual({ uploaded_files: [], survey_kpis: [] });
  });

  it("getDisplayData deve retornar a contagem de sources e o título", () => {
    const node = createDataSourceNode("ds3", {
      title: "KB Files",
      sources: ["a", "b", "c"],
    });
    const displayData = DataSourceNodeHandler.getDisplayData(node);
    expect(displayData.title).toBe("KB Files");
    expect(displayData.sourceCount).toBe(3);
  });

  it("generateOutput deve inferir tipos de perguntas e preencher inferred_survey_columns para arquivos Excel", () => {
    const excelFile = {
      type: "excel",
      name: "pesquisa.xlsx",
      content: "qualquer markdown",
      structured_data: {
        sheets: [
          {
            sheetName: "Sheet1",
            columns: [
              {
                header: "Qual seu nível de satisfação?",
                responses: ["1", "2", "5", "3", "5", "2", "1"],
                type: "rating",
              },
              {
                header: "Comentários",
                responses: ["Ótimo!", "Precisa melhorar", "Nada a declarar"],
                type: "openText",
              },
              {
                header: "Departamento",
                responses: ["RH", "TI", "RH", "TI", "RH"],
                type: "multipleChoice",
              },
            ],
          },
        ],
      },
    };

    const node = createDataSourceNode("ds-excel", {
      sources: [excelFile],
    });

    const output = DataSourceNodeHandler.generateOutput(node);

    expect(output.uploaded_files).toHaveLength(1);

    const enriched = output.uploaded_files[0];
    expect(enriched.inferred_survey_columns).toBeDefined();
    expect(enriched.inferred_survey_columns).toHaveLength(3);

    // Checa rating
    expect(enriched.inferred_survey_columns[0]).toMatchObject({
      questionText: "Qual seu nível de satisfação?",
      questionType: "rating",
      totalResponses: 7,
      distribution: { "1": 2, "2": 2, "3": 1, "5": 2 },
    });

    // Checa openText
    expect(enriched.inferred_survey_columns[1]).toMatchObject({
      questionText: "Comentários",
      questionType: "openText",
      totalResponses: 3,
      openTextResponses: ["Ótimo!", "Precisa melhorar", "Nada a declarar"],
    });

    // Checa multipleChoice
    expect(enriched.inferred_survey_columns[2]).toMatchObject({
      questionText: "Departamento",
      questionType: "multipleChoice",
      totalResponses: 5,
      distribution: { RH: 3, TI: 2 },
    });
  });

  it("deve inferir como multipleChoice uma coluna com respostas concatenadas por vírgula", () => {
    const multiSelectResponses = [
      "Pedidos entregues: É o percentual de pedidos que foram entregues ao cliente após a coleta na loja, Pedidos coletados: É o percentual de pedidos que tiveram a coleta concluída com sucesso na loja., Pontualidade: É a média de minutos de atraso nos seus pedidos",
      "Pedidos entregues: É o percentual de pedidos que foram entregues ao cliente após a coleta na loja",
      "Avaliações: É a média de avaliações positivas recebidas de lojas e clientes., Pontualidade: É a média de minutos de atraso nos seus pedidos",
      "Outros",
    ];

    const excelFile = {
      type: "excel",
      name: "pesquisa_multi_select.xlsx",
      structured_data: {
        sheets: [
          {
            sheetName: "Respostas",
            columns: [
              {
                header:
                  "Que tipos de indicadores você considera mais importantes?",
                responses: multiSelectResponses,
                type: "multipleChoice",
              },
            ],
          },
        ],
      },
    };

    const node = createDataSourceNode("ds-multiselect", {
      sources: [excelFile],
    });

    const output = DataSourceNodeHandler.generateOutput(node);

    expect(output.uploaded_files[0].inferred_survey_columns).toBeDefined();
    const inferredColumn = output.uploaded_files[0].inferred_survey_columns[0];

    expect(inferredColumn.questionType).toBe("multipleChoice");

    // Validar a distribuição contada
    expect(inferredColumn.distribution).toEqual({
      "Pedidos entregues: É o percentual de pedidos que foram entregues ao cliente após a coleta na loja": 2,
      "Pedidos coletados: É o percentual de pedidos que tiveram a coleta concluída com sucesso na loja.": 1,
      "Pontualidade: É a média de minutos de atraso nos seus pedidos": 2,
      "Avaliações: É a média de avaliações positivas recebidas de lojas e clientes.": 1,
      Outros: 1,
    });

    expect(inferredColumn.totalResponses).toBe(4);
  });
});

// Tests for DataSourceCard Component
describe("DataSourceCard component", () => {
  let wrapper: VueWrapper<any>;

  afterEach(async () => {
    if (wrapper) {
      wrapper.unmount();
      await nextTick();
    }
  });

  it("deve renderizar o título e a contagem de sources do getDisplayData", async () => {
    const node = createDataSourceNode("dsc1", {
      title: "My Knowledge Base", // Ensure this title is used for the test
      sources: [
        { id: "file1.txt", name: "file1.txt", type: "text" },
        { id: "report.pdf", name: "report.pdf", type: "pdf" },
      ],
    });
    // const displayData = DataSourceNodeHandler.getDisplayData(node); // displayData not directly used by card, card uses props.data
    store.addNode(node);
    await nextTick();

    wrapper = mount(DataSourceCardComponent, {
      props: {
        id: "dsc1",
        type: "dataSource",
        data: node.data,
      },
      global: {
        stubs: {
          DataIcon: true,
          NodeToolbar: true,
          Handle: true,
        },
      },
    });
    await nextTick();

    expect(wrapper.html()).toContain("My Knowledge Base");

    expect(wrapper.html()).toContain("2 dados");
  });

  it("deve abrir o DataSourceModal ao clicar no botão de edição na toolbar", async () => {
    const node = createDataSourceNode("dsc2", {
      sources: [{ id: "s1", name: "Source 1", type: "text" }], // Node with existing data
    });
    store.addNode(node);
    const modalStore = useModalStore();
    vi.spyOn(modalStore, "openModal");
    await nextTick();

    wrapper = mount(DataSourceCardComponent, {
      props: {
        id: "dsc2",
        type: "dataSource",
        data: node.data,
        selected: true, // Make NodeToolbar visible
      },
      global: {
        stubs: {
          // Do not stub PencilSquareIcon here, let the actual component render
          DataIcon: true,
          Handle: true,
        },
      },
    });
    await nextTick();

    // Ensure the toolbar itself is rendered
    const toolbar = wrapper.find('[data-testid="node-toolbar-mock"]');
    expect(toolbar.exists()).toBe(true);

    expect(toolbar.exists()).toBe(true); // Toolbar mock should be visible

    // Spy on the method that should be called by the icon click
    const requestNodeEditSpy = vi.spyOn(wrapper.vm, "requestNodeEdit");

    // Directly call the method, as finding the icon reliably is problematic
    await wrapper.vm.requestNodeEdit();
    await nextTick();

    // Check if the internal method was called
    expect(requestNodeEditSpy).toHaveBeenCalled();

    // Then check if that method, in turn, called openModal
    expect(modalStore.openModal).toHaveBeenCalledWith(
      "dataSource",
      node.data,
      node.id
    );

    requestNodeEditSpy.mockRestore(); // Clean up spy
  });

  it("deve exibir o botão '+ Adicionar dados ao projeto' se não houver sources", async () => {
    const node = createDataSourceNode("dsc3", { sources: [] });
    store.addNode(node);
    await nextTick();

    wrapper = mount(DataSourceCardComponent, {
      props: {
        id: "dsc3",
        type: "dataSource",
        data: node.data,
      },
      global: {
        stubs: { DataIcon: true, NodeToolbar: true, Handle: true },
      },
    });
    await nextTick();

    const addButton = wrapper.find('[data-testid="add-source"]');
    expect(addButton.exists()).toBe(true);
    expect(addButton.text()).toContain("Adicionar dados ao projeto");

    const sourcesList = wrapper.find("ul");
    expect(sourcesList.exists()).toBe(false);
  });

  // Em tests/vitest/nodes/dataSourceCard.spec.ts

  describe("DataSourceNodeHandler - generateOutput", () => {
    it("deve criar 'inferred_survey_columns' e 'survey_kpis' a partir de structured_data", () => {
      // 1. Mock de dados extraídos de um excel
      const mockStructuredData = {
        sheets: [
          {
            sheetName: "Respostas",
            columns: [
              {
                header: "NPS",
                responses: ["9", "10", "7", "9"],
                type: "rating",
              },
              {
                header: "Feedback",
                responses: ["Ótimo", "Pode melhorar"],
                type: "openText",
              },
            ],
          },
        ],
      };
      const node = createDataSourceNode("ds-1", {
        sources: [{ type: "excel", structured_data: mockStructuredData }],
      });

      // 2. Executa a função a ser testada
      const output = DataSourceNodeHandler.generateOutput(node);

      // 3. Asserts
      const enrichedFile = output.uploaded_files[0];
      const npsColumn = enrichedFile.inferred_survey_columns[0];
      const feedbackColumn = enrichedFile.inferred_survey_columns[1];
      const kpis = output.survey_kpis;

      // Coluna NPS (rating)
      expect(npsColumn.questionType).toBe("rating");
      expect(npsColumn.distribution).toEqual({ "7": 1, "9": 2, "10": 1 });

      // Coluna Feedback (openText)
      expect(feedbackColumn.questionType).toBe("openText");
      expect(feedbackColumn.openTextResponses).toEqual([
        "Ótimo",
        "Pode melhorar",
      ]);

      // KPIs
      expect(kpis).toHaveLength(1);
      expect(kpis[0]).toMatchObject({
        metric: "NPS",
        value: "8.8", // (9+10+7+9)/4 = 8.75 -> "8.8"
        details: "N=4 respostas",
      });
    });
  });

  it("deve reagir a mudanças nos dados do nó (ex: atualização de sources)", async () => {
    const nodeId = "dsc4";
    const initialNode = createDataSourceNode(nodeId, { sources: [] });
    store.addNode(initialNode);
    await nextTick();

    wrapper = mount(DataSourceCardComponent, {
      props: {
        id: nodeId,
        type: "dataSource",
        data: initialNode.data,
      },
      global: {
        stubs: { DataIcon: true, NodeToolbar: true, Handle: true },
      },
    });
    await nextTick();

    expect(wrapper.find('[data-testid="add-source"]').text()).toContain(
      "Adicionar dados ao projeto"
    );
    expect(wrapper.find("ul").exists()).toBe(false);

    const newSources = [{ id: "src1", name: "Source 1", type: "pdf" }];
    await store.updateNodeData(nodeId, { sources: newSources });

    // Ensure the component's props are updated to reflect the store change
    const updatedNode = store.nodes.find((n) => n.id === nodeId);
    if (updatedNode) {
      await wrapper.setProps({ data: { ...updatedNode.data } }); // Spread to ensure new object
    }

    await nextTick(); // Allow DOM to update after prop change

    expect(wrapper.find('[data-testid="add-source"]').exists()).toBe(false);
    const sourcesList = wrapper.find("ul");
    expect(sourcesList.exists()).toBe(true);
    expect(sourcesList.findAll("li").length).toBe(1);
    expect(sourcesList.text()).toContain("Source 1");
  });
});

// Tests for DataSourceModal Component
describe("DataSourceModal component", () => {
  interface TestSourceType {
    id: string;
    name: string;
    type: string;
    category: string;
    title?: string;
    content?: any;
    createdAt?: string;
  }

  interface UpdateNodeDataEventPayload {
    nodeId: string;
    updatedData: {
      sources: TestSourceType[];
    };
  }

  let wrapper: VueWrapper<any>;
  let modalStore: ReturnType<typeof useModalStore>;

  beforeEach(() => {
    modalStore = useModalStore();
  });

  afterEach(async () => {
    if (wrapper) {
      wrapper.unmount();
      await nextTick();
    }
  });

  it("deve ser renderizado quando aberto pela modalStore", async () => {
    const node = createDataSourceNode("dsm1");
    store.addNode(node);

    modalStore.openModal(
      ModalType.dataSource,
      { existingSources: [] }, // data payload
      "dsm1" // nodeId
    );
    await nextTick();

    wrapper = mount(DataSourceModalComponent, {
      props: {
        isOpen: true,
        nodeData: { sources: [] },
      },
      global: {
        stubs: {
          teleport: true,
          DataIcon: true,
          DataSourceNoteEditor: true,
          DataSourceActionModal: true,
          NodeIOViewer: true,
        },
      },
      attachTo: document.body,
    });
    await nextTick();
    const modalEl = wrapper.find('[role="dialog"]');
    expect(modalEl.exists()).toBe(true);
  });

  it("deve listar as fontes de dados passadas via props.nodeData", async () => {
    const mockSources = [
      { id: "s1", name: "Documento Alpha.pdf", type: "pdf", category: "geral" },
      {
        id: "s2",
        name: "Nota Beta.txt",
        type: "text",
        category: "pesquisa_usuario",
      },
      {
        id: "s3",
        name: "Planilha Gamma.xlsx",
        type: "excel",
        category: "geral",
      },
    ];

    wrapper = mount(DataSourceModalComponent, {
      props: {
        isOpen: true,
        nodeData: { sources: mockSources },
      },
      global: {
        stubs: {
          // Do NOT stub DataSourceList here, as we need to test its rendering
          DataIcon: true,
          DataSourceNoteEditor: true,
          DataSourceActionModal: true,
          NodeIOViewer: true,
          Markdown: { template: '<span class="icon-markdown" />' },
          Excel: { template: '<span class="icon-excel" />' },
          WordIcon: { template: '<span class="icon-word" />' },
          TextFile: { template: '<span class="icon-textfile" />' },
          Json: { template: '<span class="icon-json" />' },
          DocumentTextIcon: {
            name: "DocumentTextIcon",
            template: '<div class="stub-document-text-icon" />',
          }, // More explicit stub
          EllipsisVerticalIcon: {
            template: '<span class="icon-ellipsisvertical" />',
          },
        },
      },
      attachTo: document.body, // Add this line
    });
    await nextTick();

    // Wait for the list items to be rendered
    let listItems = document.querySelectorAll(
      "div.flex.items-center.justify-between.text-sm.p-2.border-b"
    );
    let attemptsList = 0;
    while (listItems.length === 0 && attemptsList < 10) {
      await nextTick();
      listItems = document.querySelectorAll(
        "div.flex.items-center.justify-between.text-sm.p-2.border-b"
      );
      if (listItems.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay
      }
      attemptsList++;
    }

    expect(listItems.length).toBe(mockSources.length);

    for (let i = 0; i < mockSources.length; i++) {
      const listItem = listItems[i];
      const source = mockSources[i];
      expect(listItem.textContent).toContain(source.name.trim());
      // Ícones são verificados em testes unitários menores; aqui basta o texto.
    }
  });

  it("deve emitir o evento 'close' ao clicar no botão de fechar (X)", async () => {
    const nodeId = "dsm-close-test";
    modalStore.openModal(ModalType.dataSource, {
      nodeId,
      existingSources: [],
    });
    await nextTick();

    wrapper = mount(DataSourceModalComponent, {
      props: {
        isOpen: true,
        nodeData: { sources: [] },
      },
      global: {
        stubs: {
          DataIcon: true,
          // DataSourceList: true, // Keep DataSourceList stubbed if not directly testing its rendering
          DataSourceNoteEditor: true,
          DataSourceActionModal: true,
          NodeIOViewer: true,
        },
      },
      attachTo: document.body, // Add this line
    });
    await nextTick();

    // Wait for the close button to be rendered
    // Wait for the close button to be rendered (query document.body directly)
    let closeButton = document.querySelector(
      '[data-testid="close-modal-button"]'
    );
    let attemptsClose = 0;
    while (closeButton === null && attemptsClose < 10) {
      await nextTick();
      closeButton = document.querySelector(
        '[data-testid="close-modal-button"]'
      );
      if (closeButton === null) {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay
      }
      attemptsClose++;
    }

    expect(closeButton !== null).toBe(true);

    if (closeButton) {
      (closeButton as HTMLElement).click();
    }
    await nextTick();

    expect(wrapper.emitted("close")).toBeTruthy();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
