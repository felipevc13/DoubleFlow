<template>
  <div class="flex flex-col flex-1 min-h-0 h-full">
    <div
      class="flex items-center px-6 border border-[#343434] py-4 rounded-t-lg mb-[-1px] h-[58px] justify-between flex-shrink-0"
    >
      <h2>Fontes adicionadas</h2>
      <button
        @click="$emit('open-add-source-modal')"
        class="flex items-center text-blue-500 hover:text-blue-400"
      >
        <span class="mr-2">+</span> Adicionar
      </button>
    </div>
    <div
      class="flex flex-col flex-1 min-h-0 border border-[#343434] w-full rounded-b-lg"
      :class="{ 'p-6 ': !dataSources || !dataSources.length }"
    >
      <!-- Header/Description (Condicional) -->
      <template v-if="!dataSources || !dataSources.length">
        <div class="flex flex-col items-center justify-center h-full">
          <h2 class="text-xl text-white mb-4 text-center">
            Adicione uma fonte de dados ao projeto
          </h2>
          <p class="text-sm text-[#B4B4B4] mb-6 text-center">
            Escolha entre arquivos Excel, Word, Txt ou Markdown para adicionar
            ao projeto
          </p>
          <button
            @click="$emit('open-add-source-modal')"
            class="flex items-center text-center text-blue-500 hover:text-blue-400"
          >
            <span class="mr-2">+</span> Adicionar
          </button>
        </div>
      </template>

      <!-- Lista de fontes existentes -->
      <div class="w-full flex-grow overflow-y-auto">
        <div
          v-if="dataSources && dataSources.length > 0"
          v-for="source in dataSources"
          :key="source.id"
          class="flex items-center justify-between text-sm p-2 border-b border-[#343434] last:border-b-0"
        >
          <div class="flex items-center gap-3 py-2 px-4 w-full justify-between">
            <div class="flex items-center min-w-0 flex-grow gap-2">
              <!-- Ícones Condicionais -->

              <Markdown
                v-if="source.type === 'markdown'"
                class="h-6 w-6 text-gray-400 flex-shrink-0"
              />
              <Excel
                v-else-if="source.type === 'excel'"
                class="h-6 w-6 text-gray-400 flex-shrink-0"
              />
              <WordIcon
                v-else-if="source.type === 'word'"
                class="h-6 w-6 text-gray-400 flex-shrink-0"
              />
              <TextFile
                v-else-if="source.type === 'text'"
                class="h-6 w-6 text-gray-400 flex-shrink-0"
              />
              <Json
                v-else-if="source.type === 'note'"
                class="h-6 w-6 text-gray-400 flex-shrink-0"
              />
              <DocumentTextIcon
                v-else
                class="h-6 w-6 text-gray-400 flex-shrink-0"
              />

              <!-- Nome Formatado -->
              <span
                class="text-gray-200 truncate"
                :title="source.name || source.id"
                >{{ getDisplaySourceName(source) }}</span
              >
              <span class="text-xs text-gray-400 select-none">
                {{ getCategoryLabel(source.category) }}
              </span>
            </div>

            <button
              @click="handleActionsClick(source)"
              class="btn btn-ghost btn-xs text-red-500 hover:text-red-700 flex items-center"
              aria-label="Excluir fonte"
            >
              <TrashIcon class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  DocumentTextIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";
import Markdown from "~/components/icon/Markdown.vue";
import Excel from "~/components/icon/Excel.vue";
import TextFile from "~/components/icon/TextFile.vue";
import WordIcon from "~/components/icon/WordIcon.vue";
import Json from "~/components/icon/Json.vue";

const props = defineProps({
  dataSources: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "request-actions",
  "request-edit",
  "open-add-source-modal",
]);

const handleActionsClick = (source) => {
  emit("request-actions", source);
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const handleEditClick = (source) => {
  emit("request-edit", source);
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const typeToExtension = {
  markdown: ".md",
  excel: ".xlsx",
  word: ".docx",
  text: ".txt",
};

const getDisplaySourceName = (source) => {
  if (source?.name && source.name.trim() !== "") {
    return source.name.trim();
  }
  return source?.id || "unknown_source";
};

const getCategoryLabel = (category) => {
  if (category === "pesquisa_usuario") return "Pesquisa";
  if (category === "transcricao_entrevista") return "Transcrição";
  return "";
};

const generateFileName = (source) => {
  let baseName = "download";
  if (source && source.name) {
    baseName = source.name.toLowerCase().replace(/\s+/g, "_");
  } else if (source && source.id) {
    baseName = source.id;
  }
  return baseName + ".md";
};

const handleDownload = (source) => {
  if (
    !source ||
    source.type !== "markdown" ||
    typeof source.content !== "string"
  ) {
    console.error("Cannot download: Invalid source or content.", source);
    return;
  }

  const filename = generateFileName(source);
  const content = source.content;

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

// --- Categorias Globais ---
const globalCategories = [
  { value: "empresa_marca", text: "Empresa e Marca" },
  { value: "mercado_industria", text: "Mercado e Indústria" },
  { value: "usuarios_clientes", text: "Usuários e Clientes" },
  { value: "principios_design", text: "Princípios de Design/UX" },
  { value: "recursos_modelos", text: "Recursos e Modelos" },
  { value: "geral", text: "Geral" },
];

// --- Categorias Locais (para o Modal) ---
const localCategories = [
  { value: "geral", text: "Geral" },
  { value: "pesquisa_usuario", text: "Pesquisa com usuário" },
  { value: "analise_mercado", text: "Análise de mercado" },
  { value: "feedback_interno", text: "Feedback interno" },
  // Adicionar outras categorias locais relevantes se necessário
];
</script>

<style scoped>
.menu button {
  display: block;
}
</style>
