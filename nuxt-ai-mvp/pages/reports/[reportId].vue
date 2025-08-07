<template>
  <div class="min-h-screen w-full bg-gray-50 px-4 py-12">
    <div class="relative max-w-4xl mx-auto">
      <div v-if="loading" class="text-center text-gray-500 py-16">
        Carregando relatório...
      </div>
      <div v-else-if="error" class="text-center text-red-500 py-16">
        {{ error }}
      </div>
      <div v-else-if="report" class="report-container">
        <!-- Cabeçalho padronizado -->
        <div class="bg-white rounded-xl shadow p-8 mb-8">
          <h1 class="report-title">{{ report.title }}</h1>
          <p class="report-summary">{{ report.summary }}</p>
        </div>

        <!-- Renderização Dinâmica dos Blocos -->
        <div v-if="report.report_blocks && report.report_blocks.length">
          <component
            v-for="(block, index) in report.report_blocks"
            :key="`${block.type}-${index}`"
            :is="getBlockComponent(block.type)"
            :data="block.data"
            :light="true"
          />
        </div>
        <div v-else class="text-center text-gray-500">
          Este relatório não possui blocos de conteúdo.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta } from "#imports";
import type { Component } from "vue";
import { shallowRef } from "vue";
import { useSeoMeta } from "nuxt/app";

definePageMeta({ layout: "blank" });

import { useRoute } from "vue-router";
import { ref, onMounted, watchEffect } from "vue";
import { useSupabaseClient } from "#imports";

// Importar os componentes de bloco dinamicamente para otimização
const ProblemContextBlock = shallowRef<Component | null>(null);
const InsightsBlock = shallowRef<Component | null>(null);
const EmpathyMapBlock = shallowRef<Component | null>(null);
const AffinityMapBlock = shallowRef<Component | null>(null);

onMounted(() => {
  import("~/components/reports/blocks/ProblemContextBlock.vue").then(
    (module) => (ProblemContextBlock.value = module.default)
  );
  import("~/components/reports/blocks/InsightsBlock.vue").then(
    (module) => (InsightsBlock.value = module.default)
  );
  import("~/components/reports/blocks/EmpathyMapBlock.vue").then(
    (module) => (EmpathyMapBlock.value = module.default)
  );
  import("~/components/reports/blocks/AffinityMapBlock.vue").then(
    (module) => (AffinityMapBlock.value = module.default)
  );
});

const blockComponentMap: Record<string, any> = {
  problem_context: ProblemContextBlock,
  insights_block: InsightsBlock,
  empathy_map_block: EmpathyMapBlock,
  affinity_map_block: AffinityMapBlock,
};

const getBlockComponent = (type: string) => {
  const compRef = blockComponentMap[type];
  return compRef?.value || null;
};

const route = useRoute();
const reportId = route.params.reportId as string;

const report = ref<any>(null);
const loading = ref(true);
const error = ref("");

// Atualiza os metadados dinamicamente quando o relatório está disponível
watchEffect(() => {
  if (report.value) {
    useSeoMeta({
      title: `${report.value.title} - Relatório DoubleFlow`,
      description:
        report.value.summary ||
        "Veja os insights e conclusões deste relatório gerado no DoubleFlow.",
      ogTitle: report.value.title,
      ogDescription: report.value.summary,
      // ogImage: 'URL_DINAMICA_RELATORIO.png', // Personalize se quiser gerar uma imagem por relatório
      // twitterCard: 'summary_large_image',
    });
  }
});

const fetchReport = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data, error: supaError } = await useSupabaseClient()
      .from("reports")
      .select("id, title, summary, report_blocks, task_id") // <<< Seleciona report_blocks
      .eq("id", reportId)
      .single();

    if (supaError) throw supaError;
    if (!data) throw new Error("Relatório não encontrado.");
    report.value = data;
  } catch (err: any) {
    error.value = err?.message || "Erro ao buscar relatório.";
  } finally {
    loading.value = false;
  }
};

onMounted(fetchReport);
</script>

<style scoped>
.back-link {
  font-size: 0.875rem; /* text-sm */
  color: #2563eb; /* text-blue-600 */
  text-decoration: none;
  margin-bottom: 1rem; /* mb-4 */
  display: block;
  transition: color 0.2s;
}
.back-link:hover {
  text-decoration: underline;
  color: #1d4ed8; /* hover:text-blue-700 (aproximação) */
}
.report-title {
  font-size: 2.25rem; /* text-4xl */
  font-weight: 700; /* font-bold */
  color: #111827; /* text-gray-900 */
  line-height: 2.5rem;
}
.report-summary {
  margin-top: 2rem; /* mt-2 */
  font-size: 1rem; /* text-lg */
  color: #4b5563; /* text-gray-600 */
}
</style>
