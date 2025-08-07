Claro. Combinado. Aqui está o plano de ação completo e detalhado, incluindo os snippets de código para cada arquivo que precisa ser modificado.

Você pode salvar este conteúdo como refactor-datasource-modal-plan.md no seu memory-bank.

Plano de Implementação: Refatoração do Fluxo de Adição de Fontes de Dados

Objetivo: Substituir a edição de categoria inline por um modal de adição contextual, onde o usuário define o "Tipo de Conteúdo" de um arquivo no momento do upload. Isso simplificará a UI, melhorará a UX e aumentará a qualidade da análise da IA. As "Notas Rápidas" serão removidas temporariamente para focar no fluxo de arquivos.

Passo 1: Remover Lógica de Notas Rápidas e Ajustar o DataSourceModal

Vamos simplificar o modal principal para se tornar um contêiner para a lista de arquivos e o gatilho para o novo modal de adição.

Arquivo: components/modals/DataSourceModal/DataSourceModal.vue

Ação: Remova a lógica do editor de notas e simplifique o layout para uma única coluna.

Código:

Generated vue
<template>
<BaseModal
:is-open="isOpen"
size="lg"
:hide-default-header="true"
:hide-default-footer="true"
@close="closeModal"
content-wrapper-class="flex flex-col h-full"

>

    <!-- Cabeçalho (não muda) -->
    <template #header>
      <div class="flex items-center justify-between px-6 py-4">
        <!-- ... (código do header permanece o mesmo, incluindo as abas) ... -->
      </div>
    </template>

    <!-- Corpo Principal Simplificado -->
    <template #default>
      <div class="flex-1 p-6 bg-[#171717] overflow-auto flex flex-col h-full">
        <!-- Conteúdo Aba 'Fontes de dados' -->
        <template v-if="activeTab === 'sources'">
          <DataSourceList
            :data-sources="dataSources"
            @open-add-source-modal="isAddSourceModalOpen = true"
            @request-actions="handleRequestActions"
          />
        </template>

        <!-- Conteúdo Aba 'Input/Output' (permanece igual) -->
        <template v-if="activeTab === 'output'">
          <NodeIOViewer
            :cumulative-context="viewerInputData"
            :output-data="viewerOutputData"
            class="flex-grow overflow-auto"
          />
        </template>
      </div>
    </template>

  </BaseModal>

  <!-- Modal de Adição (NOVO) -->

<AddSourceModal
:is-open="isAddSourceModalOpen"
@close="isAddSourceModalOpen = false"
@sources-prepared="handleSourcesPrepared"
/>

  <!-- Modal de Ações (permanece igual) -->

<DataSourceActionModal
:is-open="isActionModalOpen"
:source-data="selectedSourceForAction"
@close="isActionModalOpen = false"
@confirm-delete="handleConfirmDeleteAction"
/>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import BaseModal from '../BaseModal.vue';
import DataSourceList from './content/DataSourceList.vue';
import AddSourceModal from './content/AddSourceModal.vue'; // NOVO
import DataSourceActionModal from './DataSourceActionModal.vue';
import NodeIOViewer from './content/NodeIOViewer.vue';
import { useTaskFlowStore } from '~/stores/taskFlow';
import { useModalStore } from '~/stores/modal';
import { dataSourceNodeHandler } from '~/lib/nodeHandlers/dataSourceNodeHandler';
import { v4 as uuidv4 } from "uuid";

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  nodeData: { type: Object, default: () => ({ sources: [] }) },
});

const emit = defineEmits(['close', 'update:nodeData']);

const modalStore = useModalStore();
const taskFlowStore = useTaskFlowStore();

// --- State ---
const activeTab = ref('sources');
const isAddSourceModalOpen = ref(false); // Controla o novo modal
const isActionModalOpen = ref(false);
const selectedSourceForAction = ref(null);

const dataSources = computed(() => props.nodeData?.sources || []);
const currentNodeId = computed(() => modalStore.getActiveNodeId);

const currentNode = computed(() => {
  if (!currentNodeId.value) return null;
  return taskFlowStore.nodes.find((n) => n.id === currentNodeId.value);
});

const viewerInputData = computed(() => currentNode.value?.data?.cumulativeContext || { compressed: false, blob: {} });
const viewerOutputData = computed(() => currentNode.value?.data?.outputData || {});

// --- Methods ---
const emitCompleteUpdate = (updatedSources) => {
  if (!currentNodeId.value) return;
  const outputData = dataSourceNodeHandler.generateOutput({ data: { sources: updatedSources } });
  emit('update:nodeData', {
    nodeId: currentNodeId.value,
    updatedData: { sources: updatedSources, outputData },
  });
};

const handleSourcesPrepared = ({ category, files }) => {
  isAddSourceModalOpen.value = false;
  const newSources = [...dataSources.value];

  const fileReadPromises = Array.from(files).map(file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const sourceObject = {
          id: uuidv4(),
          name: file.name,
          type: file.name.split('.').pop()?.toLowerCase() || 'text',
          category: category, // Categoria definida no modal
          content: e.target.result,
          createdAt: new Date().toISOString(),
          // Se for excel, a extração de 'structured_data' precisa ser refeita aqui
          // ou passada do AddSourceModal
        };
        resolve(sourceObject);
      };
      reader.onerror = reject;
      reader.readAsText(file); // Simplificado para texto por enquanto
    });
  });

  Promise.all(fileReadPromises).then(processedFiles => {
    emitCompleteUpdate([...newSources, ...processedFiles]);
  });
};

const handleRequestActions = (source) => {
  selectedSourceForAction.value = source;
  isActionModalOpen.value = true;
};

const handleConfirmDeleteAction = (sourceIdToDelete) => {
  const updatedSources = dataSources.value.filter(s => s.id !== sourceIdToDelete);
  emitCompleteUpdate(updatedSources);
  isActionModalOpen.value = false;
};

const closeModal = () => emit('close');

watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = 'sources';
  }
});

</script>

Passo 2: Criar o AddSourceModal.vue

Este é o novo componente para a adição focada.

Arquivo: components/modals/DataSourceModal/content/AddSourceModal.vue

Ação: Crie este novo arquivo com a lógica de seleção de tipo e upload.

Código:

Generated vue
<template>
<BaseModal
:is-open="isOpen"
size="md"
title="Adicionar Nova Fonte de Dados"
:hide-default-header="false"
:hide-default-footer="true"
@close="$emit('close')"

>

    <div class="p-6 space-y-6">
      <!-- Seletor de Tipo de Conteúdo -->
      <div>
        <label for="contentTypeSelect" class="block text-sm font-medium text-gray-300 mb-1">
          1. Qual é o tipo de conteúdo?
        </label>
        <select
          id="contentTypeSelect"
          v-model="selectedCategory"
          class="select select-bordered w-full bg-[#2C2B30] border-[#47464B]"
        >
          <option disabled value="">Selecione um tipo...</option>
          <option
            v-for="option in contentTypes"
            :key="option.value"
            :value="option.value"
          >
            {{ option.text }}
          </option>
        </select>
      </div>

      <!-- Área de Upload -->
      <div v-if="selectedCategory">
        <label class="block text-sm font-medium text-gray-300 mb-1">
          2. Selecione os arquivos
        </label>
        <div
          @click="triggerFileInput"
          @dragover.prevent @dragenter.prevent @drop.prevent="handleDrop"
          class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-blue-500 transition"
        >
          <div class="space-y-1 text-center">
            <svg class="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <div class="flex text-sm text-gray-400">
              <p class="pl-1">Clique para selecionar ou arraste arquivos aqui</p>
            </div>
            <p class="text-xs text-gray-500">{{ acceptedFileTypes }}</p>
          </div>
        </div>
        <input ref="fileInput" type="file" @change="handleFileChange" :accept="acceptedFileTypes" multiple class="hidden">
      </div>

      <!-- Lista de Arquivos Selecionados -->
      <div v-if="selectedFiles.length > 0" class="space-y-2">
        <p class="text-sm font-medium text-gray-300">Arquivos selecionados:</p>
        <ul class="max-h-40 overflow-y-auto">
          <li v-for="file in selectedFiles" :key="file.name" class="text-xs text-gray-400 truncate">{{ file.name }}</li>
        </ul>
      </div>

    </div>

    <!-- Footer com Ações -->
    <template #footer>
      <div class="flex justify-end gap-3 px-6 py-4 bg-[#232227] rounded-b-lg border-t border-t-[#393939]">
        <button @click="$emit('close')" class="btn btn-sm btn-ghost">Cancelar</button>
        <button @click="handleAdd" class="btn btn-sm btn-primary" :disabled="!canAdd">Adicionar</button>
      </div>
    </template>

  </BaseModal>
</template>

<script setup>
import { ref, computed } from 'vue';
import BaseModal from '../BaseModal.vue';

const props = defineProps({
  isOpen: { type: Boolean, required: true },
});
const emit = defineEmits(['close', 'sources-prepared']);

const selectedCategory = ref('');
const selectedFiles = ref([]);
const fileInput = ref(null);

const contentTypes = [
  { value: 'pesquisa_usuario', text: 'Dados de Pesquisa (Planilha)', accept: '.xlsx,.xls' },
  { value: 'transcricao_entrevista', text: 'Transcrição de Entrevista (Texto)', accept: '.docx,.txt,.md' },
];

const acceptedFileTypes = computed(() => {
  const selectedType = contentTypes.find(ct => ct.value === selectedCategory.value);
  return selectedType ? selectedType.accept : '*';
});

const canAdd = computed(() => selectedCategory.value && selectedFiles.value.length > 0);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (event) => {
  selectedFiles.value = Array.from(event.target.files);
};
const handleDrop = (event) => {
  selectedFiles.value = Array.from(event.dataTransfer.files);
};

const handleAdd = () => {
  emit('sources-prepared', {
    category: selectedCategory.value,
    files: selectedFiles.value,
  });
  resetState();
};

const resetState = () => {
  selectedCategory.value = '';
  selectedFiles.value = [];
  emit('close');
}

watch(() => props.isOpen, (open) => {
  if (!open) resetState();
});
</script>

IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Vue
IGNORE_WHEN_COPYING_END
Passo 3: Simplificar a DataSourceList.vue

Agora que a categorização acontece no modal, a lista fica muito mais limpa.

Arquivo: components/modals/DataSourceModal/content/DataSourceList.vue

Ação: Remova o select inline e adicione o indicativo de tipo.

Código:

Generated vue
<template>

  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center px-6 border border-[#343434] py-4 rounded-t-lg mb-[-1px] h-[58px] justify-between flex-shrink-0">
      <h2 class="text-white">Fontes adicionadas</h2>
      <button @click="$emit('open-add-source-modal')" class="flex items-center text-blue-500 hover:text-blue-400">
        <span class="mr-2">+</span> Adicionar Arquivo
      </button>
    </div>
    
    <div class="flex flex-col flex-1 min-h-0 border border-[#343434] w-full rounded-b-lg">
      <!-- Mensagem de estado vazio -->
      <template v-if="!dataSources || dataSources.length === 0">
        <div class="flex flex-col items-center justify-center h-full p-6">
          <h2 class="text-xl text-white mb-4 text-center">Nenhuma fonte de dados ainda</h2>
          <p class="text-sm text-[#B4B4B4] mb-6 text-center">Clique em "Adicionar Arquivo" para começar.</p>
        </div>
      </template>

      <!-- Lista de fontes existentes -->
      <div v-else class="w-full flex-grow overflow-y-auto">
        <div v-for="source in dataSources" :key="source.id" class="flex items-center justify-between text-sm p-2 border-b border-[#343434] last:border-b-0">
          <div class="flex items-center gap-3 py-2 px-4 w-full justify-between">
            <div class="flex items-center min-w-0 flex-grow gap-2">
              <!-- Ícones (permanece igual) -->

              <!-- Nome e NOVO Indicador de Tipo -->
              <span class="text-gray-200 truncate" :title="source.name || source.id">{{ getDisplaySourceName(source) }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 flex-shrink-0">
                {{ getCategoryLabel(source.category) }}
              </span>
            </div>

            <!-- Botão de Ações (permanece igual) -->
            <div class="flex-shrink-0 dropdown dropdown-end pointer-events-auto" @click.stop>
              <button tabindex="0" role="button" class="btn btn-ghost btn-xs btn-circle text-gray-400 hover:text-gray-200" aria-label="Opções">
                <EllipsisVerticalIcon class="h-5 w-5" />
              </button>
              <ul tabindex="0" class="dropdown-content z-[51] menu p-2 shadow bg-base-200 rounded-box w-36">
                <li>
                  <button class="text-red-500" @click="$emit('request-actions', source)">Excluir</button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
// ...
// NOVO: Adicione esta função auxiliar para obter o label amigável da categoria
const getCategoryLabel = (categoryValue) => {
  if (categoryValue === 'pesquisa_usuario') return 'Pesquisa';
  if (categoryValue === 'transcricao_entrevista') return 'Transcrição';
  return 'Geral';
};
// ...
</script>

IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Vue
IGNORE_WHEN_COPYING_END

Com essas mudanças, o fluxo fica muito mais claro, intencional e a interface, mais limpa. É uma melhoria significativa em todos os aspectos.
