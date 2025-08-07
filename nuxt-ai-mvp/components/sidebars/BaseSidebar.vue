<template>
  <div
    class="h-full transition-all duration-300 ease-in-out border-l border-[#2C2B30] bg-[#171717]"
    :class="[
      isOpen ? 'w-[400px]' : 'w-0',
      'overflow-hidden'
    ]"
  >
    <div class="h-full">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSidenavStore } from '~/stores/sidenav';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const sidenavStore = useSidenavStore();

// Computed para controlar a classe do layout baseado no sidenav apenas
const layoutClass = computed(() => {
  return {
    'mr-[72px]': sidenavStore.isCollapsed,
    'mr-[234px]': !sidenavStore.isCollapsed
  };
});
</script>

<style scoped>
:deep(.overflow-y-auto) {
  scrollbar-width: thin;
  scrollbar-color: #4D6BFE #2C2B30;
}

:deep(.overflow-y-auto::-webkit-scrollbar) {
  width: 6px;
}

:deep(.overflow-y-auto::-webkit-scrollbar-track) {
  background: #2C2B30;
}

:deep(.overflow-y-auto::-webkit-scrollbar-thumb) {
  background-color: #4D6BFE;
  border-radius: 3px;
}
</style> 