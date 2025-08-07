<template>
  <BaseModal 
    :is-open="isOpen" 
    size="viewport-fill" 
    @close="$emit('close')" 
    hide-default-header 
    hide-default-footer
  >
    <template #header>
      <div class="flex items-center justify-between px-6 py-4 border-b border-[#393939]">
        <div class="flex items-center gap-4">
          <AiIcon class="w-7 h-7" />
          <h2 class="text-xl font-semibold text-white">Hub de Análise de IA</h2>
        </div>
        <div class="flex items-center gap-4">
          <div class="tabs tabs-boxed bg-transparent">
            <a 
              class="tab" 
              :class="{'tab-active': activeTab === 'table'}" 
              @click="activeTab = 'table'"
            >
              Análise Detalhada
            </a>
            <a 
              class="tab" 
              :class="{'tab-active': activeTab === 'affinity'}" 
              @click="activeTab = 'affinity'"
            >
              Mapa de Afinidade
            </a>
            <a 
              class="tab" 
              :class="{'tab-active': activeTab === 'empathy'}" 
              @click="activeTab = 'empathy'"
            >
              Mapa de Empatia
            </a>
          </div>
          <button class="btn btn-primary" @click="generateReport">
            Gerar Relatório
          </button>
          <button @click="$emit('close')" class="btn btn-ghost btn-circle">
            ✕
          </button>
        </div>
      </div>
    </template>

    <div class="flex-1 p-6 bg-[#171717] overflow-auto">
      <div v-if="!analyzedData || !analyzedData.insights || analyzedData.insights.length === 0" 
           class="text-center text-gray-400">
        Nenhuma análise encontrada ou dados insuficientes.
      </div>
      <div v-else>
        <div v-if="activeTab === 'table'" class="h-full">
          <AnalysisDataTable 
            :data="analyzedData.insights" 
            :columns="tableColumns" 
            :page-size="15"
          />
        </div>
        <div v-if="activeTab === 'affinity'" class="h-full">
          <PostItBoard :clusters="affinityMapForBoard" layout="grid" />
        </div>
        <div v-if="activeTab === 'empathy'" class="h-full">
          <PostItBoard :clusters="empathyMapForBoard" layout="quadrant" />
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue';
import { createColumnHelper } from '@tanstack/vue-table';
import { useTaskFlowStore } from '~/stores/taskFlow';
import BaseModal from './BaseModal.vue';
import AiIcon from '../icon/AiIcon.vue';
import AnalysisDataTable from '../common/AnalysisDataTable.vue';
import PostItBoard from '../cards/content/PostItBoard.vue';

type TabType = 'table' | 'affinity' | 'empathy';

const props = defineProps<{
  isOpen: boolean;
  nodeData: any;
  nodeId: string;
}>();

const emit = defineEmits(['close']);
const taskFlowStore = useTaskFlowStore();
const activeTab = ref<TabType>('table');

const analyzedData = computed(() => props.nodeData?.analyzedData || { insights: [] });

const affinityMapForBoard = computed(() => {
  const insights = analyzedData.value?.insights || [];
  const groups = insights.reduce((acc: Record<string, string[]>, item: any) => {
    const topic = item.topic || 'Geral';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(item.quote);
    return acc;
  }, {});
  
  return Object.entries(groups).map(([title, items]) => ({ 
    title, 
    items: items as string[] 
  }));
});

const empathyMapForBoard = computed(() => {
  const insights = analyzedData.value?.insights || [];
  const says = insights.map((d: any) => d.quote);
  const feels = insights
    .filter((d: any) => d.sentiment)
    .map((d: any) => `${d.sentiment}: ${d.quote}`);
  const thinks = insights
    .filter((d: any) => d.user_need)
    .map((d: any) => d.user_need);
    
  return [
    { title: "Diz", items: says },
    { title: "Pensa", items: thinks },
    { title: "Faz", items: [] },
    { title: "Sente", items: feels },
  ];
});

const columnHelper = createColumnHelper<any>();
const tableColumns = [
  columnHelper.accessor('quote', {
    header: 'Citação / Feedback',
    cell: (info: any) => h('span', { innerHTML: info.getValue() })
  }),
  columnHelper.accessor('topic', { 
    header: 'Tópico',
    cell: (info: any) => info.getValue() || '—'
  }),
  columnHelper.accessor('sentiment', { 
    header: 'Sentimento',
    cell: (info: any) => info.getValue() || '—'
  }),
  columnHelper.accessor('user_need', { 
    header: 'Necessidade do Usuário',
    cell: (info: any) => info.getValue() || '—'
  }),
];

const generateReport = () => {
  taskFlowStore.requestNodeReprocessing(props.nodeId);
  emit('close');
};
</script>

<style scoped>
.tab {
  color: #9ca3af;
  transition: color 0.2s ease-in-out;
}

.tab:hover {
  color: #ffffff;
}

.tab-active {
  color: #ffffff;
  background-color: #3a3940;
  border-radius: 0.5rem;
}

.tabs-boxed {
  padding: 0.25rem;
  border-radius: 0.5rem;
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
