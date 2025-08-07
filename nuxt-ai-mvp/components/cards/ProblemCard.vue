<!-- components/cards/ProblemCard.vue -->
<template>
  <div class="problem-card" ref="cardContainerRef">
    <BaseNodeCard
      :node-id="props.id"
      raw-node-type="problem"
      node-type-label="Problema Inicial"
      :content-title="displayTitle"
      :selected="props.selected"
      :is-loading="props.isLoading"
      empty-state-width-class="w-[300px]"
      content-width-class="w-[300px]"
      min-card-height="110px"
      :has-content="hasContent"
      :center-content-when-empty="true"
      :show-contextual-add-button="true"
      :toolbar-can-delete="false"
      :node-deletable="false"
      :toolbar-can-lock="true"
      :toolbar-can-edit="true"
      :show-default-target-handle="false"
      :edge-connection-loading="props.data?.isLoadingEdgeConnection"
      @toolbar-edit-node="handleToolbarEdit"
      :key="props.id"
    >
      <template #icon>
        <ProblemIcon class="w-10 h-10 text-[#9A9A9C]" />
      </template>

      <template #default>
        <EmptyCardAction
          v-if="!hasContent && !props.isLoading"
          :label="
            props.data?.title || props.data?.description
              ? 'Editar Problema'
              : 'Definir Problema Inicial'
          "
          :icon="PencilSquareIcon"
          action-class="primary"
          @action="requestProblemEdit"
        />
        <div
          v-else-if="props.data?.description"
          class="text-xs text-gray-300 mt-1 whitespace-pre-line break-words"
        >
          {{ props.data.description }}
        </div>
        <EmptyCardAction
          v-else-if="
            props.data?.title && !props.data?.description && !props.isLoading
          "
          label="Adicionar descrição do problema"
          :icon="PencilSquareIcon"
          action-class="secondary"
          @action="requestProblemEdit"
        />
      </template>
    </BaseNodeCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import BaseNodeCard from "./BaseNodeCard.vue";
import ProblemIcon from "../icon/ProblemIcon.vue";
import EmptyCardAction from "./content/EmptyCardAction.vue"; // Importa o novo componente
import { PencilSquareIcon } from "@heroicons/vue/24/outline";
import { useModalStore, ModalType } from "~/stores/modal";
import { useVueFlow } from "@vue-flow/core";

const props = defineProps({
  data: {
    type: Object as () => {
      title?: string;
      description?: string;
      [key: string]: any;
    },
    default: () => ({
      title: "",
      description: "",
    }),
  },
  selected: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    required: true,
  },
});

const modalStore = useModalStore();
const { findNode } = useVueFlow();

const hasContent = computed(() => {
  return !!(props.data?.title?.trim() || props.data?.description?.trim());
});

// Exibe o título apenas quando há descrição preenchida.
const displayTitle = computed(() => {
  return props.data?.description?.trim() ? props.data?.title?.trim() || "" : "";
});

const requestProblemEdit = () => {
  const node = findNode(props.id);
  const nodeDataForModal = {
    title: props.data?.title || "",
    description: props.data?.description || "",
    ...props.data,
  };

  if (node) {
    modalStore.openModal(ModalType.problem, nodeDataForModal, props.id);
  } else {
    console.error(
      `[ProblemCard ${props.id}] Nó não encontrado para abrir o modal de edição.`
    );
    modalStore.openModal(ModalType.problem, nodeDataForModal, props.id);
  }
};

const handleToolbarEdit = (nodeId: string) => {
  if (nodeId === props.id) {
    requestProblemEdit();
  }
};

defineExpose({
  requestProblemEdit,
});

const cardContainerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  // Lógica de montagem, se houver
});

onUnmounted(() => {
  // Lógica de desmontagem, se houver
});
</script>

<style scoped>
.problem-card {
  position: relative;
}
/* Estilo de foco visível para o EmptyCardAction é definido dentro dele próprio */
</style>
