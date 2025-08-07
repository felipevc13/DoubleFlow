<template>
  <div class="report-block">
    <h2 class="report-block-title">Recomendações Acionáveis</h2>
    <div class="mt-4">
      <ActionRecommendations
        v-if="data && data.length > 0"
        :recommendations="data"
      />
      <p v-else class="text-gray-500 italic">
        Nenhuma recomendação foi gerada.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionRecommendations from "~/components/cards/content/ActionRecommendations.vue";
import type { ActionRecommendation } from "~/types/taskflow";

defineProps<{
  data: ActionRecommendation[];
}>();
</script>

<style scoped>
.report-block {
  background-color: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
.report-block-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
}
</style>
