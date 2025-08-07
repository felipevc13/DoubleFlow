<!-- BarDistributionChart.vue -->
<template>
  <div class="w-full flex flex-col gap-2">
    <div
      v-for="([label, value], idx) in sortedDistribution"
      :key="idx"
      class="flex items-center gap-2"
    >
      <div
        class="text-xs text-gray-300 font-medium max-w-[130px] line-clamp-1 truncate"
        :title="label"
      >
        {{ label }}
      </div>
      <div
        class="bg-gray-700 rounded h-4 flex items-center relative w-full min-w-[60px]"
      >
        <div
          class="bg-blue-600 h-4 rounded flex items-center px-1 text-white font-bold text-xs"
          :style="{ width: getPercentage(value) + '%' }"
        >
          <span class="ml-2">{{ value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ distribution: Record<string, number> }>();
const sortedDistribution = computed(() => Object.entries(props.distribution));
const total = computed(() =>
  Object.values(props.distribution).reduce((a, b) => a + b, 0)
);
const getPercentage = (value: number) =>
  total.value > 0 ? (value / total.value) * 100 : 0;
</script>
