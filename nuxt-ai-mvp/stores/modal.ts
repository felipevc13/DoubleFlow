import { defineStore } from "pinia";
import { ref, shallowRef, computed } from "vue";
import type { Ref, ShallowRef, ComputedRef } from "vue";

export const ModalType = {
  dataSource: "dataSource",
  addSource: "addSource",
  newTask: "newTask",
  taskForm: "taskForm",
  surveyBuilder: "surveyBuilder",
  survey: "survey",
  confirmDelete: "confirmDelete",
  problem: "problem",
} as const;

export type ModalType = (typeof ModalType)[keyof typeof ModalType];

// Interface for the modal data. 'any' can be replaced with a more specific
// union type if the possible shapes of modalData are known.
type ModalDataType = any;
type NodeIdType = string | null;

export const useModalStore = defineStore("modal", () => {
  // --- State ---
  const activeModalType: Ref<ModalType | null> = ref(null);
  const modalData: Ref<ModalDataType> = ref(null);
  const activeNodeId: Ref<NodeIdType> = ref(null);

  // --- Actions ---
  function openModal(
    type: ModalType,
    data: ModalDataType = null,
    nodeId: NodeIdType = null
  ): void {
    // Optional: Validate type against the ModalType enum if strict checking is desired
    // if (!Object.values(ModalType).includes(type)) {
    //   console.error(`[ModalStore] Invalid modal type: ${type}`);
    //   return;
    // }

    modalData.value = data;
    activeNodeId.value = nodeId;
    activeModalType.value = type;
  }

  function closeModal(): void {
    if (activeModalType.value) {
      activeModalType.value = null;
      modalData.value = null;
      activeNodeId.value = null;
    }
  }

  // --- Getters (Computed Properties) ---
  const getActiveModalType: ComputedRef<ModalType | null> = computed(
    () => activeModalType.value
  );
  const getModalData: ComputedRef<ModalDataType> = computed(
    () => modalData.value
  );
  const getActiveNodeId: ComputedRef<NodeIdType> = computed(
    () => activeNodeId.value
  );

  // This is a function, not a computed getter, so its signature is different
  function isModalOpen(type: ModalType): boolean {
    return activeModalType.value === type;
  }

  return {
    // State (exposed for direct access if needed, though getters are preferred)
    // activeModalType, // Not typically exposed directly if getters are provided
    // modalData,       // Not typically exposed directly
    // activeNodeId,    // Not typically exposed directly

    // Actions
    openModal,
    closeModal,

    // Getters
    isModalOpen,
    getActiveModalType,
    getModalData,
    getActiveNodeId,
  };
});
