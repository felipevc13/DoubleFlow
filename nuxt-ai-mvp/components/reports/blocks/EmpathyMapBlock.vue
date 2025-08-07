<template>
  <div
    :class="[
      'bg-white  rounded-lg border border-gray-200 shadow-sm mb-8 ',
      light ? '' : 'bg-gray-800 text-white border-gray-700 ',
    ]"
  >
    <div class="p-8">
      <h2 class="text-xl font-semibold text-gray-800 flex items-center gap-2">
        <EmpathyMapIcon class="w-7 h-7 text-[#9A9A9C]" />
        Mapa de Empatia
      </h2>
    </div>
    <div class="border-b border-gray-200"></div>
    <div class="p-8">
      <PostItBoard
        v-if="empathyMapDataForBoard.length > 0"
        :clusters="empathyMapDataForBoard"
        layout="quadrant"
        :light="light"
        :cluster-colors="
          light
            ? ['bg-yellow-100', 'bg-blue-100', 'bg-pink-100', 'bg-green-100']
            : ['bg-yellow-700', 'bg-blue-700', 'bg-pink-700', 'bg-green-700']
        "
      />
      <p
        v-else
        :class="light ? 'text-gray-500 italic' : 'text-gray-300 italic'"
      >
        Nenhum dado para o mapa de empatia.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PostItBoard from "~/components/cards/content/PostItBoard.vue";
import EmpathyMapIcon from "@/components/icon/EmpathIcon.vue";

interface EmpathyMapBlockProps {
  data: any; // pode vir em diferentes formatos
  light?: boolean;
}

const props = withDefaults(defineProps<EmpathyMapBlockProps>(), {
  light: false,
});

const empathyMapDataForBoard = computed(() => {
  if (!props.data) return [];

  // A fonte pode vir diretamente ou aninhada
  const source = (props.data as any).says
    ? props.data
    : (props.data as any).empathy_map_results
    ? (props.data as any).empathy_map_results
    : (props.data as any).analyzedData?.empathy_map ?? {};

  return [
    { title: "Diz", items: source.says ?? [] },
    { title: "Pensa", items: source.thinks ?? [] },
    { title: "Faz", items: source.does ?? [] },
    { title: "Sente", items: source.feels ?? [] },
  ];
});

const light = props.light === true;
</script>
