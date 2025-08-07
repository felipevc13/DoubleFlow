<template>
  <div class="">
    <!-- Texto da Pergunta -->
    <div>
      <label :for="`question-text-${uniqueId}`" class="block-label mb-1"
        >Texto da Pergunta</label
      >
      <textarea
        :id="`question-text-${uniqueId}`"
        rows="2"
        :value="editableConfigData.questionText"
        @input="handleInput"
        @blur="handleBlur"
        class="block-input"
        placeholder="Digite sua pergunta..."
      ></textarea>
    </div>

    <!-- Opções de Resposta -->
    <div class="mt-8">
      <label class="block-label mb-2">Opções</label>
      <div class="space-y-2">
        <div
          v-for="(option, idx) in editableConfigData.options"
          :key="option.id"
          class="flex items-center space-x-4"
        >
          <input
            type="text"
            class="block-input flex-1"
            :value="option.text"
            @input="handleOptionInput(idx, $event.target.value)"
            @blur="handleOptionBlur(idx, $event.target.value)"
            :placeholder="`Opção ${idx + 1}`"
          />
          <label
            class="flex items-center gap-1 text-xs text-gray-400 select-none ml-2"
          >
            <input
              type="checkbox"
              :checked="option.action === 'end'"
              @change="handleOptionActionCheckbox(idx, $event.target.checked)"
            />
            Finalizar pesquisa
          </label>
          <template v-if="idx > 1">
            <button
              class="text-red-500 hover:text-red-700 p-1 rounded"
              @click.prevent="removeOption(idx)"
              title="Remover opção"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </template>
        </div>
      </div>
      <button
        class="text-[#4E6AF6] font-regular text-sm hover:underline focus:outline-none mt-4"
        @click.prevent="addOption"
        :disabled="editableConfigData.options.length >= 8"
      >
        + Adicionar opção
      </button>
    </div>

    <!-- Sessão Extras -->
    <div class="mt-8 mb-8">
      <label class="block-label mb-4">Extras</label>
      <!-- Permitir múltiplas respostas (Toggle) -->
      <div class="flex items-center space-x-4 mb-4">
        <label
          :for="`multiple-toggle-${uniqueId}`"
          class="flex items-center cursor-pointer"
        >
          <div class="relative">
            <input
              type="checkbox"
              :id="`multiple-toggle-${uniqueId}`"
              class="sr-only"
              :checked="editableConfigData.allowMultiple"
              @change="handleToggleMultiple"
            />
            <div class="block bg-gray-600 w-10 h-6 rounded-full"></div>
            <div
              class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition"
            ></div>
          </div>
          <span class="ml-2 text-sm text-gray-300"
            >Permitir múltiplas respostas</span
          >
        </label>
      </div>
      <!-- Adicionar outros (Toggle) -->
      <div class="flex items-center space-x-4 mb-4">
        <label
          :for="`other-toggle-${uniqueId}`"
          class="flex items-center cursor-pointer"
        >
          <div class="relative">
            <input
              type="checkbox"
              :id="`other-toggle-${uniqueId}`"
              class="sr-only"
              :checked="editableConfigData.allowOther"
              @change="handleToggleOther"
            />
            <div class="block bg-gray-600 w-10 h-6 rounded-full"></div>
            <div
              class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition"
            ></div>
          </div>
          <span class="ml-2 text-sm text-gray-300">Adicionar outros</span>
        </label>
      </div>
      <!-- Required Toggle -->
      <div class="flex items-center space-x-4">
        <label
          :for="`required-toggle-${uniqueId}`"
          class="flex items-center cursor-pointer"
        >
          <div class="relative">
            <input
              type="checkbox"
              :id="`required-toggle-${uniqueId}`"
              class="sr-only"
              :checked="editableConfigData.isRequired"
              @change="handleToggleRequired"
            />
            <div class="block bg-gray-600 w-10 h-6 rounded-full"></div>
            <div
              class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition"
            ></div>
          </div>
          <span class="ml-2 text-sm font-medium text-gray-300"
            >Pergunta obrigatória</span
          >
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  configData: {
    type: Object,
    required: true,
    default: () => ({
      questionText: "",
      options: [],
      allowMultiple: false,
      allowOther: false,
      isRequired: false,
    }),
  },
});

const emit = defineEmits(["update:configData"]);

const editableConfigData = ref({
  questionText: props.configData.questionText || "",
  options: props.configData.options?.length
    ? [...props.configData.options]
    : [
        {
          id: `opt-${Math.random().toString(36).slice(2, 9)}`,
          text: "",
          action: "continue",
        },
        {
          id: `opt-${Math.random().toString(36).slice(2, 9)}`,
          text: "",
          action: "continue",
        },
      ],
  allowMultiple: !!props.configData.allowMultiple,
  allowOther: !!props.configData.allowOther,
  isRequired: !!props.configData.isRequired,
});

const isEditingLocally = ref(false);
const uniqueId = `multiplechoice-${Math.random().toString(36).substring(2, 9)}`;

watch(
  () => props.configData,
  (newData) => {
    if (!isEditingLocally.value) {
      // Restore the check
      if (
        JSON.stringify(newData) !== JSON.stringify(editableConfigData.value)
      ) {
        // Normalize incoming options data
        const normalizedOptions = (newData.options || [])
          .map((opt) => {
            if (typeof opt === "string") {
              // If it's just a string, convert it to the expected object format
              return {
                id: `opt-${Math.random().toString(36).slice(2, 9)}`,
                text: opt,
                action: "continue",
              };
            } else if (typeof opt === "object" && opt !== null) {
              // If it's an object, ensure it has id and text. Handle potentially corrupted objects like the one in the log.
              const text = typeof opt.text === "string" ? opt.text : ""; // Use text property if it's a string, otherwise empty string
              const id =
                typeof opt.id === "string"
                  ? opt.id
                  : `opt-${Math.random().toString(36).slice(2, 9)}`; // Ensure ID exists or generate one
              return { id, text, action: opt.action || "continue" };
            }
            // Ignore invalid entries (e.g., null, numbers) or return a default empty option structure
            return {
              id: `opt-${Math.random().toString(36).slice(2, 9)}`,
              text: "",
              action: "continue",
            };
          })
          .filter((opt) => typeof opt.text === "string"); // Filter out any completely invalid entries

        // Ensure at least two options exist if normalized array is too short
        while (normalizedOptions.length < 2) {
          normalizedOptions.push({
            id: `opt-${Math.random().toString(36).slice(2, 9)}`,
            text: "",
            action: "continue",
          });
        }

        editableConfigData.value = {
          questionText: newData.questionText || "",
          // Use the normalized options
          options: normalizedOptions,
          allowMultiple: !!newData.allowMultiple,
          allowOther: !!newData.allowOther,
          isRequired: !!newData.isRequired,
        };
      }
    }
  },
  { deep: true }
);

// Atualiza o estado local do campo pergunta mas NÃO emite
const handleInput = ($event) => {
  isEditingLocally.value = true;
  editableConfigData.value.questionText = $event.target.value;
};

// Emite o dado ao perder o foco
const handleBlur = () => {
  updateConfig("questionText", editableConfigData.value.questionText);
  nextTick(() => {
    isEditingLocally.value = false;
  });
};

function updateConfig(key, value) {
  // Atualiza e emite
  editableConfigData.value = {
    ...editableConfigData.value,
    [key]: value,
  };
  emit("update:configData", { ...editableConfigData.value });
}

// Função dedicada para o toggle de múltiplas respostas
function handleToggleMultiple(event) {
  isEditingLocally.value = true;
  editableConfigData.value.allowMultiple = event.target.checked;
  updateConfig("allowMultiple", event.target.checked);
  nextTick(() => {
    isEditingLocally.value = false;
  });
}
// Função dedicada para o toggle de "Adicionar outros"
function handleToggleOther(event) {
  isEditingLocally.value = true;
  editableConfigData.value.allowOther = event.target.checked;
  updateConfig("allowOther", event.target.checked);
  nextTick(() => {
    isEditingLocally.value = false;
  });
}
// Função dedicada para o toggle de obrigatoriedade
function handleToggleRequired(event) {
  isEditingLocally.value = true;
  editableConfigData.value.isRequired = event.target.checked;
  updateConfig("isRequired", event.target.checked);
  nextTick(() => {
    isEditingLocally.value = false;
  });
}

function handleOptionInput(idx, value) {
  isEditingLocally.value = true;
  // Atualiza apenas localmente, não emite
  const options = editableConfigData.value.options.map((opt, i) =>
    i === idx ? { ...opt, text: value } : opt
  );
  editableConfigData.value.options = options;
}

function handleOptionBlur(idx, value) {
  // Só emite no blur
  updateConfig("options", editableConfigData.value.options);
  nextTick(() => {
    isEditingLocally.value = false;
  });
}

function handleOptionActionCheckbox(idx, checked) {
  isEditingLocally.value = true;
  const options = editableConfigData.value.options.map((opt, i) =>
    i === idx ? { ...opt, action: checked ? "end" : "continue" } : opt
  );
  updateConfig("options", options);
  nextTick(() => {
    isEditingLocally.value = false;
  });
}

function addOption() {
  if (editableConfigData.value.options.length < 8) {
    const options = [
      ...editableConfigData.value.options,
      {
        id: `opt-${Math.random().toString(36).slice(2, 9)}`,
        text: "",
        action: "continue",
      },
    ];
    updateConfig("options", options);
  }
}

function removeOption(idx) {
  if (editableConfigData.value.options.length > 2) {
    const options = editableConfigData.value.options.filter(
      (_, i) => i !== idx
    );
    updateConfig("options", options);
  }
}
</script>

<style scoped>
@import "../blockStyles.css";
input:checked ~ .dot {
  transform: translateX(100%);
  background-color: #d1d5db;
}
input:checked ~ .block {
  background-color: #3a55d1;
}
</style>
