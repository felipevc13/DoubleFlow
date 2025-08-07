<template>
  <div class="survey-card" ref="cardContainerRef">
    <BaseNodeCard
      :node-id="props.id"
      raw-node-type="survey"
      node-type-label="Survey"
      :content-title="contentTitle"
      :selected="props.selected"
      :is-loading="effectiveIsLoading"
      empty-state-width-class="w-[300px]"
      content-width-class="w-[350px]"
      min-card-height="110px"
      :has-content="hasQuestions"
      :center-content-when-empty="true"
      :show-contextual-add-button="true"
      :toolbar-can-edit="true"
      :toolbar-can-delete="true"
      :node-deletable="true"
      :toolbar-can-refresh="canRefreshToolbar"
      :toolbar-is-refresh-disabled="internalLoading"
      :toolbar-can-lock="true"
      :show-default-target-handle="true"
      :edge-connection-loading="props.data?.isLoadingEdgeConnection"
      @toolbar-edit-node="requestNodeEdit"
      @toolbar-delete-node="requestNodeDeletion"
      @toolbar-refresh-node="forceRefreshAnalysis"
      :key="props.id"
    >
      <template #icon>
        <SurveyIcon class="w-10 h-10 text-[#9A9A9C]" />
      </template>

      <template #header-actions>
        <div
          v-if="showStatusPill"
          class="px-2 py-0.5 text-xs rounded-full font-medium z-10"
          :class="statusPillClass"
        >
          {{ statusText }}
        </div>
      </template>

      <template #default>
        <!-- MODIFICADO: Removido o div extra com h-full -->
        <EmptyCardAction
          v-if="!hasQuestions && !effectiveIsLoading"
          label="Configurar Survey"
          :icon="PencilSquareIcon"
          action-class="primary"
          @action="requestNodeEdit"
        />
        <div
          v-else-if="hasQuestions && !effectiveIsLoading"
          class="text-sm text-gray-300 space-y-3 w-full"
        >
          <div class="flex space-x-3 mb-1">
            <!-- Bloco Perguntas -->
            <div
              class="flex-1 bg-[#3A393F] p-3 rounded-lg border border-[#47464B] text-center"
            >
              <div
                class="flex items-center justify-center text-xs text-gray-400 mb-1"
              >
                <QuestionMarkCircleIcon class="w-4 h-4 mr-1.5" />
                <span>Perguntas</span>
              </div>
              <div class="text-2xl font-bold text-white">
                {{ questionBlocks.length }}
              </div>
            </div>
            <!-- Bloco Respostas -->
            <div
              class="flex-1 bg-[#3A393F] p-3 rounded-lg border border-[#47464B] text-center"
            >
              <div
                class="flex items-center justify-center text-xs text-gray-400 mb-1"
              >
                <ChatBubbleLeftRightIcon class="w-4 h-4 mr-1.5" />
                <span>Respostas</span>
              </div>
              <div class="text-2xl font-bold text-white">
                {{ props.data?.responseCount || 0 }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- MODIFICADO: Slot #footer agora usa ShareableLinkFooter -->
      <template
        v-if="
          hasQuestions && props.data?.is_active === true && props.data?.surveyId
        "
        #footer
      >
        <ShareableLinkFooter
          :id="props.id"
          :link="shareableLink"
          label="Link de Compartilhamento:"
          button-text="Copiar"
        />
      </template>
    </BaseNodeCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from "vue";
import BaseNodeCard from "./BaseNodeCard.vue";
import SurveyIcon from "../icon/SurveyIcon.vue";
import EmptyCardAction from "./content/EmptyCardAction.vue";
import ShareableLinkFooter from "./content/ShareableLinkFooter.vue";
import {
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/vue/24/outline";
import { useModalStore, ModalType } from "~/stores/modal";
import { useTaskFlowStore } from "~/stores/taskFlow";

// Definindo a interface para a prop `data` de forma mais explícita
interface SurveyNodeData {
  title?: string;
  description?: string;
  surveyId?: string;
  surveyStructure?: Array<{ type: string; [key: string]: any }>;
  is_active?: boolean;
  responseCount?: number;
  wasActivated?: boolean;
  [key: string]: any;
}

const props = defineProps({
  id: { type: String, required: true },
  data: {
    type: Object as () => SurveyNodeData,
    default: () => ({
      surveyStructure: [],
      responseCount: 0,
      is_active: false, // Default para boolean, importante para consistência
    }),
  },
  selected: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
});

const modalStore = useModalStore();
const taskFlowStore = useTaskFlowStore();

const cardContainerRef = ref<HTMLElement | null>(null);
const internalLoading = ref(false);

const effectiveIsLoading = computed(
  () => props.isLoading || internalLoading.value
);

const questionBlocks = computed(() => {
  const allBlocks = props.data?.surveyStructure;
  if (!Array.isArray(allBlocks)) return [];
  const validQuestionTypes = [
    "opinionScale",
    "rating",
    "multipleChoice",
    "openText",
    "satisfactionScale",
  ];
  return allBlocks.filter(
    (block) => block && validQuestionTypes.includes(block.type)
  );
});

const hasQuestions = computed(() => questionBlocks.value.length > 0);

const contentTitle = computed(() => ""); // SurveyCard não usa contentTitle atualmente

const statusText = computed(() => {
  if (props.data?.is_active === true) return "Ativo";
  if (props.data?.is_active === false) return "Inativo";
  return "Verificando...";
});

const statusPillClass = computed(() => {
  if (props.data?.is_active === true) return "bg-green-600 text-green-100";
  if (props.data?.is_active === false) return "bg-gray-600 text-gray-200";
  return "bg-yellow-600 text-yellow-100";
});

// Badge só deve aparecer se o Survey foi explicitamente ativado/desativado via modal
const showStatusPill = computed(() => props.data?.wasActivated === true);

const canRefreshToolbar = computed(() => {
  return (
    props.data?.is_active === true &&
    !!props.data?.surveyId &&
    !internalLoading.value
  );
});

const shareableLink = computed(() => {
  if (!props.data?.surveyId) return "Link indisponível";
  if (typeof window !== "undefined") {
    return `${window.location.origin}/preview/${props.data.surveyId}`;
  }
  return `/preview/${props.data.surveyId}`;
});

const requestNodeEdit = async () => {
  if (internalLoading.value) return; // Previna execuções simultâneas
  internalLoading.value = true;
  let dataForModal = { ...props.data };
  const nodeId = props.id;

  try {
    // 1. Survey completamente novo (sem surveyId)
    if (!dataForModal.surveyId) {
      await taskFlowStore.updateNodeData(nodeId, {
        _action: "initializeSurvey",
        _payload: { context: { task_id: taskFlowStore.currentTaskId } },
        ...dataForModal,
      });
      await nextTick();
      const nodeFromStore = taskFlowStore.nodes.find((n) => n.id === nodeId);
      dataForModal = nodeFromStore?.data || dataForModal;

      if (!dataForModal.surveyId) {
        throw new Error("Falha ao obter ID do survey após a inicialização.");
      }
    }

    // 2. Survey já existe mas não tem estrutura (ou estrutura está vazia)
    if (
      !dataForModal.surveyStructure ||
      dataForModal.surveyStructure.length === 0
    ) {
      await taskFlowStore.updateNodeData(nodeId, {
        _action: "fetchSurveyStructure",
        _payload: {},
        ...dataForModal,
      });
      await nextTick();
      const nodeFromStore = taskFlowStore.nodes.find((n) => n.id === nodeId);
      dataForModal = nodeFromStore?.data || dataForModal;
    }

    // 3. Atualizar is_active e responseCount somente quando o usuário solicitar
    if (dataForModal.surveyId) {
      // Em vez de reprocessar genérico, peça explicitamente o status
      await taskFlowStore.updateNodeData(nodeId, {
        _action: "fetchSurveyStatus",
        _payload: {},
        ...dataForModal,
        wasActivated: true,
      });
      await nextTick();
      const nodeFromStore = taskFlowStore.nodes.find((n) => n.id === nodeId);
      dataForModal = nodeFromStore?.data || dataForModal;
    }

    // Checagem final antes de abrir o modal
    if (!dataForModal.surveyId) {
      console.error(
        "Não foi possível carregar os dados da pesquisa. ID ausente."
      );
      internalLoading.value = false;
      return;
    }

    // Agora garantimos surveyId e surveyStructure disponíveis para o modal
    modalStore.openModal(ModalType.survey, dataForModal, nodeId);
  } catch (error: any) {
    console.error(
      `[SurveyCard] Erro ao preparar editor de survey ${nodeId}:`,
      error
    );
    console.error(error.message || "Erro ao abrir editor da pesquisa.");
  } finally {
    internalLoading.value = false;
  }
};

const requestNodeDeletion = () => {
  taskFlowStore.removeNode(props.id);
};

const forceRefreshAnalysis = () => {
  internalLoading.value = true;
  taskFlowStore
    .updateNodeData(props.id, {
      _action: "fetchSurveyStatus",
      _payload: {},
      ...props.data,
      wasActivated: true,
    })
    .catch((error) => {
      console.error(
        `[SurveyCard] Erro ao atualizar status do survey ${props.id}:`,
        error
      );
      // TODO: feedback ao usuário (toast, etc.)
    })
    .finally(() => {
      internalLoading.value = false;
    });
};
</script>

<style scoped>
/* Estilos específicos para SurveyCard, se necessário. */
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
</style>
