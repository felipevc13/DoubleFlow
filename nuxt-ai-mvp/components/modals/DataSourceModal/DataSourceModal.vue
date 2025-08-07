<template>
  <BaseModal
    :is-open="isOpen"
    size="lg"
    :hide-default-header="true"
    :hide-default-footer="true"
    @close="closeModal"
    content-wrapper-class="flex flex-col h-full"
  >
    <template #header>
      <div class="flex items-center justify-between px-6 py-4">
        <div v-if="diffMode" class="flex items-center gap-2">
          <DataIcon />
          <span class="text-base font-semibold text-white">
            {{ modalTitle || "Atualização sugerida" }}
          </span>
        </div>
        <div v-else class="flex items-center gap-10">
          <div class="flex items-center gap-2">
            <DataIcon></DataIcon>
            <span class="text-base font-semibold text-white"
              >Fonte de dados</span
            >
          </div>
          <div class="flex items-center rounded">
            <button
              @click="activeTab = 'sources'"
              :class="{
                'text-[#E7E9EA] font-bold': activeTab === 'sources',
                'text-[#71767B] hover:text-[#E7E9EA]': activeTab !== 'sources',
              }"
              class="relative px-4 py-2 text-sm bg-transparent focus:outline-none"
            >
              Fontes de dados
              <span
                v-if="activeTab === 'sources'"
                class="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#4D6BFE] rounded-full"
              ></span>
            </button>
            <button
              @click="activeTab = 'output'"
              :class="{
                'text-[#E7E9EA] font-bold': activeTab === 'output',
                'text-[#71767B] hover:text-[#E7E9EA]': activeTab !== 'output',
              }"
              class="relative px-4 py-2 text-sm font-medium bg-transparent focus:outline-none"
            >
              Input/Output
              <span
                v-if="activeTab === 'output'"
                class="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#4D6BFE] rounded-full"
              ></span>
            </button>
          </div>
        </div>
        <button
          @click="closeModal"
          class="text-[#F8FAFC] hover:text-gray-400"
          data-testid="close-modal-button"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </template>
    <div
      v-if="diffMode"
      class="flex flex-col flex-1 h-full min-h-0 p-8 bg-[#171717]"
    >
      <!-- Diff UI aqui -->
      <div class="flex-1 mb-8">
        <!-- Diff UI aqui -->
        <div class="text-[#E7E9EA] text-center text-lg py-10">
          <span class="opacity-70">[Diff UI aqui]</span>
        </div>
      </div>
      <div class="flex justify-end gap-4">
        <button
          class="px-4 py-2 rounded bg-[#23272F] text-[#E7E9EA] hover:bg-[#2d323b]"
          @click="closeModal"
        >
          Cancelar
        </button>
        <button
          class="px-4 py-2 rounded bg-[#4D6BFE] text-white font-semibold hover:bg-[#3251e4]"
          @click="onConfirm"
        >
          Confirmar atualização
        </button>
      </div>
    </div>
    <div v-else class="flex flex-1 h-full min-h-0 overflow-hidden">
      <div
        v-if="activeTab === 'sources'"
        class="w-full py-6 px-6 flex flex-col flex-1 h-full min-h-0 bg-[#171717]"
      >
        <div class="flex-1 min-h-0 h-full">
          <DataSourceList
            class="flex-1 min-h-0"
            :data-sources="dataSources"
            @request-actions="handleRequestActions"
            @open-add-source-modal="isAddSourceModalOpen = true"
          />
        </div>
      </div>
      <div
        v-if="activeTab === 'output'"
        class="w-full flex flex-col h-full min-h-0 p-6 bg-[#171717] overflow-hidden"
      >
        <div v-if="contextError" class="p-4 text-red-500">
          {{ contextError }}
        </div>
        <NodeIOViewer
          v-else
          :input-data="viewerInputData"
          :output-data="viewerOutputData"
          :cumulative-context="currentNode?.data?.cumulativeContext"
          :is-loading-input="isLoadingContext"
          :is-loading-output="isLoadingContext"
          class="flex-1 min-h-0 overflow-auto"
        />
      </div>
    </div>
  </BaseModal>
  <DataSourceActionModal
    :is-open="isActionModalOpen"
    :source-data="selectedSourceForAction"
    @close="isActionModalOpen = false"
    @confirm-delete="handleConfirmDeleteAction"
  />
  <AddSourceModal
    :is-open="isAddSourceModalOpen"
    :is-loading="isUploading"
    @close="isAddSourceModalOpen = false"
    @sources-prepared="handleSourcesPrepared"
  />
</template>

<script setup>
const props = defineProps({
  isOpen: { type: Boolean, required: true },
  nodeData: {
    type: Object,
    default: () => ({ sources: [], note: "", noteTitle: "" }),
  },
  diffMode: { type: Boolean, default: false },
  originalData: { type: Object, default: () => ({}) },
  proposedData: { type: Object, default: () => ({}) },
  diffFields: { type: Array, default: () => [] },
  modalTitle: { type: String, default: "" },
  actionToConfirm: { type: Object, default: null },
  // Temporary prop for testing nodeId propagation
  testNodeId: { type: String, default: null },
});

console.log("[DataSourceModal] INICIAL: props.isOpen", props.isOpen);

import { ref, watch, computed, onMounted, nextTick } from "vue";
import { useSupabaseClient } from "#imports";
import DataSourceList from "./content/DataSourceList.vue";
import DataIcon from "../../icon/DataIcon.vue";
import { v4 as uuidv4 } from "uuid";
import { useModalStore } from "~/stores/modal";
import DataSourceActionModal from "./DataSourceActionModal.vue";
import NodeIOViewer from "./content/NodeIOViewer.vue";
import { useNodeContext } from "~/composables/useNodeContext";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { dataSourceNodeHandler } from "~/lib/nodeHandlers/dataSourceNodeHandler";
import BaseModal from "~/components/modals/BaseModal.vue";
import AddSourceModal from "./content/AddSourceModal.vue";
import mammoth from "mammoth";

const isUploading = ref(false);

const emit = defineEmits(["close", "update:nodeData", "confirm"]);

// --- Store ---
const modalStore = useModalStore();
const taskFlowStore = useTaskFlowStore(); // Instanciar TaskFlowStore
const { getNodeInputContext, getCurrentInputContextSync } = useNodeContext(); // Obter ambas as funções
// Obter supabase usando useNuxtApp
const supabase = useSupabaseClient();

// --- State ---
const activeTab = ref("sources");
const isActionModalOpen = ref(false); // Estado para modal de ações
const selectedSourceForAction = ref(null); // Fonte selecionada para ações
const isAddSourceModalOpen = ref(false); // Estado para o novo modal de adicionar fonte
const saveTriggered = ref(false); // Track if an explicit save occurred

// State para o contexto de input do viewer
const computedInputContext = ref(null); // Receberá o resultado do composable
const isLoadingContext = ref(false);
const contextError = ref(null);

// Compute data sources from props for the list view
const dataSources = computed(() => props.nodeData?.sources || []);

const currentNodeId = computed(() => modalStore.getActiveNodeId); // Get nodeId from store

// Obter o nó atual completo da store
const currentNode = computed(() => {
  if (!currentNodeId.value) return null;
  return taskFlowStore.nodes.find((n) => n.id === currentNodeId.value);
});

// Copiando helpers para uso local no cálculo do output
const removeFileExtension = (filename) => {
  if (!filename || typeof filename !== "string") return filename;
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === 0) return filename; // Sem extensão ou começa com ponto
  return filename.substring(0, lastDotIndex);
};

const groupSourcesByCategory = (sources) => {
  // Implemente a lógica para agrupar fontes por categoria
  // Esta é uma implementação básica e pode ser ajustada conforme necessário
  return sources.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {});
};

// Computar dados para a seção INPUT do viewer
const viewerInputData = computed(() => {
  // Access the current node object directly from the store
  const node = currentNode.value; // currentNode is already computed
  if (!node || !node.data) {
    return {}; // Return empty if node or data is missing
  }
  // Return the inputData stored on the node, which should be the merged data

  return node.data.inputData || {};
});

// Computar dados para a seção OUTPUT do viewer
const viewerOutputData = computed(() => {
  // Access the current node object directly from the store
  const node = currentNode.value; // currentNode is already computed
  if (!node || !node.data) {
    return {}; // Return empty if node or data is missing
  }
  // Return the outputData stored on the node, which was calculated by the store

  return node.data.outputData || {};
});

// --- Methods ---
const closeModal = () => {
  isActionModalOpen.value = false;
  emit("close");
};

const onConfirm = () => {
  if (props.diffMode) {
    emit("confirm", props.actionToConfirm);
  }
};

// Função auxiliar para emitir o update das sources E recalcular o outputData usando o handler
const emitCompleteUpdate = (updatedSources) => {
  const nodeId = props.testNodeId || currentNodeId.value; // Prioritize testNodeId if present
  if (!nodeId) {
    console.error("[Modal - emitCompleteUpdate] Node ID missing!");
    return;
  }

  // Gere o outputData usando o handler, garantindo que as sources estejam presentes
  const nodeFake = {
    data: { sources: updatedSources },
  };
  const outputData = dataSourceNodeHandler.generateOutput(nodeFake);

  // Emitir as sources e o novo outputData
  const payloadToEmit = {
    nodeId: nodeId,
    updatedData: {
      sources: updatedSources,
      outputData, // inclui outputData atualizado
    },
  };

  emit("update:nodeData", payloadToEmit);
  saveTriggered.value = true; // Mark that an update was triggered
};

// Método chamado pelo DataSourceList para ABRIR o modal de ações
const handleRequestActions = (source) => {
  selectedSourceForAction.value = source; // Define qual fonte será alvo das ações
  isActionModalOpen.value = true; // Abre o modal de ações
};

// Método chamado pelo DataSourceActionModal para CONFIRMAR a deleção
const handleConfirmDeleteAction = (sourceIdToDelete) => {
  const nodeId = currentNodeId.value;
  if (!nodeId) {
    console.error("Node ID missing in handleConfirmDeleteAction");
    return;
  }

  const currentSources = props.nodeData?.sources || [];
  const updatedSources = currentSources.filter(
    (s) => s.id !== sourceIdToDelete
  );
  emitCompleteUpdate(updatedSources);
  // saveTriggered is set inside emitCompleteUpdate
  // Removido: isActionModalOpen.value = false;
};

// --- Watchers ---

// Watch for modal opening to set initial state
watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      activeTab.value = "sources"; // Sempre abrir na aba de fontes
      isActionModalOpen.value = false; // Quando o modal principal abre, reseta o estado do modal de ações
      selectedSourceForAction.value = null; // Quando o modal principal abre, reseta o estado do modal de ações
      // Reset KB data on open?

      saveTriggered.value = false; // Reset save trigger when modal opens
      handleNewNote(); // Chama a função que já limpa editTitle/editContent
    } else {
      // Reset when closing
      editTitle.value = ""; // Clear title
      editContent.value = null;
    }
  }
);

// Watch para buscar contexto quando a aba Output for selecionada
watch(activeTab, async (newTab) => {
  if (newTab === "output" && currentNodeId.value) {
    isLoadingContext.value = true;
    contextError.value = null;
    computedInputContext.value = null; // Resetar para garantir reatividade
    try {
      const context = await getNodeInputContext(currentNodeId.value);
      if (context.error) {
        throw new Error(context.error);
      }
      computedInputContext.value = context;
    } catch (error) {
      console.error("Error fetching node input context:", error);
      contextError.value = "Falha ao carregar contexto de entrada.";
      computedInputContext.value = { error: contextError.value }; // Sinalizar erro
    } finally {
      isLoadingContext.value = false;
    }
  }
});

// Watcher para abrir o AddSourceModal automaticamente ao abrir o modal principal com initialAction = 'addSource'
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && props.nodeData?.initialAction === "addSource") {
      nextTick(() => {
        isAddSourceModalOpen.value = true;
      });
    }
  }
);

// --- Adição de fontes via modal AddSourceModal ---
const handleSourcesPrepared = ({ sources }) => {
  const currentSources = props.nodeData?.sources || [];
  emitCompleteUpdate([...currentSources, ...sources]);
  isAddSourceModalOpen.value = false;
};
</script>

<style scoped>
/* Adicionar estilos específicos do modal se necessário */
</style>
