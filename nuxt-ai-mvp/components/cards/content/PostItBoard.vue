<template>
  <div :class="containerClass">
    <div
      v-for="(cluster, i) in clusters"
      :key="i"
      :class="[
        'cluster-card rounded-lg shadow p-3',
        props.light ? 'bg-white border border-gray-200' : 'bg-[#3A393F]',
      ]"
    >
      <h4
        :class="
          props.light
            ? 'text-gray-900 font-semibold text-base mb-1'
            : 'text-white font-semibold text-base mb-1'
        "
      >
        {{ cluster.title }}
      </h4>
      <div class="flex flex-wrap gap-2 items-start">
        <div
          v-for="(item, itemIndex) in cluster.items"
          :key="`cluster-${i}-item-${itemIndex}`"
          :class="[
            'post-it-simple aspect-square w-[140px] p-3 rounded shadow-sm flex items-center justify-center text-center text-xs',
            props.light
              ? lightColorClass(i) + ' text-gray-900'
              : colorClass(i) + ' text-gray-800',
          ]"
        >
          {{ item }}
        </div>
        <div
          v-if="!cluster.items || cluster.items.length === 0"
          :class="
            props.light
              ? 'text-gray-400 text-xs italic w-full mt-2 col-span-full'
              : 'text-gray-300 text-xs italic w-full mt-2 col-span-full'
          "
        >
          Sem itens neste grupo
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface PostItCluster {
  title: string;
  items: string[];
}

const props = defineProps<{
  clusters: PostItCluster[];
  layout?: "grid" | "quadrant";
  clusterColors?: string[];
  light?: boolean;
}>();

const defaultColors = [
  "bg-yellow-100",
  "bg-blue-100",
  "bg-pink-100",
  "bg-green-100",
  "bg-purple-100",
  "bg-orange-100",
];

const lightColors = [
  "bg-yellow-50",
  "bg-blue-50",
  "bg-pink-50",
  "bg-green-50",
  "bg-purple-50",
  "bg-orange-50",
];

const colorClass = (i: number) =>
  props.clusterColors?.[i % props.clusterColors.length] ??
  defaultColors[i % defaultColors.length];

const lightColorClass = (i: number) =>
  props.clusterColors?.[i % props.clusterColors.length] ??
  lightColors[i % lightColors.length];

const containerClass = computed(() =>
  props.layout === "quadrant"
    ? "grid grid-cols-2 gap-4"
    : "grid grid-cols-2 md:grid-cols-3 gap-4"
);
</script>

<style scoped>
.cluster-card {
  min-width: 150px;
  padding: 0.75rem; /* consistent padding */
}
</style>
