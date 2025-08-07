<template>
  <div>
    <!-- Texto da Pergunta -->
    <div>
      <label :for="`question-text-${uniqueId}`" class="block-label mb-1"
        >Texto da Pergunta</label
      >
      <textarea
        :id="`question-text-${uniqueId}`"
        rows="2"
        :value="editableConfigData.questionText"
        @input="handleInput('questionText', $event.target.value)"
        @blur="handleBlur('questionText')"
        class="block-input"
        placeholder="Digite sua pergunta..."
      ></textarea>
    </div>

    <!-- Configuração da Escala -->
    <div class="mt-8">
      <div class="flex flex-col gap-4">
        <!-- Linha Início -->
        <div class="flex items-center gap-3">
          <div>
            <label class="block-label mb-1">Início da escala</label>
            <select
              class="block-input w-20"
              :value="editableConfigData.minValue"
              @change="
                handleInput('minValue', parseInt($event.target.value));
                handleBlur('minValue');
              "
            >
              <option
                v-for="n in 10"
                :key="n"
                :value="n"
                :disabled="n >= editableConfigData.maxValue"
              >
                {{ n }}
              </option>
            </select>
          </div>
          <div class="flex-1 ml-2 flex flex-col">
            <label class="text-xs text-gray-400 opacity-0 mb-1">Legenda</label>
            <input
              type="text"
              class="block-input"
              :value="editableConfigData.startLabel"
              @input="handleInput('startLabel', $event.target.value)"
              @blur="handleBlur('startLabel')"
              placeholder="Ex: Discordo totalmente"
            />
          </div>
        </div>
        <!-- Linha Fim -->
        <div class="flex items-center gap-3">
          <div>
            <label class="block-label mb-1">Fim da escala</label>
            <select
              class="block-input w-20"
              :value="editableConfigData.maxValue"
              @change="
                handleInput('maxValue', parseInt($event.target.value));
                handleBlur('maxValue');
              "
            >
              <option
                v-for="n in 10"
                :key="n"
                :value="n"
                :disabled="n <= editableConfigData.minValue"
              >
                {{ n }}
              </option>
            </select>
          </div>
          <div class="flex-1 ml-2 flex flex-col">
            <label class="text-xs text-gray-400 opacity-0 mb-1">Legenda</label>
            <input
              type="text"
              class="block-input"
              :value="editableConfigData.endLabel"
              @input="handleInput('endLabel', $event.target.value)"
              @blur="handleBlur('endLabel')"
              placeholder="Ex: Concordo totalmente"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Sessão Extras -->
    <div class="mt-8 mb-8">
      <label class="block-label mb-4">Extras</label>
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
// Configuração padrão para escala de opinião
function opinionScaleDefault() {
  return {
    questionText: "",
    minValue: 1,
    maxValue: 5,
    startLabel: "Discordo totalmente",
    endLabel: "Concordo totalmente",
    isRequired: false,
  };
}

import { ref, watch } from "vue";

const props = defineProps({
  configData: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:configData"]);

const editableConfigData = ref({
  questionText: props.configData.questionText || "",
  minValue: props.configData.minValue ?? 1,
  maxValue: props.configData.maxValue ?? 5,
  startLabel: props.configData.startLabel || "Discordo totalmente",
  endLabel: props.configData.endLabel || "Concordo totalmente",
  isRequired: !!props.configData.isRequired,
});

const isEditingLocally = ref(false);

const uniqueId = `opinionscale-${Math.random().toString(36).substring(2, 9)}`;

watch(
  () => props.configData,
  (newData) => {
    if (!isEditingLocally.value) {
      if (
        JSON.stringify(newData) !== JSON.stringify(editableConfigData.value)
      ) {
        editableConfigData.value = {
          questionText: newData.questionText || "",
          minValue: newData.minValue ?? 1,
          maxValue: newData.maxValue ?? 5,
          startLabel: newData.startLabel || "Discordo totalmente",
          endLabel: newData.endLabel || "Concordo totalmente",
          isRequired: !!newData.isRequired,
        };
      }
    }
  },
  { deep: true }
);

function handleInput(key, value) {
  isEditingLocally.value = true;
  editableConfigData.value[key] = value;
}

function handleBlur(key) {
  updateConfig(key, editableConfigData.value[key]);
  nextTick(() => {
    isEditingLocally.value = false;
  });
}

function handleToggleRequired(event) {
  isEditingLocally.value = true;
  editableConfigData.value.isRequired = event.target.checked;
  updateConfig("isRequired", event.target.checked);
  nextTick(() => {
    isEditingLocally.value = false;
  });
}

function updateConfig(key, value) {
  editableConfigData.value = {
    ...editableConfigData.value,
    [key]: value,
  };
  emit("update:configData", { ...editableConfigData.value });
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
