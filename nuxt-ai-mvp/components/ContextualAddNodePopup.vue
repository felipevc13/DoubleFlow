<template>
  <div
    class="contextual-add-node-popup bg-[#232227] rounded-lg shadow-xl border border-[#2C2B30] text-white outline-none focus:outline focus:outline-2 focus:outline-white p-4 flex flex-col pb-6"
    tabindex="0"
    @keydown.esc="onEsc"
    ref="popup"
    style="width: 320px"
  >
    <!-- Header: Title and Close Button -->
    <div class="flex justify-between items-center mb-3 flex-shrink-0">
      <h3 class="font-semibold text-white">Conectar a...</h3>
      <button
        @click="$emit('close')"
        class="text-gray-400 hover:text-gray-200 p-1 rounded-full hover:bg-white/10"
        aria-label="Fechar"
      >
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>

    <div class="space-y-1.5 flex-grow">
      <div
        v-for="typeInfo in paginatedNodeTypes"
        :key="typeInfo.type"
        class="flex items-center p-3 bg-[#2C2B30] rounded-lg border border-[#393939] hover:bg-[#3A393F] hover:border-[#4D6BFE] transition-colors cursor-pointer"
        role="button"
        tabindex="0"
        @click="selectType(typeInfo.type)"
        @keydown.enter="selectType(typeInfo.type)"
      >
        <component
          v-if="typeInfo.icon"
          :is="typeInfo.icon"
          class="w-7 h-7 flex-shrink-0 mr-2"
        />
        <div class="flex-grow min-w-0">
          <span class="text-sm font-medium text-white block truncate">{{
            typeInfo.label
          }}</span>
        </div>
      </div>
      <div
        v-if="nodeTypes.length === 0"
        class="text-sm text-gray-400 p-3 text-center"
      >
        Nenhum nó compatível para conectar.
      </div>
    </div>

    <div
      v-if="totalPages > 1"
      class="flex items-center justify-center mt-4 gap-3 flex-shrink-0"
    >
      <button
        @click="prevPage"
        :disabled="currentPage === 0"
        class="rounded-full w-8 h-8 flex items-center justify-center transition disabled:opacity-30 bg-[#232227] hover:bg-[#393939] focus:outline-none"
        aria-label="Página anterior"
      >
        <ChevronLeftIcon
          class="w-5 h-5"
          :class="currentPage === 0 ? 'text-[#393939]' : 'text-[#ABB2BD]'"
        />
      </button>
      <div class="flex items-center gap-1">
        <button
          v-for="(dot, idx) in totalPages"
          :key="idx"
          @click="goToPage(idx)"
          class="w-2.5 h-2.5 rounded-full transition"
          :class="currentPage === idx ? 'bg-[#4D6BFE]' : 'bg-[#393939]'"
          aria-label="Ir para página"
        ></button>
      </div>
      <button
        @click="nextPage"
        :disabled="currentPage >= totalPages - 1"
        class="rounded-full w-8 h-8 flex items-center justify-center transition disabled:opacity-30 bg-[#232227] hover:bg-[#393939] focus:outline-none"
        aria-label="Próxima página"
      >
        <ChevronRightIcon
          class="w-5 h-5"
          :class="
            currentPage >= totalPages - 1 ? 'text-[#393939]' : 'text-[#ABB2BD]'
          "
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/vue/24/solid";
import { useUiStateStore } from "~/stores/uiState";
import { storeToRefs } from "pinia";

const props = defineProps<{
  nodeTypes: Array<{
    type: string;
    label: string;
    icon?: any;
    description?: string;
  }>;
}>();

const emit = defineEmits<{
  (e: "select-node-type", type: string): void;
  (e: "close"): void;
}>();

const popup = ref<HTMLElement | null>(null);

const uiStateStore = useUiStateStore();
const { closeContextualPopupsTrigger } = storeToRefs(uiStateStore);
watch(closeContextualPopupsTrigger, () => {
  emit("close");
});

function selectType(type: string) {
  emit("select-node-type", type);
  emit("close");
}

function handleClickOutside(e: MouseEvent) {
  if (popup.value && !popup.value.contains(e.target as Node)) {
    emit("close");
  }
}

function onEsc() {
  emit("close");
}

const itemsPerPage = ref(3);
const currentPage = ref(0);

const totalPages = computed(() => {
  if (!props.nodeTypes || props.nodeTypes.length === 0) return 1;
  return Math.ceil(props.nodeTypes.length / itemsPerPage.value);
});

const paginatedNodeTypes = computed(() => {
  if (!props.nodeTypes) return [];
  const start = currentPage.value * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return props.nodeTypes.slice(start, end);
});

function nextPage() {
  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++;
  }
}
function prevPage() {
  if (currentPage.value > 0) {
    currentPage.value--;
  }
}
function goToPage(idx: number) {
  currentPage.value = idx;
}
watch(
  () => props.nodeTypes,
  () => {
    currentPage.value = 0;
  }
);

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  if (popup.value) popup.value.focus();
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<style scoped>
.contextual-add-node-popup {
  display: flex;
  flex-direction: column;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Item da lista */
.vertical-node-list > div[role="button"] {
  /* Adiciona padding e outros estilos se necessário para melhorar a área de clique */
}
</style>
