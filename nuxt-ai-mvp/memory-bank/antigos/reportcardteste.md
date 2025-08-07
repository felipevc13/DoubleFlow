# Test Plan: ReportCard & reportCardNodeHandler

**Objective**: Ensure comprehensive testing for the UI component (`ReportCard.vue`), its business logic (`reportCardNodeHandler.ts`), the full report page (`pages/reports/[reportId].vue`), the backend API endpoint (`/api/ai/generateReport.post.ts`), and related store interactions for data integrity.

**I. Test Setup (`tests/nodes/reportCard.spec.ts`)**

1.  **File Creation**:
    - Create a new test file: `tests/nodes/reportCard.spec.ts`.
2.  **Standard Imports**:
    - Vue Test Utils: `mount`, `shallowMount`, `VueWrapper`.
    - Pinia: `setActivePinia`, `createPinia`.
    - Vitest: `vi`, `describe`, `it`, `expect`, `beforeEach`, `beforeAll`, `afterAll`, `afterEach`.
    - Nuxt Test Utils: `setup`, `useTestContext`.
    - Stores: `useTaskFlowStore`, `useSidebarStore`.
    - Components: `ReportCard.vue`, `MarkdownRenderer.vue` (or mock).
    - Page: `pages/reports/[reportId].vue`.
    - Handler: `reportCardNodeHandler` from `~/lib/nodeHandlers/reportCardNodeHandler.ts`.
    - Mocks: `mockFetch` from `tests/mocks/imports.ts`, Supabase client mock from `tests/setup.ts`.
3.  **Core Mocks**:
    - **`@vue-flow/core`**: Mock `useVueFlow` (to provide `findNode`, `nodes` getter, etc.), `Handle` component.
    - **`@vue-flow/node-toolbar`**: Mock `NodeToolbar` component.
    - **`#imports` / `$fetch`**: Ensure `$fetch` is globally mocked to control API responses for AI calls and report data fetching.
    - **`#imports` / `navigateTo`**: Mock `navigateTo` for testing navigation from the card to the full report page.
    - **Supabase Client**: Ensure `useSupabaseClient` is mocked (typically in `tests/setup.ts`) to control database interactions (saving/fetching/deleting reports).
    - **Stores**:
      - `useTaskFlowStore`: Spy on methods like `requestNodeReprocessing`, `removeNode`, `updateNodeData`, `getReportLastProcessedInput`, `setReportLastProcessedInput`, `clearReportAnalysis`. Crucially, `removeNode` will be tested for its side effect on the `reports` table.
      - `useSidebarStore`: Spy on `openSidebar`.
4.  **Helper Functions**:
    - `createReportNode(id: string, data: Partial<NodeData> = {}): TaskFlowNode`: Utility to generate `TaskFlowNode` objects specifically for ReportCard nodes with default and overridable data.
    - `mountReportCard(nodeId: string, props = {}): Promise<VueWrapper<any>>`: Utility to mount the `ReportCard.vue` component with necessary props, global stubs, and Pinia store setup.
    - `mountReportPage(reportId: string, props = {}): Promise<VueWrapper<any>>`: Utility to mount the `pages/reports/[reportId].vue` component.
5.  **Test Lifecycle Hooks**:
    - Standard `beforeAll`, `afterAll`, `beforeEach`, `afterEach` structure (similar to `empathCard.spec.ts` or `problemCard.spec.ts`).

**II. `reportCardNodeHandler.ts` Tests**

- **`describe('ReportCardNodeHandler', () => { ... });`**
  1.  **`initializeData(initialConfig?: any)`**:
      - `it('should return correct initial node data with defaults')`: Verify `label`, `title`, `description`, `analyzedData: null`, `processInputError: null`, etc.
      - `it('should return correct initial node data with provided config overrides')`.
  2.  **`processInput(currentNodeData: NodeData, parentOutputs: Record<string, any>)`**:
      - **Data Aggregation:**
        - `it('should correctly aggregate and format data from various parent outputs (Problem, DataSource, Survey, EmpathMap, AffinityMap, Insights) for the AI prompt')`:
          - Provide mock `parentOutputs` from different node types.
          - Verify the `aggregatedInputData` sent to the AI includes `sourceNodeId` and `sourceNodeType` (or a similar structured key) for each input.
        - `it('should return with null analyzedData if no processable input is provided')`:
          - Provide empty `parentOutputs` or outputs without relevant data for report generation.
          - Assert `$fetch` for AI is NOT called.
          - Assert `analyzedData` is `null` and `processInputError` is `null`.
      - **Interaction with AI API (`/api/ai/generateReport`) & Supabase**:
        - `it('should call AI API with aggregated data, save report to Supabase "reports" table, and update node data on success')`:
          - Mock `$fetch` for `/api/ai/generateReport` to return a successful AI response (e.g., `{ report: { title: "AI Title", summary: "AI Summary", markdownContent: "..." } }`).
          - Mock the Supabase client's `from('reports').insert().select().single()` to simulate a successful save and return a mock `report_id` and other report fields.
          - Spy on `taskFlowStore.currentTaskId` and `useSupabaseUser()` to ensure correct `task_id` and `user_id` are used for the Supabase insert.
          - Verify the returned `Partial<NodeData>` has `analyzedData: { report_id, title, summary }`, `processInputError: null`, and the correct `outputData`.
        - `it('should handle AI API call failure and set processInputError')`:
          - Mock `$fetch` to throw an error or return an error status.
          - Assert `processInputError` is set with an appropriate message.
          - Assert `analyzedData` remains unchanged (or null if it was initial).
          - Assert Supabase save is NOT called.
        - `it('should handle Supabase save failure after a successful AI call and set processInputError')`:
          - Mock `$fetch` for AI success.
          - Mock Supabase client `insert` to return an error.
          - Assert `processInputError` is set with a message reflecting the Supabase error.
        - `it('should handle invalid JSON structure or missing fields from AI API and set processInputError')`:
          - Mock `$fetch` to return malformed JSON or a JSON object missing the `report` key or its nested `title`, `summary`, `markdownContent`.
          - Assert `processInputError` is set.
      - **Task/User Context:**
        - `it('should use currentTaskId (from taskFlowStore) and userId (from useSupabaseUser) when preparing data for Supabase insert')`.
  3.  **`generateOutput(currentNode: TaskFlowNode)`**:
      - `it('should return report_id, report_title, and report_summary in outputData if analyzedData is present and valid')`:
        - Create a `TaskFlowNode` with sample `analyzedData: { report_id: "uuid-123", title: "Report Title", summary: "Report Summary" }`.
        - Call `generateOutput` and assert the result is `{ report_id: "uuid-123", report_title: "Report Title", report_summary: "Report Summary" }`.
      - `it('should return an empty object if analyzedData is not present or malformed (e.g., missing report_id)')`.
  4.  **`getDisplayData(currentNode: TaskFlowNode)`**:
      - `it('should return title, summary, report_id, processInputError, and inputData for card display')`:
        - Create a `TaskFlowNode` with sample data for these fields.
        - Call `getDisplayData` and verify the returned object contains these fields correctly.

**III. `ReportCard.vue` Component Tests**

- **`describe('ReportCard Component', () => { ... });`**
  1.  **Initial Rendering and States**:
      - `it('should display "Conecte dados..." message if !hasPotentiallyProcessableInput and no analysis/error and not loading')`.
      - `it('should display "Gerar Relatório com IA" button if canManuallyAnalyze is true and not loading/error')`.
      - `it('should display loading spinner and "Gerando relatório..." text when isAnalyzing is true and no error')`.
      - `it('should display error message clearly if props.data.processInputError is present')`.
      - `it('should display report title, summary, and "Visualizar Relatório Completo" button when props.data.analyzedData is populated (showReportPreview is true) and not loading/error')`.
      - `it('should correctly form the "Visualizar Relatório Completo" link using report_id from analyzedData')`.
      - `it('should disable "Visualizar Relatório Completo" button if report_id is missing from analyzedData')`.
  2.  **User Interactions**:
      - `it('should call triggerInitialAnalysis (which calls requestNodeReprocessing) and set isAnalyzing to true when "Gerar Relatório com IA" is clicked')`.
      - `it('should call navigateTo with the correct report URL when "Visualizar Relatório Completo" is clicked')`: Mock `navigateTo` and verify it's called with `/reports/[report_id]`.
  3.  **NodeToolbar Interactions**:
      - `it('should show and trigger "Atualizar Relatório" action when hasPotentiallyProcessableInput is true')`:
        - Ensure refresh icon is visible.
        - Simulate click and assert `taskFlowStore.requestNodeReprocessing` is called with the node ID and `isAnalyzing` becomes true.
      - `it('should hide "Atualizar Relatório" icon when no processable input is available')`.
      - `it('should trigger "Excluir Nó" action')`:
        - Ensure delete icon is visible.
        - Simulate click and assert `taskFlowStore.removeNode` is called with the node ID.
  4.  **"+" Button (Add Node) Interaction**:
      - `it('should open AddNodeSidebar when "+" button is clicked (if no outgoing connection)')`:
        - Set `props.hasOutgoingConnection` to `false`.
        - Simulate click and assert `sidebarStore.openSidebar` is called with `SidebarType.ADD_NODE` and correct payload.
      - `it('should hide "+" button if props.hasOutgoingConnection is true')`.
  5.  **Computed Properties (Indirectly tested via UI state and interactions)**:
      - `displayError`, `analyzedReport`, `hasPotentiallyProcessableInput`, `showReportPreview`, `canManuallyAnalyze`.
  6.  **Watchers**:
      - `it('should set isAnalyzing to false when props.data.analyzedData or props.data.processInputError changes (after analysis completes or fails)')`.
      - `it('should call clearReportAnalysis via taskFlowStore if props.data.inputData becomes effectively empty after having data')`.

**IV. `pages/reports/[reportId].vue` Page Tests**

- **`describe('Full Report Page (/reports/[reportId].vue)', () => { ... });`**
  1.  **Data Fetching and Rendering**:
      - `it('should display a loading message initially while fetching report data')`.
      - `it('should fetch report data from Supabase "reports" table using reportId from route params on mount')`:
        - Mock `useRoute` to provide `params.reportId`.
        - Mock Supabase client `from('reports').select().eq().single()` to return mock report data (title, markdown_content, task_id).
      - `it('should render the report title correctly')`.
      - `it('should render the markdown_content using the MarkdownRenderer component')`:
        - Verify that the `MarkdownRenderer` component is present and receives the correct `markdown_content` as a prop.
      - `it('should display an error message if report fetching fails or the report is not found')`:
        - Mock Supabase client to return an error or no data for the given `reportId`.

**V. Backend API Endpoint (`/api/ai/generateReport.post.ts`) Tests (Conceptual)**

These tests describe expected behavior of the API endpoint, typically verified through integration testing or by testing the handler that calls it.

- `it('should return a 400 Bad Request if the prompt is missing in the request body')`.
- `it('should return a 500 Internal Server Error if the GEMINI_API_KEY is not configured')`.
- `it('should call the Gemini API with the provided prompt and specific instructions to return JSON')`.
- `it('should correctly parse the Gemini API response and return the report object with keys: title, summary, markdownContent, recommendations (optional array), nextSteps (optional array)')`.
- `it('should handle errors from the Gemini API call and return an appropriate 5xx error to the client')`.
- `it('should handle malformed or unexpected JSON responses from Gemini and return an appropriate 5xx error to the client')`.

**VI. `taskFlowStore.ts` Interaction Tests (related to ReportCard cleanup)**

This section describes tests that, while residing in `tests/taskFlow.spec.ts`, are crucial for the ReportCard's lifecycle.

1.  **`removeNode` action for `ReportCard`**:
    - `it('should delete the corresponding report from Supabase "reports" table when a ReportCard node with a generated report_id is removed')`:
      - **Setup**:
        - Add a `ReportCard` node to `taskFlowStore.nodes`.
        - Ensure this node has `node.data.analyzedData.report_id` set to a valid mock UUID.
        - Spy on the Supabase client's `from('reports').delete().eq('id', report_id)` method.
      - **Action**:
        - Call `taskFlowStore.removeNode(reportCardNodeId)`.
      - **Assertions**:
        - Verify that `supabase.from('reports').delete().eq('id', report_id)` was called with the correct `report_id`.
        - Verify that the `ReportCard` node was removed from `taskFlowStore.nodes`.
    - `it('should NOT attempt to delete from Supabase "reports" table if the ReportCard node has no report_id (e.g., analysis never run or failed)')`:
      - **Setup**:
        - Add a `ReportCard` node to `taskFlowStore.nodes` where `node.data.analyzedData` is `null` or does not contain a `report_id`.
        - Spy on the Supabase client's `from('reports').delete()` method.
      - **Action**:
        - Call `taskFlowStore.removeNode(reportCardNodeId)`.
      - **Assertions**:
        - Verify that `supabase.from('reports').delete()` was **NOT** called.
        - Verify that the `ReportCard` node was removed from `taskFlowStore.nodes`.

---

This test plan provides a comprehensive set of scenarios to ensure the ReportCard feature, including its database interactions, functions as expected.
