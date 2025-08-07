<!-- components/handles/DefaultTargetHandle.vue (criar pasta handles) -->
<template>
  <Handle
    type="target"
    :position="Position.Top"
    :id="`${nodeId}-target`"
    class="!w-6 !h-2 !bg-[#47464B] border border-[#E0E0E0] !opacity-100 !rounded-none !-top-[3px]"
  />
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
defineProps<{ nodeId: string }>();
</script>
