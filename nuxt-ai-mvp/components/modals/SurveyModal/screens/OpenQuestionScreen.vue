<template>
  <div
    :class="
      fullscreen
        ? 'flex flex-col items-center justify-center w-full h-full bg-[#fafbfc] py-12 rounded-lg'
        : 'relative flex flex-col w-full h-full bg-[#fafbfc] items-center justify-center px-8'
    "
  >
    <div
      :class="
        fullscreen
          ? 'w-full max-w-xl bg-white rounded-lg shadow-md  flex flex-col items-stretch '
          : 'w-full max-w-xl bg-white rounded-lg shadow-md flex flex-col items-stretch'
      "
    >
      <div class="bg-[#FBFBFB] border border-b-[#ECECEE] rounded-t-lg">
        <h2
          :class="
            fullscreen
              ? 'text-2xl font-bold text-[#393b4a] p-8'
              : 'text-lg font-bold text-[#393b4a] p-4'
          "
        >
          {{ questionText }}
        </h2>
      </div>
      <pre
        v-if="instructions"
        :class="
          fullscreen
            ? 'text-base text-[#6b6c7e] mb-4 whitespace-pre-line break-words'
            : 'text-sm text-[#6b6c7e] mb-4 whitespace-pre-line break-words'
        "
        >{{ instructions }}</pre
      >
      <div :class="fullscreen ? 'p-8' : 'p-4'">
        <textarea
          v-model="answer"
          class="w-full min-h-[80px] max-h-[180px] rounded-lg bg-white text-base text-[#393b4a] focus:outline-none focus:ring-2 focus:ring-[#4d6bfe] resize-none shadow-sm border border-b-[#ECECEE] p-4"
          :placeholder="placeholder || 'Digite sua resposta aqui...'"
          :disabled="!fullscreen"
        ></textarea>
      </div>
    </div>
    <!-- Bloco de navegação SEPARADO, fixo no rodapé do preview -->
    <div
      class="w-full max-w-xl bg-white rounded-lg shadow-md px-8 py-4 flex flex-row justify-end gap-4"
      style="
        position: absolute;
        left: 0;
        bottom: 0;
        right: 0;
        margin: auto;
        z-index: 10;
      "
    >
      <button
        v-if="!isRequired"
        class="px-6 py-2 rounded-lg border border-[#e0e0e0] bg-white text-[#6b6c7e] font-medium hover:bg-gray-50 transition-colors text-sm"
        :disabled="fullscreen ? false : true"
        @click="
          emit('submitAnswerEvent', {
            // Use defined emit
            questionId: props.questionId,
            value: null,
          })
        "
      >
        Pular esta pergunta
      </button>
      <button
        class="px-6 py-2 rounded-lg bg-[#4d6bfe] text-white font-semibold shadow-sm text-sm disabled:opacity-50"
        :disabled="!fullscreen || !answer.trim()"
        @click="
          fullscreen &&
            emit('submitAnswerEvent', {
              // Use defined emit
              questionId: props.questionId,
              value: answer.trim(),
            })
        "
      >
        Avançar
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue"; // Import watch
import { defineEmits } from "vue"; // Import defineEmits

const emit = defineEmits(["submitAnswerEvent"]); // Define the emit
const props = defineProps({
  questionText: {
    type: String,
    default: "Digite sua pergunta aberta aqui.",
  },
  instructions: {
    type: String,
    default: "",
  },
  fullscreen: {
    type: Boolean,
    required: true,
  },
  placeholder: {
    type: String,
    default: "",
  },
  isRequired: {
    type: Boolean,
    default: false,
  },
  questionId: {
    // Add questionId prop
    type: String,
    required: true,
  },
});

const answer = ref("");

// Watch for changes in the questionId prop
watch(
  () => props.questionId,
  (newId, oldId) => {
    // Clear the answer when the question changes
    if (newId !== oldId) {
      answer.value = "";
    }
  }
);
</script>
