<template>
  <div
    class="flex items-center p-3 rounded-md cursor-pointer transition-colors duration-150 group"
    :class="hoverClass"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Icon Slot/Placeholder -->
    <div
      class="mr-3 flex-shrink-0 w-8 h-8 flex items-center justify-center bg-[#2C2B30] rounded-md"
    >
      <slot name="icon">
        <!-- Default placeholder icon -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="w-5 h-5 text-[#9A9A9C] group-hover:text-white"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </slot>
    </div>
    <!-- Title and Description -->
    <div class="flex-grow">
      <h4 class="text-sm font-medium text-white">{{ title }}</h4>
      <p class="text-xs text-[#9A9A9C]">{{ description }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
});

const isHovered = ref(false);

const hoverClass = computed(() => {
  // Similar ao estilo de fundo levemente mais claro no hover da imagem
  return isHovered.value ? "bg-white/5" : "hover:bg-white/5";
});
</script>

<style scoped>
/* Add specific styles if needed */
.bg-white\/5 {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
