<template>
  <div
    class="base-node-card"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Handle de Target Padrão (se habilitado) -->
    <DefaultTargetHandle v-if="showDefaultTargetHandle" :node-id="nodeId" />
    <!--
      OU, se não quiser criar DefaultTargetHandle.vue e preferir o markup direto:
      <Handle
        v-if="showDefaultTargetHandle"
        type="target"
        :position="Position.Top"
        :id="`${nodeId}-target`"
        class="!w-6 !h-2 !bg-[#47464B] border border-[#E0E0E0] !opacity-100 !rounded-none !-top-[3px]"
      />
    -->

    <div
      ref="cardRef"
      class="card-shell text-white rounded-lg shadow-lg flex flex-col"
      :class="[
        selected ? 'border-selected' : 'border-default',
        dynamicWidthClass,
      ]"
      :style="autoHeight ? undefined : { minHeight: minCardHeightComputed }"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-4 pt-3 pb-3 border-b border-[#393939] flex-shrink-0 relative"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="mr-0 flex-shrink-0 w-10 h-10 flex items-center justify-center bg-[#2C2B30] rounded-md"
          >
            <slot name="icon">
              <svg
                class="w-5 h-5 text-[#9A9A9C]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"
                ></path>
              </svg>
            </slot>
          </div>
          <span
            class="text-base font-medium text-[#E0E0E0] truncate"
            :title="nodeTypeLabel"
          >
            {{ nodeTypeLabel }}
          </span>
        </div>
        <div class="flex-shrink-0">
          <slot name="header-actions"></slot>
        </div>
      </div>

      <!-- Corpo Principal -->
      <div
        class="flex-1 flex flex-col p-4 overflow-hidden"
        :class="{ 'items-center justify-center': centerContent }"
      >
        <div v-if="contentTitle && hasContent" class="mb-3 flex-shrink-0">
          <!-- Adicionado hasContent aqui -->
          <h2
            class="text-lg font-semibold text-white truncate"
            :title="contentTitle"
          >
            {{ contentTitle }}
          </h2>
        </div>
        <div
          class="flex-grow"
          :class="{
            'overflow-y-auto custom-scrollbar': !isLoading && hasContent,
          }"
        >
          <div v-if="isLoading" class="flex items-center justify-center h-full">
            <div class="base-node-card-spinner"></div>
          </div>
          <slot v-else></slot>
        </div>
      </div>

      <!-- Footer Slot -->
      <div v-if="$slots.footer" class="px-4 pb-4 pt-2 flex-shrink-0">
        <slot name="footer"></slot>
      </div>
    </div>

    <!-- Toolbar de Ações do Nó -->
    <NodeActionToolbar
      :is-visible="selected || (showToolbarOnHover && isHovered)"
      :node-id="nodeId"
      :node-type="rawNodeType"
      :can-edit="toolbarCanEdit"
      :can-delete="toolbarCanDelete"
      :deletable="nodeDeletable"
      :can-refresh="toolbarCanRefresh"
      :toolbar-can-lock="toolbarCanLock"
      :is-refresh-disabled="toolbarIsRefreshDisabled"
      :toolbar-position="toolbarPosition"
      @edit-node="$emit('toolbar-edit-node', nodeId)"
      @delete-node="$emit('toolbar-delete-node', nodeId)"
      @refresh-node="$emit('toolbar-refresh-node', nodeId)"
      @toggle-draggable="handleToggleDraggable"
    >
      <template #additional-actions>
        <slot name="toolbar-additional-actions"></slot>
      </template>
    </NodeActionToolbar>

    <!-- Botão de Adicionar Contextual -->
    <ContextualAddButton
      :node-id="nodeId"
      :node-type="rawNodeType"
      v-show="showContextualAddButton"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from "vue";
import { useTaskFlowStore } from "~/stores/taskFlow";
import ContextualAddButton from "~/components/ContextualAddButton.vue";
import NodeActionToolbar from "~/components/NodeActionToolbar.vue";
import { Position, useVueFlow } from "@vue-flow/core"; // Importar Position para a prop da toolbar e useVueFlow
// Importar o Handle se for usar o markup direto, ou o componente DefaultTargetHandle
// import { Handle } from "@vue-flow/core";
import DefaultTargetHandle from "~/components/handles/DefaultTargetHandle.vue"; // Importar o novo componente

// Estratégia: Persiste dimensões reais do card na store para layout preciso e carregamento estável (híbrido pro).

// Se não usar lodash, crie um debounce simples:
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let t: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  }) as T;
}

const props = defineProps({
  nodeId: { type: String, required: true },
  rawNodeType: { type: String, required: true },
  nodeTypeLabel: { type: String, required: true },
  contentTitle: { type: String, default: "" },
  selected: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  emptyStateWidthClass: { type: String, default: "w-[300px]" },
  contentWidthClass: { type: String, default: "" },
  minCardHeight: { type: String, default: "150px" },
  /**
   * Faz o card crescer conforme o conteúdo quando true (sem minHeight).
   */
  autoHeight: { type: Boolean, default: false },
  hasContent: { type: Boolean, default: false },
  centerContentWhenEmpty: { type: Boolean, default: true },
  showContextualAddButton: { type: Boolean, default: true },
  showDefaultTargetHandle: { type: Boolean, default: true }, // <<< NOVA PROP

  // Props para controlar a NodeActionToolbar
  toolbarCanEdit: { type: Boolean, default: true },
  toolbarCanDelete: { type: Boolean, default: true },
  nodeDeletable: { type: Boolean, default: true },
  toolbarCanRefresh: { type: Boolean, default: false },
  toolbarIsRefreshDisabled: { type: Boolean, default: true },
  toolbarPosition: { type: String as () => Position, default: Position.Left },
  showToolbarOnHover: { type: Boolean, default: false },
  toolbarCanLock: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (e: "toolbar-edit-node", nodeId: string): void;
  (e: "toolbar-delete-node", nodeId: string): void;
  (e: "toolbar-refresh-node", nodeId: string): void;
  (e: "toolbar-toggle-draggable", nodeId: string): void;
}>();

const isHovered = ref(false);

const dynamicWidthClass = computed(() => {
  if (props.hasContent && props.contentWidthClass) {
    return props.contentWidthClass;
  }
  return props.emptyStateWidthClass;
});

const minCardHeightComputed = computed(() => {
  if (props.minCardHeight.startsWith("min-h-")) {
    return undefined;
  }
  return /^\d+$/.test(props.minCardHeight)
    ? `${props.minCardHeight}px`
    : props.minCardHeight;
});

const centerContent = computed(() => {
  return !props.hasContent && props.centerContentWhenEmpty && !props.isLoading;
});

const cardRef = ref(null);
const taskFlowStore = useTaskFlowStore();

const { updateNodeInternals, setNodes } = useVueFlow();

async function handleToggleDraggable(id: string) {
  
  // 1) Atualiza estado na store (persistência)
  taskFlowStore.toggleNodeDraggable(id);

  await nextTick();

  // 2) Força o Vue Flow a recriar o node com o novo draggable
  setNodes((nodes) =>
    nodes.map((n) => (n.id === id ? { ...n, draggable: !n.draggable } : n))
  );


}

onMounted(() => {
  const { updateNodeInternals } = useVueFlow();
  let lastSize = { width: 0, height: 0 };
  const debouncedUpdate = debounce((width: number, height: number) => {
    // Só salva se mudou
    if (width !== lastSize.width || height !== lastSize.height) {
      lastSize = { width, height };
      taskFlowStore.updateNodeDimensions?.(props.nodeId, { width, height });
      nextTick(() => updateNodeInternals([props.nodeId]));
    }
  }, 350);
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      let width: number, height: number;

      // Usa borderBoxSize quando disponível (mais preciso para width real)
      if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
        const borderBox = entry.borderBoxSize[0];
        width = borderBox.inlineSize;
        height = borderBox.blockSize;
      } else {
        // Fallback para contentRect para navegadores antigos
        width = entry.contentRect.width;
        height = entry.contentRect.height;
      }

      debouncedUpdate(width, height);
    }
  });
  if (cardRef.value) resizeObserver.observe(cardRef.value);
  onBeforeUnmount(() => resizeObserver.disconnect());
});
</script>

<style scoped>
.base-node-card {
  position: relative; /* Essencial para o posicionamento absoluto dos Handles e Toolbar */
  display: inline-block; /* Para que o tamanho se ajuste ao conteúdo do card-shell */
}
.card-shell {
  background-image: linear-gradient(to bottom, #313035, #2c2b30);
  border-width: 1px;
  transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out,
    width 0.3s ease-in-out;
  will-change: width, border-color, box-shadow;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15),
    inset 0 1px 0px rgba(255, 255, 255, 0.04),
    inset 0 -1px 0px rgba(0, 0, 0, 0.08);
  position: relative; /* Para o ::before do gradiente da borda superior */
}
.card-shell::before {
  content: "";
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  height: 2px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.08),
    transparent
  );
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
  pointer-events: none;
  z-index: 1;
}
.border-default {
  border-color: #47464b;
}
.border-selected {
  border-color: #4d6bfe;
  box-shadow: 0 0 0 1.5px #4d6bfe, 0 6px 15px rgba(77, 107, 254, 0.2),
    inset 0 1px 0px rgba(77, 107, 254, 0.1),
    inset 0 -1px 0px rgba(0, 0, 0, 0.08);
}
.border-selected::before {
  background: linear-gradient(to bottom, rgba(77, 107, 254, 0.2), transparent);
}
.base-node-card-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #6b7280;
  border-top: 3px solid #4d6bfe;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.flex-grow.overflow-y-auto {
  display: flex;
  flex-direction: column;
}
.flex-grow.overflow-y-auto > :deep(*) {
  flex-grow: 1;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #718096;
}
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 rgba(255, 255, 255, 0.05);
}

/* Ajuste no container do ícone no header */
.flex.items-center.gap-3.min-w-0 > .mr-0 {
  /* Seleciona o div do ícone que agora tem mr-0 */
  margin-right: 0.75rem; /* Equivalente a gap-3, para manter o espaçamento com o texto */
}

/* Removendo o margin-right do ícone se ele for o último elemento visível antes do texto (raro) */
.flex.items-center.gap-3.min-w-0 > .mr-0:last-child {
  margin-right: 0;
}
</style>
