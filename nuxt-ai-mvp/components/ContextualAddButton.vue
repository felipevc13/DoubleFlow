<template>
  <!-- Container for line and "+" button (Handle) - ALWAYS VISIBLE -->
  <div
    ref="contextualContainer"
    class="absolute left-1/2 -translate-x-1/2 h-[60px] w-6 -bottom-[60px] pointer-events-none"
  >
    <!-- Connection Line -->
    <div
      class="absolute left-1/2 top-0 -translate-x-1/2 w-[1px] h-full bg-[#A9A9AE] z-[5]"
    ></div>

    <!-- Plus Button (Handle) -->
    <Handle
      type="source"
      :id="`${nodeId}-source-plus`"
      :position="Position.Bottom"
      class="card-handle add-node-handle"
      :style="{
        left: '50%',
        bottom: 0,
        transform: 'translate(-50%, 50%)',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 12,
        pointerEvents: 'all',
        boxShadow: '0 2px 8px #0002',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }"
      @mousedown.left="handlePlusMouseDown"
      @click.left.stop="handlePlusClick"
    >
      <span class="plus-icon">+</span>
    </Handle>

    <!-- NodeToolbar for Popup Contextual -->
    <NodeToolbar
      :is-visible="showContextualPopup"
      :node-id="nodeId"
      :position="Position.Bottom"
      align="center"
      :offset="20"
    >
      <ContextualAddNodePopup
        v-if="showContextualPopup"
        :nodeTypes="filteredNodeTypes"
        @select-node-type="handleNodeTypeSelectedFromPopup"
        @close="closeContextualPopup"
      />
    </NodeToolbar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { Handle, Position, useVueFlow } from "@vue-flow/core";
import { NodeToolbar } from "@vue-flow/node-toolbar";
import ContextualAddNodePopup from "~/components/ContextualAddNodePopup.vue";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { nodeDisplayInfoList } from "~/lib/nodeDisplayInfo";
import { connectionRules } from "~/lib/connectionRules";
import usePlusButtonLogic from "~/composables/usePlusButtonLogic";
import { useConnectionControlStore } from "~/stores/connectionControl";
const connectionControlStore = useConnectionControlStore();

const props = defineProps<{
  nodeId: string;
  nodeType: string;
}>();

const contextualContainer = ref<HTMLElement | null>(null);

const {
  handlePlusMouseDown,
  handlePlusClick,
  showContextualPopup,
  closeContextualPopup,
} = usePlusButtonLogic({ nodeId: props.nodeId });

const filteredNodeTypes = computed(() => {
  const allowed =
    connectionRules[props.nodeType as keyof typeof connectionRules] || {};
  return nodeDisplayInfoList.filter(
    (info) => (allowed as Record<string, boolean>)[info.type]
  );
});

const vueFlow = useVueFlow();
const taskFlowStore = useTaskFlowStore();

async function handleNodeTypeSelectedFromPopup(selectedType: string) {
  connectionControlStore.setLastInteractionWasSimpleClickOnSource(false);
  connectionControlStore.setDragInProgress(false);

  const node = vueFlow.findNode(props.nodeId);
  if (!node) {
    console.error(`[ContextualAddButton] Node ${props.nodeId} not found!`);
    closeContextualPopup();
    return;
  }

  // 1. pede à store para criar o nó e conectar a aresta
  const newNode = await taskFlowStore.addNodeAndConnect(
    selectedType,
    props.nodeId, // sourceNodeId
    node.position,
    node.dimensions?.height
  );

  // Garantir que o flag isLoadingEdgeConnection seja removido/ajustado se necessário
  if (newNode && newNode.data.isLoadingEdgeConnection) {
    newNode.data.isLoadingEdgeConnection = false;
  }

  // await nextTick(); // Não é mais necessária pois as operações já usam nextTick internamente

  closeContextualPopup();
}
</script>

<style scoped>
.add-node-handle {
  background: #232227;
  border: 1px solid #a9a9ae;
  color: #ffff;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.5rem;
  font-weight: 700;
  box-shadow: 0 2px 6px #0002;
  z-index: 12;
  transition: border 0.18s, color 0.18s, background 0.18s;
}
.add-node-handle:hover,
.add-node-handle:focus {
  border-color: #4d6bfe !important;
  color: #fff;
  background: #232227;
}
.plus-icon {
  display: block;
  position: relative;
  top: 0.5px; /* Fine-tune vertical alignment if needed */
  font-size: 28px; /* Adjust size as needed */
  line-height: 32px; /* Match handle height for centering */
  font-weight: 100; /* Lighter font weight for "+" */
  font-family: Inter, Arial, sans-serif;
  pointer-events: none;
}
</style>
