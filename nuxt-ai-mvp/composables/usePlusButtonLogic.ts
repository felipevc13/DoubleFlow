import { ref, onUnmounted, getCurrentInstance } from "vue";
// Ref global para garantir que só um popup/contexto do "+" esteja aberto por vez
const globalContextualPopupNodeId = ref<string | null>(null);
import { SidebarType } from "~/stores/sidebar";
import { addFromPlusProgrammatically } from "~/lib/plusActions";
import { useVueFlow } from "@vue-flow/core";
import { useConnectionControlStore } from "~/stores/connectionControl";
import { useTaskFlowStore } from "~/stores/taskFlow";

type PlusButtonLogicOptions = {
  nodeId: string;
  dragThreshold?: number;
  sidebarType?: SidebarType;
};

export default function usePlusButtonLogic({
  nodeId,
  dragThreshold = 5,
  sidebarType = SidebarType.ADD_NODE,
}: PlusButtonLogicOptions) {
  const isMouseDownOnPlus = ref(false);
  const hasDraggedEnough = ref(false);
  const initialMousePosition = ref({ x: 0, y: 0 });

  const showContextualPopup = ref(false);
  const popupPosition = ref<{ top: number; left: number }>({ top: 0, left: 0 });
  const originNodeId = ref<string | null>(null);
  const plusButtonRef = ref<HTMLElement | null>(null);

  const instance = getCurrentInstance();
  const { findNode, getSelectedNodes, updateNode } = useVueFlow();
  const taskFlowStore = useTaskFlowStore();
  const connectionControlStore = useConnectionControlStore();

  const addDraggingClass = () => {
    const wrapper = document.querySelector(".vue-flow-wrapper");
    if (wrapper) wrapper.classList.add("user-is-dragging-edge");
    else document.body.classList.add("user-is-dragging-edge");
  };
  const removeDraggingClass = () => {
    const wrapper = document.querySelector(".vue-flow-wrapper");
    if (wrapper) wrapper.classList.remove("user-is-dragging-edge");
    else document.body.classList.remove("user-is-dragging-edge");
  };

  const handlePlusMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;

    // Fecha popup/contexto de qualquer outro node antes de abrir um novo
    if (
      globalContextualPopupNodeId.value &&
      globalContextualPopupNodeId.value !== nodeId
    ) {
      globalContextualPopupNodeId.value = null;
    }
    globalContextualPopupNodeId.value = nodeId;

    connectionControlStore.setLastInteractionWasSimpleClickOnSource(true);

    isMouseDownOnPlus.value = true;
    hasDraggedEnough.value = false;
    initialMousePosition.value = { x: event.clientX, y: event.clientY };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp, { once: true });
  };

  const handleWindowMouseMove = (event: MouseEvent) => {
    if (!isMouseDownOnPlus.value || hasDraggedEnough.value) return;
    const dx = Math.abs(event.clientX - initialMousePosition.value.x);
    const dy = Math.abs(event.clientY - initialMousePosition.value.y);
    if (dx > dragThreshold || dy > dragThreshold) {
      hasDraggedEnough.value = true;
      addDraggingClass();
      window.removeEventListener("mousemove", handleWindowMouseMove);
    }
  };

  const handleWindowMouseUp = (event: MouseEvent) => {
    removeDraggingClass();
    if (isMouseDownOnPlus.value && !hasDraggedEnough.value) {
      // Simple click: show contextual popup near the plus button
      connectionControlStore.setLastInteractionWasSimpleClickOnSource(true);

      // Instead of unselectNodes(), manually unselect all selected nodes
      const selectedNodes = getSelectedNodes.value;
      selectedNodes.forEach((node: any) => {
        updateNode(node.id, (n) => ({ ...n, selected: false }));
      });

      originNodeId.value = nodeId;
      showContextualPopup.value = true;

      connectionControlStore.setLastInteractionWasSimpleClickOnSource(false);

      // Calculate popup position near the button
      const target = event.target as HTMLElement;
      const rect = target.getBoundingClientRect();
      popupPosition.value = {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      };
    }
    // Reset states
    isMouseDownOnPlus.value = false;
    hasDraggedEnough.value = false;
    window.removeEventListener("mousemove", handleWindowMouseMove);
  };

  const handlePlusClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (hasDraggedEnough.value) {
      hasDraggedEnough.value = false;
    }
  };

  function handleSelectNodeType(selectedType: string) {
    // Add the new node and prepare edge connection through the store
    if (!originNodeId.value) {
      closeContextualPopup();
      return;
    }
    const currentNode = findNode(originNodeId.value);
    if (!currentNode) {
      console.error(
        `[usePlusButtonLogic] Node ${originNodeId.value} not found when selecting type ${selectedType}`
      );
      closeContextualPopup();
      return;
    }
    addFromPlusProgrammatically(
      selectedType,
      originNodeId.value,
      currentNode.position,
      currentNode.dimensions?.height
    );
    connectionControlStore.setLastInteractionWasSimpleClickOnSource(false);
    closeContextualPopup();
  }

  function closeContextualPopup() {
    if (globalContextualPopupNodeId.value === nodeId) {
      globalContextualPopupNodeId.value = null;
    }
    connectionControlStore.setLastInteractionWasSimpleClickOnSource(false);
    showContextualPopup.value = false;
    originNodeId.value = null;
  }

  onUnmounted(() => {
    window.removeEventListener("mousemove", handleWindowMouseMove);
    window.removeEventListener("mouseup", handleWindowMouseUp);
    removeDraggingClass();
  });

  return {
    handlePlusMouseDown,
    handlePlusClick,
    isMouseDownOnPlus,
    hasDraggedEnough,
    showContextualPopup,
    popupPosition,
    originNodeId,
    plusButtonRef,
    handleSelectNodeType,
    closeContextualPopup,
  };
}
