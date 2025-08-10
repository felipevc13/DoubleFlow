// Utilitário para converter qualquer erro em string amigável
function toErrorString(err: unknown): string {
  if (!err) return "Erro desconhecido";
  if (typeof err === "string") return err;
  if (typeof err === "object" && "message" in (err as any))
    return String((err as any).message);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

import { useModalStore, ModalType } from "~/stores/modal";
import type { RealtimeChannel } from "@supabase/supabase-js";
const supabaseChannel: Ref<RealtimeChannel | null> = ref(null);
import {
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type Edge,
  type EdgeEventsHandler,
  type GraphEdge,
  type NodeChange,
} from "@vue-flow/core";
import type { Database } from "../types/supabase";
import { defineStore } from "pinia";
import { ref, nextTick, watch, onUnmounted, computed } from "vue";
import { shallowRef } from "vue";
import { until } from "@vueuse/core";
import { useSupabaseClient } from "#imports";
// Import helper functions
import { nanoid } from "nanoid"; // Import nanoid for unique ID generation
import { removeFileExtension, groupSourcesByCategory } from "../utils/helpers";
import {
  getAggregatedContext,
  decompress,
  mergeByVersion,
  compressIfNeeded,
} from "../utils/nodeContext"; // <<< Import new context helpers

import { getNodeHandler } from "../lib/nodeHandlers"; // <<< IMPORT NODE HANDLER REGISTRY
import { useTaskFlowPersistence } from "../composables/taskflow/useTaskFlowPersistence";
import { useGraphOperations } from "../composables/taskflow/useGraphOperations";
import { useNodeInitialization } from "../composables/taskflow/useNodeInitialization";
import { useCumulativeContext } from "../composables/taskflow/useCumulativeContext";
import { usePropagation } from "../composables/taskflow/usePropagation";
import { calculateChildNodePosition } from "../composables/taskflow/useNodeLayout";
import { useSmartNodePlacement } from "../composables/taskflow/useSmartNodePlacement";
import type { Ref } from "vue"; // Import Ref type
import type {
  TaskFlowEdge,
  TaskFlowNode,
  Viewport,
  NodeData,
  AncestorContextData,
  CumulativeContextBlob,
  CumulativeContextWrapper,
} from "../types/taskflow"; // Import TaskFlowEdge, TaskFlowNode, Viewport, and other types
// Use specific types from Vue Flow where possible, define others if not exported
import type { Node, XYPosition, Dimensions, ElementData } from "@vue-flow/core";
import type {
  RealtimePostgresChangesPayload,
  // SupabaseClient import removed as it's not used if we infer the mock type
} from "@supabase/supabase-js"; // Import Supabase types
// Removed duplicate import of Database
import {
  clampToViewport,
  isNodeFullyVisibleInViewport,
} from "../composables/taskflow/useNodeLayout";
import { ESTIMATED_NODE_DIMENSIONS } from "../constants/nodeDimensions"; // Se já estiver importado, ignore.

// Interface for raw data from Supabase (adjust based on actual table structure)
interface RawTaskFlowData {
  id: string;
  user_id: string;
  task_id: string;
  nodes: string | null; // Assuming JSON stored as text
  edges: string | null; // Assuming JSON stored as text
  viewport: string | null; // Assuming JSON stored as text
  created_at?: string;
  updated_at?: string;
}

// Type matching the Supabase task_flows table structure
interface TaskFlowTableRow {
  id: string;
  user_id: string;
  task_id: string;
  nodes?: string | null; // JSON as text
  edges?: string | null; // JSON as text
  viewport?: string | null; // JSON as text
  created_at?: string;
  updated_at?: string;
}

// Simple debounce function with types
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return function executedFunction(
    this: ThisParameterType<T>,
    ...args: Parameters<T>
  ) {
    const later = () => {
      timeout = undefined; // Clear timeout ID after execution
      func.apply(this, args);
    };

    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

export type { NodeData }; // Re-export NodeData type
export const useTaskFlowStore = defineStore("taskFlow", () => {
  // --- Estado para animação até o novo nó adicionado ---
  const nodeToAnimateTo = ref<string | null>(null);

  function clearNodeToAnimateTo() {
    nodeToAnimateTo.value = null;
  }
  const currentTaskId: Ref<string | null> = ref(null);
  const nodes: Ref<TaskFlowNode[]> = ref([]); // <<< Apply TaskFlowNode type
  const edges: Ref<TaskFlowEdge[]> = ref([]); // <<< Apply TaskFlowEdge type

  /**
   * Alterna a propriedade "draggable" de um nó específico de forma reativa.
   * @param nodeId - ID do nó a ser alternado
   */
  function toggleNodeDraggable(nodeId: string): void {
    const nodeIndex = nodes.value.findIndex(
      (n: TaskFlowNode) => n.id === nodeId
    );
    if (nodeIndex !== -1) {
      const node = nodes.value[nodeIndex];
      // Log BEFORE toggling

      const updatedNode = {
        ...node,
        draggable: !node.draggable,
        data: {
          ...node.data,
          updated_at: new Date().toISOString(),
        },
      };
      nodes.value.splice(nodeIndex, 1, validateNode(updatedNode));

      debouncedSaveTaskFlow();

      // O watcher já salva o fluxo automaticamente
    }
  }

  const isViewportReady = ref(false);
  const vueFlowInstance = shallowRef<any>(null);
  const isVueFlowInstanceReady = ref(false); // Flag indica quando o Vue Flow está pronto

  // --- Controlled Promise for VueFlowInstance (not reactive) ---
  let _resolveVueFlowInstancePromise: (instance: any) => void;
  let vueFlowInstancePromise = new Promise<any>((resolve) => {
    _resolveVueFlowInstancePromise = resolve;
  });

  function resetVueFlowInstancePromise() {
    vueFlowInstancePromise = new Promise<any>((resolve) => {
      _resolveVueFlowInstancePromise = resolve;
    });
  }
  async function applyEdgeChangesManually(changes: EdgeChange[]) {
    // Aplique as mudanças normalmente
    edges.value = applyEdgeChanges(changes, edges.value as GraphEdge[]);

    function isAddEdgeChange(
      change: EdgeChange | any
    ): change is EdgeChange & { item: Edge } {
      return (
        change.type === "add" &&
        change.item !== undefined &&
        change.item !== null
      );
    }

    // Propaga recursivamente a partir de cada source das edges adicionadas
    async function propagateRecursively(
      nodeId: string,
      visited = new Set<string>()
    ) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      await propagateOutput(nodeId);

      const targets = edges.value
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);

      for (const targetId of targets) {
        await propagateRecursively(targetId, visited);
      }
    }

    const addedEdges = changes.filter(isAddEdgeChange);
    await Promise.all(
      addedEdges.map((change) =>
        change.item.source
          ? propagateRecursively(change.item.source)
          : undefined
      )
    );
  }

  async function applyNodeChangesManually(changes: NodeChange[]) {
    // 1. Aplique todas as mudanças primeiro na store (inclui dimensions, selects, etc.)
    nodes.value = applyNodeChanges(changes, nodes.value as TaskFlowNode[]);

    // 2. Capture a última posição recebida por nó dentro deste lote
    const finalPositions: Record<string, XYPosition> = {};
    for (const change of changes) {
      if (change.type === "position") {
        const p: XYPosition | null =
          (change as any).position ?? (change as any).positionAbsolute ?? null;
        if (p) finalPositions[change.id] = p;
      }
    }

    // 3. Persista somente a posição mais recente de cada nó
    await Promise.all(
      Object.entries(finalPositions).map(([id, pos]) =>
        updateNodePosition(id, pos)
      )
    );

    // 4. Salve o fluxo completo (uma só vez, debounced)
    saveFlowDebounced({
      taskId: currentTaskId.value!,
      nodes: nodes.value,
      edges: edges.value,
      viewport: viewport.value,
    });
  }

  // Pushes a node into state without creating edges;
  // keeps the original addNode logic intact.
  const pushNode = async (node: TaskFlowNode): Promise<void> => {
    await addNode(node);
  };
  const viewport: Ref<Viewport> = ref({
    x: 0,
    y: 0,
    zoom: 1,
    width: 0,
    height: 0,
  });
  // Explicitly type the Supabase client with the generated Database type
  const supabase = useSupabaseClient();
  // --- Composables (persistence & graph helpers) ---
  const { loadFlow, saveFlowDebounced } = useTaskFlowPersistence();
  const graphOps = useGraphOperations();
  const { findFreePosition } = useSmartNodePlacement();

  const nodeInitializer = useNodeInitialization(
    nodes,
    edges,
    viewport,
    // The findFreePosition parameter is currently unused in the composable.
    // Passing a compliant dummy function to satisfy the type signature.
    (node: TaskFlowNode) => node.position
  );
  const contextManager = useCumulativeContext();
  const propagation = usePropagation();

  const isInitialLoadComplete = ref(false); // <<< Add flag
  const isTransitioning = ref(false);
  const supabaseChannel: Ref<RealtimeChannel | null> = ref(null); // <<< Type the channel ref - Will be removed if setupRealtimeSubscription is fully removed
  const empathMapLastProcessedInputs = ref<Record<string, string | null>>({}); // Stores last processed input string for EmpathMapCards
  const affinityMapLastProcessedInputs = ref<Record<string, string | null>>({}); // Stores last processed input string for AffinityMapCards
  const insightsLastProcessedInputs = ref<Record<string, string | null>>({}); // Stores last processed input string for InsightsCard
  // --- Report Card Specific State and Actions ---
  const reportLastProcessedInputs = ref<Record<string, string | null>>({}); // Stores last processed input string for ReportCard
  // --- Report Card Specific State and Actions ---
  const getReportLastProcessedInput = (nodeId: string): string | null => {
    return reportLastProcessedInputs.value[nodeId] ?? null;
  };

  const setReportLastProcessedInput = (
    nodeId: string,
    inputString: string | null
  ): void => {
    if (inputString === null) {
      delete reportLastProcessedInputs.value[nodeId];
    } else {
      reportLastProcessedInputs.value[nodeId] = inputString;
    }
  };

  const clearReportAnalysis = (nodeId: string): void => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex !== -1) {
      const nodeToUpdate = nodes.value[nodeIndex];
      let updated = false;

      if (nodeToUpdate.data.analyzedData !== null) {
        nodeToUpdate.data.analyzedData = null;
        updated = true;
      }
      if (nodeToUpdate.data.processInputError !== null) {
        nodeToUpdate.data.processInputError = null;
        updated = true;
      }
      if (
        nodeToUpdate.data.outputData &&
        Object.keys(nodeToUpdate.data.outputData).length > 0
      ) {
        nodeToUpdate.data.outputData = {};
        updated = true;
      }

      if (updated) {
        nodeToUpdate.data.updated_at = new Date().toISOString();
        nodes.value.splice(nodeIndex, 1, { ...nodeToUpdate });
      }
      setReportLastProcessedInput(nodeId, null);

      if (updated) {
        saveFlowDebounced({
          taskId: currentTaskId.value!,
          nodes: nodes.value,
          edges: edges.value,
          viewport: viewport.value,
        });
      }
    } else {
      if (getReportLastProcessedInput(nodeId) !== null) {
        setReportLastProcessedInput(nodeId, null);
        saveFlowDebounced({
          taskId: currentTaskId.value!,
          nodes: nodes.value,
          edges: edges.value,
          viewport: viewport.value,
        });
      }
    }
  };
  // --- Insights Card Specific State and Actions ---
  const getInsightsLastProcessedInput = (nodeId: string): string | null => {
    return insightsLastProcessedInputs.value[nodeId] ?? null;
  };

  const setInsightsLastProcessedInput = (
    nodeId: string,
    inputString: string | null
  ): void => {
    if (inputString === null) {
      delete insightsLastProcessedInputs.value[nodeId];
    } else {
      insightsLastProcessedInputs.value[nodeId] = inputString;
    }
  };

  const clearInsightsAnalysis = (nodeId: string): void => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex !== -1) {
      const nodeToUpdate = nodes.value[nodeIndex];
      let updated = false;

      if (nodeToUpdate.data.analyzedData !== null) {
        nodeToUpdate.data.analyzedData = null;
        updated = true;
      }
      if (nodeToUpdate.data.processInputError !== null) {
        nodeToUpdate.data.processInputError = null;
        updated = true;
      }
      if (
        nodeToUpdate.data.outputData &&
        Object.keys(nodeToUpdate.data.outputData).length > 0
      ) {
        nodeToUpdate.data.outputData = {};
        updated = true;
      }

      if (updated) {
        nodeToUpdate.data.updated_at = new Date().toISOString();
        nodes.value.splice(nodeIndex, 1, { ...nodeToUpdate });
      }
      setInsightsLastProcessedInput(nodeId, null);

      if (updated) {
        saveFlowDebounced({
          taskId: currentTaskId.value!,
          nodes: nodes.value,
          edges: edges.value,
          viewport: viewport.value,
        });
      }
    } else {
      if (getInsightsLastProcessedInput(nodeId) !== null) {
        setInsightsLastProcessedInput(nodeId, null);
        saveFlowDebounced({
          taskId: currentTaskId.value!,
          nodes: nodes.value,
          edges: edges.value,
          viewport: viewport.value,
        });
      }
    }
  };
  const loadingStates = ref<
    Record<string, { isLoading: boolean; message: string }>
  >({}); // For per-node loading status

  function getLoadingState(nodeId: string) {
    return loadingStates.value[nodeId];
  }

  // Helper to create default NodeData structure
  const createInitialNodeData = (): NodeData => ({
    label: "",
    title: "",
    description: "",
    sources: [],
    inputData: {},
    outputData: {},
    cumulativeContext: { compressed: false, blob: {} },
    processInputError: null,
    updated_at: null, // Initialize to null
    is_active: false, // Default for is_active
    responseCount: 0,
    isLoadingEdgeConnection: false,
    // Add other default fields from NodeData interface if necessary
  });

  // REMOVIDO initializeSupabase - agora usamos o client reativo do Nuxt

  // --- REMOVED: Function to setup Supabase Realtime Subscription for knowledge_base ---
  // const setupRealtimeSubscription = () => { ... };
  // --- REMOVED: Function to clean up Supabase Realtime Subscription for knowledge_base ---
  // const cleanupRealtimeSubscription = () => { ... };
  // If other realtime subscriptions are needed later, these functions can be re-added/modified.
  // For now, assuming they were solely for knowledge_base.

  // <<< Add type annotation for input and return
  const validateNode = (node: Partial<TaskFlowNode>): TaskFlowNode => {
    const defaultData: Partial<NodeData> = {
      // Use Partial for default data
      sources: [], // REINSTATED - Default for node-specific sources
      inputData: {}, // Garantir que inputData exista
      outputData: {}, // Garantir que outputData exista
      cumulativeContext: { compressed: false, blob: {} }, // <<< Initialize cumulativeContext
      // analysisStatus: "idle", // REMOVED
      processInputError: null, // <<< ADD DEFAULT for processInputError
      responseCount: 0,
      isLoadingEdgeConnection: false,
      // Adicionar outros campos padrão se necessário
    };

    // Preserve original inputData and outputData if they exist in the raw node data
    const rawInputData = node.data?.inputData;
    const rawOutputData = node.data?.outputData;
    const rawCumulativeContext = node.data?.cumulativeContext; // <<< Preserve raw cumulativeContext if exists

    // Construct the validated node, ensuring all required fields are present
    const validatedData: NodeData = {
      inputData:
        rawInputData === undefined || rawInputData === null ? {} : rawInputData,
      outputData:
        rawOutputData === undefined || rawOutputData === null
          ? {}
          : rawOutputData,
      cumulativeContext: rawCumulativeContext ??
        defaultData.cumulativeContext ?? { compressed: false, blob: {} },
      // Merge other data fields, ensuring defaults are applied if missing
      ...defaultData, // Apply defaults first (doesn't include updated_at yet)
      ...(node.data || {}), // Spread potentially incomplete node data (might have updated_at as string | undefined)
      // Ensure updated_at is explicitly handled to match NodeData type (string | null)
      updated_at: node.data?.updated_at ?? null,
      is_active: node.data?.is_active ?? false, // Handle is_active, default to false
      responseCount: node.data?.responseCount ?? defaultData.responseCount ?? 0,
      // Re-apply preserved crucial fields if they existed
      ...(rawInputData !== undefined && { inputData: rawInputData }),
      ...(rawOutputData !== undefined && { outputData: rawOutputData }),
      ...(rawCumulativeContext !== undefined && {
        cumulativeContext: rawCumulativeContext,
      }),
    };

    const validatedNode: TaskFlowNode = {
      id: node.id || nanoid(), // Ensure ID exists, generate if not
      type: node.type || "default", // Ensure type exists
      position: {
        x: node.position?.x || 0,
        y: node.position?.y || 0,
      },
      data: validatedData, // Explicitly set the validated data object
      // Ensure all GraphNode properties are present, providing defaults if missing
      selected: node.selected ?? false, // Explicitly set selected
      draggable: node.draggable ?? true,
      selectable: node.selectable ?? true,
      dragging: node.dragging ?? false, // Explicitly set dragging
      // These are typically computed by Vue Flow, but need to be present for type compatibility
      computedPosition: node.computedPosition || { x: 0, y: 0, z: 0 },
      handleBounds: node.handleBounds || {
        source: [],
        target: [],
      },
      dimensions: node.dimensions || { width: 0, height: 0 },
      isParent: node.isParent ?? false,
      resizing: node.resizing ?? false, // Explicitly set resizing
      events: node.events ?? {}, // Explicitly set events
      // Spread any other properties from the input node that are not explicitly handled
      ...node,
    };

    return validatedNode;
  };

  // --- Realtime subscription for survey_responses ---
  function setupRealtimeSubscription(taskId: string) {
    // Limpa qualquer assinatura anterior
    if (supabaseChannel.value) {
      supabaseChannel.value.unsubscribe();
      supabaseChannel.value = null;
    }

    const supabase = useSupabaseClient();

    const channel = supabase.channel(`survey_responses:task_id=eq.${taskId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "survey_responses",
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          const surveyId = payload.new.survey_id;
          if (!surveyId) return;

          // Procura o SurveyCard correto
          const targetNode = nodes.value.find(
            (node) => node.data.surveyId === surveyId
          );
          if (targetNode) {
            await updateNodeData(targetNode.id, {
              _action: "fetchSurveyStatus",
              _payload: {},
            });
          } else {
            console.warn(
              `[Realtime] Nenhum nó de survey para surveyId: ${surveyId}`
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
        } else {
        }
      });

    supabaseChannel.value = channel;
  }

  function cleanupRealtimeSubscription() {
    if (supabaseChannel.value) {
      supabaseChannel.value.unsubscribe();
      supabaseChannel.value = null;
    }
  }

  const validateEdge = (
    edge: Partial<TaskFlowEdge>,
    options: { skipTargetExistCheck?: boolean } = {}
  ): boolean => {
    // --- FIM LOGS NOVOS ---
    if (!edge || !edge.source || !edge.target) {
      console.warn(
        "[validateEdge] Edge inválido: source ou target ausente.",
        edge
      );

      return false;
    }

    const sourceExists = nodes.value.some((n) => n.id === edge.source);
    const targetExists = options.skipTargetExistCheck
      ? true
      : nodes.value.some((n) => n.id === edge.target);

    if (!sourceExists) {
      console.warn(
        `[validateEdge] Nó de origem ${edge.source} não encontrado para a aresta.`,
        edge
      );
    }
    if (!targetExists && !options.skipTargetExistCheck) {
      console.warn(
        `[validateEdge] Nó de destino ${edge.target} não encontrado para a aresta.`,
        edge
      );
    }

    return !!(edge.source && edge.target && sourceExists && targetExists);
  };

  // <<< Add type annotation for input
  const loadTaskFlow = async (taskId: string) => {
    resetVueFlowInstancePromise();
    isInitialLoadComplete.value = false;
    isTransitioning.value = true;
    try {
      const {
        nodes: loadedNodes,
        edges: loadedEdges,
        viewport: loadedViewport,
      } = await loadFlow(taskId);

      currentTaskId.value = taskId;
      nodes.value = loadedNodes.map(validateNode);
      // (Removido: criação automática do node problem-1)
      edges.value = loadedEdges.filter((edge: TaskFlowEdge) =>
        validateEdge(edge)
      );
      viewport.value = {
        x: 0,
        y: 0,
        zoom: 1,
        width: 0,
        height: 0,
        ...loadedViewport,
      };

      for (const n of nodes.value) {
        if (n.type === "survey") {
          try {
            await updateNodeData(n.id, {
              _action: "fetchSurveyStatus",
              _payload: {},
            });
          } catch (err) {
            console.error(
              "[loadTaskFlow] Falha ao hidratar SurveyCard",
              n.id,
              err
            );
          }
        }
      }
    } catch (err) {
      console.error(
        "[TaskFlowStore loadTaskFlow] error via useTaskFlowPersistence:",
        err
      );
      // Não tocar no estado atual; manter isInitialLoadComplete=false para bloquear autosave.
      return;
    } finally {
      isTransitioning.value = false;
      isInitialLoadComplete.value = true;
    }
    setupRealtimeSubscription(taskId);
  };

  const saveTaskFlow = async (): Promise<any | undefined> => {
    if (!currentTaskId.value) return;
    if (isTransitioning.value || !isInitialLoadComplete.value) return;
    saveFlowDebounced({
      taskId: currentTaskId.value,
      nodes: nodes.value,
      edges: edges.value,
      viewport: viewport.value as Viewport,
    });
  };
  // --- Debounced Save Function (Defined AFTER saveTaskFlow) ---
  const debouncedSaveTaskFlow = debounce(saveTaskFlow, 1000); // Debounce save by 1 second

  // --- REVISED: Action to update a target node's input and cumulative context ---
  // <<< Add type annotations
  const updateTargetNodeInput = (
    targetNodeId: string,
    sourceNodeId: string,
    directInput: any,
    incomingCumulativeContext: CumulativeContextWrapper
  ): void => {
    const targetNodeIndex = nodes.value.findIndex((n) => n.id === targetNodeId);
    if (targetNodeIndex === -1) {
      return;
    }

    // Use JSON parse/stringify for deep copy to avoid issues with proxies/non-cloneables in tests
    const targetNode = JSON.parse(JSON.stringify(nodes.value[targetNodeIndex]));

    // --- 1. Update inputData (Backward Compatibility) ---
    const currentInputData = targetNode.data?.inputData || {};
    const newInputData = {
      ...currentInputData,
      [sourceNodeId]: directInput, // Add/overwrite direct input from this source
    };

    // --- 2. Update cumulativeContext (Merge with Versioning & Compression) ---
    const currentContext = getAggregatedContext(targetNode); // Decompresses if needed
    const incomingContextObject = decompress(incomingCumulativeContext); // Decompress incoming
    const mergedContextObject = mergeByVersion(
      currentContext,
      incomingContextObject
    );
    const newCumulativeContextToSave = compressIfNeeded(mergedContextObject); // Re-compress if needed

    // --- 3. Prepare Updated Node ---
    const updatedNode = {
      ...targetNode, // Spread the cloned node
      data: {
        ...targetNode.data, // Spread existing data
        inputData: newInputData, // Set updated direct input
        cumulativeContext: newCumulativeContextToSave, // Set new cumulative context
        updated_at: new Date().toISOString(), // Update timestamp
      },
    };

    // --- 4. Update Nodes Array Reactively ---
    // Use splice for in-place replacement detected by Vue's reactivity
    nodes.value.splice(targetNodeIndex, 1, validateNode(updatedNode));
  };

  // --- NEW: Action to process all inputs for a node using its handler ---
  const processNodeInputs = async (nodeId: string): Promise<boolean> => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      return false; // Indicate no change
    }

    // Use JSON parse/stringify for deep copy to avoid issues with proxies/non-cloneables in tests
    // This ensures we don't accidentally modify the reactive state directly before splice
    const targetNode: TaskFlowNode = JSON.parse(
      JSON.stringify(nodes.value[nodeIndex])
    );
    let handler; // Initialize handler
    if (targetNode.type) {
      handler = getNodeHandler(targetNode.type);
    } else {
    }

    if (!handler || typeof handler.processInput !== "function") {
      // Continue to calculate context even if no processInput handler
    }

    // --- 1. Aggregate Parent Outputs & Contexts ---
    const incomingEdges = edges.value.filter((e) => e.target === nodeId);
    const parentOutputs: Record<string, any> = {};
    let aggregatedParentContextBlob: CumulativeContextBlob = {};
    let contextChanged = false; // Track if the final context differs from the original

    for (const edge of incomingEdges) {
      const parentNode = nodes.value.find((n) => n.id === edge.source);
      if (parentNode?.data?.outputData) {
        parentOutputs[edge.source] = parentNode.data.outputData;

        // Context aggregation: Use parent's update timestamp as version
        const parentVersion = parentNode.data.updated_at
          ? Date.parse(parentNode.data.updated_at)
          : 0;
        if (isNaN(parentVersion)) {
        }
        // Include type in each parent's context entry
        const parentContextEntry = {
          type: parentNode.type,
          output: parentNode.data.outputData,
          version: isNaN(parentVersion) ? 0 : parentVersion, // Use 0 if date parsing failed
        };
        const incomingBlob: Record<string, any> = {
          [edge.source]: parentContextEntry,
        };
        aggregatedParentContextBlob = mergeByVersion(
          aggregatedParentContextBlob,
          incomingBlob
        );
        // Note: contextChanged flag will be set later by comparing final context with original
      } else {
      }
    }
    const newCumulativeContextToSave = compressIfNeeded(
      aggregatedParentContextBlob
    );
    // Check if the calculated context is different from the node's original context
    contextChanged =
      JSON.stringify(targetNode.data.cumulativeContext) !==
      JSON.stringify(newCumulativeContextToSave);

    // --- 2. Call Handler's processInput (if exists) ---
    // Initialize with the original inputData. This will be updated if the handler returns new data.
    let finalInputData: Record<string, any> = targetNode.data.inputData ?? {};
    let handlerMadeChanges = false;
    if (handler?.processInput) {
      try {
        let newInputDataFromHandler;
        if (handler && typeof handler.processInput === "function") {
          newInputDataFromHandler = await handler.processInput(
            targetNode.data,
            parentOutputs,
            globalThis.$fetch
          );
        } else {
          newInputDataFromHandler = undefined;
        }
        if (
          newInputDataFromHandler &&
          JSON.stringify(newInputDataFromHandler) !==
            JSON.stringify(targetNode.data.inputData)
        ) {
          finalInputData = newInputDataFromHandler;
          handlerMadeChanges = true;
        }
      } catch (error) {
        handlerMadeChanges = false;
      }
    }

    // --- 3. Update Node in Store ---
    // Update only if the handler modified the data OR the cumulative context changed
    if (handlerMadeChanges || contextChanged) {
      const updatedNode: TaskFlowNode = {
        ...targetNode, // Spread the original structure (like id, type, position)
        data: {
          ...targetNode.data, // Start with original data
          inputData: finalInputData, // Apply the final input data (potentially from handler)
          cumulativeContext: newCumulativeContextToSave, // Apply the newly calculated context
          updated_at: new Date().toISOString(), // Update timestamp because state changed
        },
        // Ensure specific node properties like 'deletable' are preserved if needed
        ...(targetNode.type === "problem" && { deletable: false }),
      };

      // Use splice for in-place replacement detected by Vue's reactivity
      nodes.value.splice(nodeIndex, 1, validateNode(updatedNode));
      return true; // Indicate changes were made
    } else {
      return false; // Indicate no changes
    }
  };
  // --- REVISED: Action to propagate output data and cumulative context ---
  // <<< Add type annotation
  // Garante sempre objeto vazio se null/undefined, mantém valores válidos inalterados
  function normalizeOutput(val: any) {
    return val === undefined || val === null ? {} : val;
  }

  const propagateOutput = async (sourceNodeId: string): Promise<void> => {
    // ATENÇÃO: Análise IA dos cards analíticos é manual! Só ocorre via requestNodeReprocessing. Aqui só propaga input/contexto.

    let sourceNode = nodes.value.find((n) => n.id === sourceNodeId);

    if (!sourceNode || !sourceNode.type) {
      return;
    }

    const sourceHandler = getNodeHandler(sourceNode.type);
    if (!sourceHandler) {
      return;
    }

    // 1. Generate Output using Source Handler
    let sourceOutput: Record<string, any> | null = {};
    try {
      sourceOutput = await sourceHandler.generateOutput(sourceNode);
    } catch (error) {
      const errorMessage = toErrorString(error);
      sourceOutput = { error: `Failed to generate output: ${errorMessage}` };
    }

    // Sempre atualiza o source node para garantir updated_at e outputData, criando novo objeto .data
    const sourceNodeIndex = nodes.value.findIndex((n) => n.id === sourceNodeId);
    if (sourceNodeIndex !== -1) {
      const sourceNodeToUpdate = nodes.value[sourceNodeIndex];
      const updatedSourceNode = {
        ...sourceNodeToUpdate,
        data: {
          ...sourceNodeToUpdate.data,
          outputData: normalizeOutput(sourceOutput),
          updated_at: new Date().toISOString(),
        },
      };
      const newNodes = [...nodes.value];
      newNodes[sourceNodeIndex] = validateNode(updatedSourceNode);
      nodes.value = newNodes;

      // Atualiza a variável para refletir a nova referência
      sourceNode = nodes.value.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return;

      // 2. Para cada filho, propaga input/context de forma imutável
      const outgoingEdges = edges.value.filter(
        (e) => e.source === sourceNodeId
      );
      for (const edge of outgoingEdges) {
        const targetNodeId = edge.target;
        const targetNodeIndex = nodes.value.findIndex(
          (n) => n.id === targetNodeId
        );

        if (targetNodeIndex === -1) {
          console.warn(
            `[TaskFlowStore propagateOutput] Target node ${targetNodeId} not found. Skipping.`
          );
          continue;
        }

        try {
          const currentTargetNode = nodes.value[targetNodeIndex];
          let targetDataClone: NodeData;
          try {
            targetDataClone = JSON.parse(
              JSON.stringify(currentTargetNode.data)
            );
          } catch (e) {
            targetDataClone = { ...currentTargetNode.data };
          }

          // NOVO: Cria novo objeto inputData
          const newInputData = {
            ...(targetDataClone.inputData || {}),
            [sourceNodeId]: normalizeOutput(sourceOutput),
          };

          // Atualiza cumulativeContext de forma imutável
          const sourceNodeCumulativeContext: CumulativeContextBlob = decompress(
            sourceNode.data.cumulativeContext
          );
          const targetNodeCurrentCumulativeContext: CumulativeContextBlob =
            decompress(currentTargetNode.data.cumulativeContext);

          let mergedContext: CumulativeContextBlob = mergeByVersion(
            { ...targetNodeCurrentCumulativeContext },
            sourceNodeCumulativeContext
          );
          mergedContext[sourceNodeId] = {
            type: sourceNode.type,
            output: normalizeOutput(sourceOutput),
            version: Date.now(),
          };

          const newTargetData: NodeData = {
            ...targetDataClone,
            inputData: { ...newInputData },
            cumulativeContext: compressIfNeeded(mergedContext),
            updated_at: new Date().toISOString(),
          };

          // Troca o node no array (imutabilidade)
          const updatedTargetNode: TaskFlowNode = {
            ...currentTargetNode,
            data: newTargetData,
          };
          const newNodesArr = [...nodes.value];
          newNodesArr[targetNodeIndex] = validateNode(updatedTargetNode);
          nodes.value = newNodesArr;
        } catch (err) {
          console.error(
            `[TaskFlowStore propagateOutput] Falha ao propagar para target ${targetNodeId}:`,
            err
          );
          // Salva o erro como string no processInputError do target node
          const targetNodeIndex = nodes.value.findIndex(
            (n) => n.id === targetNodeId
          );
          if (targetNodeIndex !== -1) {
            const currentTargetNode = nodes.value[targetNodeIndex];
            const updatedTargetNode = {
              ...currentTargetNode,
              data: {
                ...currentTargetNode.data,
                processInputError: toErrorString(err), // Salva o erro como string
                updated_at: new Date().toISOString(),
              },
            };
            const newNodesArr = [...nodes.value];
            newNodesArr[targetNodeIndex] = validateNode(updatedTargetNode);
            nodes.value = newNodesArr;
          }
          // Continua propagação para os outros filhos
          continue;
        }
      }
    }
  };

  // <<< Refatorado: updateNodeData modularizado usando propagation composable
  const updateNodeData = async (
    nodeId: string,
    newData: Partial<NodeData> & { _action?: string; _payload?: any }
  ): Promise<void> => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;

    const oldNode = nodes.value[nodeIndex];

    let dataUpdates = { ...newData };
    delete (dataUpdates as any)._action;
    delete (dataUpdates as any)._payload;

    // Se houver _action, chama o handler.handleAction
    if (newData._action && oldNode.type) {
      const handler = getNodeHandler(oldNode.type);
      if (handler?.handleAction) {
        const actionResult = await handler.handleAction(
          newData._action,
          newData._payload,
          oldNode,
          globalThis.$fetch
        );
        if (
          actionResult &&
          typeof actionResult === "object" &&
          !(actionResult as any).error
        ) {
          dataUpdates = {
            ...dataUpdates,
            ...(actionResult as Partial<NodeData>),
          };
        } else if ((actionResult as any)?.error) {
          dataUpdates.processInputError = `Ação '${
            newData._action
          }' falhou: ${toErrorString((actionResult as any).error)}`;
        }
      }
    }

    // === GERA O OUTPUT AUTOMATICAMENTE PARA "problem" ===
    if (
      oldNode.type === "problem" &&
      (dataUpdates.title !== undefined || dataUpdates.description !== undefined)
    ) {
      const handler = getNodeHandler(oldNode.type);
      if (handler?.generateOutput) {
        dataUpdates.outputData = await handler.generateOutput({
          ...oldNode,
          data: {
            ...oldNode.data,
            ...dataUpdates,
          },
        });
      }
    }

    // === GERA O OUTPUT AUTOMATICAMENTE QUANDO SOURCES SÃO ATUALIZADOS ===
    if (oldNode.type === "dataSource" && dataUpdates.sources !== undefined) {
      const handler = getNodeHandler(oldNode.type);
      if (handler?.generateOutput) {
        // Gera o novo outputData baseado nas sources atualizadas
        dataUpdates.outputData = await handler.generateOutput({
          ...oldNode,
          data: {
            ...oldNode.data,
            ...dataUpdates,
          },
        });
      }
    }

    // Merge shallow for outputData and inputData, giving precedence to newData.
    // If only inputData changed, mirror inputs into outputs by default.
    const newInputData = dataUpdates.inputData ?? oldNode.data.inputData ?? {};
    const newOutputData =
      dataUpdates.outputData !== undefined
        ? dataUpdates.outputData
        : dataUpdates.inputData !== undefined
        ? newInputData
        : oldNode.data.outputData ?? {};

    const mergedData: NodeData = {
      ...oldNode.data,
      ...dataUpdates,
      outputData: newOutputData,
      inputData: newInputData,
      updated_at: new Date().toISOString(),
    };

    // Verifica se o outputData realmente mudou
    const outputChanged =
      JSON.stringify(oldNode.data.outputData) !==
      JSON.stringify(mergedData.outputData);

    // Atualiza o nó na store
    const updatedNode = { ...oldNode, data: mergedData };
    nodes.value.splice(nodeIndex, 1, validateNode(updatedNode));

    // Força troca de referência do array para garantir reatividade e passar em testes de referência
    nodes.value = [...nodes.value];
    await nextTick();

    // Se o output mudou, propaga output para os filhos.
    if (outputChanged) {
      await propagation.propagateOutputFromNode(nodeId, nodes, edges);
    }
    debouncedSaveTaskFlow();
  };

  // <<< Add type annotations
  const updateElements = (
    newNodes: TaskFlowNode[],

    newEdges: TaskFlowEdge[]
  ): void => {
    nodes.value = newNodes.map(validateNode);
    edges.value = newEdges.filter((edge) => validateEdge(edge));

    console.trace("[TaskFlowStore DEBUG] Stacktrace para edges.value");
    saveTaskFlow(); // Use direct save
  };

  // Renamed to clarify it also saves
  // <<< Add type annotation
  const updateViewportAndSave = (newViewport: Viewport): void => {
    // Garante que o viewport tenha valores válidos
    const validViewport: Viewport = {
      // <<< Use Viewport type
      x: typeof newViewport.x === "number" ? newViewport.x : 0,
      y: typeof newViewport.y === "number" ? newViewport.y : 0,
      zoom: typeof newViewport.zoom === "number" ? newViewport.zoom : 1,
      width: typeof newViewport.width === "number" ? newViewport.width : 0,
      height: typeof newViewport.height === "number" ? newViewport.height : 0,
    };

    viewport.value = validViewport;
    saveTaskFlow(); // Use direct save
  };

  // <<< Add type annotations
  const addNode = async (node: TaskFlowNode): Promise<void> => {
    if (!currentTaskId.value) {
      console.warn("[TaskFlowStore addNode] currentTaskId é nulo.");
      return;
    }

    graphOps.addNodeToState(nodes, node);
    await nextTick();

    nodeToAnimateTo.value = node.id;
  };

  // Função correta de remoção de node (versão refatorada usando graphOps/contextManager)
  // <<< Add type annotation
  const removeNode = async (nodeId: string): Promise<void> => {
    const nodeToRemove = nodes.value.find((n) => n.id === nodeId);
    if (!nodeToRemove) return;

    // Passo 1: Verificar se precisa de confirmação
    const typesRequiringConfirmation = ["survey", "report"];
    const modalStore = useModalStore();

    // Passo 2: Função que realmente remove o nó (lógica antiga aqui dentro)
    const performDelete = async () => {
      // --- Centralized side‑effects: delete associated DB rows ---
      const supabase = useSupabaseClient<Database>();

      // Delete report row (cascades) when removing a ReportCard
      if (
        nodeToRemove.type === "report" &&
        nodeToRemove.data?.analyzedData?.report_id
      ) {
        const reportIdToDelete = nodeToRemove.data.analyzedData.report_id;

        try {
          const { error } = await supabase
            .from("reports")
            .delete()
            .eq("id", reportIdToDelete);
          if (error) {
            console.error(
              `[TaskFlowStore] Error deleting report ${reportIdToDelete}:`,
              error
            );
          }
        } catch (err) {
          console.error(
            `[TaskFlowStore] Exception during report deletion (${reportIdToDelete}):`,
            err
          );
        }
      }

      // Delete survey row (questions/answers cascade) when removing a SurveyCard
      if (nodeToRemove.type === "survey" && nodeToRemove.data?.surveyId) {
        const surveyIdToDelete = nodeToRemove.data.surveyId;

        try {
          const { error } = await supabase
            .from("surveys")
            .delete()
            .eq("id", surveyIdToDelete);
          if (error) {
            console.error(
              `[TaskFlowStore] Error deleting survey ${surveyIdToDelete}:`,
              error
            );
          }
        } catch (err) {
          console.error(
            `[TaskFlowStore] Exception during survey deletion (${surveyIdToDelete}):`,
            err
          );
        }
      }
      // Ação específica do handler antes da remoção (ex: deletar survey ou report do DB)
      if (!nodeToRemove.type) return; // Ensure type is defined
      const handler = getNodeHandler(nodeToRemove.type);
      if (handler?.handleAction) {
        try {
          await handler.handleAction(
            "onBeforeDelete",
            { nodeId },
            nodeToRemove,
            globalThis.$fetch
          );
        } catch (e) {
          console.error(
            `[TaskFlowStore] Erro na ação onBeforeDelete do handler para ${nodeId}:`,
            e
          );
          // Decide se a remoção prossegue mesmo com erro — aqui prossegue
        }
      }

      // Remove o nó e retorna informações sobre as edges removidas
      const removalResult = graphOps.removeNodeFromState(nodes, edges, nodeId);

      if (removalResult) {
        // Limpar LastProcessedInputs do nó removido para cada tipo
        setEmpathMapLastProcessedInput(nodeId, null);
        setAffinityMapLastProcessedInput(nodeId, null);
        setInsightsLastProcessedInput(nodeId, null);
        setReportLastProcessedInput(nodeId, null);

        // Para cada edge removida que tinha o node como SOURCE,
        // limpar input/context do target e reconstruir cumulativeContext
        const affectedTargetNodeIds = new Set<string>();
        if (removalResult.affectedEdges) {
          for (const affectedEdge of removalResult.affectedEdges) {
            if (affectedEdge.source === nodeId && affectedEdge.target) {
              affectedTargetNodeIds.add(affectedEdge.target);
            }
          }
        }

        for (const targetId of affectedTargetNodeIds) {
          const targetNodeIndex = nodes.value.findIndex(
            (n) => n.id === targetId
          );
          if (targetNodeIndex !== -1) {
            const currentTargetNode = nodes.value[targetNodeIndex];
            let targetNodeDataCopy = JSON.parse(
              JSON.stringify(currentTargetNode.data)
            );

            // Limpar input direto do nó removido
            if (targetNodeDataCopy.inputData?.[nodeId]) {
              delete targetNodeDataCopy.inputData[nodeId];
            }
            // Limpar do cumulativeContext e reconstruir
            targetNodeDataCopy.cumulativeContext =
              contextManager.buildCompleteCumulativeContextForNode(
                targetId,
                nodes,
                edges
              );
            targetNodeDataCopy.updated_at = new Date().toISOString();

            const updatedTargetNode = {
              ...currentTargetNode,
              data: targetNodeDataCopy,
            };
            nodes.value.splice(targetNodeIndex, 1, updatedTargetNode);

            // Opcional: Reprocessar o targetNode pois seus inputs mudaram
            // await requestNodeReprocessing(targetId);
          }
        }
      }
      saveFlowDebounced({
        taskId: currentTaskId.value!,
        nodes: nodes.value,
        edges: edges.value,
        viewport: viewport.value,
      });

      modalStore.closeModal(); // Fecha o modal após a deleção
    };

    // Passo 3: Exibir modal se necessário
    if (typesRequiringConfirmation.includes(nodeToRemove.type)) {
      modalStore.openModal(ModalType.confirmDelete, {
        title: `Excluir ${
          nodeToRemove.type === "survey" ? "Survey" : "Relatório"
        }`,
        message: `Isso excluirá permanentemente este ${
          nodeToRemove.type === "survey"
            ? "survey e todas as suas respostas"
            : "relatório"
        } do banco de dados. Esta ação não pode ser desfeita.`,
        onConfirm: performDelete,
      });
      return;
    }

    // Caso não precise de confirmação, executa direto
    await performDelete();
  };

  // Nova versão robusta de addEdgeInternal, garantindo reatividade e retorno do edge criado
  function addEdgeInternal(
    edgeData: Partial<TaskFlowEdge>,
    sourceNodeId: string,
    targetNodeId: string,
    validationOptions: { skipTargetExistCheck?: boolean } = {}
  ): TaskFlowEdge | null {
    const newEdgeObject: TaskFlowEdge = {
      id:
        edgeData.id ||
        `vueflow__edge-${sourceNodeId}${targetNodeId}-${nanoid(5)}`, // Garante ID único
      source: sourceNodeId,
      target: targetNodeId,
      type: edgeData.type || "smoothstep",
      sourceX: edgeData.sourceX || 0,
      sourceY: edgeData.sourceY || 0,
      targetX: edgeData.targetX || 0,
      targetY: edgeData.targetY || 0,
      selected: edgeData.selected || false,
      sourceNode: edgeData.sourceNode as any, // Cast to any as it's likely populated by Vue Flow later
      targetNode: edgeData.targetNode as any, // Cast to any as it's likely populated by Vue Flow later
      data: edgeData.data || {},
      events: edgeData.events || {},
      animated: edgeData.animated ?? false,
      label: edgeData.label,
    };

    const edgeExists = edges.value.some(
      (e) => e.source === sourceNodeId && e.target === targetNodeId
    );

    if (validateEdge(newEdgeObject, validationOptions) && !edgeExists) {
      // Usa novo array para garantir reatividade
      edges.value = [...edges.value, newEdgeObject];
      return newEdgeObject;
    }

    console.warn(
      "[TaskFlowStore addEdgeInternal] Validation failed or edge already exists.",
      newEdgeObject
    );
    return null;
  }

  // Nova versão de addEdge totalmente modularizada usando composables
  const addEdge = async (edgeData: Partial<TaskFlowEdge>): Promise<void> => {
    if (!edgeData.source || !edgeData.target) {
      console.warn(
        "[TaskFlowStore addEdge] Source ou target ausente.",
        edgeData
      );
      return;
    }

    // 1. Usa o composable para adicionar a aresta ao estado
    const addedEdge = graphOps.addEdgeToState(edges, nodes, edgeData);

    await nextTick();

    // Log edges.value após tentativa de adição

    if (addedEdge) {
      await nextTick();
      // 2. Propaga o input e contexto do source para o target usando propagation
      const sourceNode = nodes.value.find((n) => n.id === addedEdge.source);

      if (sourceNode) {
        propagation.propagateInputAndContextToChild(
          sourceNode,
          addedEdge.target,
          nodes,
          edges
        );
      }
      debouncedSaveTaskFlow();
    }
  };

  // --- REFACTORED: Modular removeEdge using graphOps and contextManager ---
  const removeEdge = async (edgeId: string): Promise<void> => {
    // 1. Remove a edge usando o composable graphOps
    const removedEdge = graphOps.removeEdgeFromState(edges, edgeId);

    if (removedEdge) {
      // 2. Reconstrói o contexto cumulativo do nó target afetado
      const targetNodeIndex = nodes.value.findIndex(
        (n) => n.id === removedEdge.target
      );
      if (targetNodeIndex !== -1) {
        const currentTargetNode = nodes.value[targetNodeIndex];
        let targetNodeDataCopy = JSON.parse(
          JSON.stringify(currentTargetNode.data)
        );

        // Limpa input direto do source removido
        if (targetNodeDataCopy.inputData?.[removedEdge.source]) {
          delete targetNodeDataCopy.inputData[removedEdge.source];
        }

        // Reconstrói o cumulativeContext completo do targetNode
        targetNodeDataCopy.cumulativeContext =
          contextManager.buildCompleteCumulativeContextForNode(
            removedEdge.target,
            nodes,
            edges
          );
        targetNodeDataCopy.updated_at = new Date().toISOString();

        const updatedTargetNode = {
          ...currentTargetNode,
          data: targetNodeDataCopy,
        };
        nodes.value.splice(targetNodeIndex, 1, updatedTargetNode);

        // Opcional: Reprocessa o targetNode, pois seus inputs mudaram
        // await requestNodeReprocessing(removedEdge.target);
      }
      debouncedSaveTaskFlow();
    }
  };

  // --- recalculateNodeState function is removed ---

  // <<< Add type annotations
  /**
   * Adiciona um nó e conecta a partir de um nó fonte, utilizando composables para inicialização, contexto e propagação.
   */
  // Função para adicionar um nó e conectar a partir de um nó fonte (localizada)
  const addNodeAndConnect = async (
    nodeType: string,
    sourceNodeId: string | null = null,
    sourceNodePosition: XYPosition | null = null,
    sourceHeight: number | null = null,
    targetFlowX?: number,
    targetFlowY?: number
  ): Promise<TaskFlowNode | null> => {
    const logPrefix = `[taskFlowStore.addNodeAndConnect][${nodeType}]`;

    if (!currentTaskId.value) {
      console.error(`${logPrefix} ERRO: currentTaskId é nulo.`);
      console.groupEnd();
      return null;
    }

    // 1. Calcular posição do novo nó (usando a lógica corrigida)
    const est = {
      ...(ESTIMATED_NODE_DIMENSIONS[nodeType] ||
        ESTIMATED_NODE_DIMENSIONS.default),
      nodeType, // Adiciona o tipo para logs
    };

    let pos: XYPosition;
    if (typeof targetFlowX === "number" && typeof targetFlowY === "number") {
      // Adição global (canvas) — usar smart placement para evitar sobreposição

      const initialCandidatePos = {
        x: targetFlowX - est.width / 2,
        y: targetFlowY - est.height / 2,
      };
      // Primeiro tenta manter o novo nó dentro da viewport visível
      const clampedInitialPos = clampToViewport(
        initialCandidatePos,
        { width: est.width, height: est.height },
        viewport.value
      );

      // Garantir que cada nó tenha dimensões não‑zero para o cálculo;
      // se ainda não foram medidas, usa estimativa por tipo.
      const nodesWithDims = nodes.value.map((n) => {
        const hasRealDims =
          n.dimensions && n.dimensions.width > 0 && n.dimensions.height > 0;

        return {
          ...n,
          dimensions: hasRealDims
            ? n.dimensions
            : ESTIMATED_NODE_DIMENSIONS[n.type || "default"] ??
              ESTIMATED_NODE_DIMENSIONS.default,
        };
      });
      pos = findFreePosition(nodesWithDims as any, est, clampedInitialPos, {
        gridStep: 30,
        searchRadius: 600,
        safeMargin: 60, // Increased to match updated safe margin for better spacing
      });
    } else if (sourceNodePosition && sourceNodeId) {
      const sourceNodeForPos = nodes.value.find((n) => n.id === sourceNodeId);
      if (sourceNodeForPos) {
        const estWidth = est.width;
        const estHeight = est.height;
        // Filtra filhos reais já existentes
        const existingChildren = edges.value
          .filter((e) => e.source === sourceNodeId)
          .map((e) => nodes.value.find((n) => n.id === e.target))
          .filter((n): n is TaskFlowNode => !!n);

        pos = calculateChildNodePosition(
          sourceNodeForPos,
          existingChildren,
          { width: estWidth, height: estHeight },
          { gapY: 160, gapX: 50 }
        );
      } else {
        // Fallback: centraliza no viewport
        const vp = viewport.value;
        const z = vp.zoom || 1;
        pos = {
          x: (vp.x + vp.width / 2) / z - est.width / 2,
          y: (vp.y + vp.height / 2) / z - est.height / 2,
        };
      }
    } else {
      // fallback: centraliza no viewport atual (para fluxos criados programaticamente)
      const vp = viewport.value;
      const z = vp.zoom || 1;
      pos = {
        x: (100 - vp.x) / z - est.width / 2,
        y: (100 - vp.y) / z - est.height / 2,
      };
    }

    /* ------------------------------------------------------------------
     *  PASSO EXTRA de segurança:
     *  Depois de calcular a posição inicial (pos) usando
     *  calculateChildNodePosition OU findFreePosition,
     *  garantimos que ela NÃO colida com nenhum nó existente.
     *  Se houver colisão, chamamos findFreePosition novamente
     *  a partir da posição já calculada para obter um ponto livre.
     * ------------------------------------------------------------------ */
    (() => {
      const SAFE_MARGIN = 40; // Increased to match updated safe margin for better spacing
      const newNodeDims = est; // já contém {width,height} estimados p/ este tipo

      // Garante que todos os nós tenham dimensões válidas
      const nodesForCheck = nodes.value.map((n) => {
        const hasDims =
          n.dimensions && n.dimensions.width > 0 && n.dimensions.height > 0;
        return {
          ...n,
          dimensions: hasDims
            ? n.dimensions
            : ESTIMATED_NODE_DIMENSIONS[n.type || "default"] ??
              ESTIMATED_NODE_DIMENSIONS.default,
        };
      });

      const overlapsExisting = nodesForCheck.some((n) => {
        const a = { x: pos.x, y: pos.y, ...newNodeDims };
        const b = {
          x: n.position.x,
          y: n.position.y,
          width: n.dimensions.width,
          height: n.dimensions.height,
        };
        // DETECTA colisão com margem de segurança
        return !(
          a.x + a.width + SAFE_MARGIN < b.x ||
          b.x + b.width + SAFE_MARGIN < a.x ||
          a.y + a.height + SAFE_MARGIN < b.y ||
          b.y + b.height + SAFE_MARGIN < a.y
        );
      });

      if (overlapsExisting) {
        console.warn(
          "[addNodeAndConnect] Posição inicial colidiu com nó existente. " +
            "Recalculando com findFreePosition..."
        );
        pos = findFreePosition(nodesForCheck as any, newNodeDims, pos, {
          gridStep: 30,
          searchRadius: 600,
          safeMargin: 60, // Increased to match updated safe margin for better spacing
        });
      }
    })();
    // 2. Criar o objeto do novo nó usando useNodeInitialization
    const sourceNode = sourceNodeId
      ? nodes.value.find((n) => n.id === sourceNodeId)
      : undefined;
    const newNode = nodeInitializer.createNewNodeObject(
      nodeType,
      currentTaskId.value,
      pos,
      sourceNodeId ?? undefined,
      sourceNode?.data.outputData,
      sourceNode?.type
    );

    if (!newNode) return null;

    // 1. Adiciona node na store
    await graphOps.addNodeToState(nodes, newNode);
    await nextTick();
    try {
      await until(() => nodes.value.some((n) => n.id === newNode.id)).toBe(
        true,
        { timeout: 1500, throwOnTimeout: true }
      );
    } catch (error) {
      console.error(
        `${logPrefix} ERRO CRÍTICO: Nó ${newNode.id} não apareceu em nodes.value após timeout do 'until'.`,
        { allNodeIdsInStore: nodes.value.map((n) => n.id) },
        error
      );
      console.groupEnd();
      return null;
    }
    // --- Lógica para trigger de animação no canvas ---
    nodeToAnimateTo.value = newNode.id;

    // // 2. Atualiza internals no Vue Flow (garante handles/dimensões)
    // if (vueFlowInstance.value?.updateNodeInternals) {
    //   vueFlowInstance.value.updateNodeInternals([newNode.id]);
    //   await nextTick();
    // } else {
    //   console.warn(
    //     "[addNodeAndConnect] vueFlowInstance/updateNodeInternals ausente"
    //   );
    //   await nextTick();
    // }

    // 3. Só agora adiciona a edge (se tiver sourceNodeId)

    // [DEBUG] Entrando no bloco de edge?

    let wasEdgeAdded = false;
    if (sourceNodeId) {
      // Dentro de addEdgeToState, antes da validação dos nós

      const partialEdge = { source: sourceNodeId, target: newNode.id };

      const sourceNodeExists = nodes.value.some((n) => n.id === sourceNodeId);
      const targetNodeExists = nodes.value.some((n) => n.id === newNode.id);

      if (!sourceNodeExists || !targetNodeExists) {
        console.error("NÃO EXISTE SOURCE/TARGET", {
          sourceNodeId,
          targetNodeId: newNode.id,
        });
      } else {
        // ADICIONE LOG ANTES DE ADICIONAR

        const newEdgeId = `edge_${sourceNodeId}-${newNode.id}_${nanoid(7)}`;

        const addedEdge = graphOps.addEdgeToState(edges, nodes, {
          id: newEdgeId,
          source: sourceNodeId,
          target: newNode.id,
          type: "smoothstep",
          animated: false,
          data: {},
        });

        if (addedEdge) {
          wasEdgeAdded = true;
          await nextTick();
          // Propaga input/context
          const sourceNode = nodes.value.find((n) => n.id === sourceNodeId);
          if (sourceNode) {
            propagation.propagateInputAndContextToChild(
              sourceNode,
              newNode.id,
              nodes,
              edges
            );
          }
          if (vueFlowInstance.value?.addEdges) {
            await nextTick();
          }
        }
      }
    }

    // Outras inicializações específicas de nós aqui (se necessário, para outros tipos)

    // 6. Finalizar o estado do isLoadingEdgeConnection
    const nodeIndexToFinalize = nodes.value.findIndex(
      (n) => n.id === newNode.id
    );
    if (nodeIndexToFinalize !== -1) {
      const nodeToFinalize = { ...nodes.value[nodeIndexToFinalize] };
      nodeToFinalize.data = {
        ...nodeToFinalize.data,
        isLoadingEdgeConnection: false,
        updated_at: new Date().toISOString(),
      };
      nodes.value.splice(nodeIndexToFinalize, 1, validateNode(nodeToFinalize));
    }

    try {
      saveFlowDebounced({
        taskId: currentTaskId.value!,
        nodes: nodes.value,
        edges: edges.value,
        viewport: viewport.value,
      });
    } catch (error) {
      console.error(`${logPrefix} ERRO ao salvar fluxo:`, error);
    }

    // --- Ajuste de Viewport Inteligente (fitView/setViewport) ---
    await nextTick();
    const vfInstance = (globalThis as any).$vueFlow;
    if (vfInstance?.fitView && vfInstance.setViewport) {
      const currentVp = viewport.value;
      const actualNewNodeInStore = nodes.value.find((n) => n.id === newNode.id);
      const finalNodeDims =
        actualNewNodeInStore?.dimensions &&
        actualNewNodeInStore.dimensions.width > 0 &&
        actualNewNodeInStore.dimensions.height > 0
          ? actualNewNodeInStore.dimensions
          : est;

      const isNewNodeVisible = isNodeFullyVisibleInViewport(
        pos,
        finalNodeDims,
        currentVp,
        50
      );

      if (!isNewNodeVisible) {
        if (sourceNodeId) {
          // Adição contextual: faz fitView entre o nó origem e o novo nó
          vfInstance.fitView({
            nodes: [sourceNodeId, newNode.id],
            duration: 300,
            padding: 0.2,
            maxZoom: currentVp.zoom,
            minZoom: Math.min(currentVp.zoom, 0.5),
          });
        } else {
          // Adição global: faz fitView para incluir o novo nó
          vfInstance.fitView({
            nodes: [newNode.id],
            duration: 300,
            padding: 0.2,
            maxZoom: currentVp.zoom,
            minZoom: Math.min(currentVp.zoom, 0.5),
          });
        }
      }
    }

    return nodes.value.find((n) => n.id === newNode.id) || null;
  };

  /* ---- Aliases legados para não quebrar chamadas antigas ---- */
  const addNodeAndGetEdgePlan = addNodeAndConnect;
  const requestAddNodeAndPrepareConnection = addNodeAndConnect;
  const requestAddNode = addNodeAndConnect;

  // --- Action to update only node position ---
  // <<< Add type annotations
  const updateNodePosition = (
    nodeId: string,
    position: XYPosition
  ): Promise<void> => {
    return new Promise((resolve) => {
      const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
      if (nodeIndex > -1) {
        const updatedNode = {
          ...nodes.value[nodeIndex],
          position,
          data: {
            ...nodes.value[nodeIndex].data,
            updated_at: new Date().toISOString(),
          },
        };
        const newNodes = [...nodes.value];
        newNodes[nodeIndex] = updatedNode;
        nodes.value = newNodes;

        nextTick(() => {
          saveFlowDebounced({
            taskId: currentTaskId.value!,
            nodes: nodes.value,
            edges: edges.value,
            viewport: viewport.value,
          });
          resolve();
        });
      } else {
        console.warn(
          `[TaskFlowStore updateNodePosition] Node not found: ${nodeId}`
        );
        resolve();
      }
    });
  };

  // --- Watcher for Knowledge Base Changes (Triggered by fetchSources) ---
  // --- Debounced Save Function ---
  // Debounce saveTaskFlow to avoid excessive writes
  // const debouncedSave = debounce(saveTaskFlow, 300); // REDUCED delay (was 1500ms)

  // --- Watcher for Nodes and Edges ---
  watch(
    [nodes, edges], // Watch both nodes and edges arrays
    ([newNodes, newEdges], [oldNodes, oldEdges]) => {
      // REMOVED: isInitialLoadComplete check. Let debounce handle initial load flurry.
      // REINSTATING check to prevent premature saves on initial load:
      if (isInitialLoadComplete.value && !isTransitioning.value) {
        saveFlowDebounced({
          taskId: currentTaskId.value!,
          nodes: nodes.value,
          edges: edges.value,
          viewport: viewport.value,
        });
      } else {
      }
    },
    { deep: true } // Crucial: Watch for changes inside node data objects
  );

  // --- REMOVED Orphaned Watcher (was for kbSources) ---

  // --- Cleanup on Store Unmount ---
  // This might not be the standard Pinia way, but works within setup function context

  // Função para limpar o estado do fluxo ao deletar uma task
  // --- Action to trigger reprocessing of a node ---
  const requestNodeReprocessing = async (nodeId: string): Promise<void> => {
    // Set loading state at the very beginning
    loadingStates.value[nodeId] = {
      isLoading: true,
      message: "Analisando com IA...",
    };
    try {
      const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
      if (nodeIndex === -1) return;

      const nodeToReprocess = nodes.value[nodeIndex];

      // 1. Garante que o cumulativeContext do nó está atualizado
      const rebuiltCumulativeContext =
        contextManager.buildCompleteCumulativeContextForNode(
          nodeId,
          nodes,
          edges
        );

      // Atualiza o nó na store com o contexto reconstruído ANTES de chamar triggerNodeProcessing
      let dataWithRebuiltContext = {
        ...nodeToReprocess.data,
        cumulativeContext: rebuiltCumulativeContext,
        updated_at: new Date().toISOString(),
      };
      const nodeWithFreshContext = {
        ...nodeToReprocess,
        data: dataWithRebuiltContext,
      };
      nodes.value.splice(nodeIndex, 1, validateNode(nodeWithFreshContext));

      // FORÇAR REATIVIDADE
      nodes.value = [...nodes.value];
      await nextTick();

      // A referência nodeToReprocess ainda aponta para o objeto antigo. Pegue o novo da store.
      const actualNodeToProcess = nodes.value.find((n) => n.id === nodeId);
      if (!actualNodeToProcess) {
        console.error(
          `[TaskFlowStore requestNodeReprocessing] Nó ${nodeId} sumiu após atualização de contexto.`
        );
        return;
      }

      // 2. Dispara o processamento do nó (que usa o data atualizado, incluindo o cumulativeContext fresco)
      const { updates, outputChanged } =
        await propagation.triggerNodeProcessing(nodeId, nodes, edges);

      // 3. Mescla os resultados do processamento (analyzedData, processInputError, outputData) de volta no nó
      if (updates) {
        const finalNodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
        if (finalNodeIndex !== -1) {
          const nodeBeforeHandlerUpdates = nodes.value[finalNodeIndex];
          const finalData = {
            ...nodeBeforeHandlerUpdates.data,
            ...updates,
            updated_at: new Date().toISOString(),
          };
          const finalUpdatedNode = {
            ...nodeBeforeHandlerUpdates,
            data: finalData,
          };
          nodes.value.splice(finalNodeIndex, 1, validateNode(finalUpdatedNode));

          nodes.value = [...nodes.value];
          await nextTick();

          // 4. Se o output mudou como resultado do processamento, propaga
          if (outputChanged) {
            await propagation.propagateOutputFromNode(nodeId, nodes, edges);
          }
        }
      }
      debouncedSaveTaskFlow();
    } finally {
      // Always clear loading state at the end
      loadingStates.value[nodeId] = { isLoading: false, message: "" };
    }
  };
  function clearTaskFlowState() {
    currentTaskId.value = null;
    nodes.value = [];
    edges.value = [];

    viewport.value = { x: 0, y: 0, zoom: 1, width: 0, height: 0 };
    empathMapLastProcessedInputs.value = {}; // Clear EmpathMapCard processed states
    affinityMapLastProcessedInputs.value = {};
    insightsLastProcessedInputs.value = {};
    reportLastProcessedInputs.value = {};
    isInitialLoadComplete.value = false;
    loadingStates.value = {};
    isVueFlowInstanceReady.value = false; // reseta flag
  }

  // Função para resetar todos os principais estados reativos
  function $reset() {
    currentTaskId.value = null;
    nodes.value = [];
    edges.value = [];
    viewport.value = { x: 0, y: 0, zoom: 1, width: 0, height: 0 };
    empathMapLastProcessedInputs.value = {};
    affinityMapLastProcessedInputs.value = {};
    insightsLastProcessedInputs.value = {};
    reportLastProcessedInputs.value = {};
    isInitialLoadComplete.value = false;
    loadingStates.value = {};
  }

  // --- Getters/Setters for EmpathMapCard Processed State ---
  const getEmpathMapLastProcessedInput = (nodeId: string): string | null => {
    return empathMapLastProcessedInputs.value[nodeId] ?? null;
  };

  const setEmpathMapLastProcessedInput = (
    nodeId: string,
    inputString: string | null
  ): void => {
    if (inputString === null) {
      // Allows explicit clearing by deleting the key
      delete empathMapLastProcessedInputs.value[nodeId];
    } else {
      empathMapLastProcessedInputs.value[nodeId] = inputString;
    }
  };

  // Action to specifically clear analysis data for an EmpathMapNode
  // This is called from EmpathMapCard.vue when its relevant input becomes null
  const clearEmpathMapAnalysis = (nodeId: string): void => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      // console.warn(`[TaskFlowStore clearEmpathMapAnalysis] Node ${nodeId} not found.`);
      return;
    }

    const nodeToUpdate = nodes.value[nodeIndex];

    // Check if an update is actually needed to avoid unnecessary reactivity/saves
    if (
      nodeToUpdate.data.analyzedData !== null ||
      nodeToUpdate.data.processInputError !== null ||
      (nodeToUpdate.data.outputData &&
        Object.keys(nodeToUpdate.data.outputData).length > 0)
    ) {
      // Directly update the node's data fields.
      // We create a new object for node.data to ensure reactivity.
      const newData = {
        ...nodeToUpdate.data,
        analyzedData: null,
        processInputError: null,
        outputData: {}, // Empath map output depends on analyzedData
        updated_at: new Date().toISOString(),
      };

      nodes.value[nodeIndex] = {
        ...nodeToUpdate,
        data: newData,
      };

      // After clearing, the "current relevant input" is effectively null.
      // The EmpathMapCard watcher's newStringForComparison will be primitive null.
      setEmpathMapLastProcessedInput(nodeId, null); // Use primitive null

      // Trigger a debounced save as node data has changed.
      debouncedSaveTaskFlow();
    } else {
      // Ensure last processed input is consistent even if no data change
      if (getEmpathMapLastProcessedInput(nodeId) !== "null") {
        setEmpathMapLastProcessedInput(nodeId, "null");
        // If only the last processed input changed, still good to save to maintain consistency if app closes.
        debouncedSaveTaskFlow();
      }
    }
  };

  // --- Affinity Map Specific State and Actions ---
  const setAffinityMapLastProcessedInput = (
    nodeId: string,
    inputString: string | null
  ): void => {
    if (inputString === null) {
      delete affinityMapLastProcessedInputs.value[nodeId];
    } else {
      affinityMapLastProcessedInputs.value[nodeId] = inputString;
    }
  };

  const getAffinityMapLastProcessedInput = (nodeId: string): string | null => {
    return affinityMapLastProcessedInputs.value[nodeId] ?? null;
  };

  const clearAffinityMapAnalysis = (nodeId: string): void => {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex !== -1) {
      const nodeToUpdate = nodes.value[nodeIndex];
      let updated = false;

      if (nodeToUpdate.data.analyzedData !== null) {
        nodeToUpdate.data.analyzedData = null;
        updated = true;
      }
      if (nodeToUpdate.data.processInputError !== null) {
        nodeToUpdate.data.processInputError = null;
        updated = true;
      }
      if (
        nodeToUpdate.data.outputData &&
        Object.keys(nodeToUpdate.data.outputData).length > 0
      ) {
        nodeToUpdate.data.outputData = {}; // Clear output if it depends on analysis
        updated = true;
      }

      if (updated) {
        nodeToUpdate.data.updated_at = new Date().toISOString();
        // Ensure reactivity by creating a new nodes array or updating the item reference
        nodes.value.splice(nodeIndex, 1, { ...nodeToUpdate });
      }
      // Always clear the last processed input string for this node
      setAffinityMapLastProcessedInput(nodeId, null);

      if (updated) {
        // Save if data was actually changed
        debouncedSaveTaskFlow();
      }
    } else {
      // If node not found, but we have a processed input string, clear it
      if (getAffinityMapLastProcessedInput(nodeId) !== null) {
        setAffinityMapLastProcessedInput(nodeId, null);
        debouncedSaveTaskFlow(); // Save if only the processed input changed
      }
    }
  };

  const setVueFlowInstance = (instance: any) => {
    vueFlowInstance.value = instance;
    if (_resolveVueFlowInstancePromise) {
      _resolveVueFlowInstancePromise(instance);
    }
    isVueFlowInstanceReady.value = true; // <-- novo
  };

  const initializeFlow = (taskId: string, initialProblem: any) => {
    const { initializeProblemNode, loadNodesAndEdgesFromProblemStatement } =
      useNodeInitialization(
        nodes,
        edges,
        viewport,
        // The findFreePosition parameter is currently unused in the composable.
        // Passing a compliant dummy function to satisfy the type signature.
        (node: TaskFlowNode) => node.position
      );

    if (nodes.value.length === 0) {
      if (initialProblem) {
        loadNodesAndEdgesFromProblemStatement(initialProblem);
      } else {
        initializeProblemNode();
      }
    }
    currentTaskId.value = taskId;
  };

  /**
   * Atualiza as dimensões reais de um nó na store e dispara save debounced.
   * Use em conjunto com ResizeObserver no card.
   * @param nodeId - ID do nó a ser atualizado
   * @param dims - Objeto { width, height }
   */
  function updateNodeDimensions(
    nodeId: string,
    dims: { width: number; height: number }
  ): void {
    const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;
    const node = nodes.value[nodeIndex];
    // Só atualiza se realmente mudou
    if (
      !node.dimensions ||
      node.dimensions.width !== dims.width ||
      node.dimensions.height !== dims.height
    ) {
      const updatedNode = {
        ...node,
        dimensions: { ...dims },
        data: {
          ...node.data,
          updated_at: new Date().toISOString(),
        },
      };
      nodes.value.splice(nodeIndex, 1, validateNode(updatedNode));
      // Força reatividade para Vue
      nodes.value = [...nodes.value];
      debouncedSaveTaskFlow();
    }
  }

  return {
    updateNodeDimensions,
    currentTaskId,
    nodes,
    edges,
    viewport,
    isVueFlowInstanceReady,
    isInitialLoadComplete,
    isTransitioning,
    loadingStates,
    empathMapLastProcessedInputs,
    // Do not return the promise directly; instead, expose as a computed getter
    loadTaskFlow,
    saveTaskFlow,
    debouncedSaveTaskFlow,
    updateNodeData,
    updateElements,
    updateViewportAndSave,
    updateNodePosition,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    propagateOutput,
    updateTargetNodeInput,
    getLoadingState,
    requestAddNodeAndPrepareConnection,
    requestAddNode,
    requestNodeReprocessing,
    clearTaskFlowState,
    $reset,
    addNodeAndGetEdgePlan,
    addNodeAndConnect,
    setupRealtimeSubscription,
    cleanupRealtimeSubscription,
    getEmpathMapLastProcessedInput,
    setEmpathMapLastProcessedInput,
    clearEmpathMapAnalysis,
    affinityMapLastProcessedInputs,
    getAffinityMapLastProcessedInput,
    setAffinityMapLastProcessedInput,
    clearAffinityMapAnalysis,
    insightsLastProcessedInputs,
    getInsightsLastProcessedInput,
    setInsightsLastProcessedInput,
    clearInsightsAnalysis,
    reportLastProcessedInputs,
    getReportLastProcessedInput,
    setReportLastProcessedInput,
    clearReportAnalysis,
    applyEdgeChangesManually,
    applyNodeChangesManually,
    setVueFlowInstance,
    initializeFlow,
    toggleNodeDraggable,
    nodeToAnimateTo,
    clearNodeToAnimateTo,
    vueFlowInstancePromise: computed(() => vueFlowInstancePromise),
  };
});
