<template>
  <div class="question-block block-base">
    <!-- Header Row -->
    <div
      class="flex justify-between items-center cursor-pointer block-title"
      @click.stop="handleHeaderClick"
    >
      <!-- Left side: Drag handle and Title -->
      <div class="flex items-center space-x-2 flex-shrink min-w-0 mr-2">
        <!-- Added flex-shrink, min-w-0, mr-2 -->
        <Drag class="drag-handle flex-shrink-0"></Drag>
        <h4 class="flex-shrink-0 truncate">
          Pergunta {{ props.questionIndex + 1 }}
        </h4>
        <!-- Added truncate -->
      </div>

      <!-- Right side: Controls -->
      <div class="flex items-center space-x-2 flex-shrink-0">
        <!-- Added flex-shrink-0 -->
        <!-- Delete Button -->
        <button
          @click.stop="handleDeleteClick"
          title="Deletar bloco"
          class="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-700"
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
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
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
    </div>

    <!-- Collapsed Question Text (Below Header) -->
    <div v-if="!isExpanded && localBlockData.questionText" class="mt-2">
      <p
        class="text-sm text-gray-400 truncate mt-2 ml-2"
        :title="localBlockData.questionText"
      >
        {{ localBlockData.questionText }}
      </p>
    </div>

    <!-- Expanded Content Area -->
    <div v-show="isExpanded" class="block-content space-y-4 mt-4">
      <!-- Question Type Selector -->
      <div>
        <label :for="`question-type-${id}`" class="block-label"
          >Tipo de Pergunta</label
        >
        <select
          :id="`question-type-${id}`"
          :value="localBlockType"
          @change="handleTypeChange($event.target.value)"
          class="block-input w-full mt-1 pr-12"
        >
          <option value="openText">Texto Aberto</option>
          <option value="multipleChoice">Múltipla Escolha</option>
          <option value="rating">Escala de satisfação</option>
          <option value="opinionScale">Escala de Opinião</option>
          <!-- Adicionar mais tipos aqui -->
        </select>
      </div>

      <!-- Dynamic Configuration Component -->
      <div class="config-area pt-4 mt-8">
        <component
          v-if="configComponent"
          :is="configComponent"
          :config-data="localBlockData"
          @update:config-data="handleConfigUpdate"
        />
        <div v-else class="text-gray-500 italic text-sm">
          Configuração para o tipo '{{ localBlockType }}' não implementada.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, shallowRef } from "vue";
import Drag from "~/components/icon/Drag.vue";

// --- Define Props ---
const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  blockType: {
    // Receber o tipo como prop separada
    type: String,
    required: true,
  },
  blockData: {
    // Receber apenas os dados de configuração
    type: Object,
    required: true,
    default: () => ({}),
  },
  questionIndex: {
    // Add questionIndex prop
    type: Number,
    required: true,
  },
  isOpen: {
    type: Boolean,
    default: undefined,
  },
  // isFirst, isLast, isFixed podem ser adicionados se necessários para lógica/estilo
});

// --- Define Emits ---
const emit = defineEmits([
  "update:blockType",
  "update:blockData",
  "deleteBlock",
]);

// --- Local State ---
// Refs locais para evitar mutação direta das props
const localBlockType = ref(props.blockType);
const localBlockData = ref({ ...props.blockData });

// --- Watchers to sync local state with props ---
watch(
  () => props.blockType,
  (newType) => {
    if (newType !== localBlockType.value) {
      localBlockType.value = newType;
      // Considerar resetar localBlockData ou ajustar baseado no novo tipo?
      // Por agora, apenas atualiza o tipo local.
    }
  }
);
watch(
  () => props.blockData,
  (newData) => {
    // Usar JSON stringify para uma comparação profunda mais robusta
    if (JSON.stringify(newData) !== JSON.stringify(localBlockData.value)) {
      localBlockData.value = { ...newData };
    }
  },
  { deep: true } // Restore deep watcher
);

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

onMounted(() => {});

// --- Import default configs
import { opinionScaleDefault } from "./config/questionDefaults.js";
// --- Configuration Sub-Component Mapping ---
// (Importar componentes de configuração)
const OpenTextConfig = shallowRef(null);
const MultipleChoiceConfig = shallowRef(null);
const OpinionScaleConfig = shallowRef(null);
const SatisfactionScaleConfig = shallowRef(null);
// const RatingConfig = shallowRef(null); // Commented out - File doesn't exist yet

import("./config/OpenTextConfig.vue").then(
  (module) => (OpenTextConfig.value = module.default)
);
import("./config/MultipleChoiceConfig.vue").then(
  (module) => (MultipleChoiceConfig.value = module.default)
);
import("./config/OpinionScaleConfig.vue").then(
  (module) => (OpinionScaleConfig.value = module.default)
);

import("./config/SatisfactionScaleConfig.vue").then(
  (module) => (SatisfactionScaleConfig.value = module.default)
);
// import('./config/RatingConfig.vue').then(module => RatingConfig.value = module.default); // Commented out

const configComponentMap = {
  openText: OpenTextConfig,
  multipleChoice: MultipleChoiceConfig,
  opinionScale: OpinionScaleConfig,
  rating: SatisfactionScaleConfig,
  // Adicionar outros aqui
};

const configComponent = computed(() => {
  const type = localBlockType.value;
  const componentRef = configComponentMap[type];
  const resolvedComponent = componentRef ? componentRef.value : null;
  return resolvedComponent;
});

// --- Computed Title (Removed - Now using index) ---

// --- Event Handlers ---

// Chamado quando o dropdown de tipo muda
const handleTypeChange = (newType) => {
  if (newType !== localBlockType.value) {
    // Gere os dados default do novo tipo
    let defaultConfig = {};
    if (newType === "openText" && OpenTextConfig.value?.default) {
      defaultConfig = OpenTextConfig.value.default();
    } else if (
      newType === "multipleChoice" &&
      MultipleChoiceConfig.value?.default
    ) {
      defaultConfig = MultipleChoiceConfig.value.default();
    } else if (newType === "opinionScale" && opinionScaleDefault) {
      defaultConfig = opinionScaleDefault();
    }
    // Se for satisfactionScale ou rating, envie scaleLabels também
    if (
      newType === "satisfactionScale" ||
      newType === "rating" ||
      newType === "opinionScale"
    ) {
      emit("update:block-data", {
        ...defaultConfig,
        type: newType,
        scaleLabels: [
          defaultConfig.startLabel || "Discordo totalmente",
          defaultConfig.endLabel || "Concordo totalmente",
        ],
      });
    } else {
      emit("update:block-data", { ...defaultConfig, type: newType });
    }
  }
};

// Chamado quando o subcomponente de configuração emite uma atualização
const handleConfigUpdate = (newConfigData) => {
  let dataToEmit = { ...newConfigData };
  if (
    localBlockType.value === "satisfactionScale" ||
    localBlockType.value === "rating" ||
    localBlockType.value === "opinionScale"
  ) {
    dataToEmit.scaleLabels = [
      newConfigData.startLabel || "Discordo totalmente",
      newConfigData.endLabel || "Concordo totalmente",
    ];
  }
  localBlockData.value = dataToEmit;
  // Emitir a atualização dos dados para o SurveyBuilder
  emit("update:blockData", dataToEmit);
};

// Função para emitir delete
const handleDeleteClick = () => {
  emit("deleteBlock", props.id);
};
</script>

<style scoped>
/* Reutilizando estilos comuns */
@import "./blockStyles.css";
</style>
