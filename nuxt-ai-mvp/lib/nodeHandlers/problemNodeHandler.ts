import type { INodeHandler } from "~/types/nodeHandler";
import type { NodeData, TaskFlowNode } from "~/types/taskflow"; // Adjust path if NodeData moves, Added TaskFlowNode
import { $fetch } from "ofetch"; // Attempt to import directly from ofetch
import { getAggregatedContext } from "~/utils/nodeContext"; // <<< IMPORT HELPER
import { getContextBlobFromNode } from "~/composables/taskflow/useCumulativeContext";

// Helper to ensure data consistency, similar to validateNode but simpler for initialization
function createInitialNodeData(config?: any): NodeData {
  return {
    label: config?.label || "Problem Definition",
    title: config?.title || "Define the Core Problem",
    description: config?.description || "",
    sources: [], // Keep sources for potential future use? Or remove if unused by this node type?
    inputData: {},
    outputData: {}, // Initial output is empty, generated later
    updated_at: new Date().toISOString(), // Mark update time
    cumulativeContext: { compressed: false, blob: {} },
    // Add any other problem-specific default fields if needed
  };
}

export const problemNodeHandler: INodeHandler = {
  initializeData(initialConfig?: any): NodeData {
    // Basic initialization, potentially customized by initialConfig
    const data = createInitialNodeData(initialConfig);
    // Initial output will be generated on first propagation, not here.
    // data.outputData = this.generateOutput(data); // <<< REMOVE THIS LINE
    return data;
  },

  processInput(
    currentNodeData: NodeData,
    parentOutputs: Record<string, any>
  ): NodeData | Promise<NodeData> {
    // Adjusted to align with interface (though current impl is sync)
    // For a 'problem' node, input processing might involve:
    // - Aggregating context/definitions from parents (though generic aggregation happens in store)
    // - Potentially validating or structuring input if specific formats are expected.
    // Currently, the main aggregation logic seems handled by the store's propagateOutput/updateTargetNodeInput.
    // If the problem node *itself* needs to react to specific inputs beyond simple aggregation, add logic here.
    // For now, we assume the generic aggregation is sufficient.
    // If NodeData is not directly assignable to Record<string, any> as per interface,
    // this might need to return currentNodeData.inputData or a processed version.
    // For now, returning NodeData and adjusting signature.
    return currentNodeData; // Return data as is, assuming store handles aggregation
  },

  generateOutput(currentNode: TaskFlowNode): Record<string, any> {
    return {
      problem: {
        title: currentNode.data.title || "Problema sem título",
        description: currentNode.data.description || "",
      },
    };
  },

  // Optional: getDisplayData if the card needs specific formatting
  // getDisplayData(currentNodeData: NodeData): any {
  //   return {
  //     title: currentNodeData.title,
  //     description: currentNodeData.description,
  //   };
  // }

  async handleAction(
    action: string,
    payload: any,
    currentNode: TaskFlowNode,
    fetchInstance?: typeof fetch
  ): Promise<
    Partial<NodeData> | void | { error?: string; [key: string]: any }
  > {
    if (action === "refineProblem") {
      // Allow refinement if at least title or description is present
      // Only refine if there's actual content in the description
      if (!currentNode.data.description?.trim()) {
        return;
      }
      try {
        const result = await $fetch("/api/ai/runAnalysis", {
          method: "POST",
          body: {
            analysisKey: "refineProblemStatement", // analysisKey agora é um campo de nível superior
            nodeData: {
              inputData: {
                // inputData deve estar dentro de nodeData
                currentTitle: currentNode.data.title,
                currentDescription: currentNode.data.description,
              },
              cumulativeContext: getContextBlobFromNode(currentNode),
            },
          },
        });

        // O resultado de runAnalysis traz os dados principais em analyzedData
        const refinedData = result?.analyzedData;

        if (
          refinedData &&
          typeof refinedData.title === "string" &&
          typeof refinedData.description === "string"
        ) {
          return {
            title: refinedData.title,
            description: refinedData.description,
            analyzedData: {
              recommendations: refinedData.recommendations,
            },
            updated_at: new Date().toISOString(),
          };
        } else {
          // Estrutura inesperada
          return {
            processInputError:
              result?.processInputError ||
              "AI refinement returned invalid data structure.",
          };
        }
      } catch (err: any) {
        return {
          processInputError: err?.message || "Erro ao chamar IA",
        };
      }
    }
  },
};
