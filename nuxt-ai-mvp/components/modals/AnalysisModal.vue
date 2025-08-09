<template>
  <BaseModal
    :is-open="isOpen"
    size="viewport-fill"
    @close="closeModal"
    hide-default-header
    hide-default-footer
    :is-loading="isModalLoading"
    content-wrapper-class="flex flex-col h-full"
  >
    <template #header>
      <div class="flex items-center justify-between px-6 py-4">
        <!-- Grupo Esquerda: Título + Abas (igual Survey) -->
        <div class="flex items-center gap-10">
          <!-- Título Fixo -->
          <div class="flex items-center gap-2">
            <AiIcon class="w-5 h-5" />
            <span class="text-base font-semibold text-white">Análise</span>
          </div>
          <!-- Abas (Tabs) -->
          <div class="flex items-center rounded">
            <button
              @click="activeTab = 'table'"
              :class="{
                'text-[#E7E9EA] font-bold': activeTab === 'table',
                'text-[#71767B] hover:text-[#E7E9EA]': activeTab !== 'table',
              }"
              class="relative px-4 py-2 text-sm bg-transparent focus:outline-none"
            >
              Análise Detalhada
              <span
                v-if="activeTab === 'table'"
                class="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#4D6BFE] rounded-full"
              ></span>
            </button>
          </div>
        </div>
        <!-- Direita: Ação + Fechar (estilo Survey) -->
        <div class="flex items-center gap-8">
          <button
            @click="generateReport"
            class="px-3 py-1 border border-white rounded-md text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Gerar Relatório
          </button>
          <button
            @click="closeModal"
            class="text-[#F8FAFC] hover:text-gray-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </template>

    <div class="flex-1 p-6 bg-base-200 overflow-auto">
      <div
        v-if="
          !analyzedData ||
          !analyzedData.insights ||
          analyzedData.insights.length === 0
        "
        class="text-center text-gray-400"
      >
        Nenhuma análise encontrada ou dados insuficientes.
        <span class="block text-xs opacity-60 mt-1"
          >(AnalysisModal: empty-state reached)</span
        >
      </div>
      <div v-else>
        <div
          class="card bg-base-100 shadow rounded-lg border border-[#e5e7eb] dark:border-[#2a2a2a]"
        >
          <div class="card-body p-4 md:p-6">
            <div v-if="activeTab === 'table'" class="h-full">
              <AnalysisDataTable
                :data="tableRows"
                :columns="tableColumns"
                :page-size="15"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, h, watch } from "vue";
import { createColumnHelper } from "@tanstack/vue-table";
import { useTaskFlowStore } from "~/stores/taskFlow";
import BaseModal from "./BaseModal.vue";
import AiIcon from "../icon/AiIcon.vue";
import AnalysisDataTable from "../common/AnalysisDataTable.vue";

// --- Normalizers to tolerate multiple backend shapes ---
function coalesce<T>(...vals: (T | undefined | null)[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null) return v as T;
}

function normalizeAnalyzedData(nodeData: any): { insights: any[] } {
  if (!nodeData) return { insights: [] };
  const d = nodeData;
  const raw =
    coalesce<any[]>(
      // Direct arrays
      Array.isArray(d) ? d : undefined,

      // Flat
      d?.insights,

      // Common top-level objects
      d?.analyzedData?.insights,
      d?.analyzed?.insights,
      d?.analysisResults?.insights,
      d?.analysis?.results?.insights,
      d?.analysis?.insights,

      // Nested under data
      d?.data?.insights,
      d?.data?.analyzedData?.insights,
      d?.data?.analysis?.insights,
      d?.data?.analysis?.results?.insights,

      // Output-style
      d?.outputData?.insights,
      d?.outputData?.analysis?.insights,
      d?.outputData?.analysis?.results?.insights,
      d?.output?.insights,
      d?.output?.analysis?.insights,

      // Result-style
      d?.result?.insights,
      d?.results?.insights,

      // Generic items arrays sometimes used
      d?.items,
      d?.data?.items,
      d?.outputData?.items
    ) || [];

  return { insights: Array.isArray(raw) ? raw : [] };
}

function mapInsightToRow(x: any) {
  // Quote / content
  const quote =
    coalesce<string>(x?.quote, x?.text, x?.content, x?.message, x?.raw) || "";
  // Topic / cluster
  const topic =
    coalesce<string>(x?.topic, x?.cluster, x?.tag, x?.category, x?.label) ||
    "—";
  // Sentiment
  const sentiment =
    coalesce<string>(x?.sentiment, x?.polarity, x?.feeling) || "—";
  // User need / JTBD
  const userNeed =
    coalesce<string>(x?.user_need, x?.need, x?.jtbd, x?.jobToBeDone) || "—";
  return { quote, topic, sentiment, user_need: userNeed };
}

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  nodeData: {
    type: Object,
    default: () => ({ analyzedData: { insights: [] } }),
  },
  nodeId: { type: String, required: true },
});

import { useModalStore, ModalType } from "~/stores/modal";
const modalStore = useModalStore();
const openAnalysisModal = () => {
  modalStore.openModal(
    ModalType.analysis,
    { nodeId: props.nodeId },
    props.nodeId
  );
};

const emit = defineEmits(["close"]);
const isModalLoading = ref(false);
const closeModal = () => emit("close");

const taskFlowStore = useTaskFlowStore();
const activeTab = ref<"table">("table");

const analyzedData = computed(() => normalizeAnalyzedData(props.nodeData));
const tableRows = computed(() =>
  analyzedData.value.insights.map(mapInsightToRow)
);

watch(
  () => analyzedData.value.insights,
  (val) => {
    if (!val || val.length === 0) {
      console.log(
        "[AnalysisModal] Insights vazios. nodeData keys:",
        Object.keys(props.nodeData || {})
      );
      console.log("[AnalysisModal] Exemplo de nodeData:", props.nodeData);
    }
  },
  { immediate: true }
);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      console.log("[AnalysisModal] Opened for node:", props.nodeId);
      console.log("[AnalysisModal] nodeData on open:", props.nodeData);
    }
  },
  { immediate: true }
);

watch(
  () => props.nodeData,
  (val) => {
    console.log(
      "[AnalysisModal] nodeData changed. keys:",
      Object.keys(val || {})
    );
  },
  { deep: true }
);

const columnHelper = createColumnHelper<any>();
const tableColumns = [
  columnHelper.accessor("quote", {
    header: "Citação / Feedback",
    cell: (info: any) => h("span", { innerHTML: info.getValue() }),
  }),
  columnHelper.accessor("topic", {
    header: "Tópico",
    cell: (info: any) => info.getValue() || "—",
  }),
  columnHelper.accessor("sentiment", {
    header: "Sentimento",
    cell: (info: any) => info.getValue() || "—",
  }),
  columnHelper.accessor("user_need", {
    header: "Necessidade do Usuário",
    cell: (info: any) => info.getValue() || "—",
  }),
];

const generateReport = () => {
  taskFlowStore.requestNodeReprocessing(props.nodeId);
  emit("close");
};
</script>

<style scoped></style>
