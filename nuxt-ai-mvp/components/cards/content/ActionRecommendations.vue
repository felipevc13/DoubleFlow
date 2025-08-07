<template>
  <div
    v-if="recommendations && recommendations.length"
    class="recommendations-container"
    :class="{ 'light-mode': light }"
  >
    <h3
      class="recommendations-title"
      :class="light ? 'text-gray-800' : 'text-white'"
    >
      💡 Recomendações de Ação
    </h3>
    <div class="recommendations-cards">
      <!-- Card Alta Prioridade -->
      <div
        v-if="grouped.high.length"
        :class="[
          'priority-card',
          light ? 'bg-white border border-gray-200' : 'bg-white/5',
        ]"
        class="max-w-xs"
      >
        <div class="priority-header">
          <span class="priority-dot bg-red-500"></span>
          <h4
            class="priority-title"
            :class="light ? 'text-gray-800' : 'text-white'"
          >
            Alta Prioridade
          </h4>
        </div>
        <ul class="recommendation-list">
          <li
            v-for="(rec, i) in grouped.high"
            :key="`high-${i}`"
            class="truncate"
            :class="light ? 'text-gray-600' : 'text-gray-400'"
          >
            {{ rec.text }}
          </li>
        </ul>
      </div>
      <!-- Card Média Prioridade -->
      <div
        v-if="grouped.medium.length"
        :class="[
          'priority-card',
          light ? 'bg-white border border-gray-200' : 'bg-white/5',
        ]"
        class="max-w-xs"
      >
        <div class="priority-header">
          <span class="priority-dot bg-yellow-500"></span>
          <h4
            class="priority-title"
            :class="light ? 'text-gray-800' : 'text-white'"
          >
            Média Prioridade
          </h4>
        </div>
        <ul class="recommendation-list">
          <li
            v-for="(rec, i) in grouped.medium"
            :key="`medium-${i}`"
            class="truncate"
            :class="light ? 'text-gray-600' : 'text-gray-400'"
          >
            {{ rec.text }}
          </li>
        </ul>
      </div>
      <!-- Card Baixa Prioridade -->
      <div
        v-if="grouped.low.length"
        :class="[
          'priority-card',
          light ? 'bg-white border border-gray-200' : 'bg-white/5',
        ]"
        class="max-w-xs"
      >
        <div class="priority-header">
          <span class="priority-dot bg-green-500"></span>
          <h4
            class="priority-title"
            :class="light ? 'text-gray-800' : 'text-white'"
          >
            Baixa Prioridade
          </h4>
        </div>
        <ul class="recommendation-list">
          <li
            v-for="(rec, i) in grouped.low"
            :key="`low-${i}`"
            class="truncate"
            :class="light ? 'text-gray-600' : 'text-gray-400'"
          >
            {{ rec.text }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PropType } from "vue";
import type { ActionRecommendation } from "~/types/taskflow";

const props = defineProps({
  recommendations: {
    type: Array as PropType<ActionRecommendation[]>,
    required: true,
  },
  light: { type: Boolean, default: false },
});

const grouped = computed(() => {
  const groups: {
    high: ActionRecommendation[];
    medium: ActionRecommendation[];
    low: ActionRecommendation[];
  } = { high: [], medium: [], low: [] };
  for (const rec of props.recommendations) {
    if (rec.priority === "high") groups.high.push(rec);
    else if (rec.priority === "medium") groups.medium.push(rec);
    else if (rec.priority === "low") groups.low.push(rec);
  }
  return groups;
});
</script>

<style scoped>
.recommendations-container {
  @apply mt-6 bg-white/5 rounded-lg p-4;
}
.recommendations-title {
  @apply text-base font-semibold mb-4 text-lg;
}
.recommendations-cards {
  @apply flex flex-row gap-3;
}
.priority-card {
  @apply rounded-lg px-4 py-3 flex-1 min-w-[220px] max-w-[300px] flex flex-col justify-center;
}
.priority-header {
  @apply flex items-center mb-1  pr-1;
}
.priority-dot {
  @apply w-2 h-2 rounded-full mr-2;
}
.priority-title {
  @apply text-base font-semibold;
}
.recommendation-list {
  @apply m-0 p-0 list-none;
}
.recommendation-list li {
  @apply text-sm whitespace-normal break-words leading-tight my-1;
  max-width: 260px;
  overflow-wrap: anywhere;
}

/* Light mode overrides */
.light-mode {
  background-color: white; /* light gray background */
  border: 1px solid #e5e7eb; /* light border */
  border-radius: 0.5rem; /* rounded-lg */
  padding: 1rem; /* p-4 */
}
</style>
