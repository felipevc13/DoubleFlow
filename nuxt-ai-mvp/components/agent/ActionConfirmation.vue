<template>
  <div
    class="p-4 bg-[#23232A] border border-[#393939] rounded-lg text-white space-y-4"
  >
    <p class="text-sm text-gray-300 whitespace-pre-wrap">
      {{ displayMessage }}
    </p>
    <div class="flex justify-end space-x-3">
      <button @click="$emit('cancel')" class="btn btn-sm btn-ghost">
        Cancelar
      </button>
      <button @click="$emit('confirm')" class="btn btn-sm btn-primary">
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
  displayMessage: string;
}

const props = defineProps<{
  action: ActionProposal;
}>();

defineEmits(["confirm", "cancel"]);

const displayMessage = computed(() => {
  return (
    props.action.displayMessage || "A IA propõe a seguinte ação. Você confirma?"
  );
});
</script>
