<template>
  <div class="">
    <div>
      <label :for="`question-text-${uniqueId}`" class="block-label"
        >Texto da Pergunta</label
      >
      <textarea
        :id="`question-text-${uniqueId}`"
        rows="2"
        :value="editableConfigData.questionText"
        @input="handleInput"
        @blur="handleBlur"
        class="block-input"
        placeholder="Digite sua resposta..."
      ></textarea>
    </div>
    <!-- Required Toggle -->
    <div class="mt-8 mb-8">
      <label class="block-label mb-4">Extras</label>
      <div class="flex items-center space-x-4">
        <label
          :for="`required-toggle-${uniqueId}`"
          class="flex items-center cursor-pointer"
        >
          <!-- Basic Toggle Switch -->
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
    default: () => ({ questionText: "", isRequired: false }), // Removed placeholder, added isRequired
  },
});

const emit = defineEmits(["update:configData"]);

// Estado local para edição
const editableConfigData = ref({ ...props.configData });

const isEditingLocally = ref(false); // Flag to prevent watcher override

// Gerar um ID único para os labels/inputs dentro deste componente
const uniqueId = `opentext-${Math.random().toString(36).substring(2, 9)}`;

// Observa mudanças na prop para atualizar estado local
watch(
  () => props.configData,
  (newData) => {
    // Only update from prop if not currently editing locally
    if (!isEditingLocally.value) {
      if (
        JSON.stringify(newData) !== JSON.stringify(editableConfigData.value)
      ) {
        editableConfigData.value = { ...newData };
      }
    }
  },
  { deep: true }
);

// Atualiza o estado local e emite o objeto completo
const handleInput = ($event) => {
  isEditingLocally.value = true;
  editableConfigData.value.questionText = $event.target.value;
  // Do NOT emit here
};

const handleBlur = () => {
  updateConfig("questionText", editableConfigData.value.questionText);
  // Delay resetting the flag until the next DOM update cycle
  nextTick(() => {
    isEditingLocally.value = false;
  });
};

const updateConfig = (key, value) => {
  // This function now primarily emits the current state
  // The local state for the textarea is updated directly in handleInput
  const dataToEmit = {
    ...editableConfigData.value,
    [key]: value, // Ensure the latest value for the blurred/changed field is included
  };
  emit("update:configData", dataToEmit);
};
// Função dedicada para o toggle de 'Pergunta obrigatória'
const handleToggleRequired = (event) => {
  isEditingLocally.value = true;
  editableConfigData.value.isRequired = event.target.checked;
  updateConfig("isRequired", event.target.checked);
  nextTick(() => {
    isEditingLocally.value = false;
  });
};
</script>

<style scoped>
/* Estilos específicos para esta configuração, se necessário */
/* Importar estilos comuns para garantir que sejam aplicados */
@import "../blockStyles.css";

/* Basic Toggle Switch Styles */
input:checked ~ .dot {
  transform: translateX(100%);
  background-color: #d1d5db; /* Mantém cinza mesmo ativo */
}
input:checked ~ .block {
  background-color: #3a55d1; /* Darker theme color for checked background */
}
</style>
