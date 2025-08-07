<template>
  <div
    :class="`analysis-card rounded-lg p-4 flex flex-col border ${
      light ? 'bg-white/90 border-gray-300' : 'bg-white/5 border-white/10'
    }`"
  >
    <h3
      :class="`card-title text-base font-semibold mb-4 ${
        light ? 'text-gray-900' : 'text-white'
      }`"
    >
      Análise Quantitativa
    </h3>
    <div class="card-content flex-1">
      <div
        v-if="!kpis || kpis.length === 0"
        :class="`text-center text-sm italic py-8 ${
          light ? 'text-gray-600' : 'text-gray-500'
        }`"
      >
        Nenhuma métrica quantitativa encontrada.
      </div>
      <div v-else class="kpi-grid grid grid-cols-1 md:grid-cols-1 gap-6">
        <div
          v-for="(kpi, index) in kpis"
          :key="`kpi-${index}`"
          :class="`kpi-card rounded-md p-4 flex flex-row items-center justify-between gap-2 min-h-[72px] max-w-full ${
            light ? 'border-gray-100' : 'bg-white/5'
          }`"
        >
          <div
            class="kpi-info flex flex-col items-start justify-center"
            style="min-width: 0; width: 60%; max-width: 220px"
          >
            <span
              :class="`kpi-title text-sm font-semibold mb-0.5 ${
                light ? 'text-gray-900' : 'text-gray-200'
              }`"
              :title="kpi.metric"
              style="
                line-height: 1.15;
                white-space: normal;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                width: 100%;
                max-width: 100%;
                line-clamp: 3;
              "
            >
              {{ kpi.metric }}
            </span>
            <span
              :class="`kpi-value text-lg font-bold mb-0.5 ${
                light ? 'text-blue-700' : 'text-blue-400'
              }`"
              >{{ kpi.value }}</span
            >
            <p
              v-if="kpi.details"
              :class="`kpi-details text-xs italic ${
                light ? 'text-gray-600' : 'text-gray-400'
              }`"
            >
              {{ kpi.details }}
            </p>
          </div>

          <!-- Gráfico de Barras para Distribuição -->
          <BarDistributionChart
            v-if="kpi.distribution && Object.keys(kpi.distribution).length > 0"
            :distribution="kpi.distribution"
            class="flex-1 max-w-[180px] w-32 md:w-40"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { KpiMetric } from "~/types/taskflow"; // Importe a interface
import BarDistributionChart from "~/components/cards/content/BarDistributionChart.vue";

const props = defineProps({
  kpis: {
    type: Array as PropType<KpiMetric[]>,
    required: true,
  },
  light: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
@media (max-width: 640px) {
  .kpi-title {
    -webkit-line-clamp: unset;
    line-clamp: unset;
    display: block;
    overflow: visible;
    text-overflow: unset;
  }
}
</style>
