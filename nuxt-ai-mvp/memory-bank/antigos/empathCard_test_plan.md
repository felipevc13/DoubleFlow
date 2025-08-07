# Test Plan: EmpathMapCard & empathMapNodeHandler

**Objective**: Ensure comprehensive testing for both the UI component (`EmpathMapCard.vue`) and its business logic (`empathMapNodeHandler.ts`), following the existing testing patterns in the project.

**I. Test Setup (`tests/nodes/empathCard.spec.ts`)**

1.  **File Creation**:
    - Create a new test file: `tests/nodes/empathCard.spec.ts`.
2.  **Standard Imports**:
    - Vue Test Utils: `mount`, `VueWrapper`.
    - Pinia: `setActivePinia`, `createPinia`.
    - Vitest: `vi`, `describe`, `it`, `expect`, `beforeEach`, `beforeAll`, `afterAll`, `afterEach`.
    - Nuxt Test Utils: `setup`, `useTestContext` (for e2e-like setup if needed, or simplified unit setup).
    - Stores: `useTaskFlowStore`, `useSidebarStore`.
    - Component: `EmpathMapCard.vue`.
    - Handler: `empathMapNodeHandler` from `~/lib/nodeHandlers/empathMapNodeHandler.ts`.
    - Mocks: `mockFetch` from `tests/mocks/imports.ts`.
3.  **Core Mocks**:
    - **`@vue-flow/core`**:
      - Mock `useVueFlow` to provide controlled `findNode`, `nodes` getter, `addNodes`, `updateNode`, `removeNodes`.
      - Mock `Handle` component.
    - **`@vue-flow/node-toolbar`**: Mock `NodeToolbar` component.
    - **`#imports` / `$fetch`**: Ensure `$fetch` is globally mocked to control API responses for AI calls.
    - **Stores**:
      - `useTaskFlowStore`: Spy on methods like `requestNodeReprocessing`, `removeNode`, `updateNodeData`.
      - `useSidebarStore`: Spy on `openSidebar`.
4.  **Helper Functions**:
    - `createEmpathNode(id: string, data: Partial<NodeData> = {}): TaskFlowNode`: Utility to generate `TaskFlowNode` objects specifically for Empath Map nodes with default and overridable data.
    - `mountEmpathCard(nodeId: string, props = {}): Promise<VueWrapper<any>>`: Utility to mount the `EmpathMapCard.vue` component with necessary props, global stubs, and Pinia store setup.
5.  **Test Lifecycle Hooks**:
    - `beforeAll`: Initialize the Nuxt testing environment. Dynamically import the `empathMapNodeHandler` and `EmpathMapCardComponent` to ensure mocks are applied.
    - `afterAll`: Clean up and close the Nuxt testing environment.
    - `beforeEach`:
      - Set up a fresh Pinia instance (`setActivePinia(createPinia())`).
      - Initialize/reset `useTaskFlowStore` state (nodes, edges, currentTaskId).
      - Clear all Vitest mocks (`vi.clearAllMocks()`).
      - Enable fake timers (`vi.useFakeTimers()`).
    - `afterEach`:
      - Run all pending timers (`vi.runAllTimers()`).
      - Clear all timers (`vi.clearAllTimers()`).
      - Restore real timers (`vi.useRealTimers()`).
      - Restore all mocks (`vi.restoreAllMocks()`).

**II. `empathMapNodeHandler` Tests**

- **`describe('EmpathMapNodeHandler', () => { ... });`**
  1.  **`initializeData(initialConfig?: any)`**:
      - `it('should return correct initial node data with defaults')`
      - `it('should return correct initial node data with provided config overrides')`
  2.  **`processInput(currentNodeData: NodeData, parentOutputs: Record<string, any>)`**:
      - `it('should correctly aggregate text from survey parent outputs and call AI API')`:
        - Mock `parentOutputs` with sample survey data.
        - Mock `$fetch` for `/api/ai/empathMapAnalysis` to return a successful `EmpathyMapAnalysis` structure.
        - Verify the returned `Partial<NodeData>` has populated `analyzedData`, null `processInputError`, and `outputData.empathy_map`.
      - `it('should correctly aggregate text from "pesquisa_usuario" data source parent outputs and call AI API')`:
        - Similar to above, but `parentOutputs` simulate file content.
      - `it('should combine text from multiple valid parent outputs for analysis')`.
      - `it('should return an error and no analyzedData if combined text for analysis is empty')`:
        - Provide `parentOutputs` that result in no usable text.
        - Assert `$fetch` is not called, `analyzedData` is null, and `processInputError` is set.
      - `it('should handle AI API call failure (e.g., network error, 500 status)')`:
        - Mock `$fetch` to throw an error or return an error status.
        - Assert `processInputError` is set and `analyzedData` is handled appropriately (e.g., remains unchanged or becomes null).
      - `it('should handle invalid or unexpected API response structure from AI')`:
        - Mock `$fetch` to return a response that doesn't match `EmpathyMapAnalysis`.
        - Assert `processInputError` is set.
  3.  **`generateOutput(currentNode: TaskFlowNode)`**:
      - `it('should return analyzedData as empathy_map_results for child nodes')`:
        - Create a `TaskFlowNode` with sample `analyzedData`.
        - Call `generateOutput` and assert the result is `{ empathy_map_results: /* analyzedData */ }`.
      - `it('should return null for empathy_map_results if analyzedData is not present')`.
  4.  **`getDisplayData(currentNode: TaskFlowNode)`**:
      - `it('should return analyzedData, processInputError, and inputData for card display')`:
        - Create a `TaskFlowNode` with sample data for these fields.
        - Call `getDisplayData` and assert the returned object contains these fields correctly.

**III. `EmpathMapCard.vue` Component Tests**

- **`describe('EmpathMapCard Component', () => { ... });`**
  1.  **Initial Rendering States**:
      - `it('should display "Connect Data" message if analyzedData is null and no error')`.
      - `it('should display error message if props.data.processInputError is present')`.
      - `it('should display the four quadrants (Says, Thinks, Does, Feels) with data when props.data.analyzedData is populated')`.
      - `it('should display "Sem dados" within a quadrant if its specific data array (e.g., analyzedData.says) is empty')`.
  2.  **Toolbar Interactions**:
      - `it('should show and trigger "Atualizar Análise" (refresh) action when processable input is available')`:
        - Set `props.data.inputData` to make `hasPotentiallyProcessableInput` true.
        - Ensure refresh icon is visible.
        - Simulate click and assert `taskFlowStore.requestNodeReprocessing` is called with the node ID.
      - `it('should hide "Atualizar Análise" (refresh) icon when no processable input is available')`.
      - `it('should trigger "Excluir Nó" (delete) action')`:
        - Simulate click on delete icon and assert `taskFlowStore.removeNode` is called.
  3.  **"+" Button (Add Node) Interaction**:
      - `it('should open AddNodeSidebar when "+" button is clicked (if no outgoing connection)')`:
        - Set `props.hasOutgoingConnection` to `false`.
        - Simulate click and assert `sidebarStore.openSidebar` is called with `SidebarType.ADD_NODE` and correct payload.
      - `it('should hide "+" button and connecting line if props.hasOutgoingConnection is true')`.
  4.  **Props Application**:
      - `it('should apply selected styling when props.selected is true')`.
  5.  **Computed Properties (Tested via UI state and interactions)**:
      - `displayError`: Verified by tests for rendering error messages.
      - `showQuadrantsLayout`: Verified by tests for rendering quadrants vs. default/error messages.
      - `hasPotentiallyProcessableInput`: Verified by tests for refresh icon visibility based on `props.data.inputData` (survey data, `pesquisa_usuario` files).
  6.  **Watcher for `props.data.inputData` (Card's internal logic for `lastProcessedInputString`)**:
      - The card's watcher updates `lastProcessedInputString` in the node's data via `taskFlowStore.updateNodeData`. The actual AI processing is triggered by the store and handled by `empathMapNodeHandler.processInput`.
      - `it('should call taskFlowStore.updateNodeData with a new lastProcessedInputString when relevant inputData from a DIRECT parent changes (e.g., new survey results)')`:
        - Setup initial `inputData` and `lastProcessedInputString`.
        - Mount the card.
        - Simulate a change in `props.data.inputData` that reflects new, relevant data from a direct parent.
        - Assert `taskFlowStore.updateNodeData` was called with the node ID and the correctly updated `lastProcessedInputString` in the payload.
      - `it('should call taskFlowStore.updateNodeData with a new lastProcessedInputString for relevant "pesquisa_usuario" file changes from a DIRECT parent')`.
      - `it('should NOT update lastProcessedInputString if inputData changes are from non-direct parents or are irrelevant to empathy map analysis')`.
