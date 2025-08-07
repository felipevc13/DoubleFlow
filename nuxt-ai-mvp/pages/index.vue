<template>
  <div class="min-h-screen bg-[#171717] text-white flex flex-col">
    <LandingHeader />
    <main class="flex flex-col flex-1 items-center px-4 pb-10">
      <HeroSection
        headline="Visualize o Fluxo. Automatize o Insight."
        subheadline="DoubleFlow é a tela inteligente para organizar tarefas, gerar pesquisas e automatizar análise de dados qualitativos, sem código."
      />
      <FeaturesSection :features="productFeatures" />
    </main>
    <!-- <LandingFooter /> se desejar -->
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import LandingHeader from "~/components/landing/LandingHeader.vue";
import HeroSection from "~/components/landing/HeroSection.vue";
import FeaturesSection from "~/components/landing/FeaturesSection.vue";
import { useSeoMeta } from "nuxt/app";

useSeoMeta({
  title: "DoubleFlow: Ferramenta Visual de Tarefas e Análise com IA",
  description:
    "Organize projetos, crie pesquisas e automatize a geração de insights e mapas de empatia com a plataforma visual inteligente DoubleFlow.",
  ogTitle: "DoubleFlow: Ferramenta Visual de Tarefas e Análise com IA",
  ogDescription:
    "Deixe a IA trabalhar por você. Crie fluxos, pesquisas e relatórios de forma intuitiva.",
  // ogImage: 'URL_DA_SUA_IMAGEM_LANDING_PAGE.png', // Imagem específica para a landing page
  // twitterCard: 'summary_large_image',
});
// @ts-expect-error: definePageMeta é macro do Nuxt
definePageMeta({ layout: "blank" });

const productFeatures = ref([
  {
    title: "Dê forma às suas ideias, sem limites.",
    description:
      "Abandone as listas estáticas e organize tudo visualmente com drag-and-drop, cards dinâmicos e integração com IA.",
    visual: "placeholder.mp4",
  },
  {
    title: "Crie pesquisas e colete dados em segundos.",
    description:
      "Gere surveys inteligentes, compartilhe com o time ou clientes e tenha os resultados prontos para análise instantânea.",
    visual: "placeholder.mp4",
  },
  {
    title: "Insights automáticos, dashboards prontos.",
    description:
      "Deixe a IA gerar análises qualitativas e quantitativas. Veja dashboards e relatórios prontos, prontos para apresentação.",
    visual: "placeholder.mp4",
  },
]);
</script>
