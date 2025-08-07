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
        <div class="flex flex-row justify-center items-center gap-8 w-full">
          <button
            v-for="n in range"
            :key="n"
            class="flex flex-col items-center group"
            @click="selectValue(n)"
            :disabled="!fullscreen"
          >
            <!-- Ícone de carinha (substitua pelo seu depois) -->
            <span
              class="w-14 h-14 rounded-full border-2 flex items-center justify-center mb-2"
              :class="[
                selectedValue === n ? iconClass(n) : 'border-[#e4e4e9]',
                '',
              ]"
            >
              <svg
                v-if="n <= minNeutral"
                width="32"
                height="32"
                fill="none"
                :stroke="iconColor(n)"
                stroke-width="2"
                viewBox="0 0 32 32"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  :fill="iconColor(n)"
                  fill-opacity="0.18"
                />

                <circle cx="12" cy="14" r="2" :fill="iconColor(n)" />
                <circle cx="20" cy="14" r="2" :fill="iconColor(n)" />
                <path d="M11 22c2-2 6-2 8 0" :stroke="iconColor(n)" />
              </svg>
              <svg
                v-else-if="n === neutral"
                width="32"
                height="32"
                fill="none"
                :stroke="iconColor(n)"
                stroke-width="2"
                viewBox="0 0 32 32"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  :fill="iconColor(n)"
                  fill-opacity="0.18"
                />

                <circle cx="12" cy="14" r="2" :fill="iconColor(n)" />
                <circle cx="20" cy="14" r="2" :fill="iconColor(n)" />
                <path d="M12 22h8" :stroke="iconColor(n)" />
              </svg>
              <svg
                v-else
                width="32"
                height="32"
                fill="none"
                :stroke="iconColor(n)"
                stroke-width="2"
                viewBox="0 0 32 32"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  :fill="iconColor(n)"
                  fill-opacity="0.18"
                />

                <circle cx="12" cy="14" r="2" :fill="iconColor(n)" />
                <circle cx="20" cy="14" r="2" :fill="iconColor(n)" />
                <path d="M11 21c2 2 6 2 8 0" :stroke="iconColor(n)" />
              </svg>
            </span>
            <span class="text-xs text-[#6b6c7e] mt-1 min-h-[1.25rem] block">
              <template v-if="n === minValue">{{ startLabel }}</template>
              <template v-else-if="n === maxValue">{{ endLabel }}</template>
              <template v-else>&nbsp;</template>
            </span>
          </button>
        </div>
      </div>
    </div>
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
import { ref, computed } from "vue";
import { defineEmits } from "vue"; // Import defineEmits

const emit = defineEmits(["submitAnswerEvent"]); // Define the emit
const props = defineProps({
  fullscreen: {
    type: Boolean,
    required: false,
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
    default: 5,
  },
  startLabel: {
    type: String,
    default: "Muito insatisfeito",
  },
  endLabel: {
    type: String,
    default: "Muito satisfeito",
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
  const max = Number(props.maxValue) || 5;
  const arr = [];
  for (let i = min; i <= max; i++) arr.push(i);
  return arr;
});
const neutral = computed(() =>
  Math.round((props.maxValue + props.minValue) / 2)
);
const minNeutral = computed(() => neutral.value - 1);
function selectValue(n) {
  selectedValue.value = n;
}
function iconClass(n) {
  // Color style: insatisfeito = vermelho, neutro = amarelo, satisfeito = azul
  if (n === props.minValue) return "border-[#f87171] text-red-400";
  if (n === props.maxValue) return "border-[#60a5fa] text-blue-400";
  if (n === neutral.value) return "border-[#facc15] text-yellow-400";
  return n < neutral.value
    ? "border-[#fb7185] text-pink-400"
    : "border-[#818cf8] text-indigo-400";
}
// Função para cor dos ícones internos (carinhas)
function iconColor(n) {
  if (n === props.minValue) return "#f87171"; // vermelho
  if (n === props.maxValue) return "#60a5fa"; // azul
  if (n === neutral.value) return "#facc15"; // amarelo
  return n < neutral.value ? "#fb7185" : "#818cf8"; // rosa ou indigo
}
</script>
