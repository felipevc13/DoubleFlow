<!-- Exemplo: components/reports/blocks/InsightsBlock.vue -->
<template>
  <div class="bg-white rounded-lg border border-gray-200 mb-6 shadow-sm">
    <div class="flex items-center gap-2 p-8">
      <InsightIcon class="w-7 h-7" />
      <h2 class="text-xl font-semibold text-gray-800">Análise de Insights</h2>
    </div>
    <div class="border-b border-gray-200"></div>
    <div class="w-full p-8">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <QuantitativeAnalysis :kpis="data.quantitativeKpis" :light="true" />
        <QualitativeAnalysis
          :insights="data.qualitativeInsights"
          :light="true"
        />
      </div>
      <ActionRecommendations
        v-if="
          data.actionableRecommendations &&
          data.actionableRecommendations.length
        "
        :recommendations="data.actionableRecommendations"
        :light="true"
        class="mt-6"
      />
    </div>
  </div>
</template>

<script setup>
import QuantitativeAnalysis from "~/components/cards/content/QuantitativeAnalysis.vue";
import QualitativeAnalysis from "~/components/cards/content/QualitativeAnalysis.vue";
import ActionRecommendations from "~/components/cards/content/ActionRecommendations.vue";
import InsightIcon from "@/components/icon/InsightIcon.vue";

defineProps({ data: { type: Object, required: true } });
</script>

<style scoped>
.report-block {
  background-color: #fff;
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
.dashboard-layout {
  /* Estilos do InsightsCard original */
  width: 100%;
  height: 100%;
}
.main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  width: 100%;
}
@media (min-width: 768px) {
  .main-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
