<template>
  <div
    class="empty-card-action-container flex items-center justify-center text-center cursor-pointer p-4 group h-full"
    data-testid="add-source"
    :class="textColorClass"
    role="button"
    tabindex="0"
    @click.stop="$emit('action')"
    @keydown.enter="$emit('action')"
    @keydown.space.prevent="$emit('action')"
  >
    <component
      v-if="icon"
      :is="icon"
      class="w-5 h-5 mr-1.5 transition-colors duration-150"
      :class="iconColorClass"
    />
    <span
      class="text-sm font-medium transition-colors duration-150"
      :class="{ 'group-hover:underline': enableHoverUnderline }"
    >
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { Component, PropType } from "vue";
import { computed } from "vue"; // Adicionado computed

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  icon: {
    // Aceita tanto componentes de objeto quanto componentes funcionais (stubs nos testes)
    type: [Object, Function] as unknown as PropType<Component | null>,
    default: null,
  },
  actionClass: {
    type: String,
    default: "primary",
  },
  enableHoverUnderline: {
    type: Boolean,
    default: true,
  },
});

defineEmits(["action"]);

const textColorClass = computed(() => {
  if (props.actionClass === "primary") {
    return "text-[#4D6BFE] hover:text-[#6F8AFF]";
  }
  return "text-[#4D6BFE] hover:text-[#6F8AFF]";
});

const iconColorClass = computed(() => {
  return "";
});
</script>

<style scoped>
.empty-card-action-container:focus-visible {
  outline: 2px solid
    v-bind("props.actionClass === 'primary' ? '#4D6BFE' : '#9CA3AF'");
  outline-offset: 2px;
  border-radius: 0.375rem; /* rounded-md */
}
</style>
