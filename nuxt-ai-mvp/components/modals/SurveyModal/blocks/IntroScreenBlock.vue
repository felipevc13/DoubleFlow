<template>
  <div class="p-6 border-b border-[#343434] mb-4">
    <div
      class="block-header flex items-center justify-between cursor-pointer"
      @click.stop="handleHeaderClick"
    >
      <h4 class="text-[15px] font-normal">Tela de Introdução</h4>
      <!-- Ícone de Chevron -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-gray-400 transition-transform duration-200 ease-in-out"
        :class="{ 'rotate-180': isExpanded }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
    <!-- Conteúdo colapsível -->
    <div v-show="isExpanded" class="block-content space-y-3">
      <div>
        <label for="intro-title" class="block-label">Título</label>
        <input
          type="text"
          id="intro-title"
          :value="editableData.title"
          @input="editableData.title = $event.target.value"
          @blur="emitUpdate('title')"
          class="block-input"
          placeholder="Ex: Bem-vindo à nossa pesquisa!"
        />
      </div>
      <div>
        <label for="intro-description" class="block-label">Descrição</label>
        <textarea
          id="intro-description"
          rows="3"
          :value="editableData.description"
          @input="editableData.description = $event.target.value"
          @blur="emitUpdate('description')"
          class="block-input"
          placeholder="Explique o objetivo da pesquisa e agradeça a participação."
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  blockData: {
    type: Object,
    required: true,
    default: () => ({
      title: "",
      description: "",
    }),
  },
  isOpen: {
    type: Boolean,
    default: undefined, // Se não for passado, controle local
  },
});

const emit = defineEmits(["update:blockData", "open-block"]);

// Estado para controlar se o bloco está expandido
const isExpanded = ref(false);

watch(
  () => props.isOpen,
  (newVal) => {
    if (typeof newVal === "boolean") {
      isExpanded.value = newVal;
    }
  },
  { immediate: true }
);

function handleHeaderClick() {
  if (typeof props.isOpen === "boolean") {
    emit("open-block");
  } else {
    isExpanded.value = !isExpanded.value;
  }
}

// Initialize with defaults if keys are missing in extra
const editableData = ref({
  title: props.blockData.extra?.title || "", // Default to empty string
  description: props.blockData.extra?.description || "", // Default to empty string
  buttonText: props.blockData.extra?.buttonText || "", // Add defaults for others too
  showButton: props.blockData.extra?.showButton || false,
});

watch(
  () => props.blockData.extra,
  (newExtra) => {
    // Ensure newExtra is treated as an object even if null/undefined
    const safeExtra = newExtra || {};

    // Update with defaults if keys are missing
    editableData.value = {
      title: safeExtra.title || "",
      description: safeExtra.description || "",
      buttonText: safeExtra.buttonText || "",
      showButton: safeExtra.showButton || false,
    };
  },
  { deep: true }
);

const emitUpdate = () => {
  emit("update:blockData", { ...editableData.value });
};
</script>

<style scoped>
/* Importa estilos comuns */
@import "./blockStyles.css";

/* Estilos específicos para IntroScreenBlock, se houver */
</style>
