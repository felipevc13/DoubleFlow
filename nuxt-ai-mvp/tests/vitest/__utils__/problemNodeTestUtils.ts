import { ref, computed } from 'vue';
import type { Mock } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import { defineStore } from 'pinia';
import { expect, vi } from 'vitest';
import type { TaskFlowNode, TaskFlowEdge, Viewport, NodeData } from '~/types/taskflow';

// Local type definitions for testing
export interface XYPosition {
  x: number;
  y: number;
  z: number; // Required by Vue Flow
}

export interface TestNodeData {
  title: string;
  description: string;
  inputData: Record<string, any> | null;
  outputData: any;
  cumulativeContext: any;
  updated_at: string | null;
  [key: string]: any;
}

export type TestTaskFlowNode = Omit<TaskFlowNode, 'selected' | 'resizing' | 'events' | 'dimensions' | 'positionAbsolute' | 'isValid'> & {
  computedPosition?: XYPosition;
  handleBounds?: any;
  isParent?: boolean;
  [key: string]: any;
}

// Common test data
export const COMMON_TEST_DATA = {
  NODE_ID: 'test-node-id',
  TASK_ID: 'test-task-id',
  CORRELATION_ID: 'test-correlation-id',
  ORIGINAL_TITLE: 'Original Title',
  UPDATED_TITLE: 'Updated Title',
  NODE_DESCRIPTION: 'Test node description',
  NODE_TYPE: 'problem',
} as const;

/**
 * Creates a test node with default values
 */
export const createTestNode = (
  id: string = COMMON_TEST_DATA.NODE_ID,
  data: Partial<TestNodeData> = {}
): TestTaskFlowNode => {
  const node: TestTaskFlowNode = {
    id,
    type: COMMON_TEST_DATA.NODE_TYPE,
    position: { x: 0, y: 0 },
    computedPosition: { x: 0, y: 0, z: 0 },
    selected: false,
    resizing: false,
    events: {},
    dimensions: { width: 0, height: 0 },
    data: {
      title: data.title || COMMON_TEST_DATA.ORIGINAL_TITLE,
      description: data.description || COMMON_TEST_DATA.NODE_DESCRIPTION,
      inputData: data.inputData || null,
      outputData: data.outputData || null,
      cumulativeContext: data.cumulativeContext || null,
      updated_at: data.updated_at || null,
      processInputError: null,
      is_active: true,
      responseCount: 0,
      isLoadingEdgeConnection: false,
      surveyId: '',
      surveyStructure: null,
      analyzedData: null,
      isProcessing: false,
      initialized: true,
      wasActivated: false,
      ...data,
    },
    positionAbsolute: { x: 0, y: 0 },
    dragging: false,
    hidden: false,
    handleBounds: { source: [], target: [] },
    isParent: false,
  };
  
  return node;
};

/**
 * Common mock responses for the problem node tests
 */
export const MOCK_RESPONSES = {
  // Success response for node update
  updateSuccess: {
    correlationId: COMMON_TEST_DATA.CORRELATION_ID,
    sideEffects: [
      {
        type: 'EXECUTE_ACTION',
        payload: {
          tool_name: 'problem.update',
          parameters: {
            nodeId: COMMON_TEST_DATA.NODE_ID,
            newData: { title: COMMON_TEST_DATA.UPDATED_TITLE },
            isApprovedUpdate: true,
          },
          feedbackMessage: 'Nó atualizado com sucesso!',
        },
      },
    ],
  },
  
  // Confirmation required response
  confirmationRequired: {
    correlationId: COMMON_TEST_DATA.CORRELATION_ID,
    sideEffects: [
      {
        type: 'SHOW_CONFIRMATION',
        payload: {
          approvalStyle: 'visual',
          nodeId: COMMON_TEST_DATA.NODE_ID,
          tool_name: 'problem.update',
          parameters: {
            nodeId: COMMON_TEST_DATA.NODE_ID,
            newData: { title: COMMON_TEST_DATA.UPDATED_TITLE },
          },
          diffFields: ['title'],
          originalData: { title: COMMON_TEST_DATA.ORIGINAL_TITLE },
          proposedData: { title: COMMON_TEST_DATA.UPDATED_TITLE },
          modalTitle: 'Confirmar alterações',
          displayMessage: 'Deseja confirmar as alterações no nó de problema?',
        },
      },
    ],
  },
  
  // Error response
  error: {
    error: 'Failed to update node',
    message: 'An error occurred while updating the node',
  },
} as const;

/**
 * Common assertions for problem node tests
 */
export const assertNodeUpdated = (
  updateNodeMock: Mock,
  nodeId: string = COMMON_TEST_DATA.NODE_ID,
  expectedData: Record<string, any> = { title: COMMON_TEST_DATA.UPDATED_TITLE }
) => {
  expect(updateNodeMock).toHaveBeenCalledWith(
    nodeId,
    expect.objectContaining(expectedData)
  );
};

/**
 * Asserts that a modal was opened with the correct parameters
 */
export const assertModalOpened = (
  openModalMock: Mock,
  expectedType: string = COMMON_TEST_DATA.NODE_TYPE,
  expectedNodeId: string = COMMON_TEST_DATA.NODE_ID
) => {
  expect(openModalMock).toHaveBeenCalledWith(
    expectedType,
    expect.objectContaining({
      diffMode: true,
      originalData: expect.any(Object),
      proposedData: expect.any(Object),
      diffFields: expect.any(Array),
      actionToConfirm: expect.objectContaining({
        tool_name: 'problem.update',
        parameters: expect.any(Object),
      }),
    })
  );
};

/**
 * Define a store type for testing
 */
const useTaskFlowStore = defineStore('taskFlow', () => {
  const nodes = ref<TestTaskFlowNode[]>([]);
  const edges = ref<TaskFlowEdge[]>([]);
  const currentTaskId = ref(COMMON_TEST_DATA.TASK_ID);
  const loadingStates = ref<Record<string, { isLoading: boolean; message: string }>>({});
  const vueFlowInstance = ref(null);
  const isVueFlowInstanceReady = ref(false);
  const nodeToAnimateTo = ref<string | null>(null);
  const viewport = ref<Viewport>({ x: 0, y: 0, zoom: 1, width: 0, height: 0 });
  const isInitialLoadComplete = ref(true);
  const empathMapLastProcessedInputs = ref<Record<string, string | null>>({});
  const affinityMapLastProcessedInputs = ref<Record<string, string | null>>({});
  const insightsLastProcessedInputs = ref<Record<string, string | null>>({});
  const reportLastProcessedInputs = ref<Record<string, string | null>>({});
  const vueFlowInstancePromise = ref(Promise.resolve());

  // Getters
  const getNodeById = (id: string) => {
    return nodes.value.find(n => n.id === id) || null;
  };

  const getNodes = () => nodes.value;
  const getEdges = () => edges.value;
  const getLoadingState = (nodeId: string) => loadingStates.value[nodeId];
  const getEmpathMapLastProcessedInput = (nodeId: string) => empathMapLastProcessedInputs.value[nodeId] || null;
  const getAffinityMapLastProcessedInput = (nodeId: string) => affinityMapLastProcessedInputs.value[nodeId] || null;
  const getInsightsLastProcessedInput = (nodeId: string) => insightsLastProcessedInputs.value[nodeId] || null;
  const getReportLastProcessedInput = (nodeId: string) => reportLastProcessedInputs.value[nodeId] || null;

  // Actions
  const updateNodeData = vi.fn((nodeId: string, data: any) => {
    const nodeIndex = nodes.value.findIndex(n => n.id === nodeId);
    if (nodeIndex !== -1) {
      nodes.value[nodeIndex].data = { 
        ...nodes.value[nodeIndex].data, 
        ...data,
        updated_at: new Date().toISOString()
      };
      return Promise.resolve(nodes.value[nodeIndex]);
    }
    return Promise.resolve(null);
  });

  const setNodes = vi.fn((newNodes: TestTaskFlowNode[]) => {
    nodes.value = [...newNodes];
  });

  const setEdges = vi.fn((newEdges: TaskFlowEdge[]) => {
    edges.value = [...newEdges];
  });

  const addNode = vi.fn((node: TestTaskFlowNode) => {
    nodes.value = [...nodes.value, node];
  });

  const updateNode = vi.fn((id: string, updates: Partial<TestTaskFlowNode>) => {
    const index = nodes.value.findIndex(n => n.id === id);
    if (index !== -1) {
      nodes.value = [
        ...nodes.value.slice(0, index),
        { ...nodes.value[index], ...updates },
        ...nodes.value.slice(index + 1)
      ];
    }
  });

  const removeNode = vi.fn((id: string) => {
    const index = nodes.value.findIndex(n => n.id === id);
    if (index !== -1) {
      nodes.value = [
        ...nodes.value.slice(0, index),
        ...nodes.value.slice(index + 1)
      ];
    }
  });

  return {
    // State
    nodes,
    edges,
    currentTaskId,
    loadingStates,
    vueFlowInstance,
    isVueFlowInstanceReady,
    nodeToAnimateTo,
    viewport,
    isInitialLoadComplete,
    empathMapLastProcessedInputs,
    affinityMapLastProcessedInputs,
    insightsLastProcessedInputs,
    reportLastProcessedInputs,
    
    // Getters
    getNodeById,
    getNodes,
    getEdges,
    getLoadingState,
    getEmpathMapLastProcessedInput,
    getAffinityMapLastProcessedInput,
    getInsightsLastProcessedInput,
    getReportLastProcessedInput,
    vueFlowInstancePromise: computed(() => vueFlowInstancePromise.value),
    
    // Actions
    updateNodeData,
    setNodes,
    setEdges,
    addNode,
    updateNode,
    removeNode,
  };
});

/**
 * Helper to create a mock task flow store for testing
 */
export const createMockTaskFlowStore = (initialNodes: TestTaskFlowNode[] = []) => {
  // Create a fresh Pinia instance for testing
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false, // Set to true if you want to stub all actions by default
  });
  
  // Create the store with the testing Pinia instance
  const store = useTaskFlowStore(pinia);
  
  // Initialize with test data if provided
  if (initialNodes.length > 0) {
    store.setNodes(initialNodes);
  }
  
  // Ensure all required properties are present
  const mockStore = {
    ...store,
    $state: {
      nodes: store.getNodes(),
      edges: store.getEdges(),
      currentTaskId: null,
      loadingStates: {},
      empathMapLastProcessedInputs: {},
      affinityMapLastProcessedInputs: {},
      insightsLastProcessedInputs: {},
      reportLastProcessedInputs: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      isInitialLoadComplete: true,
      vueFlowInstancePromise: null,
    },
    // Add any missing methods that might be called
    updateNodeDimensions: vi.fn(),
    setViewport: vi.fn(),
    setInitialLoadComplete: vi.fn(),
    setVueFlowInstancePromise: vi.fn(),
    // Ensure all getters are present
    getNodes: store.getNodes,
    getEdges: store.getEdges,
    getNodeById: store.getNodeById,
    getLoadingState: store.getLoadingState,
    getEmpathMapLastProcessedInput: store.getEmpathMapLastProcessedInput,
    getAffinityMapLastProcessedInput: store.getAffinityMapLastProcessedInput,
    getInsightsLastProcessedInput: store.getInsightsLastProcessedInput,
    getReportLastProcessedInput: store.getReportLastProcessedInput,
    // Ensure all actions are present
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
    addNode: store.addNode,
    updateNode: store.updateNode,
    removeNode: store.removeNode,
  };
  
  return mockStore as unknown as ReturnType<typeof useTaskFlowStore>;
};

/**
 * Define a modal store type for testing
 */
const useModalStore = defineStore('modal', () => {
  const activeModalType = ref<string | null>(null);
  const activeNodeId = ref<string | null>(null);
  const modalProps = ref<Record<string, any>>({});
  const isOpen = ref(false);

  // Actions
  const openModal = vi.fn((type: string, options: any = {}) => {
    activeModalType.value = type;
    modalProps.value = options;
    isOpen.value = true;
    return { 
      onConfirm: options?.onConfirm || (() => {}), 
      onCancel: options?.onCancel || (() => {}) 
    };
  });

  const closeModal = vi.fn(() => {
    activeModalType.value = null;
    modalProps.value = {};
    isOpen.value = false;
  });

  // Getters
  const getActiveModalType = () => activeModalType.value;
  const getActiveNodeId = () => activeNodeId.value;
  const isModalOpen = (type?: string) => {
    if (type) {
      return activeModalType.value === type;
    }
    return isOpen.value;
  };
  const getModalData = () => modalProps.value;

  return {
    // State
    activeModalType,
    activeNodeId,
    modalProps,
    isOpen,
    
    // Actions
    openModal,
    closeModal,
    
    // Getters
    getActiveModalType,
    getActiveNodeId,
    isModalOpen,
    getModalData,
  };
});

/**
 * Helper to create a mock modal store for testing
 */
export const createMockModalStore = () => {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
  });
  
  const store = useModalStore(pinia);
  
  // Ensure all required properties are present
  const mockStore = {
    ...store,
    $state: {
      activeModalType: null,
      activeNodeId: null,
      modalProps: {},
      isOpen: false,
    },
    // Add any missing methods that might be called
    openModal: vi.fn((type: string, data?: any, nodeId?: string) => {
      store.activeModalType = type;
      store.activeNodeId = nodeId || null;
      store.modalProps = data || {};
      store.isOpen = true;
      return {
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      };
    }),
    closeModal: vi.fn(() => {
      store.activeModalType = null;
      store.activeNodeId = null;
      store.modalProps = {};
      store.isOpen = false;
    }),
    isModalOpen: vi.fn((type?: string) => {
      if (!type) return store.isOpen;
      return store.isOpen && store.activeModalType === type;
    }),
    // Ensure all getters are present
    getActiveModalType: vi.fn(() => store.activeModalType),
    getActiveNodeId: vi.fn(() => store.activeNodeId),
    getModalData: vi.fn(() => store.modalProps),
  };
  
  return mockStore as unknown as ReturnType<typeof useModalStore>;
};
