<template>
  <div class="bg-white rounded-lg border border-gray-200 mb-6 shadow-sm">
    <div class="flex items-center gap-2 p-8">
      <AffinityIcon class="w-7 h-7" />
      <h2 class="text-xl font-semibold text-gray-800">Análise de Afinidade</h2>
    </div>
    <div class="border-b border-gray-200"></div>
    <div class="p-8">
      <PostItBoard
        v-if="affinityClusters.length > 0"
        :clusters="affinityClusters"
        layout="grid"
        :light="light"
      />
      <p v-else class="text-gray-500 italic">
        Nenhum agrupamento de afinidade foi gerado.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AffinityIcon from "@/components/icon/AffinityIcon.vue";

interface AffinityMapBlockProps {
  data: any; // dados em vários formatos possíveis
  light?: boolean;
}

const props = withDefaults(defineProps<AffinityMapBlockProps>(), {
  light: false,
});

const light = props.light === true;

import PostItBoard from "~/components/cards/content/PostItBoard.vue";

const affinityClusters = computed(() => {
  if (!props.data) return [];

  // Caso mais comum: analyzedData já é array
  if (Array.isArray((props.data as any).analyzedData)) {
    return (props.data as any).analyzedData;
  }
  if (Array.isArray((props.data as any).affinity_map_clusters)) {
    return (props.data as any).affinity_map_clusters;
  }
  if (Array.isArray((props.data as any).clusters)) {
    return (props.data as any).clusters;
  }

  // Caso como objeto { clusterName: [...] }
  const sourceObj =
    (props.data as any).affinity_map_results ??
    (props.data as any).analyzedData?.affinity_map ??
    props.data;

  if (typeof sourceObj === "object" && sourceObj !== null) {
    return Object.entries(sourceObj).map(([title, items]) => ({
      title,
      items: Array.isArray(items) ? items : [],
    }));
  }
  return [];
});
</script>
