<template>
  <BaseModal
    :is-open="isOpen"
    size="viewport-fill"
    :is-loading="isModalLoading"
    hide-default-header
    hide-default-footer
    @close="closeModal"
    content-wrapper-class="flex flex-col h-full"
  >
    <template #header>
      <div class="flex items-center justify-between px-6 py-4">
        <!-- Grupo Esquerda: Título + Abas -->
        <div class="flex items-center gap-10">
          <!-- Título Fixo -->
          <div class="flex items-center gap-2">
            <SurveyIcon></SurveyIcon>
            <span class="text-base font-semibold text-white">Survey</span>
          </div>
          <!-- Abas (Tabs) -->
          <div class="flex items-center rounded">
            <button
              @click="activeTab = 'create'"
              :class="{
                'text-[#E7E9EA] font-bold': activeTab === 'create',
                'text-[#71767B] hover:text-[#E7E9EA]': activeTab !== 'create',
              }"
              class="relative px-4 py-2 text-sm bg-transparent focus:outline-none"
            >
              Criar
              <span
                v-if="activeTab === 'create'"
                class="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#4D6BFE] rounded-full"
              ></span>
            </button>
            <button
              v-if="hasQuestions"
              @click="activeTab = 'share'"
              :class="{
                'text-[#E7E9EA] font-bold': activeTab === 'share',
                'text-[#71767B] hover:text-[#E7E9EA]': activeTab !== 'share',
              }"
              class="relative px-4 py-2 text-sm font-medium bg-transparent focus:outline-none"
            >
              Compartilhar
              <span
                v-if="activeTab === 'share'"
                class="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#4D6BFE] rounded-full"
              ></span>
            </button>
            <button
              v-if="hasQuestions"
              @click="activeTab = 'results'"
              :class="{
                'text-[#E7E9EA] font-bold': activeTab === 'results',
                'text-[#71767B] hover:text-[#E7E9EA]': activeTab !== 'results',
              }"
              class="relative px-4 py-2 text-sm font-medium bg-transparent focus:outline-none"
            >
              Resultados
              <span
                v-if="activeTab === 'results'"
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
        <!-- Botão Preview (só na aba criar) + Fechar -->
        <div class="flex items-center gap-8">
          <button
            v-if="activeTab === 'create' && hasQuestions"
            @click="openPreview"
            class="px-3 py-1 border border-white rounded-md text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Preview
          </button>
          <button
            @click="closeModal"
            class="text-[#F8FAFC] hover:text-gray-400"
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
      </div>
    </template>
    <template #default>
      <div
        class="flex-1 p-6 bg-[#171717] overflow-auto flex flex-col h-full min-h-0"
      >
        <!-- Conteúdo Aba 'Criar' -->
        <template v-if="activeTab === 'create'">
          <div class="flex flex-row gap-6 h-full flex-1">
            <div
              :class="[
                hasQuestions ? 'w-2/5' : 'w-full',
                'min-w-0 min-h-0 flex flex-col',
              ]"
            >
              <SurveyBuilder
                :survey-structure="props.nodeData.surveyStructure || []"
                :survey-id="surveyIdForBuilder"
                @update:survey-structure="handleStructureUpdate"
              />
            </div>
            <div
              v-if="hasQuestions"
              class="w-3/5 min-w-0 min-h-0 flex flex-col rounded-lg"
            >
              <Preview
                :blocks="props.nodeData.surveyStructure || []"
                :preview-current-page="previewCurrentPage"
                :preview-total-pages="previewTotalPages"
                @preview-next-page="previewNextPage"
                @preview-prev-page="previewPrevPage"
                :fullscreen="false"
                @jump-to-end="handleJumpToEnd"
              />
              <div
                class="w-full flex flex-row items-center justify-between bg-transparent shadow-md rounded-b-lg px-8 py-4 mt-0 border-t border-[#ececec]"
                style="position: relative; z-index: 2"
              >
                <button
                  @click="previewPrevPage"
                  :disabled="previewCurrentPage === 0"
                  class="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                >
                  Anterior
                </button>
                <span class="text-base font-medium text-white"
                  >Página {{ previewCurrentPage + 1 }} de
                  {{ previewTotalPages }}</span
                >
                <button
                  @click="previewNextPage"
                  :disabled="previewCurrentPage === previewTotalPages - 1"
                  class="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </template>
        <!-- Conteúdo Aba 'Compartilhar' -->
        <template v-if="activeTab === 'share'">
          <div
            v-if="isLoadingSurveyStatus"
            class="flex items-center justify-center min-h-[200px]"
          >
            <span class="text-gray-400">Carregando status...</span>
          </div>
          <div v-else class="p-4 max-w-2xl">
            <h2 class="text-xl font-semibold mb-6 text-white">
              Link de Compartilhamento
            </h2>
            <!-- Status Banner -->
            <div
              :class="[
                'p-4 rounded-md mb-6 text-sm',
                isSurveyActive
                  ? 'bg-blue-100 border border-blue-200 text-blue-800'
                  : 'bg-red-100 border border-red-200 text-red-800',
              ]"
            >
              <p class="font-medium">
                {{
                  isSurveyActive
                    ? "Sua pesquisa está ativa!"
                    : "Sua pesquisa não está ativa!"
                }}
              </p>
              <p>
                {{
                  isSurveyActive
                    ? "Copie e cole o link em e-mails, chats ou navegadores e comece a coletar respostas."
                    : "Ative o link para iniciar a coleta de respostas."
                }}
              </p>
            </div>
            <!-- Link Input and Toggle -->
            <div class="flex items-center gap-4">
              <div class="relative flex-grow">
                <input
                  type="text"
                  :value="shareableLink"
                  readonly
                  class="w-full px-4 py-2 border border-gray-600 rounded-md bg-[#2C2B30] text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-16"
                />
                <button
                  @click="copyLink"
                  class="absolute inset-y-0 right-0 px-4 text-sm font-medium text-blue-500 hover:text-blue-400 focus:outline-none"
                >
                  {{ copyStatus }}
                </button>
              </div>
              <div class="flex items-center gap-2">
                <!-- Usando um toggle simples por enquanto -->
                <button
                  @click="toggleSurveyStatus"
                  :disabled="isModalLoading"
                  :class="[
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                    isSurveyActive ? 'bg-blue-600' : 'bg-gray-500',
                  ]"
                  role="switch"
                  :aria-checked="isSurveyActive.toString()"
                >
                  <span
                    aria-hidden="true"
                    :class="[
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      isSurveyActive ? 'translate-x-5' : 'translate-x-0',
                    ]"
                  ></span>
                </button>
                <span
                  :class="[
                    'text-sm font-medium',
                    isSurveyActive ? 'text-green-400' : 'text-gray-400',
                  ]"
                >
                  {{ isSurveyActive ? "Ativado" : "Desativado" }}
                </span>
              </div>
            </div>
            <p v-if="shareError" class="text-red-500 text-sm mt-2">
              {{ shareError }}
            </p>
          </div>
        </template>
        <!-- Conteúdo Aba 'Resultados' -->
        <template v-if="activeTab === 'results'">
          <Results v-if="surveyIdLocal" :survey-id="surveyIdLocal" />
          <div v-else class="text-gray-400">
            ID da pesquisa não encontrado. Não é possível carregar os
            resultados.
          </div>
        </template>
        <!-- Conteúdo Aba 'Input/Output' -->
        <template v-if="activeTab === 'output'">
          <div
            class="w-full h-full flex flex-row gap-4 min-w-0 min-h-0 overflow-hidden"
          >
            <div v-if="contextError" class="p-4 text-red-500">
              {{ contextError }}
            </div>
            <div
              v-else-if="isLoadingIO"
              class="flex flex-col items-center justify-center min-h-[300px]"
            >
              <svg
                class="animate-spin h-10 w-10 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span class="mt-4 text-white">Carregando dados do survey...</span>
            </div>
            <NodeIOViewer
              v-else
              :key="outputTabKey"
              :cumulative-context="viewerInputData"
              :output-data="viewerOutputData"
              :is-loading-input="isLoadingContext"
              :is-loading-output="isLoadingContext"
              class="flex-grow min-w-0 overflow-auto overflow-x-auto"
            />
          </div>
        </template>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
// Estado de loading para a aba de resultados
// Estado local para o surveyId
const surveyIdLocal = ref(null);
import SurveyIcon from "../../icon/SurveyIcon.vue";
import BaseModal from "../BaseModal.vue";
import { useModalStore } from "~/stores/modal";
import { useTaskFlowStore } from "~/stores/taskFlow";

// --- Função para buscar survey structure e atualizar o nó (para aba output) ---
async function fetchSurveyStructureAndUpdateNode() {
  const surveyIdVal = surveyId.value;
  if (!surveyIdVal) return;
  try {
    const survey = await $fetch(`/api/surveys/${surveyIdVal}`);
    if (survey?.surveyStructure) {
      await taskFlowStore.updateNodeData(currentNodeId.value, {
        surveyStructure: survey.surveyStructure,
      });
    }
  } catch (e) {
    console.error("[SurveyModal] Falha ao buscar survey structure:", e);
  }
}

// Busca os resultados do survey (outputData) no banco e atualiza o nó
async function fetchSurveyOutputDataAndUpdateNode() {
  const surveyIdVal = surveyId.value;
  if (!surveyIdVal) return;
  try {
    const results = await $fetch(`/api/surveys/${surveyIdVal}/results`);
    if (results && currentNodeId.value) {
      await taskFlowStore.updateNodeData(currentNodeId.value, {
        outputData: results,
      });
    }
  } catch (e) {
    console.error("[SurveyModal] Falha ao buscar outputData do survey:", e);
  }
}

// Imports copied from DataSourceModal for I/O Tab
import NodeIOViewer from "../DataSourceModal/content/NodeIOViewer.vue";
import { useNodeContext } from "~/composables/useNodeContext";
import { removeFileExtension, groupSourcesByCategory } from "~/utils/helpers";
// Importar o novo componente
import SurveyBuilder from "./content/SurveyBuilder.vue";
import Preview from "./content/Preview.vue";
import Results from "./content/Results.vue"; // Import the new component

const isLoadingIO = ref(false);

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  nodeData: {
    type: Object,
    default: () => ({ data: {} }), // Garantir que data exista
  },
});

const emit = defineEmits(["close", "update:nodeData"]); // update:nodeData não é mais usado diretamente aqui

// ... resto do código ...
// --- Store ---
const modalStore = useModalStore();
const taskFlowStore = useTaskFlowStore();
const { getCurrentInputContextSync } = useNodeContext();

// --- State ---
const activeTab = ref("create");

// Forçar atualização do NodeIOViewer quando entra na aba output
const outputTabKey = ref(0);

// --- Computed for Share Tab ---
const surveyId = computed(() => {
  const idFromProps = props.nodeData?.surveyId;
  const idFromStructure = props.nodeData?.surveyStructure?.[0]?.survey_id;

  return idFromProps || idFromStructure || null;
});

watch(
  [
    () => props.nodeData?.surveyId,
    () => props.nodeData?.surveyStructure?.[0]?.survey_id,
  ],
  ([surveyIdFromNode, surveyIdFromStructure]) => {
    if (surveyIdFromNode) {
      surveyIdLocal.value = surveyIdFromNode;
    } else if (surveyIdFromStructure) {
      surveyIdLocal.value = surveyIdFromStructure;
    }
  },
  { immediate: true }
);

// Watcher para abas (output/results)
watch(activeTab, async (tab) => {
  if (tab === "output") {
    isLoadingIO.value = true;
    await fetchSurveyStructureAndUpdateNode();
    // Removido: await fetchSurveyOutputDataAndUpdateNode();
    await nextTick();
    outputTabKey.value += 1;
    isLoadingIO.value = false;
  }
});
// State for I/O Tab
const isLoadingContext = ref(false);
const contextError = ref(null);
const isModalLoading = ref(false); // Para o overlay de loading do modal inteiro
// State for Create Tab
const isLoadingSurvey = ref(false); // Flag de loading para evitar pulo
// --- State for Share Tab ---
const isSurveyActive = ref(false);
const copyStatus = ref("Copiar"); // Translate initial state
const shareError = ref(null);
const isLoadingSurveyStatus = ref(false); // Para feedback de UI
const surveyIdForBuilder = ref(null); // Novo ref para o SurveyBuilder
// --- Modal Initialization State ---
const isInitializingModal = ref(false);

async function fetchAndUpdateSurveyActiveStatus() {
  if (!surveyId.value || isLoadingSurveyStatus.value) return;

  isLoadingSurveyStatus.value = true;
  shareError.value = null; // Limpar erros anteriores
  try {
    const surveyDetails = await $fetch(`/api/surveys/${surveyId.value}`);
    if (surveyDetails) {
      const newActiveStatus = !!surveyDetails.is_active;
      if (isSurveyActive.value !== newActiveStatus) {
        isSurveyActive.value = newActiveStatus; // Atualiza o ref local
      }
      // Opcional, mas bom: garantir que a store também esteja sincronizada
      // se o valor do banco for diferente do que temos no props.nodeData
      if (
        props.nodeData?.data?.is_active !== newActiveStatus &&
        currentNodeId.value
      ) {
        await taskFlowStore.updateNodeData(currentNodeId.value, {
          is_active: newActiveStatus,
        });
      }
    }
  } catch (err) {
    console.error("Falha ao buscar status atual da pesquisa:", err);
    shareError.value = "Não foi possível carregar o status atual da pesquisa.";
    // Manter o valor local de isSurveyActive ou reverter?
    // Por segurança, poderia reverter para o valor da prop se a busca falhar.
    // isSurveyActive.value = !!props.nodeData?.data?.is_active;
  } finally {
    isLoadingSurveyStatus.value = false;
  }
}

// Garante que o toggle sempre fique sincronizado com o valor real do store
watch(
  () => props.nodeData?.is_active,
  (val) => {
    if (!isInitializingModal.value) {
      isSurveyActive.value = !!val;
    }
  },
  { flush: "post" } // Ensure watcher runs after DOM updates, props should be settled
);

const shareableLink = computed(() => {
  if (!surveyId.value) return "ID da pesquisa não encontrado"; // Translate
  // Ensure window is defined (for SSR safety, though likely client-side here)
  if (typeof window !== "undefined") {
    return `${window.location.origin}/preview/${surveyId.value}`;
  }
  return `/preview/${surveyId.value}`; // Fallback for server-side rendering if needed
});

// --- Functions for Share Tab ---
async function copyLink() {
  if (!navigator.clipboard) {
    copyStatus.value = "Falhou"; // Translate
    console.error("API de Clipboard não disponível"); // Translate console error
    return;
  }
  try {
    await navigator.clipboard.writeText(shareableLink.value);
    copyStatus.value = "Copiado!"; // Translate
    setTimeout(() => {
      copyStatus.value = "Copiar"; // Translate reset state
    }, 2000); // Reset after 2 seconds
  } catch (err) {
    copyStatus.value = "Falhou"; // Translate
    console.error("Falha ao copiar link: ", err); // Translate console error
  }
}

async function toggleSurveyStatus() {
  const currentSurveyIdVal = surveyId.value;
  if (!currentSurveyIdVal) {
    shareError.value = "ID da pesquisa não encontrado.";
    return;
  }
  shareError.value = null;
  const newStatus = !isSurveyActive.value;

  isModalLoading.value = true;
  try {
    // Atualiza status no backend
    await $fetch(`/api/surveys/${currentSurveyIdVal}`, {
      method: "PUT",
      body: { is_active: newStatus },
    });

    // Busca o status real do banco para evitar dessincronismo
    const surveyDetails = await $fetch(`/api/surveys/${currentSurveyIdVal}`);
    isSurveyActive.value = !!surveyDetails.is_active;

    if (currentNodeId.value) {
      await taskFlowStore.updateNodeData(currentNodeId.value, {
        is_active: !!surveyDetails.is_active,
      });
    }
  } catch (err) {
    console.error("[SurveyModal] Falha ao atualizar status da pesquisa:", err);
    shareError.value = "Não foi possível atualizar o status. Tente novamente.";
  } finally {
    isModalLoading.value = false;
  }
}
// --- Preview Navigation State ---
const previewCurrentPage = ref(0);
const previewTotalPages = ref(1);

const hasQuestions = computed(() => {
  const structure = props.nodeData?.surveyStructure;
  if (!structure || !Array.isArray(structure)) return false;
  return structure.some((b) => b.type !== "intro" && b.type !== "thanks");
});

// Atualiza previewTotalPages sempre que a estrutura muda
watch(
  () => props.nodeData?.surveyStructure,
  (blocks, oldBlocks) => {
    const pages = Array.isArray(blocks)
      ? blocks.filter(
          (b) =>
            b.type === "intro" ||
            b.type === "thanks" ||
            b.type === "openText" ||
            b.type === "multipleChoice" ||
            b.type === "rating" ||
            b.type === "opinionScale" ||
            b.type === "satisfactionScale"
        )
      : [];
    previewTotalPages.value = pages.length;
    // Garante que a página atual nunca fique fora do range
    if (previewCurrentPage.value >= previewTotalPages.value) {
      previewCurrentPage.value = Math.max(0, previewTotalPages.value - 1);
    }
    // Se acabou de adicionar a primeira pergunta, pula para a página 1 (primeira pergunta)
    const numQuestions = Array.isArray(blocks)
      ? blocks.filter((b) => b.type !== "intro" && b.type !== "thanks").length
      : 0;
    const oldNumQuestions = Array.isArray(oldBlocks)
      ? oldBlocks.filter((b) => b.type !== "intro" && b.type !== "thanks")
          .length
      : 0;
    if (oldNumQuestions === 0 && numQuestions > 0) {
      previewCurrentPage.value = 1;
    }
  },
  { immediate: true, deep: true }
);

function previewNextPage() {
  if (previewCurrentPage.value < previewTotalPages.value - 1) {
    previewCurrentPage.value++;
  }
}
function previewPrevPage() {
  if (previewCurrentPage.value > 0) {
    previewCurrentPage.value--;
  }
}

// Debug: log surveyId origem sempre que mudar
watch(
  [
    () => props.nodeData?.surveyId,
    () => props.nodeData?.surveyStructure?.[0]?.survey_id,
  ],
  ([surveyIdFromNode, surveyIdFromStructure]) => {},
  { immediate: true }
);

// --- Computed for I/O Tab ---
const currentNodeId = computed(() => modalStore.getActiveNodeId);
const currentNode = computed(() => {
  if (!currentNodeId.value) return null;
  return taskFlowStore.nodes.find((n) => n.id === currentNodeId.value);
});
const viewerInputData = computed(() => {
  // This will be passed to :cumulative-context
  if (!currentNode.value || !currentNode.value.data) {
    return { compressed: false, blob: {} }; // Return a default empty wrapper
  }
  // Directly use the cumulativeContext from the current node
  return (
    currentNode.value.data.cumulativeContext || { compressed: false, blob: {} }
  );
});
const viewerOutputData = computed(() => {
  // Directly return the outputData calculated and stored by the taskFlow store
  const nodeOutput = currentNode.value?.data?.outputData || {};

  return nodeOutput;
});

// Watcher for logs (I/O)
watch(
  [viewerInputData, viewerOutputData],
  ([newInput, newOutput], [oldInput, oldOutput]) => {},
  { deep: true, immediate: true }
);

// Novo watcher centralizado para abertura/fechamento do modal
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      surveyIdForBuilder.value = props.nodeData?.surveyId || null;
      isSurveyActive.value = !!props.nodeData?.is_active;

      activeTab.value = "create";
      copyStatus.value = "Copiar";
      shareError.value = null;
    } else {
      surveyIdForBuilder.value = null;
      isModalLoading.value = false;
      isSurveyActive.value = false;
    }
  },
  { immediate: true }
);

// (Watcher duplicado de activeTab removido - lógica centralizada no watcher acima)

// --- Handlers ---
const closeModal = () => {
  // Não há necessidade de chamar updateNodeData aqui, pois já foi feito.
  emit("close");
};

// Função para abrir o preview em nova aba
function openPreview() {
  // Busca o surveyId das props ou da estrutura
  const surveyIdVal =
    props.nodeData?.surveyId || props.nodeData?.surveyStructure?.[0]?.survey_id;
  if (!surveyIdVal) {
    alert("ID do survey não encontrado.");
    return;
  }
  // Monta a URL de preview
  const url = `/preview/${surveyIdVal}`;
  window.open(url, "_blank");
}

// Handler para atualizações vindas do SurveyBuilder
const handleStructureUpdate = async (newStructure) => {
  const currentSurveyIdVal = surveyId.value;

  if (currentNodeId.value && currentSurveyIdVal) {
    isModalLoading.value = true; // Mostrar loading durante a atualização
    try {
      // 1. A nova estrutura já foi atualizada no backend pelas chamadas diretas
      //    da API de perguntas dentro do SurveyBuilder (POST /questions, PUT /questions/:id, etc.)
      //    e pela chamada PUT /api/surveys/questions-order.
      //    Não precisamos reenviar a estrutura inteira aqui, a menos que a API de perguntas
      //    não retorne o `order` atualizado.

      // 2. Buscar o responseCount mais recente (pois a estrutura mudou,
      //    embora não deva afetar o count, é bom para consistência)
      //    e o is_active (caso tenha mudado em outra aba/lugar)
      const resultsResp = await $fetch(
        `/api/surveys/${currentSurveyIdVal}/results`
      );
      const surveyMeta = await $fetch(`/api/surveys/${currentSurveyIdVal}`); // Para pegar is_active atual

      const currentResponseCount =
        resultsResp?.total_individual_responses ??
        (resultsResp?.submissions?.length || 0);
      const currentIsActive = !!surveyMeta?.is_active;
      isSurveyActive.value = currentIsActive; // Atualiza o estado local do toggle, se necessário

      const nodeDataToUpdate = {
        surveyStructure: newStructure, // A estrutura que acabou de ser modificada pelo builder
        is_active: currentIsActive, // O status de ativação atual do banco
        responseCount: currentResponseCount, // A contagem de respostas atualizada
        surveyId: currentSurveyIdVal,
        // title: surveyMeta?.title || props.nodeData?.data?.title || "Survey",
      };

      await taskFlowStore.updateNodeData(currentNodeId.value, nodeDataToUpdate);

      previewCurrentPage.value = 0; // Resetar preview
    } catch (error) {
      console.error(`[SurveyModal] Erro em handleStructureUpdate:`, error);
      // Tratar erro (ex: toast)
    } finally {
      isModalLoading.value = false;
    }
  } else {
    console.error(
      "[SurveyModal] handleStructureUpdate: currentNodeId ou surveyId é nulo."
    );
  }
};

// TODO: Placeholder para adicionar um novo bloco (seria chamado por um botão)
/*
const addNewBlock = (blockType) => {
    let newBlockData = {};
    let blockId = `${blockType}-${Date.now()}`;
    switch(blockType) {
        case 'intro':
            newBlockData = { title: 'Nova Introdução', description: '' };
            break;
        // ... outros tipos
        default:
            newBlockData = {};
    }
    const newBlock = { id: blockId, type: blockType, data: newBlockData };
    const updatedStructure = [...localSurveyStructure.value, newBlock];
    handleStructureUpdate(updatedStructure);
};
*/
// Handler para pular para a tela de agradecimento no preview
function handleJumpToEnd() {
  const structure = props.nodeData?.surveyStructure;
  if (!structure || !Array.isArray(structure)) return;
  const thanksIndex = structure.findIndex((b) => b.type === "thanks");
  if (thanksIndex !== -1) {
    previewCurrentPage.value = thanksIndex;
  } else {
    // Fallback: se não achar o bloco de agradecimento, vai para a última página
    previewCurrentPage.value = previewTotalPages.value - 1;
  }
}
</script>

<style scoped>
/* Adicionar estilos específicos se necessário */
/* Estilos para scrollbar se necessário */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #2c2b30; /* Cor do fundo da trilha */
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #47464b; /* Cor da barra de rolagem */
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555; /* Cor da barra ao passar o mouse */
}

/* Forçar visibilidade da scrollbar no Firefox (pode não funcionar em todos os casos) */
* {
  scrollbar-width: thin; /* "auto" or "thin" */
  scrollbar-color: #47464b #2c2b30; /* thumb track */
}
</style>
