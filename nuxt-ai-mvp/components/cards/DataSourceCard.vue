<template>
  <div class="datasource-card" ref="cardContainerRef">
    <BaseNodeCard
      :node-id="props.id"
      raw-node-type="dataSource"
      node-type-label="Fonte de dados"
      :content-title="displayData.title"
      :selected="props.selected"
      :is-loading="props.isLoading"
      min-card-height="110px"
      empty-state-width-class="w-[300px]"
      content-width-class="w-[300px]"
      :has-content="hasData"
      :center-content-when-empty="true"
      :show-contextual-add-button="true"
      :toolbar-can-edit="true"
      :toolbar-can-delete="true"
      :toolbar-can-lock="true"
      :node-deletable="true"
      :show-default-target-handle="true"
      :edge-connection-loading="props.data?.isLoadingEdgeConnection"
      @toolbar-edit-node="handleToolbarEdit"
      @toolbar-delete-node="handleToolbarDelete"
      :key="props.id"
    >
      <template #icon>
        <DataIcon class="w-10 h-10 text-[#9A9A9C]" />
      </template>

      <template #default>
        <!-- Estado Vazio: Usando EmptyCardAction -->
        <EmptyCardAction
          v-if="!hasData && !props.isLoading"
          label="Adicionar dados ao projeto"
          :icon="PlusCircleIcon"
          action-class="primary"
          @action="requestNodeEdit"
        />

        <!-- Estado com Dados: Lista de fontes -->
        <div v-else-if="hasData && !props.isLoading" class="w-full">
          <p class="text-xs text-[#9A9A9C] mb-2">
            {{ props.data.sources.length }}
            {{
              props.data.sources.length === 1
                ? "dado adicionado"
                : "dados adicionados"
            }}
          </p>
          <ul
            class="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar-datasources pr-1"
          >
            <li
              v-for="item in dataSources"
              :key="item.id"
              class="flex items-center justify-between text-xs hover:bg-white/5 rounded p-1"
            >
              <template v-if="item">
                <div class="flex items-center gap-1.5 min-w-0">
                  <Markdown
                    v-if="item.type === 'markdown'"
                    class="h-4 w-4 text-gray-400 flex-shrink-0"
                  />
                  <Excel
                    v-else-if="item.type === 'excel'"
                    class="h-4 w-4 text-gray-400 flex-shrink-0"
                  />
                  <WordIcon
                    v-else-if="item.type === 'word'"
                    class="h-4 w-4 text-gray-400 flex-shrink-0"
                  />
                  <TextFile
                    v-else-if="item.type === 'text'"
                    class="h-4 w-4 text-gray-400 flex-shrink-0"
                  />
                  <Json
                    v-else-if="item.type === 'note'"
                    class="h-4 w-4 text-gray-400 flex-shrink-0"
                  />
                  <DocumentTextIcon
                    v-else
                    class="h-4 w-4 text-gray-400 flex-shrink-0"
                  />
                  <span
                    class="text-gray-300 truncate"
                    :title="item.name || item.id"
                    >{{ getDisplaySourceName(item) }}</span
                  >
                </div>
              </template>
            </li>
          </ul>
        </div>
      </template>
    </BaseNodeCard>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { onMounted, watch } from "vue";
import BaseNodeCard from "./BaseNodeCard.vue";
import DataIcon from "../icon/DataIcon.vue";
import EmptyCardAction from "./content/EmptyCardAction.vue"; // Importa o novo componente
import Markdown from "../icon/Markdown.vue";
import Excel from "../icon/Excel.vue";
import WordIcon from "../icon/WordIcon.vue";
import TextFile from "../icon/TextFile.vue";
import Json from "../icon/Json.vue";
import { DocumentTextIcon, PlusCircleIcon } from "@heroicons/vue/24/outline";
import { useModalStore } from "~/stores/modal";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { ModalType } from "~/stores/modal";

const props = defineProps({
  id: { type: String, required: true },
  data: {
    type: Object,
    default: () => ({ sources: [], title: "Dados do projeto" }),
  },
  selected: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
});

onMounted(() => {});

const modalStore = useModalStore();
const taskFlowStore = useTaskFlowStore();

const cardContainerRef = ref(null);

const hasData = computed(
  () => props.data?.sources && props.data.sources.length > 0
);
const dataSources = computed(() => props.data?.sources || []);

const displayData = computed(() => {
  const sourceCount = props.data?.sources?.length || 0;
  return {
    title: props.data?.title || "Dados do projeto",
    sourceCount: sourceCount,
  };
});

const getDisplaySourceName = (source) => {
  if (!source) return "";
  if (source.name && source.name.trim() !== "") {
    return source.name.trim();
  }
  // Fallback para título ou id, se não houver name
  if (source.title && source.title.trim() !== "") {
    return source.title.trim();
  }
  return source.id || "unknown_source";
};

const requestNodeEdit = () => {
  const sources = props.data?.sources || [];
  let modalDataPayload = { ...props.data };
  // Se não houver fontes, envie a instrução inicial para o modal abrir o AddSourceModal
  if (sources.length === 0) {
    modalDataPayload.initialAction = "addSource";
  }
  modalStore.openModal(ModalType.dataSource, modalDataPayload, props.id);
};

const requestNodeDeletion = () => {
  taskFlowStore.removeNode(props.id);
};

const handleToolbarEdit = (nodeId) => {
  if (nodeId === props.id) {
    requestNodeEdit();
  }
};

const handleToolbarDelete = (nodeId) => {
  if (nodeId === props.id) {
    requestNodeDeletion();
  }
};
</script>

<style scoped>
.datasource-card {
  position: relative;
}

.custom-scrollbar-datasources::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar-datasources::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}
.custom-scrollbar-datasources::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 2px;
}
.custom-scrollbar-datasources::-webkit-scrollbar-thumb:hover {
  background-color: #718096;
}
.custom-scrollbar-datasources {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 rgba(255, 255, 255, 0.05);
}

/* O estilo de foco visível para o EmptyCardAction é definido dentro do próprio componente EmptyCardAction.vue */
</style>
