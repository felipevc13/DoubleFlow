<template>
  <BaseModal
    :is-open="isOpen"
    size="md"
    title="Adicionar Nova Fonte de Dados"
    :hide-default-header="false"
    :hide-default-footer="true"
    @close="$emit('close')"
  >
    <div class="flex flex-col p-6 space-y-6">
      <!-- Seletor de Tipo de Conteúdo -->
      <div>
        <label
          for="contentTypeSelect"
          class="block text-sm font-medium text-gray-300 mb-1"
        >
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

      <!-- Instruções e botão de template (apenas para pesquisa em planilha) -->
      <div
        v-if="selectedCategory === 'pesquisa_usuario'"
        class="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg mb-4"
      >
        <p class="text-sm text-gray-300 mb-3">
          Para garantir a melhor análise, baixe nosso template. Defina os
          <strong>tipos de pergunta na primeira linha</strong> e cole seus dados
          (com perguntas) a partir da segunda.
        </p>
        <a
          href="/survey_template_example.xlsx"
          download
          class="btn btn-sm btn-outline btn-info w-full"
        >
          Baixar Template de Exemplo (.xlsx)
        </a>
      </div>

      <!-- Área de Upload -->
      <div v-if="selectedCategory">
        <label class="block text-sm font-medium text-gray-300 mb-1">
          2. Selecione os arquivos
        </label>
        <div
          @click="triggerFileInput"
          @dragover.prevent
          @dragenter.prevent
          @drop.prevent="handleDrop"
          class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-blue-500 transition"
        >
          <div class="space-y-1 text-center">
            <svg
              class="mx-auto h-12 w-12 text-gray-500"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
            <div class="flex text-sm text-gray-400">
              <p class="pl-1">
                Clique para selecionar ou arraste arquivos aqui
              </p>
            </div>
            <p class="text-xs text-gray-500">{{ acceptedFileTypes }}</p>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          @change="handleFileChange"
          :accept="acceptedFileTypes"
          multiple
          class="hidden"
        />
      </div>

      <!-- Lista de Arquivos Selecionados -->
      <div v-if="selectedFiles.length > 0" class="space-y-2">
        <p class="text-sm font-medium text-gray-300">Arquivos selecionados:</p>
        <ul class="max-h-40 overflow-y-auto">
          <li
            v-for="file in selectedFiles"
            :key="file.name"
            class="text-xs text-gray-400 truncate"
          >
            {{ file.name }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Footer com Ações -->
    <template #footer>
      <div
        class="flex justify-end gap-3 px-6 py-4 bg-[#232227] rounded-b-lg border-t border-t-[#393939]"
      >
        <button @click="$emit('close')" class="btn btn-sm btn-ghost">
          Cancelar
        </button>
        <button
          @click="handleAdd"
          class="btn btn-sm btn-primary"
          :disabled="!canAdd || isLoading"
        >
          <span
            v-if="isLoading"
            class="loading loading-spinner loading-xs mr-2"
          ></span>
          <span v-else>Adicionar</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import BaseModal from "../../BaseModal.vue";
import { v4 as uuidv4 } from "uuid";

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  isLoading: { type: Boolean, default: false },
});
const emit = defineEmits(["close", "sources-prepared"]);

const selectedCategory = ref("");
const selectedFiles = ref([]);
const fileInput = ref(null);
const isLoading = ref(false);

const contentTypes = [
  {
    value: "pesquisa_usuario",
    text: "Dados de Pesquisa (Planilha)",
    accept: ".xlsx,.xls",
  },
  {
    value: "transcricao_entrevista",
    text: "Transcrição de Entrevista (Texto)",
    accept: ".docx,.txt,.md",
  },
];

const acceptedFileTypes = computed(() => {
  const selectedType = contentTypes.find(
    (ct) => ct.value === selectedCategory.value
  );
  return selectedType ? selectedType.accept : "*";
});

const canAdd = computed(
  () =>
    selectedCategory.value && selectedFiles.value.length > 0 && !isLoading.value
);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (event) => {
  selectedFiles.value = Array.from(event.target.files);
};
const handleDrop = (event) => {
  selectedFiles.value = Array.from(event.dataTransfer.files);
};

const handleAdd = async () => {
  if (!canAdd.value) return;
  isLoading.value = true;

  const fileProcessingPromises = selectedFiles.value.map(async (file) => {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    // ⬇️ Removido structured_data/summary do shape inicial
    const sourceObject = {
      id: uuidv4(),
      name: file.name,
      type: ext,
      category: selectedCategory.value,
      content: "",
      createdAt: new Date().toISOString(),
    };

    const formData = new FormData();
    formData.append("file", file);

    try {
      if (ext === "xlsx" || ext === "xls") {
        sourceObject.type = "excel";
        const response = await $fetch("/api/files/extract-excel", {
          method: "POST",
          body: formData,
        });

        const structured = response.structured_data ?? {
          quantitativeKPIs: response.quantitativeKPIs,
          qualitativeData: response.qualitativeData,
        };

        // 🔑 Para planilhas: content = JSON estruturado (string)
        sourceObject.content = JSON.stringify(structured);
        // E **apenas aqui** adicionamos campos extras úteis na UI/análise:
        sourceObject.summary = response.text || "";
        sourceObject.structured_data = structured;
      } else if (ext === "docx") {
        sourceObject.type = "word";
        const response = await $fetch("/api/files/extract-text", {
          method: "POST",
          body: formData,
        });
        // Para texto: só content
        sourceObject.content = response.text || "";
      } else if (ext === "txt" || ext === "md") {
        sourceObject.type = ext === "md" ? "markdown" : "text";
        sourceObject.content = await file.text();
      } else {
        sourceObject.content = `(Arquivo '${file.name}' do tipo '${ext}' não suportado para extração de conteúdo.)`;
      }
    } catch (error) {
      console.error(`Erro ao processar o arquivo ${file.name}:`, error);
      sourceObject.content = `(Falha ao processar o arquivo '${file.name}')`;
    }
    return sourceObject;
  });

  try {
    const processedSources = await Promise.all(fileProcessingPromises);
    emit("sources-prepared", { sources: processedSources });
  } catch (error) {
    console.error("Erro geral no processamento de arquivos:", error);
  } finally {
    isLoading.value = false;
  }
};

const resetState = () => {
  selectedCategory.value = "";
  selectedFiles.value = [];
};

watch(
  () => props.isOpen,
  (open) => {
    if (!open) resetState();
  }
);

watch(selectedCategory, () => {
  selectedFiles.value = [];
});
</script>
