<template>
  <div
    data-testid="ai-analysis-placeholder"
    class="ai-analysis-placeholder flex flex-col items-center justify-center text-center h-full p-4 space-y-4"
  >
    <!-- Estado de Carregamento (Analisando) -->
    <div v-if="isAnalyzing" class="flex flex-col items-center justify-center">
      <div class="ai-analysis-spinner mb-3"></div>
      <span class="text-gray-200 text-base font-medium">Analisando...</span>
      <p v-if="loadingMessage" class="text-gray-400 text-xs mt-1">
        {{ loadingMessage }}
      </p>
    </div>

    <!-- Estado de Erro -->
    <div
      v-else-if="errorMessage"
      class="flex flex-col items-center justify-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-10 w-10 text-red-500 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p class="text-red-400 text-sm font-medium mb-1">Erro na Análise</p>
      <p class="text-gray-300 text-xs mb-3 max-w-xs">{{ errorMessage }}</p>
      <p
        v-if="showConnectMessageOnError && connectMessage"
        class="text-gray-400 text-xs mb-1"
      >
        {{ connectMessage }}
      </p>
      <p
        v-if="showConnectMessageOnError && connectHint"
        class="text-gray-500 text-xs italic mb-3"
      >
        {{ connectHint }}
      </p>
      <button
        v-if="showAnalyzeButtonOnError"
        @click="$emit('analyze-clicked')"
        class="inline-flex w-fit items-center justify-center gap-2 px-4 py-2 hover:bg-[#3C3B40] text-white rounded-lg border border-[#4D6BFE] transition-colors min-h-[48px] min-w-[200px] font-semibold text-base shadow-none bg-transparent"
        :aria-label="analyzeButtonText"
      >
        <AiIcon class="w-5 h-5" />
        <span>{{
          analyzeButtonTextOnError || "Tentar Analisar Novamente"
        }}</span>
        <div
          v-if="isAnalyzing"
          class="loading loading-spinner loading-xs"
        ></div>
      </button>
    </div>

    <!-- Mensagem para Conectar Dados (Prioridade se `showConnectMessage` for true) -->
    <div
      v-else-if="showConnectMessage"
      class="flex flex-col items-center justify-center"
    >
      <component
        :is="iconComponent"
        v-if="iconComponent"
        class="w-10 h-10 text-gray-500 mb-3"
        aria-hidden="true"
      />
      <p class="text-gray-300 text-sm mb-2 leading-relaxed">
        {{ connectMessage }}
      </p>
      <p v-if="connectHint" class="text-gray-500 text-xs italic">
        {{ connectHint }}
      </p>
    </div>

    <!-- Botão para Iniciar Análise (quando dados estão conectados e prontos) -->
    <div
      v-else-if="showAnalyzeButton"
      class="flex flex-col items-center justify-center"
    >
      <component
        :is="iconComponent"
        v-if="iconComponent"
        class="w-10 h-10 text-gray-500 mb-3"
        aria-hidden="true"
      />
      <p class="text-gray-300 text-sm mb-3 leading-relaxed">
        {{ readyMessage }}
      </p>
      <button
        @click="$emit('analyze-clicked')"
        class="inline-flex w-fit items-center justify-center gap-2 px-4 py-2 hover:bg-[#3C3B40] text-white rounded-lg border border-[#4D6BFE] transition-colors min-h-[48px] min-w-[200px] font-semibold text-base shadow-none bg-transparent"
        :aria-label="analyzeButtonText"
      >
        <AiIcon class="w-5 h-5" />
        <span>{{ analyzeButtonText }}</span>
        <div
          v-if="isAnalyzing"
          class="loading loading-spinner loading-xs"
        ></div>
      </button>
    </div>

    <!-- Mensagem de "Nenhum Resultado" (após análise bem-sucedida mas sem dados relevantes) -->
    <div
      v-else-if="showNoResultsMessage"
      class="flex flex-col items-center justify-center"
    >
      <component
        :is="iconComponent"
        v-if="iconComponent"
        class="w-10 h-10 text-gray-500 mb-3"
        aria-hidden="true"
      />
      <p class="text-gray-400 text-sm">{{ noResultsMessage }}</p>
    </div>

    <!-- Fallback genérico (deve ser evitado se a lógica acima for completa) -->
    <div v-else class="flex flex-col items-center justify-center">
      <p class="text-gray-500 text-sm italic">Aguardando dados ou ação.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Component } from "vue";
import AiIcon from "~/components/icon/AiIcon.vue"; // Ícone do botão "Refinar com IA"

defineProps({
  isAnalyzing: {
    // Se a análise de IA está em progresso
    type: Boolean,
    default: false,
  },
  loadingMessage: {
    // Mensagem opcional durante o carregamento
    type: String,
    default: "",
  },
  errorMessage: {
    // Mensagem de erro, se houver
    type: String,
    default: null,
  },
  showConnectMessage: {
    // Forçar exibição da mensagem "Conecte dados"
    type: Boolean,
    default: false,
  },
  connectMessage: {
    type: String,
    default:
      "Para realizar a análise, este card precisa ser conectado a uma fonte de dados compatível.",
  },
  connectHint: {
    // Dica adicional para conectar dados
    type: String,
    default: "Arraste uma conexão de um nó compatível para o topo deste card.",
  },
  showAnalyzeButton: {
    // Se o botão "Analisar com IA" deve ser mostrado
    type: Boolean,
    default: false,
  },
  readyMessage: {
    // Mensagem quando pronto para analisar
    type: String,
    default: "Dados conectados. Clique abaixo para iniciar a análise com IA.",
  },
  analyzeButtonText: {
    // Texto do botão de análise principal
    type: String,
    default: "Analisar com IA",
  },
  showNoResultsMessage: {
    // Se deve mostrar "Nenhum resultado"
    type: Boolean,
    default: false,
  },
  noResultsMessage: {
    type: String,
    default:
      "Nenhum insight relevante foi encontrado com base nos dados fornecidos.",
  },
  iconComponent: {
    // Ícone principal para os estados de placeholder
    type: Object as () => Component | null,
    default: null,
  },
  showConnectMessageOnError: {
    // Mostrar mensagem de conectar dados junto com o erro
    type: Boolean,
    default: false,
  },
  showAnalyzeButtonOnError: {
    // Mostrar botão de tentar novamente no erro
    type: Boolean,
    default: true, // Por padrão, permite tentar novamente
  },
  analyzeButtonTextOnError: {
    // Texto customizado para o botão de tentar novamente
    type: String,
    default: "Tentar Analisar Novamente",
  },
});

defineEmits(["analyze-clicked"]);
</script>

<style scoped>
.ai-analysis-placeholder {
  min-height: 100px;
}

/* Spinner permanece igual */
.ai-analysis-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #6b7280;
  border-top: 3px solid #4d6bfe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
