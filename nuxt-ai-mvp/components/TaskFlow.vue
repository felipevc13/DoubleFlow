<!-- components/TaskFlow.vue -->
<template>
  <div
    class="vue-flow-wrapper h-full w-full relative flex flex-col"
    :data-viewport="JSON.stringify(viewport)"
  >
    <Header
      :task-name="taskName"
      @rename="openRenameForm"
      @delete="deleteTask"
      class="mb-[-72px] z-10"
    />
    <div class="flex-1 relative">
      <ClientOnly>
        <div
          ref="flowContainerRef"
          v-if="isFlowReady"
          class="vue-flow-container absolute inset-0"
        >
          <VueFlow
            :id="flowId"
            ref="vueFlowRef"
            @vue-flow:init="onFlowInit"
            v-model:nodes="taskFlowStore.nodes"
            v-model:edges="taskFlowStore.edges"
            v-model:viewport="viewport"
            :node-types="nodeTypes"
            :default-viewport="{ zoom: 1 }"
            :min-zoom="0.2"
            :max-zoom="4"
            :snap-to-grid="true"
            :snap-grid="[15, 15]"
            :elevate-nodes-on-select="true"
            :delete-key-code="null"
            :nodes-draggable="true"
            :edges-updatable="true"
            :nodes-connectable="true"
            :elements-selectable="true"
            :fit-view-on-init="true"
            :fit-view-options="{ padding: 0.25, duration: 200 }"
            :is-valid-connection="isValidConnectionHandler"
            @nodes-initialized="onNodesInitializedHandler"
            @connect="onConnect"
            @node-click="minimalNodeClickHandler"
            @edge-click="minimalEdgeClickHandler"
            @pane-click="onPaneClick"
            @edge-update-start="onEdgeUpdateStart"
            @edge-update="onEdgeUpdate"
            @edge-update-end="onEdgeUpdateEnd"
            @node-drag-stop="onNodeDragStop"
            @move-end="handleMoveEnd"
            @connect-start="onConnectStart"
            @connect-end="onConnectEnd"
            tabindex="0"
            class="basicflow"
          >
            <template #node-problem="nodeProps">
              <ProblemCard
                :id="nodeProps.id"
                :data="nodeProps.data"
                :selected="nodeProps.selected"
                :is-loading="loadingNodes.includes(nodeProps.id)"
                :key="nodeProps.id"
                :has-outgoing-connection="
                  taskFlowStore.edges.some(
                    (edge) => edge.source === nodeProps.id
                  )
                "
              />
            </template>
            <template #node-dataSource="nodeProps">
              <DataSourceCard
                :id="nodeProps.id"
                :data="nodeProps.data"
                :selected="nodeProps.selected"
                :is-loading="loadingNodes.includes(nodeProps.id)"
                :key="nodeProps.id"
                :has-outgoing-connection="
                  taskFlowStore.edges.some(
                    (edge) => edge.source === nodeProps.id
                  )
                "
              />
            </template>

            <template #node-survey="nodeProps">
              <SurveyCard
                :id="nodeProps.id"
                :data="nodeProps.data"
                :selected="nodeProps.selected"
                :is-loading="loadingNodes.includes(nodeProps.id)"
                :key="nodeProps.id"
                :has-outgoing-connection="
                  taskFlowStore.edges.some(
                    (edge) => edge.source === nodeProps.id
                  )
                "
              />
            </template>

            <template #node-analysis="nodeProps">
              <AnalysisCard
                :id="nodeProps.id"
                :data="nodeProps.data"
                :selected="nodeProps.selected"
                :is-loading="loadingNodes.includes(nodeProps.id)"
                :key="nodeProps.id"
                :has-outgoing-connection="
                  taskFlowStore.edges.some(
                    (edge) => edge.source === nodeProps.id
                  )
                "
              />
            </template>

            <Background
              pattern-color="#393939"
              color="#393939"
              gap="40"
              size="3"
            />
            <Controls :show-interactive="false" />
            <EdgeLabelRenderer>
              <!-- Loop over the computed label data -->
              <template v-for="label in edgeLabelData" :key="label.id">
                <div
                  v-if="label.selected"
                  :style="{
                    position: 'absolute',
                    // Use calculated label.x and label.y for positioning
                    transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)`,
                    pointerEvents: 'all',
                  }"
                  class="nopan nodrag"
                >
                  <button
                    @click.stop="requestEdgeDeletion(label.id)"
                    class="btn btn-ghost btn-square border border-[#7E8692] bg-[#18181b] rounded-[8px] hover:!border-red-500 group transition-colors duration-150 flex items-center justify-center p-0"
                    style="
                      pointer-events: auto;
                      z-index: 50;
                      width: 32px;
                      height: 32px;
                      padding: 0;
                    "
                    title="Excluir Conexão"
                    aria-label="Excluir Conexão"
                    type="button"
                  >
                    <TrashIcon
                      class="w-5 h-5 text-[#A9A9AE] group-hover:text-red-500 transition-colors duration-150"
                    />
                  </button>
                </div>
              </template>
            </EdgeLabelRenderer>
            <!-- Add the "+" button with Tailwind classes -->
            <div class="absolute top-[88px] right-4 z-50 pointer-events-auto">
              <label
                class="btn btn-ghost btn-square border border-[#7E8692] hover:!border-[#4D6BFE]"
                style="pointer-events: auto; z-index: 50"
                @click="handleAddNodeGlobalClick"
              >
                +
              </label>
            </div>
            <!-- Botão de abrir o chat Flow Agent -->
            <div class="absolute top-[144px] right-4 z-50 pointer-events-auto">
              <label
                class="btn btn-ghost btn-square border border-[#7E8692] hover:!border-[#4D6BFE]"
                style="pointer-events: auto; z-index: 50"
                @click="sidebarStore.openSidebar('agent')"
                title="Abrir Chat Flow"
              >
                <IAIcon></IAIcon>
              </label>
            </div>
          </VueFlow>
        </div>
        <template #fallback>
          <div class="flex items-center justify-center h-full w-full">
            <div class="loading loading-spinner loading-lg text-blue-500"></div>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup>
// Ativa debug global do VueFlow (devtools)
// Ativa debug global do VueFlow (devtools) - Desativar em produção
window.VUE_FLOW_DEVTOOLS = true;
import {
  ref,
  onMounted,
  nextTick,
  onUnmounted,
  watch,
  watchEffect,
  computed,
  shallowRef,
  markRaw,
} from "vue";
import { storeToRefs } from "pinia";
import {
  VueFlow,
  useVueFlow,
  Position,
  getSmoothStepPath,
} from "@vue-flow/core";
import { applyEdgeChanges, applyNodeChanges } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { NodeToolbar } from "@vue-flow/node-toolbar";
import { EdgeLabelRenderer } from "@vue-flow/core";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useSidebarStore } from "~/stores/sidebar";
import { useSidenavStore } from "~/stores/sidenav";
import { useModalStore } from "~/stores/modal";
import Header from "~/components/Header.vue";
import ProblemCard from "./cards/ProblemCard.vue";
import DataSourceCard from "./cards/DataSourceCard.vue";
import SurveyCard from "./cards/SurveyCard.vue";
import AnalysisCard from "./cards/AnalysisCard.vue";
import { useNodeActions } from "~/composables/useNodeActions";
import NodeActionToolbar from "./NodeActionToolbar.vue";
import { connectionRules } from "~/lib/connectionRules";
import { XMarkIcon } from "@heroicons/vue/24/solid";
import { TrashIcon } from "@heroicons/vue/24/outline";
// import { groupSourcesByCategory } from "~/utils/helpers";
import { useConnectionControlStore } from "~/stores/connectionControl";
import { until } from "@vueuse/core";
import { useAnimatedFitToNode } from "~/composables/useAnimatedFitToNode";
import IAIcon from "./icon/IAIcon.vue";

const props = defineProps({
  initialProblem: {
    type: Object,
    default: () => ({
      title: "",
      description: "",
      updated_at: new Date().toISOString(),
    }),
  },
  taskId: { type: String, required: true },
  taskName: { type: String, required: true },
});

const { updateNodeInternals } = useVueFlow();

// Garante que ao criar a primeira task (ProblemCard), o handle + é atualizado corretamente
const taskFlowStore = useTaskFlowStore();
const { nodeToAnimateTo } = storeToRefs(taskFlowStore);
const vueFlowRef = ref(null); // holds the VueFlow instance
// Função de animação (usa o vueFlowRef para caminho rápido)
const { animateToNode } = useAnimatedFitToNode(vueFlowRef);

// --- Bloco para criação automática do nó inicial problem-1 ---
import { useSupabaseClient } from "#imports";
import { useTasksStore } from "~/stores/tasks"; // ajuste conforme o nome correto da sua store

const supabase = useSupabaseClient();
const tasksStore = useTasksStore();
const initialNodeCreated = ref(false);

watch(nodeToAnimateTo, async (newNodeId) => {
  if (newNodeId) {
    await animateToNode(newNodeId, { padding: 0.3, duration: 600 });
    taskFlowStore.clearNodeToAnimateTo();
  }
});

// Watcher para resetar initialNodeCreated ao trocar de taskId
watch(
  () => props.taskId,
  (newTaskId, oldTaskId) => {
    if (newTaskId && newTaskId !== oldTaskId) {
      initialNodeCreated.value = false;
    }
  }
);

watchEffect(async () => {
  if (
    taskFlowStore.isInitialLoadComplete &&
    taskFlowStore.nodes.length === 0 &&
    !initialNodeCreated.value &&
    taskFlowStore.currentTaskId
  ) {
    if (taskFlowStore.currentTaskId !== props.taskId) {
      return;
    }
    initialNodeCreated.value = true;

    try {
      // Busca o título e descrição do problema na task
      const task = await tasksStore.fetchTask(
        supabase,
        taskFlowStore.currentTaskId
      );
      const problemStatement = task?.problem_statement || {
        title: props.taskName,
        description: "",
      };

      // Cria o nó inicial do problema (sem contexto de base de conhecimento)
      const problemNode = {
        id: "problem-1",
        type: "problem",
        position: { x: 150, y: 150 },
        deletable: false,
        draggable: true,
        data: {
          title: problemStatement.title,
          description: problemStatement.description,
          updated_at: new Date().toISOString(),
          inputData: {},
          outputData: {},
        },
      };

      if (taskFlowStore.currentTaskId) {
        await taskFlowStore.addNode(problemNode);
      } else {
        const stop = watch(
          () => taskFlowStore.currentTaskId,
          (id) => {
            if (id) {
              taskFlowStore.addNode(problemNode);
              stop();
            }
          },
          { immediate: true }
        );
      }

      // (Opcional) Reprocessa o node caso dependa de outputs
      if (typeof taskFlowStore.requestNodeReprocessing === "function") {
        await taskFlowStore.requestNodeReprocessing("problem-1");
      }
    } catch (error) {
      console.error("Falha ao criar o nó inicial problem-1:", error);
    }
  }
});

const directParentIdsMap = computed(() => {
  const parentMap = new Map();
  for (const edge of taskFlowStore.edges) {
    if (!parentMap.has(edge.target)) {
      parentMap.set(edge.target, new Set());
    }
    parentMap.get(edge.target).add(edge.source);
  }
  return parentMap;
});

const getDirectParentIds = (nodeId) => {
  return directParentIdsMap.value.get(nodeId) || new Set();
};

// ---- [EXPOSE VUEFLOW INSTANCE AND $vueFlowReady FOR E2E TESTS] ----

// Loga estado inicial dos nodes e edges

const {
  handleNodeClick: nodeActionsHandleNodeClick,
  handleNodeUnselect: nodeActionsHandleNodeUnselect,
} = useNodeActions();

const emit = defineEmits([
  "rename",
  "delete",
  "node-clicked",
  "update-problem",
]);

const flowId = "task-flow";
if (process.client) {
  window.$piniaTaskFlowStore = taskFlowStore;
}
const sidebarStore = useSidebarStore();
const sidenavStore = useSidenavStore();
const modalStore = useModalStore();
const { nodes, edges, viewport } = storeToRefs(taskFlowStore);
const isFlowReady = ref(false);

// Novo watcher: executa updateNodeInternals/fitView quando flow está pronto e ProblemCard é o único node
watch(
  [isFlowReady, () => taskFlowStore.nodes.length],
  async ([flowReady, nodeLen], [oldFlowReady, oldNodeLen]) => {
    // Só executa se ficou pronto agora, e só se ProblemCard for o primeiro node
    if (
      flowReady &&
      nodeLen === 1 &&
      taskFlowStore.nodes[0]?.id === "problem-1"
    ) {
      await nextTick();
      updateNodeInternals(["problem-1"]);
      await nextTick();
      fitView({ padding: 0.25, duration: 200 });
    }
  }
);
const hasSavedViewport = ref(false);
const loadingNodes = ref([]);
const lastClickedNodeId = ref(null);
const lastClickedEdgeId = ref(null);
const flowContainerRef = ref(null); // Template ref for the container
// (vueFlowRef already declared above)

function onFlowInit(instance) {
  console.log(
    "✅ [TaskFlow.vue] onFlowInit foi disparado. Instância:",
    instance
  );
  if (process.client) {
    window.$vueFlow = instance;
  }
  // Register the VueFlow instance in the store
  taskFlowStore.setVueFlowInstance(instance);

  // Manter o viewport da store sincronizado para lógicas de clamp, etc.
  instance.on("viewport-update", (vp) => {
    taskFlowStore.updateViewportAndSave(vp);
  });

  instance.on("move-end", (event) => {
    if (event?.viewport) {
      taskFlowStore.updateViewportAndSave(event.viewport);
    }
  });
}

onUnmounted(() => {
  if (process.client) {
    delete window.$vueFlow;
    delete window.$vueFlowReady;
    delete window.$vueFlowZoom;
    delete window.$vueFlowPan;
  }
});

const nodeTypes = shallowRef({
  problem: markRaw(ProblemCard),
  dataSource: markRaw(DataSourceCard),
  survey: markRaw(SurveyCard),
  analysis: markRaw(AnalysisCard),
});

// DEBUG: Log edges e nodes enviados ao Vue Flow em tempo real

// DETECTOR DE EDGES INVÁLIDOS (source ou target vazio/null/undefined)

// Computed e watcher para edges com problema (source/target inexistente ou vazio)
const edgesComProblema = computed(() => {
  return taskFlowStore.edges.filter(
    (e) =>
      !taskFlowStore.nodes.some((n) => n.id === e.source) ||
      !taskFlowStore.nodes.some((n) => n.id === e.target) ||
      !e.source ||
      !e.target
  );
});

// Configuração do VueFlow com apenas o ID como argumento
const {
  fitView,
  viewport: vueFlowViewport,
  setViewport,
  nodes: vueFlowNodes,
  edges: vueFlowEdges,
  findSelectedNodes,
  findSelectedEdges,
  removeNodes,
  removeEdges,
  findNode,
  getSelectedNodes,
  project,
} = useVueFlow(flowId, {
  defaultViewport: { x: 0, y: 0, zoom: 1 },
  minZoom: 0.2,
  maxZoom: 4,
  panOnScroll: true,
  zoomOnDoubleClick: true,
  snapToGrid: true,
  snapGrid: [15, 15],
  defaultEdgeOptions: { type: "smoothstep", animated: false },
  defaultNodeOptions: {
    draggable: true,
    connectable: true,
    selectable: true,
    deletable: true,
  },
  fitViewOnInit: true,
  fitViewOptions: { padding: 2, duration: 200 },
});

const layoutClass = computed(() => ({
  "ml-[72px]": sidenavStore.isCollapsed,
  "ml-[234px]": !sidenavStore.isCollapsed,
}));

const clearDragState = () => {
  document.body.removeAttribute("data-dragging-node");
  document
    .querySelectorAll(".vue-flow__node.dragging")
    .forEach((node) => node.classList.remove("dragging"));
};

import { useUiStateStore } from "~/stores/uiState";

const uiStateStore = useUiStateStore();

// Removido onMounted que inicializava ou carregava o fluxo.

onUnmounted(() => {
  clearDragState();
  sidebarStore.saveSidebarState();
  // Limpa assinatura realtime do Supabase ao sair da página
  taskFlowStore.cleanupRealtimeSubscription();

  // document.removeEventListener("keydown", handleGlobalKeyDown); // Comment out listener removal
});

// Watch for sidebar opening and fit view
watch(
  () => sidebarStore.activeSidebar,
  (newActiveSidebar, oldActiveSidebar) => {
    // Trigger fitView only when a sidebar opens (changes from null to a type)
    if (newActiveSidebar && !oldActiveSidebar) {
      // Use setTimeout to allow sidebar transition before fitting the view
      setTimeout(() => {
        // Use fitView to automatically center the content within the new bounds
        // fitView({ padding: 0.2, duration: 200 }); // Commented out as requested
      }, 250); // Delay to allow layout stabilization before fitting
    }
  }
);

watch(
  () => props.taskId,
  async (newTaskId, oldTaskId) => {
    if (newTaskId && newTaskId !== oldTaskId) {
      isFlowReady.value = false;
      hasSavedViewport.value = false;

      try {
        await taskFlowStore.loadTaskFlow(newTaskId);
        await nextTick();

        await nextTick();
        if (taskFlowStore.nodes.length > 0) {
          isFlowReady.value = true;
        } else {
          // Se continuar vazio após mais um tick, aguarde o watcher dos nodes para setar isFlowReady
          const unwatchNodes = watch(
            () => taskFlowStore.nodes.length,
            (len) => {
              if (len > 0) {
                isFlowReady.value = true;
                unwatchNodes();
              }
            },
            { immediate: true }
          );
        }
      } catch (error) {
        // console.error(`[TaskFlow] Error during flow loading/initialization for task ${newTaskId}:`, error);
        isFlowReady.value = false;
      }
    }
  },
  { immediate: true }
);

const onViewportChange = (viewport) => {
  if (!viewport) return;
  taskFlowStore.updateViewport({
    x: Number.isFinite(viewport.x) ? viewport.x : 0,
    y: Number.isFinite(viewport.y) ? viewport.y : 0,
    zoom: Number.isFinite(viewport.zoom) ? viewport.zoom : 1,
  });
};

// --- Connection Validation Handler ---
const connectionControlStore = useConnectionControlStore();

function onConnectStart() {
  connectionControlStore.dragInProgress = true;
  connectionControlStore.lastInteractionWasSimpleClickOnSource = false;
}
function onConnectEnd() {
  connectionControlStore.dragInProgress = false;
  connectionControlStore.lastInteractionWasSimpleClickOnSource = false;
}

const isValidConnectionHandler = (connection) => {
  // Log detalhado do parâmetro recebido

  // --- INÍCIO DA NOVA LÓGICA ---
  // Impede conexão PARA um handle de ContextualAddButton (id termina com '-source-plus')
  if (
    typeof connection.targetHandle === "string" &&
    connection.targetHandle.endsWith("-source-plus")
  ) {
    console.warn(
      `[isValidConnectionHandler] Conexão bloqueada: Handle de destino '${connection.targetHandle}' pertence a um ContextualAddButton e não pode ser um alvo.`
    );
    return false;
  }
  // --- FIM DA NOVA LÓGICA ---

  // Log dos nodes conhecidos pelo Vue Flow no momento
  const allNodeIds = vueFlowNodes.value.map((n) => n.id);

  // Permite se já existe a edge na store (foi criada programaticamente)
  const edgeAlreadyInStore = taskFlowStore.edges.find(
    (e) => e.source === connection.source && e.target === connection.target
  );
  if (edgeAlreadyInStore && connection.source && connection.target) {
    // Só checa se os nodes existem no fluxo
    const sourceNode = vueFlowNodes.value.find(
      (node) => node.id === connection.source
    );
    const targetNode = vueFlowNodes.value.find(
      (node) => node.id === connection.target
    );
    if (!sourceNode || !targetNode) {
      console.warn(
        "[isValidConnectionHandler][DEBUG] Aresta na store, mas nó source/target não encontrado no Vue Flow. Bloqueando."
      );
      return false;
    }
    return true;
  }

  // Se a conexão NÃO está na store ainda, pode ser tentativa do usuário no canvas.
  if (
    connectionControlStore.lastInteractionWasSimpleClickOnSource &&
    !connectionControlStore.dragInProgress
  ) {
    return false;
  }

  // Busca dos nodes source e target
  const sourceNode = vueFlowNodes.value.find(
    (node) => node.id === connection.source
  );
  const targetNode = vueFlowNodes.value.find(
    (node) => node.id === connection.target
  );

  if (!sourceNode || !targetNode) {
    return false;
  }
  const sourceType = sourceNode.type;
  const targetType = targetNode.type;

  if (!sourceType || !targetType) {
    return false;
  }

  // Suas regras de conexão
  const isAllowed = connectionRules[sourceType]?.[targetType] === true;

  return isAllowed;
};
// --- End Connection Validation Handler ---

// --- Edge Update Handlers ---
const onEdgeUpdateStart = (edge) => {
  // Potential logic: Store the original edge if needed for revert/comparison
};

const onEdgeUpdate = ({ edge, connection }) => {
  // Potential logic: Validate the new connection during drag? (might be redundant with isValidConnection)
};

const onEdgeUpdateEnd = (edge) => {
  if (edge) {
    // If an edge exists, it means the update was successful (new connection made)
    // The `onConnect` handler should have already added the *new* edge.
    // We might need to remove the *original* edge here if VueFlow doesn't handle it automatically when replacing.
    // Let's check if the store still has the old edge ID if applicable.
    // For simplicity now, we assume VueFlow + onConnect handles the update correctly.
    // We might need to refine this if edges aren't updating as expected.
  } else {
    // If edge is null or undefined, it means the update was cancelled.
  }
};
// --- End Edge Update Handlers ---

const onConnect = (params) => {
  // --- INÍCIO DOS LOGS DETALHADOS ---
  // Verifica se os campos obrigatórios estão corretos
  if (!params.source || !params.target) {
    console.error(
      "[onConnect][ERRO] Parâmetros inválidos: source ou target ausentes",
      params
    );
  } else {
  }

  // Chama o método de adicionar edge na store
  taskFlowStore.addEdge(params);

  // Loga o estado dos edges DEPOIS

  // Loga cada edge isoladamente para identificar possíveis campos nulos/undefined
  taskFlowStore.edges.forEach((edge, i) => {
    if (!edge.source || !edge.target) {
      console.error(
        "[onConnect][EDGE ERRO] Edge com source/target inválido:",
        edge
      );
    }
    if (typeof edge.source !== "string" || typeof edge.target !== "string") {
      console.error(
        "[onConnect][EDGE ERRO] Edge com source/target não string:",
        edge
      );
    }
  });

  setTimeout(() => {
    const domEdges = document.querySelectorAll(".vue-flow__edge");
  }, 100);
};

// --- Node Click Handler (Handles selection tracking + actions) ---
const minimalNodeClickHandler = (event) => {
  // Fecha qualquer contextual popup aberto ao selecionar um node
  uiStateStore.triggerCloseContextualPopups();

  lastClickedNodeId.value = event.node.id; // Store the ID for potential deletion
  lastClickedEdgeId.value = null; // Clear edge selection when node is clicked

  const node = event.node;
  if (!node) {
    console.error("[TaskFlow] Invalid node in click event.");
    return;
  }

  // Logic for opening modal/sidebar moved to toolbars
  // Keep the handler minimal to just track the last click for deletion
  if (node.type !== "problem" && node.type !== "dataSource") {
    // Handle other node types or do nothing
  }
};

// --- Minimal Edge Click Handler ---
const minimalEdgeClickHandler = (event) => {
  lastClickedEdgeId.value = event.edge.id; // Store the ID
  lastClickedNodeId.value = null; // Clear node selection when edge is clicked
};
// --- End Minimal Edge Click Handler ---

const onPaneClick = () => {
  nodeActionsHandleNodeUnselect();
  sidebarStore.closeAllSidebars();
  lastClickedNodeId.value = null; // Clear last clicked ID on pane click
  lastClickedEdgeId.value = null; // Clear last clicked edge ID on pane click
  uiStateStore.triggerCloseContextualPopups();
};

const openRenameForm = () => emit("rename");
const deleteTask = () => emit("delete");

// --- Handler for Node Drag Stop ---
const onNodeDragStop = async ({ event, nodes: draggedNodes, node }) => {
  // A posição do node já foi atualizada via handleNodesChange
  // Salvamos imediatamente após o drag para garantir sincronização
  taskFlowStore.saveTaskFlow();
  // Logs de debug opcionais:
};

// --- Handler for Viewport Changes (Pan/Zoom) ---
const handleMoveEnd = async (event) => {
  // [DEBUG] Log início do handler

  // Revert to simple save on move end
  if (event) {
    taskFlowStore.updateViewportAndSave(event);
  }

  await nextTick();
  const domNodes = document.querySelectorAll(".vue-flow__node");
  const domEdges = document.querySelectorAll(".vue-flow__edge");
};

// --- Handler for Global Add Node Button Click ---
function handleAddNodeGlobalClick() {
  uiStateStore.triggerCloseContextualPopups();

  // Try to get the container and the pane element
  const container = flowContainerRef.value;
  if (!container) {
    // DEBUG LOG: container null
    console.warn(
      "[TaskFlow.vue DEBUG] flowContainerRef.value está null! Sidebar vai abrir em posição padrão (null)"
    );
    sidebarStore.openSidebar("addNode", null, null);
    return;
  }
  const pane = container.querySelector?.(".vue-flow__pane");
  if (!pane) {
    console.warn(
      "[TaskFlow.vue DEBUG] .vue-flow__pane não encontrado dentro de flowContainerRef! Sidebar vai abrir em posição padrão (null)"
    );
    sidebarStore.openSidebar("addNode", null, null);
    return;
  }
  const rect = pane.getBoundingClientRect();
  // Correção: Calcular o centro X e Y da tela para o painel do fluxo
  const screenCenterX = rect.left + rect.width / 2;
  const screenCenterY = rect.top + rect.height / 2;

  let flowCenterPosition;
  try {
    flowCenterPosition = project({ x: screenCenterX, y: screenCenterY });
  } catch (e) {
    console.error(
      "[TaskFlow.vue][handleAddNodeGlobalClick] Error calculating project:",
      e
    );
    sidebarStore.openSidebar("addNode", null, null);
    return;
  }

  sidebarStore.openSidebar(
    "addNode",
    { targetFlowX: flowCenterPosition.x, targetFlowY: flowCenterPosition.y },
    null
  );
}
// --- End Handler ---

// --- Custom handleEditNode for Problem Node ---
function handleEditNode(nodeId, node) {
  if (node && node.type === "problem") {
    sidebarStore.openSidebar("editProblem", node.data, nodeId);
  } else {
    // fallback to default (emit event or other logic if needed)
    // You may want to call the default behavior for other node types
    // For now, do nothing
  }
}

const edgeLabelData = computed(() => {
  const BUTTON_OFFSET_Y = 35;
  return (taskFlowStore.edges || []).map((edge) => {
    const sourceNode = findNode(edge.source);
    const targetNode = findNode(edge.target);

    if (!sourceNode || !targetNode) {
      // console.warn(`[edgeLabelData] Nodes not found for edge ${edge.id}`);
      return { id: edge.id, x: 0, y: 0, selected: edge.selected }; // Fallback position
    }

    // Get edge path and center coordinates
    // Assuming bottom source handle and top target handle based on card design
    // Ensure node dimensions are available (width/height might be needed)
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX: sourceNode.position.x + (sourceNode.dimensions?.width / 2 || 0),
      sourceY: sourceNode.position.y + (sourceNode.dimensions?.height || 0), // Assuming connection from bottom
      sourcePosition: Position.Bottom,
      targetX: targetNode.position.x + (targetNode.dimensions?.width / 2 || 0),
      targetY: targetNode.position.y, // Assuming connection to top
      targetPosition: Position.Top,
      // borderRadius: 5, // Optional: Adjust based on node style
      // offset: 10 // Optional: Adjust distance from node
    });

    return {
      id: edge.id,
      x: labelX,
      y: labelY + BUTTON_OFFSET_Y,
      selected: edge.selected === true, // Ensure boolean
    };
  });
});
// --- End computed property ---

// --- Function to request edge deletion ---
const requestEdgeDeletion = (edgeId) => {
  if (confirm("Tem certeza que deseja excluir esta conexão?")) {
    taskFlowStore.removeEdge(edgeId);
  } else {
  }
};

// Após cada render do VueFlow, log DOM nodes/edges
watch(
  [() => taskFlowStore.edges, () => taskFlowStore.nodes],
  async () => {
    await nextTick();
    const domNodes = document.querySelectorAll(".vue-flow__node");
    const domEdges = document.querySelectorAll(".vue-flow__edge");
  },
  { deep: true }
);

// Watcher para mudanças explícitas em edges para debug
watch(
  () => taskFlowStore.edges,
  (edges) => {
    edges.forEach((e, i) => {});
    // Também loga nodes para ver se os source/target batem:
    taskFlowStore.nodes.forEach((n, idx) => {});

    setTimeout(() => {
      const domEdges = document.querySelectorAll(".vue-flow__edge");
    }, 150);
  },
  { deep: true }
);

// --- Handler for nodes-initialized event ---
const onNodesInitializedHandler = async () => {
  // 1. Força o Vue Flow a reler as dimensões e posições de todos os nós e seus handles do DOM.
  updateNodeInternals();

  // 2. Aguarda o próximo "tick" do DOM para garantir que as atualizações internas do Vue Flow sejam processadas.
  await nextTick();

  // 3. Agora, com as dimensões corretas, ajusta a visão.
  if (vueFlowRef.value) {
    try {
      vueFlowRef.value.fitView({ padding: 0.25, duration: 200 });
    } catch (e) {
      console.warn("[TaskFlow.vue] fitView em onNodesInitialized falhou:", e);
    }
  }

  // Sinaliza que o fluxo está pronto para o E2E test, se necessário
  if (process.client) {
    window.$vueFlowReady = true;
  }
};
</script>

<style scoped>
.vue-flow-wrapper {
  width: 100%;
  height: 100%;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
}

:deep(.vue-flow__node) {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: grab;
}

:deep(.vue-flow__node.dragging) {
  cursor: grabbing;
  z-index: 1000;
  transform: scale(1.02);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

:deep(.vue-flow) {
  background-color: #1d1d1f;
}
</style>

<style scoped>
.vue-flow-wrapper {
  width: 100%;
  height: 100%;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
}

:deep(.vue-flow__node) {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: grab;
}

:deep(.vue-flow__node.dragging) {
  cursor: grabbing;
  z-index: 1000;
  transform: scale(1.02);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

:deep(.vue-flow) {
  background-color: #1d1d1f;
}
</style>
