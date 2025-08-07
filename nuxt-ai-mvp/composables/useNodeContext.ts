import { useTaskFlowStore } from "~/stores/taskFlow";
import { storeToRefs } from "pinia";
import type { Node, Edge } from "@vue-flow/core"; // Or your specific Vue Flow types

// --- Interfaces ---

// Interface for a source item after being structured by groupSourcesByCategory
interface StructuredSourceItem {
  id: string;
  name: string;
  file_name: string;
  title: string;
  content: string | null;
  type: string;
  createdAt: string | undefined; // Can be undefined if original created_at is missing
  category: string;
}

// Interface for the output of groupSourcesByCategory
type GroupedSources = Record<string, StructuredSourceItem[]>;

// Interface for parent node information
interface ParentInfo {
  parentId: string | null;
  parentType: string;
  outputData: any; // Define more specifically if possible
}

// Interface for the complete input context for a node
interface NodeInputContext {
  parent_info: ParentInfo[];
  local_sources: GroupedSources;
  // current_node_data?: any; // Optional, if you decide to include it
}

// Interface for an error response from getNodeInputContext
interface NodeContextError {
  error: string;
}

// Interface for the data object within a Vue Flow Node
// This needs to align with how you structure data in your nodes
interface FlowNodeData {
  inputData?: Record<string, any> | null; // The context built by this composable
  outputData?: any; // Output of the node's execution
  // Add other specific data properties for different node types
  [key: string]: any;
}

// Extend Vue Flow's Node type with your specific data structure
type CustomFlowNode = Node<FlowNodeData>;

// --- Helper Functions ---

const removeFileExtension = (filename: string | undefined | null): string => {
  if (!filename || typeof filename !== "string") return filename || "";
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === 0) return filename;
  return filename.substring(0, lastDotIndex);
};

const groupSourcesByCategory = (
  sources: any[] | undefined | null
): GroupedSources => {
  if (!sources || sources.length === 0) {
    return {};
  }
  return sources.reduce((acc: GroupedSources, item: any) => {
    const category = item.category || "geral";
    if (!acc[category]) {
      acc[category] = [];
    }
    const structuredItem: StructuredSourceItem = {
      id: item.id,
      name: removeFileExtension(item.name),
      file_name: item.name || "",
      title: item.title?.trim() || removeFileExtension(item.name),
      content: item.content,
      type: item.type || "unknown",
      createdAt: item.created_at, // Assuming created_at is always a string from DB
      category: category,
    };
    acc[category].push(structuredItem);
    return acc;
  }, {});
};

// --- Composable ---

export const useNodeContext = () => {
  const taskFlowStore = useTaskFlowStore();
  // Ensure types for nodes and edges from storeToRefs if possible, or cast later
  const { nodes, edges } = storeToRefs(taskFlowStore);

  const getCurrentInputContextSync = (
    nodeId: string
  ): Record<string, any> | null => {
    const currentNode = nodes.value.find((n) => n.id === nodeId) as
      | CustomFlowNode
      | undefined;
    if (!currentNode) {
      console.error(`[useNodeContext - Sync] Node ${nodeId} not found.`);
      return null;
    }
    return currentNode.data?.inputData || {};
  };

  const getNodeInputContext = async (
    nodeId: string
  ): Promise<NodeInputContext | NodeContextError> => {
    const currentNode = nodes.value.find((n) => n.id === nodeId) as
      | CustomFlowNode
      | undefined;
    if (!currentNode) {
      console.error(`[useNodeContext] Node ${nodeId} not found.`);
      return { error: `Node ${nodeId} not found.` };
    }

    const parentEdges = edges.value.filter(
      (edge: Edge) => edge.target === nodeId
    );
    const parentInfo: ParentInfo[] = parentEdges
      .map((edge: Edge) => {
        const parentNode = nodes.value.find((n) => n.id === edge.source) as
          | CustomFlowNode
          | undefined;
        return {
          parentId: parentNode?.id || null,
          parentType: parentNode?.type || "Unknown",
          outputData: parentNode?.data?.outputData || {},
        };
      })
      .filter(
        (p): p is ParentInfo & { parentId: string } => p.parentId !== null
      ); // Type guard to filter out null parentIds

    const groupedLocalSources = groupSourcesByCategory(
      currentNode.data?.sources
    );

    const inputContext: NodeInputContext = {
      parent_info: parentInfo,
      local_sources: groupedLocalSources,
    };

    return inputContext;
  };

  return {
    getNodeInputContext,
    getCurrentInputContextSync,
  };
};
