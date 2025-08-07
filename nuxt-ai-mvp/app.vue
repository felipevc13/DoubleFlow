<script setup>
import { ModalType } from "./stores/modal.ts";
import "overlayscrollbars/overlayscrollbars.css";
import { useLoadingStore } from "./stores/loading.ts";
import { useSidebarStore } from "./stores/sidebar.ts";
import { useModalStore } from "./stores/modal.ts";
import { useTaskFlowStore } from "./stores/taskFlow.ts";
import { useSidenavStore } from "./stores/sidenav.ts";
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { modalComponents } from "~/lib/modalMapping";

const router = useRouter();

const showSideNav = computed(() => {
  // Esconde o SideNav se o layout da página for 'blank'
  return route.meta.layout !== "blank";
});

// Import Sidebar Components (adjust paths if necessary)
import AddNodeSidebar from "./components/sidebars/AddNodeSidebar.vue";
import AgentSidebar from "./components/sidebars/AgentSidebar.vue";

// Import SideNav Component
import SideNav from "./components/SideNav.vue";

const loadingStore = useLoadingStore();
const sidebarStore = useSidebarStore();
const modalStore = useModalStore();
const taskFlowStore = useTaskFlowStore();
const sidenavStore = useSidenavStore();
const route = useRoute();

// Log the initial value and watch for changes

watch(
  () => sidebarStore.activeSidebarType,
  (newType, oldType) => {}
);

// Map sidebar types to components
const sidebarComponents = {
  addNode: AddNodeSidebar,
  agent: AgentSidebar,
  // Add other sidebar types and their components here
};

const ActiveSidebarComponent = computed(() => {
  const type = sidebarStore.activeSidebarType;

  return type && sidebarComponents[type] ? sidebarComponents[type] : null;
});

const sidebarProps = computed(() => {
  const activeType = sidebarStore.activeSidebarType;
  if (!activeType) return {};

  // Get taskId from taskFlowStore instead of route params
  const taskId = taskFlowStore.currentTaskId;

  // Always include isOpen
  const baseProps = {
    isOpen: sidebarStore.isSidebarOpen(activeType),
    data: sidebarStore.sidebars[activeType]?.data,
    node: sidebarStore.sidebars[activeType]?.node,
    nodeId: sidebarStore.sidebars[activeType]?.nodeId,
  };

  // Add taskId specifically if the active sidebar is ProblemSidebar or others that need it
  if (activeType === "problem" || activeType === "agent") {
    return { ...baseProps, taskId: taskId || "" };
  }

  return baseProps;
});

// --- Modal Logic ---
const ActiveModalComponent = computed(() => {
  const type = modalStore.getActiveModalType;
  return type ? modalComponents[type] ?? null : null;
});

// Close AddNodeSidebar automatically whenever a modal opens
watch(
  () => ActiveModalComponent.value,
  (newModal) => {
    if (newModal && sidebarStore.activeSidebarType === "addNode") {
      sidebarStore.closeSidebar("addNode", false);
    }
  }
);

// Props for the active modal - Standardized Modal Pattern
const modalProps = computed(() => {
  const activeType = modalStore.getActiveModalType;
  const modalDataValue = modalStore.getModalData;
  
  // Default return for no active modal
  if (!activeType) return { isOpen: false };

  // --- DIFF MODE (Agent-triggered review) ---
  if (modalDataValue?.diffMode) {
    return {
      isOpen: true,
      diffMode: true,
      originalData: modalDataValue.originalData,
      proposedData: modalDataValue.proposedData,
      diffFields: modalDataValue.diffFields,
      modalTitle: modalDataValue.modalTitle,
      actionToConfirm: modalDataValue.actionToConfirm,
    };
  }

  // --- MANUAL EDIT MODE ---
  // Handle TaskForm and ConfirmDelete modals (simpler cases)
  if (activeType === "taskForm") {
    return { 
      isOpen: true, 
      ...(modalDataValue || {}) 
    };
  }
  
  if (activeType === "confirmDelete") {
    return {
      isOpen: true,
      isLoading: modalDataValue?.isLoading ?? false,
      title: modalDataValue?.title,
      message: modalDataValue?.message,
    };
  }

  // --- NODE-EDITING MODALS (DataSource, Problem, Survey, etc.) ---
  const activeNodeId = modalStore.getActiveNodeId;
  if (!activeNodeId) {
    console.warn(
      `[app.vue] modalProps: No active node ID found for modal type: ${activeType}`
    );
    return { isOpen: true, nodeData: {} }; // Return empty but valid state
  }
  
  const reactiveNode = taskFlowStore.nodes.find(node => node.id === activeNodeId);
  if (!reactiveNode) {
    console.warn(
      `[app.vue] modalProps: Node with ID ${activeNodeId} not found in taskFlowStore.`
    );
    return { isOpen: true, nodeData: {} }; // Return empty but valid state
  }

  // For all node-editing modals, pass the node data in a consistent way
  return {
    isOpen: true,
    nodeData: reactiveNode.data,
  };
});

import { useAgentLogic } from "~/composables/useAgentLogic"; // Garante que está importado

const agentLogic = useAgentLogic(); // Passe o taskId se for necessário

// Dynamic event handlers for modals - Standardized Pattern
const modalEventHandlers = computed(() => {
  const type = modalStore.getActiveModalType;
  const modalData = modalStore.getModalData;
  
  // ConfirmDelete modal has a simple confirmation handler
  if (type === "confirmDelete") {
    return { confirm: handleModalConfirm };
  }
  
  // For node-editing modals (Problem, DataSource, Survey, etc.)
  if (type && type !== "taskForm" && type !== "confirmDelete") {
    return {
      // Handle confirmation from the modal
      confirm: (payload) => {
        console.log(`[App.vue] Received confirmation from ${type} modal:`, payload);
        
        // Check if this is an agent action confirmation (diff mode)
        if (payload?.tool_name) {
          agentLogic.handleModalConfirmation(payload);
        } 
        // Handle manual edit mode
        else {
          const nodeId = modalStore.getActiveNodeId;
          if (!nodeId) {
            console.error('[App.vue] Cannot save: No active node ID in modalStore');
            return;
          }
          // Update the node data in the store
          taskFlowStore.updateNodeData(nodeId, payload);
        }
        
        // Close the modal after handling the confirmation
        modalStore.closeModal();
      },
      
      // Handle modal close event
      close: () => {
        modalStore.closeModal();
      },
      
      // Handle update events (for multi-step modals or real-time updates)
      update: (updatedData) => {
        const nodeId = modalStore.getActiveNodeId;
        if (nodeId) {
          taskFlowStore.updateNodeData(nodeId, updatedData);
        }
      }
    };
  }
  
  // For other modals or if no specific handler is needed
  return {};
});

// Handler for modal updates - Standardized Pattern
const handleModalUpdate = (eventPayload) => {
  // Payload can be either direct data or an object with { nodeId, updatedData }
  let nodeId, updatedData;
  
  if (eventPayload && typeof eventPayload === 'object' && 'nodeId' in eventPayload) {
    // Payload is in the format { nodeId, updatedData }
    ({ nodeId, updatedData } = eventPayload);
  } else {
    // Payload is just the updated data, get nodeId from active node
    nodeId = modalStore.getActiveNodeId;
    updatedData = eventPayload;
  }

  if (!nodeId) {
    console.error(
      "[app.vue] Missing node ID in modal update payload. Payload:",
      eventPayload
    );
    return;
  }
  if (!updatedData) {
    console.error(
      "[app.vue] Missing updated data in modal update payload.",
      eventPayload
    );
    return;
  }

  taskFlowStore.updateNodeData(nodeId, updatedData);
};

// Handler para o evento de abrir formulário
const handleOpenTaskForm = () => {
  modalStore.openModal("taskForm"); // Open the new task modal
};

// Handler para fechar o modal e atualizar o node do SurveyCard se necessário
const handleModalClose = () => {
  modalStore.closeModal();
  // Atualiza o node do SurveyCard se o modal ativo for survey
  if (modalStore.getActiveModalType === "survey") {
    const surveyNodeId = modalStore.getActiveNodeId;
    if (surveyNodeId) {
      taskFlowStore.requestNodeReprocessing(surveyNodeId);
    }
  }
};

const handleModalConfirm = () => {
  const onConfirmCallback = modalStore.getModalData?.onConfirm;
  if (typeof onConfirmCallback === "function") {
    onConfirmCallback();
  } else {
    console.warn(
      "[app.vue] A função onConfirm não foi encontrada nos dados do modal."
    );
  }
};

const handleTaskSave = (savedTask) => {
  modalStore.closeModal();
  if (savedTask?.slug) {
    router.push({ path: `/task/${savedTask.slug}` });
  }
};

// Classe computada para margem esquerda baseada no estado da sidenav
const mainContentMarginClass = computed(() => {
  return sidenavStore.isCollapsed ? "ml-[72px]" : "ml-[234px]";
});
// Dynamic left/right offsets so the modal backdrop spans from the SideNav edge to the AgentSidebar edge
const overlayStyle = computed(() => {
  // Negative offset pulls the backdrop over the fixed SideNav
  const left = sidenavStore.isCollapsed ? "-72px" : "-234px";

  // Wrapper already has margin‑right for AgentSidebar, so keep right at 0
  return { left, right: "0px" };
});
</script>

<template>
  <NuxtLayout>
    <template #default>
      <div
        v-if="route.meta.layout !== 'blank'"
        class="relative min-h-screen flex"
      >
        <!-- Loading Overlay -->
        <div
          v-if="loadingStore.isLoading"
          class="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50"
        >
          <p class="text-white text-xl">Loading...</p>
        </div>
        <SideNav v-if="showSideNav" @open-task-form="handleOpenTaskForm" />
        <div
          class="relative flex-grow transition-all duration-300 ease-in-out"
          :class="[
            mainContentMarginClass,
            { 'mr-[400px]': !!sidebarStore.activeSidebarType },
          ]"
        >
          <NuxtPage />
          <!-- Modal teleport target (aligned to content wrapper) -->
          <div
            id="modal-container"
            :style="overlayStyle"
            :class="[
              'absolute top-0 bottom-0 z-[30]',
              { 'pointer-events-none': !ActiveModalComponent },
            ]"
          ></div>
        </div>
        <!-- Sidebar Area -->
        <aside
          v-if="ActiveSidebarComponent"
          class="fixed top-0 right-0 h-full z-40 bg-gray-800 shadow-lg"
          style="width: 400px"
        >
          <component
            :is="ActiveSidebarComponent"
            v-bind="sidebarProps"
            @close="sidebarStore.closeSidebar(sidebarStore.activeSidebarType)"
          />
        </aside>
        <!-- Modal Area -->
        <component
          v-if="ActiveModalComponent"
          :is="ActiveModalComponent"
          v-bind="{
            ...modalProps,
            ...(modalStore.getActiveModalType === 'taskForm'
              ? { onSave: handleTaskSave }
              : {}),
          }"
          @close="handleModalClose"
          @update:nodeData="handleModalUpdate"
          v-on="modalEventHandlers"
        />
      </div>
      <div v-else>
        <NuxtPage />
      </div>
    </template>
  </NuxtLayout>
</template>

<style>
/* Global styles */
body {
  background-color: #1f1f1f; /* Example dark background */
  color: #e0e0e0;
  overflow-x: hidden; /* Prevent horizontal scroll introduced by sidebar */
}

/* Ensure transitions work smoothly */
.flex-grow {
  transition: margin-right 0.3s ease-in-out;
}

.fixed {
  position: fixed;
}
.top-0 {
  top: 0;
}
.right-0 {
  right: 0;
}
.h-full {
  height: 100%;
}
.z-40 {
  z-index: 40;
}
.z-50 {
  z-index: 50;
}
.bg-gray-800 {
  background-color: #2d3748;
}
.shadow-lg {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
.bg-gray-900 {
  background-color: #1a202c;
}
.bg-opacity-75 {
  background-color: rgba(26, 32, 44, 0.75);
}
.absolute {
  position: absolute;
}
.inset-0 {
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
.flex {
  display: flex;
}
.items-center {
  align-items: center;
}
.justify-center {
  justify-content: center;
}
.min-h-screen {
  min-height: 100vh;
}
.relative {
  position: relative;
}
.text-white {
  color: #fff;
}
.text-xl {
  font-size: 1.25rem;
}
</style>
