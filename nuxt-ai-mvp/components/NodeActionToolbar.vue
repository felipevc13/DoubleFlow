<template>
  <NodeToolbar
    :is-visible="isVisible"
    :node-id="nodeId"
    :position="toolbarPosition as any"
    align="center"
    :offset="10"
    class="node-action-toolbar-container rounded-md px-2 py-1.5 flex flex-col items-center gap-2 bg-[#232227]/90 backdrop-blur-sm border border-[#393939] shadow-lg"
  >
    <button
      v-if="canEdit"
      @click.stop="$emit('edit-node', nodeId)"
      class="node-action-button"
      title="Editar Nó"
      aria-label="Editar Nó"
    >
      <PencilSquareIcon class="h-5 w-5" />
    </button>

    <button
      v-if="canRefresh"
      @click.stop="$emit('refresh-node', nodeId)"
      class="node-action-button"
      :class="{ 'opacity-50 cursor-not-allowed': isRefreshDisabled }"
      :disabled="isRefreshDisabled"
      title="Atualizar Análise"
      aria-label="Atualizar Análise"
    >
      <ArrowPathIcon class="h-5 w-5" />
    </button>

    <div
      v-if="canDelete && canEdit && deletable"
      class="h-px w-full bg-[#393939] my-0.5"
    ></div>
    <!-- Divisor sutil -->

    <button
      v-if="toolbarCanLock"
      @click.stop="$emit('toggle-draggable', nodeId)"
      class="node-action-button"
      :title="isNodeDraggable ? 'Travar Nó' : 'Destravar Nó'"
      :aria-label="isNodeDraggable ? 'Travar Nó' : 'Destravar Nó'"
    >
      <LockOpenIcon v-if="isNodeDraggable" class="h-5 w-5" />
      <LockClosedIcon v-else class="h-5 w-5 text-blue-400" />
    </button>

    <button
      v-if="canDelete && deletable"
      @click.stop="$emit('delete-node', nodeId)"
      class="node-action-button delete-button"
      title="Excluir Nó"
      aria-label="Excluir Nó"
      data-testid="delete-node"
    >
      <TrashIcon class="h-5 w-5" />
    </button>

    <slot name="additional-actions"></slot>
  </NodeToolbar>
</template>

<script setup lang="ts">
type Position = "left" | "right" | "top" | "bottom";

import { NodeToolbar } from "@vue-flow/node-toolbar";
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowPathIcon,
  LockOpenIcon,
  LockClosedIcon,
} from "@heroicons/vue/24/outline";
import { computed } from "vue";
import { useTaskFlowStore } from "~/stores/taskFlow";

const props = defineProps({
  isVisible: { type: Boolean, default: false }, // Controlado pela prop 'selected' do BaseNodeCard
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true }, // Usado para lógica condicional se necessário

  canEdit: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: true },
  deletable: { type: Boolean, default: true }, // Nova prop para controlar se o nó é realmente deletável
  canRefresh: { type: Boolean, default: false },
  isRefreshDisabled: { type: Boolean, default: true }, // Default true, habilitar quando houver input
  toolbarPosition: { type: String as () => Position, default: "left" },
  toolbarCanLock: { type: Boolean, default: false },
});

const taskFlowStore = useTaskFlowStore();

const isNodeDraggable = computed(() => {
  const node = taskFlowStore.nodes.find((n) => n.id === props.nodeId);
  return node?.draggable ?? false;
});

defineEmits<{
  (e: "edit-node", nodeId: string): void;
  (e: "delete-node", nodeId: string): void;
  (e: "refresh-node", nodeId: string): void;
  (e: "toggle-draggable", nodeId: string): void;
}>();
</script>

<style scoped>
.node-action-toolbar-container {
  z-index: 10;
}

.node-action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem; /* p-2 */
  border-radius: 0.375rem; /* rounded-md */
  color: #abb2bd;
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out;
}

.node-action-button:hover:not(:disabled) {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.08);
}
.node-action-button:focus:not(:disabled) {
  outline: 2px solid transparent;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #1f1f1f, 0 0 0 4px #4d6bfe; /* Ajustado para fundo mais escuro */
}

.node-action-button.delete-button:hover:not(:disabled) {
  color: #f87171;
  background-color: rgba(248, 113, 113, 0.1);
}
.node-action-button.delete-button:focus:not(:disabled) {
  box-shadow: 0 0 0 2px #1f1f1f, 0 0 0 4px #f87171;
}

.node-action-button:disabled {
  color: #52525b; /* Cor para ícone desabilitado */
}

.text-blue-400 {
  --tw-text-opacity: 1;
  color: rgba(96, 165, 250, var(--tw-text-opacity));
}
</style>
