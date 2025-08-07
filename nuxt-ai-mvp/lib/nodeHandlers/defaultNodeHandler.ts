import type { INodeHandler } from "~/types/nodeHandler";
import type { NodeData, TaskFlowNode } from "~/stores/taskFlow"; // Adjust path if needed

/**
 * Basic handler for 'default' nodes used primarily in testing or as a fallback.
 */
export const defaultNodeHandler: INodeHandler = {
  initializeData(config?: any): NodeData {
    return {
      label: config?.label || "Default Node",
      inputData: {},
      outputData: {},
      cumulativeContext: { compressed: false, blob: {} },
      updated_at: new Date().toISOString(),
    };
  },

  processInput(
    currentNodeData: NodeData,
    parentOutputs: Record<string, any>
  ): Record<string, any> {
    // <<< Change return type

    // Simple merge: Combine all parent outputs into inputData
    // More sophisticated logic might be needed depending on actual use cases
    const newInputData = { ...parentOutputs }; // Create a new object from parent outputs

    // Return a new data object with updated inputData
    return newInputData; // <<< Return only the calculated input data
  },

  generateOutput(currentNode: TaskFlowNode): Record<string, any> | null {
    // Default nodes should propagate their actual outputData
    // If outputData is explicitly null, return null. Otherwise, return outputData or an empty object.
    if (currentNode.data.outputData === null) {
      return null;
    }
    return currentNode.data.outputData || {};
  },

  // Optional methods (can be omitted if not needed)
  // getDisplayData?(currentNodeData: NodeData): any { ... }
  // handleAction?(action: string, payload: any, currentNodeData: NodeData): Promise<NodeData | void> { ... }
};
