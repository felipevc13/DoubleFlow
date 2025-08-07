<template>
  <div class="bg-white rounded-lg border border-gray-200 mb-6 shadow-sm">
    <div class="flex items-center gap-2 px-8 py-8">
      <ProblemIcon class="w-7 h-7 text-[#9A9A9C]" />
      <h2 class="text-xl font-semibold text-gray-800">Problema Inicial</h2>
    </div>
    <div class="border-b border-gray-200"></div>
    <div class="space-y-2 px-8 py-8">
      <h3 class="text-lg font-semibold text-gray-700">{{ data.title }}</h3>
      <p class="text-base text-gray-600 whitespace-pre-wrap">
        {{ data.description }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProblemIcon from "@/components/icon/ProblemIcon.vue";

interface ProblemData {
  title: string;
  description: string;
}

defineProps<{
  data: ProblemData;
}>();
</script>
