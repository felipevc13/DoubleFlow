<template>
  <!-- Use BaseSidebar for consistent structure and background -->
  <BaseSidebar :is-open="isOpen">
    <div class="flex flex-col h-full text-white">
      <!-- Header -->
      <div
        class="flex items-center justify-between p-4 border-b border-[#2C2B30] h-[74px]"
      >
        <h2 class="text-lg font-medium">Qual ação você quer fazer?</h2>
        <button @click="closeSidebar" class="text-gray-400 hover:text-white">
          <!-- Use static CloseIcon -->
          <OpenRight class="w-5 h-5" />
        </button>
      </div>

      <!-- Search Bar -->
      <div class="p-4 border-b border-[#2C2B30]">
        <div class="relative">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Busque a ação"
            class="w-full h-[38px] bg-white/[0.03] border border-[#47464B] rounded-md text-sm px-3 py-2 pl-10 text-white focus:outline-none focus:border-[#4D6BFE]"
          />
          <div
            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
          >
            <!-- Placeholder Search Icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-5 h-5 text-gray-400"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Accordion Section -->
        <div class="mb-4">
          <!-- Accordion Header -->
          <button
            @click="toggleDiscover"
            class="flex items-center justify-between w-full py-2 text-left"
          >
            <h3 class="text-sm font-medium text-[#9A9A9C]">Descobrir</h3>
            <!-- Placeholder Chevron Icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-180': !isDiscoverOpen }"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
          <!-- Accordion Content -->
          <div v-show="isDiscoverOpen" class="mt-2 space-y-2">
            <ActionListItem
              v-for="opt in filteredNodeOptions"
              :key="opt.key"
              :data-testid="'sidebar-node-option'"
              :title="opt.title"
              :description="opt.description"
              @click="addSelectedNode(opt.key)"
            >
              <template #icon>
                <component
                  :is="opt.icon"
                  class="w-8 h-8 text-[#9A9A9C] group-hover:text-white"
                />
              </template>
            </ActionListItem>
          </div>
        </div>
        <!-- Add other accordion sections here -->
      </div>

      <!-- Footer (Optional - Not shown in image, can add later if needed) -->
      <!-- <div class="p-4 border-t border-[#2C2B30]">
        Footer content
      </div> -->
    </div>
  </BaseSidebar>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useVueFlow } from "@vue-flow/core";
import { useSidebarStore } from "~/stores/sidebar";
import { useTaskFlowStore } from "~/stores/taskFlow";
import BaseSidebar from "./BaseSidebar.vue";
import ActionListItem from "./ActionListItem.vue";
// Use static import for CloseIcon
import CloseIcon from "../icon/CloseIcon.vue";
import OpenRight from "../icon/OpenRight.vue";
import DataIcon from "../icon/DataIcon.vue";
import SurveyIcon from "../icon/SurveyIcon.vue";
import AnalysisIcon from "../icon/AnalysisIcon.vue";

const sidebarStore = useSidebarStore();
const taskFlowStore = useTaskFlowStore();

const { addEdges } = useVueFlow("task-flow"); // id used in <VueFlow :id="flowId"/>

const isOpen = computed(() => sidebarStore.isSidebarOpen("addNode"));

watch(isOpen, (newVal) => {});

const isDiscoverOpen = ref(true); // Accordion starts open

const closeSidebar = () => {
  sidebarStore.closeSidebar("addNode");
};

const toggleDiscover = () => {
  isDiscoverOpen.value = !isDiscoverOpen.value;
};

const addSelectedNode = async (nodeType) => {
  const sourceContext = sidebarStore.getSidebarNode("addNode");
  const sourceNode = sourceContext?.node || null;
  const sourceHeight = sourceContext?.height || null;

  const sourceNodeId = sourceNode?.id || null;
  const sourceNodePosition = sourceNode?.position || null;

  const sidebarDataPayload = sidebarStore.getSidebarData("addNode");
  const targetFlowX = sidebarDataPayload?.targetFlowX;
  const targetFlowY = sidebarDataPayload?.targetFlowY;

  try {
    await taskFlowStore.addNodeAndConnect(
      nodeType,
      sourceNodeId,
      sourceNodePosition,
      sourceHeight,
      targetFlowX,
      targetFlowY
    );
  } catch (error) {
    console.error("[AddNodeSidebar] Error calling addNodeAndConnect:", error);
  }

  closeSidebar();
};

const searchTerm = ref("");

const allNodeOptions = [
  {
    key: "dataSource",
    title: "Adicione dados ao projeto",
    description: "Crie ou adicione fontes de dados para o projeto",
    icon: DataIcon,
  },
  {
    key: "survey",
    title: "Crie um survey",
    description: "Adicione perguntas e colete respostas",
    icon: SurveyIcon,
  },
  {
    key: "analysis",
    title: "Análise Unificada",
    description:
      "Visualize e analise dados de múltiplas fontes em um único painel",
    icon: AnalysisIcon,
  },
];

const filteredNodeOptions = computed(() => {
  if (!searchTerm.value) return allNodeOptions;
  const term = searchTerm.value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return allNodeOptions.filter((opt) =>
    (opt.title + " " + opt.description)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes(term)
  );
});
</script>

<style scoped>
/* Styles specific to AddNodeSidebar if BaseSidebar/ActionListItem don't cover everything */
.rotate-180 {
  transform: rotate(180deg);
}
</style>
