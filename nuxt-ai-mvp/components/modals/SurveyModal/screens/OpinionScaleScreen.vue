<template>
  <div
    :class="
      fullscreen
        ? 'flex flex-col items-center justify-center w-full h-full bg-[#fafbfc] py-20 rounded-lg'
        : 'relative flex flex-col w-full h-full bg-[#fafbfc] items-center justify-center px-8'
    "
  >
    <div
      :class="
        fullscreen
          ? 'w-full max-w-xl bg-white rounded-lg shadow-md flex flex-col items-stretch'
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
            ? 'text-base text-[#6b6c7e] mb-4 whitespace-pre-line break-words px-8'
            : 'text-sm text-[#6b6c7e] mb-4 whitespace-pre-line break-words px-4'
        "
        >{{ instructions }}</pre
      >
      <div class="p-8 flex flex-col items-center">
        <div class="flex flex-row justify-center items-center gap-4 w-full">
          <button
            v-for="n in range"
            :key="n"
            class="w-10 h-10 rounded-full border border-[#ECECEE] bg-white text-[#393b4a] text-base font-semibold flex items-center justify-center hover:bg-[#F0F4FF] focus:outline-none focus:ring-2 focus:ring-[#4d6bfe] transition-colors"
            :class="{ 'bg-[#4d6bfe]': selectedValue === n }"
            @click="selectValue(n)"
            :disabled="!fullscreen"
          >
            {{ n }}
          </button>
        </div>
        <div class="flex justify-between w-full mt-2 text-xs text-[#6b6c7e]">
          <span>{{ startLabel }}</span>
          <span>{{ endLabel }}</span>
        </div>
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
        :disabled="!fullscreen || selectedValue === null"
        @click="
          fullscreen &&
            selectedValue !== null &&
            emit('submitAnswerEvent', {
              // Use defined emit
              questionId: props.questionId,
              value: selectedValue,
            })
        "
      >
        Avançar
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { defineEmits } from "vue"; // Import defineEmits

const emit = defineEmits(["submitAnswerEvent"]); // Define the emit
const props = defineProps({
  fullscreen: {
    type: Boolean,
    default: false,
  },
  questionText: {
    type: String,
    default: "Como você se sente em relação a...?",
  },
  instructions: {
    type: String,
    default: "",
  },
  minValue: {
    type: Number,
    default: 1,
  },
  maxValue: {
    type: Number,
    default: 7,
  },
  startLabel: {
    type: String,
    default: "Discordo totalmente",
  },
  endLabel: {
    type: String,
    default: "Concordo totalmente",
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
const selectedValue = ref(null);
const range = computed(() => {
  const min = Number(props.minValue) || 1;
  const max = Number(props.maxValue) || 7;
  const arr = [];
  for (let i = min; i <= max; i++) arr.push(i);
  return arr;
});
function selectValue(n) {
  selectedValue.value = n;
}

const h2Class = computed(() =>
  props.fullscreen
    ? "text-2xl font-bold text-[#393b4a] p-8"
    : "text-lg font-bold text-[#393b4a] p-4"
);

onMounted(() => {
  // Log inicial ao montar
  // eslint-disable-next-line no-console
});

watch(
  () => props.fullscreen,
  (val) => {
    // eslint-disable-next-line no-console
  }
);
</script>
