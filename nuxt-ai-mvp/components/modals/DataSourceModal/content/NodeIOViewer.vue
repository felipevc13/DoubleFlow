<template>
  <div
    class="node-io-viewer flex flex-row flex-wrap gap-4 h-full overflow-hidden"
  >
    <!-- Coluna Input -->
    <div
      class="flex flex-col h-full min-w-[400px] flex-1 overflow-hidden border border-[#343434] rounded-lg"
    >
      <h3
        class="text-md font-semibold p-3 border-b border-[#343434] bg-[#171717] flex-shrink-0"
      >
        Input
      </h3>
      <div class="viewer-container p-4 flex-grow overflow-auto bg-[#171717]">
        <!-- Display Decompressed Cumulative Context -->
        <VueJsonPretty
          v-if="
            decompressedContext !== null &&
            typeof decompressedContext === 'object' &&
            Object.keys(decompressedContext).length > 0
          "
          :data="decompressedContext"
          :deep="2"
          showLineNumber
          showIcon
          theme="dark"
        />
        <!-- Handle cases where context is empty, null, or an error occurred -->
        <div v-else-if="decompressedContext && decompressedContext.error">
          <p class="text-red-500 italic">
            Erro ao processar contexto: {{ decompressedContext.details }}
          </p>
        </div>
        <div v-else>
          <p class="text-gray-500 italic">
            Nenhum dado de entrada cumulativo disponível.
          </p>
          <!-- Optionally display raw inputData if context is empty but inputData exists -->
          <!--
           <div v-if="inputData && Object.keys(inputData).length > 0" class="mt-4 border-t pt-2">
             <h4 class="text-xs text-gray-600 mb-1">Raw Direct Input:</h4>
             <VueJsonPretty :data="inputData" :deep="0" theme="dark" />
           </div>
           -->
        </div>
      </div>
    </div>

    <!-- Coluna Output -->
    <div
      class="flex flex-col h-full min-w-[400px] flex-1 overflow-hidden border border-[#343434] rounded-lg"
    >
      <h3
        class="text-md font-semibold p-3 border-b border-[#343434] bg-[#171717] flex-shrink-0"
      >
        Output
      </h3>
      <div class="viewer-container p-4 flex-grow overflow-auto bg-[#171717]">
        <!-- Verifica se outputData tem conteúdo -->
        <VueJsonPretty
          v-if="
            outputData !== null &&
            outputData !== undefined &&
            (typeof outputData !== 'object' ||
              Object.keys(outputData).length > 0)
          "
          :data="outputData"
          :deep="4"
          showLineNumber
          showIcon
          theme="dark"
        />
        <p v-else class="text-gray-500 italic">Nenhum dado de saída.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from "vue"; // Import computed
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css"; // Importar estilos CSS
import { getAggregatedContext } from "~/utils/nodeContext"; // <<< IMPORT HELPER (adjust path if needed)

const props = defineProps({
  inputData: {
    // Keep for potential future use or comparison, but won't display directly
    type: [Object, Array, String, null],
    default: null,
  },
  outputData: {
    type: [Object, Array, String, null],
    default: null,
  },
  // <<< ADD NEW PROP
  cumulativeContext: {
    type: [Object, null], // Should be { compressed: boolean, blob: string | object }
    default: null,
  },
});

// <<< ADD COMPUTED PROPERTY
const decompressedContext = computed(() => {
  // Roo Log: Log the raw cumulativeContext prop

  if (!props.cumulativeContext) {
    return null;
  }
  try {
    // getAggregatedContext handles decompression and returns the object
    // Wrap the prop in a mock node structure expected by the helper
    const result = getAggregatedContext({
      data: { cumulativeContext: props.cumulativeContext },
    });
    // Roo Log: Log the result of getAggregatedContext

    return result;
  } catch (error) {
    console.error(
      "[NodeIOViewer] Error decompressing context in viewer:",
      error
    ); // Roo Log
    return { error: "Failed to decompress context", details: error.message };
  }
});

// --- Log Props on Mount ---
onMounted(() => {
  // Roo Log: Log all props when component mounts
});
// --- End Log on Mount ---
</script>

<style scoped>
.viewer-container {
  /* Garante que o container respeite a altura flex */
  min-height: 0;
}

/* Opcional: Ajustar estilos do tema dark se necessário */
</style>
