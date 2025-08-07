<template>
  <section class="bg-[#171717] w-full py-16 md:py-24">
    <div
      class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between px-4 gap-10"
    >
      <!-- Left: Headline, Subheadline, CTA -->
      <div class="flex-1 flex flex-col md:items-start text-center md:text-left">
        <h1 class="text-3xl md:text-5xl font-bold text-white mb-4">
          {{ headline }}
        </h1>
        <p class="text-lg md:text-2xl text-white mb-8 font-medium">
          {{ subheadline }}
        </p>
        <NuxtLink
          to="/register"
          class="w-full md:w-auto inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition text-center"
        >
          Comece a usar de graça
        </NuxtLink>
      </div>
      <!-- Right: Slot for image/visual -->
      <div
        class="flex-1 flex justify-center md:justify-end w-full mt-10 md:mt-0"
      >
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  headline: string;
  subheadline: string;
}>();
</script>
