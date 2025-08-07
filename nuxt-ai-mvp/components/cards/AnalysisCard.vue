<template>
  <BaseNodeCard
    :node-id="props.id"
    raw-node-type="analysis"
    node-type-label="Análise de IA"
    :selected="props.selected"
    :is-loading="isAnalyzing"
    empty-state-width-class="w-[300px]"
    content-width-class="w-[300px]"
    :has-content="hasContent"
    center-content-when-empty
    :show-contextual-add-button="false"
    :toolbar-can-edit="false"
    :toolbar-can-delete="true"
    :toolbar-can-refresh="hasPotentiallyProcessableInput"
    :toolbar-is-refresh-disabled="isAnalyzing"
    @toolbar-delete-node="deleteNode"
    @toolbar-refresh-node="triggerAnalysis"
  >
    <template #icon>
      <AnalysisIcon class="w-10 h-10" />
    </template>

    <template #default>
      <div v-if="hasContent && !isAnalyzing" class="text-center p-4">
        <h3 class="font-semibold text-lg text-white mb-2">Análise Concluída</h3>
        <p class="text-sm text-gray-300 mb-4">
          Os dados foram extraídos e categorizados.
        </p>
        <button class="btn btn-primary" @click="openAnalysisModal">
          Explorar Dados Analisados
        </button>
      </div>

      <AiAnalysisPlaceholder
        v-else
        class="h-full"
        :is-analyzing="isAnalyzing"
        :error-message="displayError || undefined"
        :show-connect-message="!hasPotentiallyProcessableInput"
        connect-message="Para iniciar, conecte este card a um Survey ou Fonte de Dados."
        :show-analyze-button="canManuallyAnalyze"
        ready-message="Dados conectados. Pronto para iniciar a extração e análise."
        analyze-button-text="Analisar com IA"
        @analyze-clicked="triggerAnalysis"
      />
    </template>
  </BaseNodeCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAnalyticalNodeLogic } from "~/composables/taskflow/useAnalyticalNodeLogic";
import { useModalStore, ModalType } from "~/stores/modal";
import BaseNodeCard from "./BaseNodeCard.vue";
import AnalysisIcon from "../icon/AnalysisIcon.vue";
import AiAnalysisPlaceholder from "./content/AiAnalysisPlaceholder.vue";

const props = defineProps<{
  id: string;
  data: any;
  selected: boolean;
}>();

const {
  isAnalyzing,
  displayError,
  hasPotentiallyProcessableInput,
  canManuallyAnalyze,
  triggerAnalysis,
  deleteNode,
} = useAnalyticalNodeLogic(props);

const modalStore = useModalStore();

const hasContent = computed(() => {
  const ad = props.data?.analyzedData;
  // A análise tem conteúdo se 'analyzedData' existir e tiver a propriedade 'insights' com pelo menos um item.
  return (
    ad &&
    Array.isArray(ad.insights) &&
    ad.insights.length > 0 &&
    !displayError.value
  );
});

const openAnalysisModal = () => {
  // Using 'problem' modal type as a temporary solution
  modalStore.openModal("problem" as any, {
    type: "analysis",
    data: props.data,
    nodeId: props.id,
  });
};
</script>
