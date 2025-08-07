import { ref } from "vue";
import type { Ref } from "vue";
import { useSidebarStore, SidebarType } from "~/stores/sidebar"; // Assuming SidebarType is exported

// Define a basic interface for a Node's data. This should be expanded
// based on the actual structure of your node data.
interface NodeData {
  // Example properties, adjust as needed
  [key: string]: any; // Allow any other properties
}

// Define a basic interface for a Node object.
// This should align with the structure provided by Vue Flow or your custom node setup.
interface FlowNode {
  id: string;
  type: string; // Consider a more specific string literal union if node types are fixed
  data?: NodeData; // Data can be optional or have a more specific type
  // Add other common node properties like position, label, etc.
  [key: string]: any;
}

// Interface for the event object passed by Vue Flow on node click
// This might need adjustment based on the exact event structure from Vue Flow
interface NodeClickEvent {
  event: MouseEvent; // The original DOM event
  node: FlowNode;
  // Potentially other properties like `nodes`, `edges`, `screenPosition`, `flowPosition`
}

// Type for the last clicked node ID
type NodeId = string | null;

export function useNodeActions() {
  const lastClickedNode: Ref<NodeId> = ref(null);
  const lastClickTime: Ref<number> = ref(0);
  const CLICK_DEBOUNCE_TIME = 500; // 500ms de debounce

  const handleProblemNodeClick = (node: FlowNode): void => {
    const sidebarStore = useSidebarStore();

    if (!node || !node.data) {
      console.warn(
        "❌ [useNodeActions] Nó inválido ou sem dados para handleProblemNodeClick",
        node
      );
      return;
    }

    const now = Date.now();
    const isSameNode = lastClickedNode.value === node.id;
    const isRecentClick = now - lastClickTime.value < CLICK_DEBOUNCE_TIME;

    if (isSameNode && isRecentClick) {
      return;
    }

    lastClickedNode.value = node.id;
    lastClickTime.value = now;

    // Assuming 'problem' is a valid SidebarType
    sidebarStore.openSidebar(SidebarType.PROBLEM, node.data, node);
  };

  const handleNodeClick = async (
    event: NodeClickEvent | FlowNode
  ): Promise<void> => {
    // Vue Flow might pass the node directly or within an event object
    const node = "node" in event ? event.node : event;

    if (!node || !node.id || !node.type) {
      console.error(
        "❌ [useNodeActions] Nó inválido para handleNodeClick:",
        node
      );
      return;
    }

    const now = Date.now();
    const isSameNode = lastClickedNode.value === node.id;
    const isRecentClick = now - lastClickTime.value < CLICK_DEBOUNCE_TIME;

    if (isSameNode && isRecentClick) {
      return;
    }

    lastClickedNode.value = node.id;
    lastClickTime.value = now;

    // Process based on node type
    // Ensure node.type aligns with SidebarType or a mapping is used
    if (node.type === SidebarType.PROBLEM) {
      // Example: if node.type 'problem' maps to SidebarType.PROBLEM
      handleProblemNodeClick(node);
    } else if (Object.values(SidebarType).includes(node.type as SidebarType)) {
      // Generic handler for other types if they map directly to SidebarType
      const sidebarStore = useSidebarStore();
      sidebarStore.openSidebar(node.type as SidebarType, node.data, node);
    } else {
      console.warn(
        `[useNodeActions] Tipo de nó não manipulado diretamente: ${node.type}. Verifique se existe um SidebarType correspondente.`
      );
      // Optionally, open a default sidebar or no sidebar
      // const sidebarStore = useSidebarStore();
      // sidebarStore.closeAllSidebars(); // Example: close any open sidebar
    }
  };

  const handleProblemNodeDirectClick = async (
    nodeId: string,
    data: NodeData
  ): Promise<void> => {
    const sidebarStore = useSidebarStore();

    if (!nodeId || !data) {
      console.warn(
        "❌ [useNodeActions] Dados inválidos para clique direto em nó de problema"
      );
      return;
    }

    const now = Date.now();
    const isSameNode = lastClickedNode.value === nodeId;
    const isRecentClick = now - lastClickTime.value < CLICK_DEBOUNCE_TIME;

    if (isSameNode && isRecentClick) {
      return;
    }

    lastClickedNode.value = nodeId;
    lastClickTime.value = now;

    // Construct a partial FlowNode object if the full node isn't available/needed by sidebar
    const partialNode: Partial<FlowNode> = {
      id: nodeId,
      data: data,
      type: SidebarType.PROBLEM,
    };
    sidebarStore.openSidebar(
      SidebarType.PROBLEM,
      data,
      partialNode as FlowNode
    );
  };

  const handleCloseSidebar = (type: SidebarType): void => {
    const sidebarStore = useSidebarStore();
    sidebarStore.closeSidebar(type);
  };

  const handleNodeUnselect = (): void => {
    const sidebarStore = useSidebarStore();
    sidebarStore.closeAllSidebars();
    // lastClickedNode.value = null; // Optional: reset last clicked node
    // lastClickTime.value = 0;
  };

  return {
    handleNodeClick,
    handleProblemNodeClick,
    handleProblemNodeDirectClick,
    handleCloseSidebar,
    handleNodeUnselect,
    lastClickedNode, // Exposing this ref, consider if it's truly needed externally
  };
}
