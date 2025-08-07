// composables/taskflow/useNodeInitialization.ts
import { nanoid } from "nanoid";
import type {
  TaskFlowNode,
  NodeData,
  CumulativeContextWrapper,
  AncestorContextData,
  ProblemStatement,
  Viewport,
} from "../../types/taskflow";
import type { XYPosition, Edge } from "@vue-flow/core";
import { getNodeHandler } from "../../lib/nodeHandlers"; // Importa o registro de handlers
import { useCumulativeContext } from "./useCumulativeContext"; // Para compressIfNeeded
import type { Ref } from "vue";
import { getEstimatedDims } from "../../constants/nodeDimensions";

export function useNodeInitialization(
  nodes: Ref<TaskFlowNode[]>,
  edges: Ref<Edge[]>,
  viewport: Ref<Viewport>,
  findFreePosition: (node: TaskFlowNode) => XYPosition
) {
  const { compressContextIfNeeded } = useCumulativeContext();

  function createNewNodeObject(
    nodeType: string,
    currentTaskId: string | null,
    position: XYPosition,
    sourceNodeIdForContext?: string,
    parentOutputForContext?: any,
    parentTypeForContext?: string,
    customInitialConfig?: any
  ): TaskFlowNode {
    const handler = getNodeHandler(nodeType);
    if (!handler) {
      throw new Error(
        `[useNodeInitialization] Nenhum handler encontrado para o tipo de nó: ${nodeType}`
      );
    }

    const initialDataFromHandler = handler.initializeData({
      ...customInitialConfig,
      taskId: currentTaskId,
    });

    let initialCumulativeContext: CumulativeContextWrapper = {
      compressed: false,
      blob: {},
    };

    if (
      sourceNodeIdForContext &&
      parentOutputForContext !== undefined &&
      parentTypeForContext
    ) {
      const parentEntry: AncestorContextData = {
        type: parentTypeForContext,
        output: parentOutputForContext,
        version: Date.now(),
      };
      initialCumulativeContext = compressContextIfNeeded({
        [sourceNodeIdForContext]: parentEntry,
      });
    } else if (initialDataFromHandler.cumulativeContext) {
      initialCumulativeContext = initialDataFromHandler.cumulativeContext;
    }

    const finalNodeData: NodeData = {
      label: initialDataFromHandler.label || `Novo ${nodeType}`,
      title: initialDataFromHandler.title || `Título ${nodeType}`,
      description: initialDataFromHandler.description || "",
      sources: initialDataFromHandler.sources || [],
      inputData: initialDataFromHandler.inputData || {},
      outputData: initialDataFromHandler.outputData || {},
      cumulativeContext: initialCumulativeContext,
      updated_at: new Date().toISOString(),
      processInputError: initialDataFromHandler.processInputError || null,
      surveyId: initialDataFromHandler.surveyId,
      surveyStructure: initialDataFromHandler.surveyStructure,
      analyzedData:
        initialDataFromHandler.analyzedData === undefined
          ? null
          : initialDataFromHandler.analyzedData,
      is_active:
        initialDataFromHandler.is_active === undefined
          ? false
          : initialDataFromHandler.is_active,
      responseCount:
        initialDataFromHandler.responseCount === undefined
          ? 0
          : initialDataFromHandler.responseCount,
      isLoadingEdgeConnection: !!sourceNodeIdForContext,
    };

    const est = getEstimatedDims(nodeType);

    const newNodeId = `${nodeType}-${nanoid(7)}`;

    const newNode: TaskFlowNode = {
      id: newNodeId,
      type: nodeType,
      position: position,
      data: finalNodeData,
      selected: false,
      resizing: false,
      dragging: false,
      events: {},
      computedPosition: { x: position.x, y: position.y, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: est.width, height: est.height },
      isParent: false,
      draggable: true,
      selectable: true,
      connectable: true,
      ...(nodeType === "problem" && { deletable: false }),
    };

    return newNode;
  }

  const initializeProblemNode = () => {
    const problemNode = createNewNodeObject("problem", null, {
      x: 100,
      y: 100,
    });
    nodes.value = [problemNode];
  };

  const loadNodesAndEdgesFromProblemStatement = (
    problemStatement: ProblemStatement
  ) => {
    const problemNode = createNewNodeObject(
      "problem",
      null,
      { x: 100, y: 100 },
      undefined,
      undefined,
      undefined,
      {
        title: problemStatement.title,
        description: problemStatement.description,
        updated_at: problemStatement.updated_at,
      }
    );
    nodes.value = [problemNode];
    edges.value = [];
  };

  return {
    createNewNodeObject,
    initializeProblemNode,
    loadNodesAndEdgesFromProblemStatement,
  };
}
