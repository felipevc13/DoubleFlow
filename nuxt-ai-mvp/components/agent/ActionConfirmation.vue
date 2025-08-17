<template>
  <div
    class="p-4 bg-[#23232A] border border-[#393939] rounded-lg text-white space-y-4"
  >
    <p class="text-sm text-gray-300 whitespace-pre-wrap">
      {{ messageToShow }}
    </p>
    <div class="flex justify-end space-x-3">
      <button @click="emit('cancel', action)" class="btn btn-sm btn-ghost">
        Cancelar
      </button>
      <button @click="emit('confirm', action)" class="btn btn-sm btn-primary">
        Confirmar
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface ActionProposal {
  tool_name: string;
  parameters: Record<string, any>;
}

const props = defineProps<{
  action: ActionProposal;
  displayMessage?: string;
}>();

const emit = defineEmits<{
  (e: "confirm", action: ActionProposal): void;
  (e: "cancel", action: ActionProposal): void;
}>();

const action = props.action;

const messageToShow = computed(() => {
  return props.displayMessage || "A IA propõe a seguinte ação. Você confirma?";
});
</script>
