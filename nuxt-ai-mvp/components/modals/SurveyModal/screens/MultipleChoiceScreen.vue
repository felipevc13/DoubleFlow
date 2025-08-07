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
            ? 'text-base text-[#6b6c7e] mb-4 whitespace-pre-line break-words px-8'
            : 'text-sm text-[#6b6c7e] mb-4 whitespace-pre-line break-words px-'
        "
        >{{ instructions }}</pre
      >
      <div
        :class="[
          fullscreen
            ? 'p-8 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-64px-220px)]'
            : 'p-4 flex flex-col gap-3 overflow-y-auto max-h-80',
        ]"
      >
        <div v-for="(option, idx) in options" :key="idx" class="w-full">
          <label
            class="w-full border border-[#ECECEE] rounded-lg py-3 px-4 text-left text-[#393b4a] font-medium transition-colors bg-white hover:bg-[#F0F4FF] focus:outline-none focus:ring-2 focus:ring-[#4d6bfe] flex items-center gap-3 cursor-pointer"
            :class="{
              'ring-2 ring-primary ring-offset-2':
                selectedIndexes.includes(idx),
            }"
          >
            <input
              v-if="allowMultiple"
              type="checkbox"
              class="checkbox checkbox-sm mr-2 border-[#b6c2ff] checked:bg-[#4C6BFE] checked:border-[#4d6bfe]"
              :checked="selectedIndexes.includes(idx)"
              @change="fullscreen && toggleOption(idx)"
              :disabled="!fullscreen"
            />
            <input
              v-else
              type="radio"
              name="multipleChoice"
              class="radio radio-sm radio-primary mr-2 checked:bg-[white]"
              :checked="selectedIndexes.includes(idx)"
              @change="fullscreen && toggleOption(idx)"
              :disabled="!fullscreen"
            />
            <span>{{ typeof option === "object" ? option.text : option }}</span>
          </label>
        </div>
        <button
          v-if="allowOther"
          class="w-full border border-[#ECECEE] rounded-lg py-3 px-4 text-left text-[#393b4a] font-medium transition-colors bg-white hover:bg-[#F0F4FF] focus:outline-none focus:ring-2 focus:ring-[#4d6bfe] flex items-center gap-3"
          :class="{ 'bg-[#4d6bfe]': otherSelected }"
          @click="fullscreen && toggleOther()"
          :disabled="!fullscreen"
        >
          <span
            class="w-5 h-5 mr-2 border-2 rounded flex items-center justify-center transition-colors"
            :class="
              otherSelected
                ? 'bg-[#4d6bfe] border-[#4d6bfe]'
                : 'bg-white border-[#bfc1cc]'
            "
          >
            <svg
              v-if="otherSelected"
              class="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              viewBox="0 0 20 20"
            >
              <path d="M5 10l4 4 6-6" />
            </svg>
          </span>
          <span>Outro</span>
        </button>
        <div v-if="allowOther && otherSelected" class="mt-2">
          <input
            type="text"
            class="w-full rounded-lg border border-[#ECECEE] bg-white text-base text-[#393b4a] focus:outline-none focus:ring-2 focus:ring-[#4d6bfe] shadow-sm px-4 py-2"
            placeholder="Digite sua resposta..."
            v-model="otherValue"
            :disabled="!fullscreen"
          />
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
          $emit('submitAnswerEvent', {
            questionId: props.questionId,
            value: null,
          })
        "
      >
        Pular esta pergunta
      </button>
      <button
        class="px-6 py-2 rounded-lg bg-[#4d6bfe] text-white font-semibold shadow-sm text-sm disabled:opacity-50"
        :disabled="
          !fullscreen || (selectedIndexes.length === 0 && !otherValue.trim())
        "
        @click="submitAnswer"
      >
        Avançar
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue"; // Import computed if not already there (it is used later)
import { defineEmits } from "vue"; // Import defineEmits

const emit = defineEmits(["submitAnswerEvent", "submitAnswerAndEnd"]); // Define the emit
const props = defineProps({
  fullscreen: {
    type: Boolean,
    required: true,
  },
  allowMultiple: {
    type: Boolean,
    default: true,
  },
  questionText: {
    type: String,
    default: "Escolha uma ou mais opções:",
  },
  instructions: {
    type: String,
    default: "",
  },
  options: {
    type: Array,
    default: () => ["Opção 1", "Opção 2", "Opção 3"],
  },
  isRequired: {
    type: Boolean,
    default: false,
  },
  allowOther: {
    type: Boolean,
    default: false,
  },
  questionId: {
    // Add questionId prop
    type: String,
    required: true,
  },
});
const selectedIndexes = ref([]);
const otherSelected = ref(false);
const otherValue = ref("");

// Method to calculate and emit the answer
function submitAnswer() {
  if (
    !props.fullscreen ||
    !(selectedIndexes.value.length > 0 || otherValue.value.trim())
  ) {
    return; // Don't submit if not fullscreen or no answer selected/entered
  }

  let calculatedValue = null; // Initialize with null

  const selectedOptions = selectedIndexes.value.map((index) => {
    const option = props.options[index];
    return typeof option === "object" ? option.value || option.text : option;
  });

  if (otherSelected.value && otherValue.value.trim()) {
    if (props.allowMultiple) {
      calculatedValue = [
        ...selectedOptions,
        `Other: ${otherValue.value.trim()}`,
      ];
    } else {
      calculatedValue = `Other: ${otherValue.value.trim()}`;
    }
  } else {
    if (props.allowMultiple) {
      calculatedValue = selectedOptions;
    } else {
      calculatedValue = selectedOptions.length > 0 ? selectedOptions[0] : null;
    }
  }

  // Verifica se ALGUMA das opções marcadas tem action === "end"
  const hasEndAction = selectedIndexes.value.some((idx) => {
    const opt = props.options[idx];
    return opt && typeof opt === "object" && opt.action === "end";
  });

  if (!otherSelected.value && hasEndAction) {
    emit("submitAnswerAndEnd", {
      questionId: props.questionId,
      value: calculatedValue,
    });
    return;
  }

  emit("submitAnswerEvent", {
    questionId: props.questionId,
    value: calculatedValue,
  });
}

function toggleOption(idx) {
  if (props.allowMultiple) {
    if (selectedIndexes.value.includes(idx)) {
      selectedIndexes.value = selectedIndexes.value.filter((i) => i !== idx);
    } else {
      selectedIndexes.value = [...selectedIndexes.value, idx];
    }
  } else {
    if (selectedIndexes.value.includes(idx)) {
      selectedIndexes.value = [];
    } else {
      selectedIndexes.value = [idx];
      // If single choice and an option is selected, deselect "Other"
      if (!props.allowMultiple) {
        otherSelected.value = false;
        otherValue.value = "";
      }
    }
  }
}
function toggleOther() {
  const wasSelected = otherSelected.value;
  otherSelected.value = !wasSelected;

  if (!otherSelected.value) {
    // If deselecting "Other", just clear its value
    otherValue.value = "";
  } else if (!props.allowMultiple) {
    // If selecting "Other" in single-choice mode, clear standard selections
    selectedIndexes.value = [];
  }
  // If selecting "Other" in multiple-choice mode, standard selections remain
}
</script>

<style scoped lang="postcss">
.block-btn {
  @apply rounded-lg px-6 py-2 font-semibold text-white bg-[#4d6bfe] shadow hover:bg-[#3a55d1] transition-colors;
}
.block-btn-disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
