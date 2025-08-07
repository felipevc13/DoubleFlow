<template>
  <div
    :class="
      fullscreen
        ? 'w-screen h-screen min-h-screen min-w-full bg-[#171717] overflow-hidden'
        : 'flex-1 w-full min-h-0 bg-[#fafbfc] flex flex-col'
    "
  >
    <IntroScreen
      v-if="currentBlock && currentBlock.type === 'intro'"
      :title="
        currentBlock.title ||
        currentBlock.data?.title ||
        currentBlock.extra?.title ||
        ''
      "
      :description="
        currentBlock.description ||
        currentBlock.data?.description ||
        currentBlock.extra?.description ||
        ''
      "
      :fullscreen="fullscreen"
      @next="emit('preview-next-page')"
    />
    <ThankYouScreen
      v-else-if="
        currentBlock &&
        (currentBlock.type === 'thankYou' || currentBlock.type === 'thanks')
      "
      :block="currentBlock"
      :fullscreen="fullscreen"
      @next="emit('preview-next-page')"
    />
    <component
      v-else-if="currentBlock && currentBlock.type === 'openText'"
      :is="currentBlockComponent"
      :question-text="
        currentBlock.questionText ||
        currentBlock.data?.questionText ||
        currentBlock.title ||
        ''
      "
      :instructions="
        currentBlock.instructions || currentBlock.data?.instructions || ''
      "
      :placeholder="
        currentBlock.placeholder || currentBlock.data?.placeholder || ''
      "
      :is-required="
        currentBlock.isRequired ?? currentBlock.data?.isRequired ?? false
      "
      :fullscreen="fullscreen"
      :question-id="currentBlock.id"
      @submitAnswerEvent="handleAnswerSubmit"
    />
    <component
      v-else-if="currentBlock && currentBlock.type === 'opinionScale'"
      :is="currentBlockComponent"
      :question-text="
        currentBlock.questionText ||
        currentBlock.data?.questionText ||
        currentBlock.title ||
        ''
      "
      :instructions="
        currentBlock.instructions || currentBlock.data?.instructions || ''
      "
      :min-value="currentBlock.minValue ?? currentBlock.data?.minValue ?? 1"
      :max-value="
        currentBlock.maxValue ??
        currentBlock.data?.maxValue ??
        currentBlock.scaleLength ??
        currentBlock.data?.scaleLength ??
        7
      "
      :start-label="
        currentBlock.startLabel ||
        currentBlock.data?.startLabel ||
        'Discordo totalmente'
      "
      :end-label="
        currentBlock.endLabel ||
        currentBlock.data?.endLabel ||
        'Concordo totalmente'
      "
      :is-required="
        currentBlock.isRequired ?? currentBlock.data?.isRequired ?? false
      "
      :fullscreen="fullscreen"
      :question-id="currentBlock.id"
      @submitAnswerEvent="handleAnswerSubmit"
    />
    <component
      v-else-if="
        currentBlock &&
        (currentBlock.type === 'satisfactionScale' ||
          currentBlock.type === 'rating')
      "
      :is="
        defineAsyncComponent(() =>
          import(
            '@/components/modals/SurveyModal/screens/SatisfactionScaleScreen.vue'
          )
        )
      "
      :question-text="
        currentBlock.questionText ||
        currentBlock.data?.questionText ||
        currentBlock.title ||
        ''
      "
      :instructions="
        currentBlock.instructions || currentBlock.data?.instructions || ''
      "
      :min-value="currentBlock.minValue ?? currentBlock.data?.minValue ?? 1"
      :max-value="currentBlock.maxValue ?? currentBlock.data?.maxValue ?? 5"
      :start-label="
        currentBlock.startLabel ||
        currentBlock.data?.startLabel ||
        'Muito insatisfeito'
      "
      :end-label="
        currentBlock.endLabel ||
        currentBlock.data?.endLabel ||
        'Muito satisfeito'
      "
      :is-required="
        currentBlock.isRequired ?? currentBlock.data?.isRequired ?? false
      "
      :fullscreen="fullscreen"
      :question-id="currentBlock.id"
      @submitAnswerEvent="handleAnswerSubmit"
    />
    <component
      v-else-if="currentBlock && currentBlock.type === 'multipleChoice'"
      :is="
        defineAsyncComponent(() =>
          import(
            '@/components/modals/SurveyModal/screens/MultipleChoiceScreen.vue'
          )
        )
      "
      :question-text="
        currentBlock.questionText ||
        currentBlock.data?.questionText ||
        currentBlock.title ||
        ''
      "
      :instructions="
        currentBlock.instructions || currentBlock.data?.instructions || ''
      "
      :options="currentBlock.options || currentBlock.data?.options || []"
      :is-required="
        currentBlock.isRequired ?? currentBlock.data?.isRequired ?? false
      "
      :allow-other="
        currentBlock.allowOther ?? currentBlock.data?.allowOther ?? false
      "
      :allow-multiple="
        currentBlock.allowMultiple ?? currentBlock.data?.allowMultiple ?? false
      "
      :fullscreen="fullscreen"
      :question-id="currentBlock.id"
      @submitAnswerEvent="handleAnswerSubmit"
      @submitAnswerAndEnd="handleSubmitAndEnd"
    />
    <component
      v-else
      :is="currentBlockComponent"
      :block="currentBlock"
      mode="preview"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, defineAsyncComponent } from "vue";
import ThankYouScreen from "../screens/ThankYouScreen.vue";
import IntroScreen from "../screens/IntroScreen.vue";
import { onMounted } from "vue";

const props = defineProps({
  blocks: {
    type: Array,
    required: true,
  },
  previewCurrentPage: {
    type: Number,
    default: 0,
  },
  previewTotalPages: {
    type: Number,
    default: 0,
  },
  fullscreen: {
    type: Boolean,
    required: true,
  },
});

onMounted(() => {
  // Log para depuração
  // eslint-disable-next-line no-console
});

const emit = defineEmits([
  "preview-next-page",
  "preview-prev-page",
  "answer",
  "jump-to-end",
]); // Add 'answer' and 'jump-to-end' emit

// Function to handle the answer submission from child screens
function handleAnswerSubmit(answerData) {
  // Emit the answer data upwards to the parent page
  emit("answer", answerData);
  // Also trigger the page change
  emit("preview-next-page");
}

function handleSubmitAndEnd(answerData) {
  // Primeiro, salva a resposta normalmente
  emit("answer", answerData);
  // Emite evento especial para o SurveyModal pular para tela de agradecimento
  emit("jump-to-end");
}

const currentPage = computed({
  get: () => props.previewCurrentPage,
  set: (val) =>
    emit(
      val > props.previewCurrentPage ? "preview-next-page" : "preview-prev-page"
    ),
});

const pages = computed(() => {
  if (!props.blocks || !Array.isArray(props.blocks)) return [];
  // Garante ordem: intro -> perguntas -> thanks
  const intro = props.blocks.find((b) => b.type === "intro");
  const thanks = props.blocks.find((b) => b.type === "thanks");
  const questions = props.blocks.filter(
    (b) => b.type !== "intro" && b.type !== "thanks"
  );
  return [...(intro ? [intro] : []), ...questions, ...(thanks ? [thanks] : [])];
});

const currentBlock = computed(() => pages.value[props.previewCurrentPage]);

// Supondo que cada bloco tem um tipo, podemos mapear para o componente correto
const blockTypeToComponent = {
  intro: defineAsyncComponent(() =>
    import("@/components/modals/SurveyModal/screens/IntroScreen.vue")
  ),
  thanks: defineAsyncComponent(() =>
    import("@/components/modals/SurveyModal/blocks/ThankYouScreenBlock.vue")
  ),
  openText: defineAsyncComponent(() =>
    import("@/components/modals/SurveyModal/screens/OpenQuestionScreen.vue")
  ),
  multipleChoice: defineAsyncComponent(() =>
    import("@/components/modals/SurveyModal/blocks/QuestionBlock.vue")
  ),
  rating: defineAsyncComponent(() =>
    import("@/components/modals/SurveyModal/blocks/QuestionBlock.vue")
  ),
  opinionScale: defineAsyncComponent(() =>
    import("@/components/modals/SurveyModal/screens/OpinionScaleScreen.vue")
  ),
};

const currentBlockComponent = computed(() => {
  if (!currentBlock.value) return null;
  const type = currentBlock.value.type;
  if (blockTypeToComponent[type]) return blockTypeToComponent[type];
  return blockTypeToComponent.openText; // fallback para perguntas
});

function nextPage() {
  if (currentPage.value < pages.value.length - 1) {
    currentPage.value++;
  }
}
function prevPage() {
  if (currentPage.value > 0) {
    currentPage.value--;
  }
}
</script>

<style scoped>
.form-preview {
  border-radius: 8px;
  padding: 24px;
  background: #fafbfc;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.preview-content {
  width: 100%;
  max-width: 500px;
  min-height: 220px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
