<template>
  <div class="p-6">
    <div
      class="block-header flex items-center justify-between cursor-pointer"
      @click.stop="handleHeaderClick"
    >
      <h4 class="text-[15px] font-normal">Tela de Agradecimento</h4>
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
    <div v-show="isExpanded" class="block-content space-y-3">
      <div>
        <label class="block-label">Título</label>
        <input
          type="text"
          :value="editableData.title"
          @input="editableData.title = $event.target.value"
          @blur="emitUpdate('title')"
          class="block-input"
        />
      </div>
      <div>
        <label class="block-label">Descrição</label>
        <textarea
          rows="3"
          :value="editableData.description"
          @input="editableData.description = $event.target.value"
          @blur="emitUpdate('description')"
          class="block-input"
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
// Busca os dados em blockData.extra, igual ao bloco intro
const editableData = ref({ ...(props.blockData.extra || {}) });

watch(
  () => props.blockData.extra,
  (newExtra) => {
    editableData.value = { ...(newExtra || {}) };
  },
  { deep: true }
);

const emitUpdate = () => {
  emit("update:blockData", { ...editableData.value });
};
</script>

<style scoped>
/* Reutilizando estilos do IntroScreenBlock via classe comum */
@import "./blockStyles.css";
</style>
