<template>
  <div
    class="flex flex-col h-full min-h-0 text-white border border-[#343434] rounded-lg"
  >
    <!-- Header -->
    <template v-if="questionBlocks.length === 0">
      <div class="flex flex-1 flex-col items-center justify-center py-16">
        <div class="flex flex-row items-center gap-4">
          <button
            class="inline-flex w-fit items-center justify-center gap-2 px-4 py-2 hover:bg-[#3C3B40] text-white rounded-lg border border-[#4D6BFE] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            @click="handleCreateWithAI"
            :disabled="!props.surveyId || isGeneratingAI"
            title="Gerar estrutura com IA"
          >
            <span
              v-if="isGeneratingAI"
              class="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></span>
            <AiIcon v-else class="h-4 w-4" />
            <span>{{ isGeneratingAI ? "Gerando..." : "Criar com IA" }}</span>
          </button>
          <span class="mx-2 text-[#A0A0A0] font-semibold select-none">OU</span>
          <button
            class="inline-flex w-fit items-center justify-center gap-2 px-4 py-2 border border-white text-white rounded-lg bg-transparent hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            @click="handleAddNewQuestion"
            :disabled="!props.surveyId || isAddingQuestion"
            title="Criar manualmente"
          >
            <span
              v-if="isAddingQuestion"
              class="inline-block h-4 w-4 mr-1 align-middle border-2 border-white border-t-transparent rounded-full animate-spin"
            ></span>
            <span>Criar manualmente</span>
          </button>
        </div>
      </div>
    </template>
    <template v-else>
      <!-- Intro Block (Always at the top when questions exist) -->
      <component
        v-if="introBlock"
        :is="getBlockComponent(introBlock.type)"
        :id="introBlock.id"
        :block-data="introBlock"
        :block-type="introBlock.type"
        :is-first="true"
        :is-last="false"
        :is-fixed="true"
        :key="introBlock.id"
        :is-open="openedBlockId === introBlock.id"
        @open-block="
          openedBlockId = openedBlockId === introBlock.id ? null : introBlock.id
        "
        @update:block-data="
          (newData) =>
            handleBlockUpdate(introBlock.id, introBlock.type, newData)
        "
        class="p-4 border-b border-[#343434]"
      />
      <!-- Scrollable Question Area -->
      <div class="flex-1 overflow-y-auto px-4">
        <!-- Draggable Question Area (using vuedraggable) -->
        <ClientOnly>
          <draggable
            :list="questionBlocks"
            item-key="id"
            class="space-y-4"
            handle=".drag-handle"
            ghost-class="ghost-block"
            drag-class="dragging-block"
            @end="onDraggableEnd"
          >
            <template #item="{ element: block, index }">
              <component
                :is="getBlockComponent(block.type)"
                :id="block.id"
                :block-data="block"
                :block-type="block.type"
                :question-index="index"
                :is-first="false"
                :is-last="false"
                :is-fixed="false"
                :key="block.id"
                :is-open="openedBlockId === block.id"
                @open-block="
                  openedBlockId = openedBlockId === block.id ? null : block.id
                "
                @update:block-data="
                  (newData) => handleBlockUpdate(block.id, block.type, newData)
                "
                @update:block-type="
                  (newType) => handleBlockUpdate(block.id, newType, block.data)
                "
                @delete-block="handleDeleteBlock"
                class="survey-block cursor-grab"
              />
            </template>
          </draggable>
          <template #fallback>
            <!-- Optional: Show a placeholder while the component is loading on the client -->
            <div class="space-y-4 p-4 text-gray-500">
              Carregando perguntas...
            </div>
          </template>
        </ClientOnly>
      </div>

      <!-- Add New Question Button (Moved Outside Scroll Area) -->
      <div class="px-4 pt-4 mb-6 border-t border-[#343434] mt-4">
        <button
          @click="handleAddNewQuestion"
          :disabled="!props.surveyId || isAddingQuestion"
          class="flex items-center justify-center w-full bg-[#4D6BFE] border-gray-600 hover:border-gray-500 text-white hover:text-gray-300 rounded-lg p-2 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span
            v-if="isAddingQuestion"
            class="inline-block h-4 w-4 mr-1 align-middle border-2 border-white border-t-transparent rounded-full animate-spin"
          ></span>
          <span>Adicionar nova pergunta</span>
        </button>
      </div>

      <!-- Thank You Block (Now Fixed Bottom) -->
      <component
        v-if="thanksBlock"
        :is="getBlockComponent(thanksBlock.type)"
        :id="thanksBlock.id"
        :block-data="thanksBlock"
        :block-type="thanksBlock.type"
        :is-first="false"
        :is-last="true"
        :is-fixed="true"
        :key="thanksBlock.id"
        :is-open="openedBlockId === thanksBlock.id"
        @open-block="
          openedBlockId =
            openedBlockId === thanksBlock.id ? null : thanksBlock.id
        "
        @update:block-data="
          (newData) =>
            handleBlockUpdate(thanksBlock.id, thanksBlock.type, newData)
        "
        class="p-4 border-t border-[#343434]"
      />
    </template>

    <!-- Footer/Actions (Optional) -->
    <!-- <div class="p-4 border-t border-gray-700">
      Actions if needed
    </div> -->
  </div>
</template>

<script setup>
import { computed, shallowRef, watch, ref } from "vue";

// Controle unificado de expansão de blocos (apenas um aberto por vez)
const openedBlockId = ref(null); // id do bloco aberto ou null
import draggable from "vuedraggable"; // Import vuedraggable
import AiIcon from "~/components/icon/AiIcon.vue";

// Import Block Components (using shallowRef for potential performance)
const IntroScreenBlock = shallowRef(null);
const ThankYouScreenBlock = shallowRef(null);
const QuestionBlock = shallowRef(null);

// Dynamically import components only when needed - CORRIGIR NOMES AQUI
import("../blocks/IntroScreenBlock.vue").then((module) => {
  IntroScreenBlock.value = module.default;
});
import("../blocks/ThankYouScreenBlock.vue").then(
  (module) => (ThankYouScreenBlock.value = module.default)
);
import("../blocks/QuestionBlock.vue").then(
  (module) => (QuestionBlock.value = module.default)
);

const props = defineProps({
  surveyStructure: {
    type: Array,
    required: true,
  },
  surveyId: {
    type: [String, Number],
    required: false,
    default: undefined,
  },
});

// Log prop changes
import { onMounted } from "vue";
onMounted(() => {});

watch(
  () => props.surveyStructure,
  (newVal, oldVal) => {
    let safeOld =
      oldVal !== undefined
        ? (() => {
            try {
              return JSON.parse(JSON.stringify(oldVal));
            } catch (e) {
              return oldVal;
            }
          })()
        : undefined;
    let safeNew =
      newVal !== undefined
        ? (() => {
            try {
              return JSON.parse(JSON.stringify(newVal));
            } catch (e) {
              return newVal;
            }
          })()
        : undefined;
  },
  { deep: true, immediate: true }
);

const emit = defineEmits(["update:surveyStructure"]);

// --- Computed Properties for Block Filtering ---
const introBlock = computed(() => {
  const block = props.surveyStructure.find((b) => b.type === "intro");
  if (!block) {
    console.warn(
      "[SurveyBuilder] Nenhum bloco intro encontrado em surveyStructure:",
      JSON.parse(JSON.stringify(props.surveyStructure))
    );
  } else {
  }
  return block || null;
});
const thanksBlock = computed(() =>
  props.surveyStructure.find((b) => b.type === "thanks")
);
// Apenas perguntas comuns (exclui intro/thanks)
const questionBlocks = computed(() =>
  props.surveyStructure.filter((b) => b.type !== "intro" && b.type !== "thanks")
);

// --- Component Mapping ---
const blockComponentMap = {
  intro: IntroScreenBlock,
  thanks: ThankYouScreenBlock,
  openText: QuestionBlock,
  multipleChoice: QuestionBlock,
  rating: QuestionBlock,
  opinionScale: QuestionBlock,
  // Add other block types here as needed
};

const getBlockComponent = (type) => {
  const componentRef = blockComponentMap[type];
  const resolvedComponent = componentRef?.value; // Access .value from shallowRef

  return resolvedComponent || null; // Return the resolved component or null
};

// --- Event Handlers ---

const isAddingQuestion = ref(false);

const handleAddNewQuestion = async () => {
  if (isAddingQuestion.value) return;
  isAddingQuestion.value = true;
  try {
    await addNewQuestion();
  } finally {
    isAddingQuestion.value = false;
  }
};

// Função unificada para atualizar tipo OU dados de um bloco
const handleBlockUpdate = async (blockId, newType, newData) => {
  // Atualiza no banco (PUT)
  try {
    await $fetch(`/api/questions/${blockId}`, {
      method: "PUT",
      body: {
        ...(newType ? { type: newType } : {}),
        ...(newData || {}),
      },
    });
  } catch (e) {
    alert("Erro ao atualizar tipo da questão no banco: " + e.message);
  }

  // LOG DETALHADO PARA DEBUG
  const block = props.surveyStructure.find((b) => b.id === blockId);

  // Se for o bloco intro ou thanks, salva no campo extra via API
  if (block && (block.type === "intro" || block.type === "thanks")) {
    try {
      const response = await $fetch(`/api/questions/${blockId}`, {
        method: "PUT",
        body: {
          extra: { ...newData },
        },
      });

      // Atualize o estado local com o valor salvo no backend
      if (response.question && response.question.extra) {
        newData = response.question.extra;
      }
    } catch (e) {
      alert(`Erro ao salvar ${block.type}: ` + (e.message || e));
    }
  }

  const newStructure = props.surveyStructure.map((block) => {
    if (block.id === blockId) {
      // Sempre retorna novo objeto, novo data e novo extra para garantir reatividade
      let updatedBlock;
      if (block.type === "intro" || block.type === "thanks") {
        // For intro/thanks, update the top-level 'extra' property
        updatedBlock = {
          ...block,
          // Type should not change for intro/thanks blocks via this update path
          extra: { ...newData }, // Use potentially updated newData from backend
        };
      } else {
        // Correct logic for question blocks: merge newData directly into the block
        updatedBlock = {
          ...block, // Keep existing block properties (like id, survey_id etc.)
          type: newType, // Update type if provided (e.g., from dropdown change)
          ...newData, // Merge the updated properties (like questionText, isRequired) directly
        };
      }
      // Removed log for updatedBlock
      return { ...updatedBlock };
    }
    return { ...block };
  });
  emit("update:surveyStructure", [...newStructure]);
  // Removed END log and setTimeout log
};

import {
  openTextDefault,
  multipleChoiceDefault,
  opinionScaleDefault,
  satisfactionScaleDefault,
} from "../blocks/config/questionDefaults.js";

// Adiciona uma nova pergunta
const addNewQuestion = async () => {
  const surveyId = props.surveyId;
  if (!surveyId) {
    alert("ID do survey não encontrado. props.surveyId=" + props.surveyId);
    return;
  }
  const defaultType = "openText";
  let newBlockData = openTextDefault();
  let questionText = newBlockData.questionText || "Nova Pergunta";

  try {
    // 1. Persistir no backend
    const response = await $fetch(`/api/surveys/${surveyId}/questions`, {
      method: "POST",
      body: {
        type: defaultType,
        ...newBlockData,
        questionText,
        // Adicione outros campos conforme necessário
      },
    });
    if (response.error || !response.question) {
      alert(
        "Erro ao criar pergunta: " + (response.error || "Erro desconhecido")
      );
      return;
    }
    // 2. Adicionar ao estado local com ID real do banco
    const newBlock = {
      ...response.question,
    };
    // Sempre adiciona a nova pergunta como última entre as perguntas comuns
    const newStructure = [];
    if (introBlock.value) newStructure.push(introBlock.value);
    newStructure.push(...questionBlocks.value);
    newStructure.push(newBlock); // nova pergunta ao final da lista de perguntas
    if (thanksBlock.value) newStructure.push(thanksBlock.value);
    emit("update:surveyStructure", newStructure);
  } catch (e) {
    alert("Erro ao criar pergunta: " + e.message);
  }
};

// Handle deletion of a question block
const handleDeleteBlock = async (blockId) => {
  if (blockId === introBlock.value?.id || blockId === thanksBlock.value?.id) {
    console.warn(`[SurveyBuilder] Attempted to delete fixed block: ${blockId}`);
    return;
  }
  // Chama o backend para deletar a pergunta
  try {
    await $fetch(`/api/questions/${blockId}`, { method: "DELETE" });
  } catch (e) {
    alert(
      "Erro ao excluir pergunta do banco: " + (e?.data?.error || e.message)
    );
    return;
  }
  // Atualiza o estado local normalmente
  const newStructure = props.surveyStructure.filter(
    (block) => block.id !== blockId
  );
  emit("update:surveyStructure", newStructure);

  // --- NOVO: Atualiza a ordem dos blocos restantes ---
  // Só perguntas (exclui intro/thanks)
  const questionBlocksArr = newStructure.filter(
    (b) => b.type !== "intro" && b.type !== "thanks"
  );
  const orderedQuestionIds = questionBlocksArr.map((q) => q.id);
  const surveyId = props.surveyId;
  if (!surveyId) return;
  try {
    await $fetch("/api/surveys/questions-order", {
      method: "PUT",
      body: {
        order: orderedQuestionIds,
        survey_id: surveyId,
      },
    });
  } catch (e) {
    alert("Erro ao atualizar ordem após deletar: " + e.message);
  }
};

// --- vuedraggable Event Handler ---
const onDraggableEnd = async (event) => {
  // Detecta se houve mudança real
  if (event.oldIndex === event.newIndex && event.from === event.to) return;
  // Monta a nova ordem (só das perguntas, sem intro/thanks)
  const orderedQuestionIds = questionBlocks.value.map((q) => q.id);
  const surveyId = props.surveyId;
  if (!surveyId) {
    alert("ID do survey não encontrado para salvar ordem.");
    return;
  }
  try {
    // Chama endpoint para atualizar ordem (você pode criar /api/surveys/[survey_id]/questions/order)
    await $fetch("/api/surveys/questions-order", {
      method: "PUT",
      body: {
        order: orderedQuestionIds,
        survey_id: surveyId,
      },
    });
  } catch (e) {
    alert("Erro ao salvar a ordem das perguntas: " + e.message);
  }
  // Atualiza o estado local normalmente
  const newStructure = [];
  if (introBlock.value) newStructure.push(introBlock.value);
  newStructure.push(...questionBlocks.value);
  if (thanksBlock.value) newStructure.push(thanksBlock.value);
  emit("update:surveyStructure", newStructure);
};

// --- AI Generation ---
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useModalStore } from "~/stores/modal";

const taskFlowStore = useTaskFlowStore();
const modalStore = useModalStore();
const isGeneratingAI = ref(false);

const currentNodeId = computed(() => modalStore.getActiveNodeId);
const currentNode = computed(() => {
  if (!currentNodeId.value) return null;
  return taskFlowStore.nodes.find((n) => n.id === currentNodeId.value);
});
// Get input data (context for AI)
const nodeInputData = computed(() => currentNode.value?.data?.inputData || {});

// Utilitário para sanitizar opções das perguntas (remove "Outro" das opções e seta allowOther)
function sanitizeSurveyOptions(surveyStructure) {
  return surveyStructure.map((question) => {
    if (question.type === "multipleChoice" && Array.isArray(question.options)) {
      const options = question.options;
      const hasOutro = options.some(
        (opt) =>
          (typeof opt === "string" && opt.trim().toLowerCase() === "outro") ||
          (typeof opt === "object" &&
            typeof opt.text === "string" &&
            opt.text.trim().toLowerCase() === "outro")
      );
      if (hasOutro) {
        return {
          ...question,
          options: options.filter(
            (opt) =>
              !(
                (typeof opt === "string" &&
                  opt.trim().toLowerCase() === "outro") ||
                (typeof opt === "object" &&
                  typeof opt.text === "string" &&
                  opt.text.trim().toLowerCase() === "outro")
              )
          ),
          allowOther: true,
        };
      }
    }
    return question;
  });
}

const handleCreateWithAI = async () => {
  const nodeId = modalStore.getActiveNodeId; // Obtém o ID do nó survey
  if (!nodeId) {
    alert("Erro: ID do nó não encontrado.");
    return;
  }

  isGeneratingAI.value = true;

  try {
    // Despacha a ação genérica para a store, que delegará ao handler
    await taskFlowStore.updateNodeData(nodeId, {
      _action: "generateSurvey",
      _payload: {}, // O contexto já está no cumulativeContext do nó
    });
    // A UI será atualizada reativamente quando a store for atualizada pelo handler
    // Opcional: mostrar um toast de sucesso.
  } catch (error) {
    console.error("Falha ao disparar geração de survey:", error);
    alert(`Erro: ${error.message}`);
  } finally {
    isGeneratingAI.value = false;
  }
};
// --- End AI Generation ---
</script>

<style scoped>
/* Styling for drag-and-drop */
.ghost-block {
  opacity: 0.5;
  background: #3c3b40; /* Slightly different background for ghost */
  border: 1px dashed #4d6bfe;
}

.dragging-block {
  opacity: 1; /* Ensure dragging item is fully visible */
  /* Add any other styles for the item being actively dragged */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  cursor: grabbing !important; /* Indicate grabbing */
}

.survey-block {
  /* Ensure blocks have some padding/margin if not already present */
  /* Add a subtle border or background change on hover for draggability affordance */
  cursor: grab; /* Ensure grab cursor is present */
  transition: background-color 0.2s ease;
}
.survey-block:hover {
  background-color: rgba(255, 255, 255, 0.05); /* Subtle hover */
}

/* Define a handle if you don't want the whole block to be draggable */
/* .drag-handle { */
/* cursor: grab; */
/* Add styling for your handle element (e.g., an icon) */
/* } */
</style>
