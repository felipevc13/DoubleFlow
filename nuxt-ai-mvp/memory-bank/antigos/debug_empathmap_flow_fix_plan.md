# Revised Plan: EmpathMapCard Data Flow, Analysis Handling, and Testing

**I. Goal:**
Ensure `EmpathMapCard.vue` correctly displays AI-analyzed empathy map data. The analysis logic will reside in `lib/nodeHandlers/empathMapNodeHandler.ts`, and the card will react to props (including `analyzedData` and a new `analysisStatus`) updated via the `stores/taskFlow.ts`. This plan incorporates and builds upon the original fix for `propagateOutput` and includes considerations for updating related tests.

**II. Key Changes & Rationale:**

1.  **`lib/nodeHandlers/empathMapNodeHandler.ts` Modifications:**

    - **Introduce `analysisStatus`**: This handler will set a status: 'idle', 'processing', 'completed', or 'error'.
    - It will manage this status explicitly alongside `analyzedData` and `processInputError`.

2.  **`stores/taskFlow.ts` (`propagateOutput` function) Modifications:**

    - **Integrate `analysisStatus` and `processInputError`**: Merge these fields from the handler's result into the target node's data.
    - **Apply Original Plan's Fix**: Ensure `inputData` is correctly sourced from `parentOutputs`, and handler-specific results (`analyzedData`, `analysisStatus`, `processInputError`) are merged into their respective top-level fields in `targetNode.data`.

3.  **`components/cards/EmpathMapCard.vue` Modifications:**
    - **Remove Direct AI Call**: The card will no longer call the AI API.
    - **Rely on Props**: It will receive `analyzedData`, `analysisStatus`, and `processInputError` via `props.data`.
    - **Reactive Loading State**: The card's `isAnalyzing` state will be driven by `props.data.analysisStatus`.
    - **Conditional Rendering**: Based on `props.data.analysisStatus`, `props.data.analyzedData`, and `props.data.processInputError`.
    - **Force Refresh**: The "Atualizar Análise" button will trigger reprocessing via `taskFlowStore`.

**III. Detailed Plan Steps:**

1.  **Modify `NodeData` Type (in `stores/taskFlow.ts` or `types/nodeHandler.ts`):**

    - Add/ensure these fields in the `NodeData` interface:
      ```typescript
      export interface NodeData {
        // ... existing fields
        analysisStatus?: "idle" | "processing" | "completed" | "error";
        analyzedData?: Record<string, any> | null; // Allow null for initial/reset state
        processInputError?: string | Record<string, any> | null;
        // ... other potential fields
      }
      ```

2.  **Update `lib/nodeHandlers/empathMapNodeHandler.ts`:**

    - In `initializeData`, return `NodeData` with `analysisStatus: 'idle'`, `analyzedData: null`, `processInputError: null`.
    - In `processInput(currentNodeData: NodeData, parentOutputs: Record<string, any>): Promise<Partial<NodeData>>`:
      - If no valid `parentOutputs`, return `Partial<NodeData>` with `analyzedData: null`, `analysisStatus: 'idle'`, `processInputError: 'No valid input data for analysis'`.
      - Before `$fetch`, return `Partial<NodeData>` including `analysisStatus: 'processing'`, `analyzedData: currentNodeData.analyzedData` (to keep old data while processing), `processInputError: null`.
      - On successful API response (`analysisResult`): Return `Partial<NodeData>` with `analyzedData: analysisResult`, `analysisStatus: 'completed'`, `processInputError: null`.
      - In `catch` for API errors: Return `Partial<NodeData>` with `analyzedData: currentNodeData.analyzedData` (or `null`), `analysisStatus: 'error'`, `processInputError: err?.data?.message || err?.message || 'API Error'`.
      - The object returned should be a `Partial<NodeData>` containing only the fields the handler is responsible for updating (e.g., `analyzedData`, `analysisStatus`, `processInputError`, `outputData`, `updated_at`).

3.  **Update `stores/taskFlow.ts` (within `propagateOutput` function):**

    - Let `handlerResult` be the `Partial<NodeData>` returned by `targetHandler.processInput()`.
    - **Assign `inputData` correctly:**
      ```typescript
      reactiveTargetNode.data.inputData = parentOutputs;
      ```
    - **Merge handler results into top-level fields:**
      ```typescript
      if (handlerResult && typeof handlerResult === "object") {
        // Explicitly merge known fields from the handler
        if (handlerResult.analyzedData !== undefined) {
          reactiveTargetNode.data.analyzedData = handlerResult.analyzedData;
        }
        if (handlerResult.analysisStatus !== undefined) {
          reactiveTargetNode.data.analysisStatus = handlerResult.analysisStatus;
        }
        if (handlerResult.processInputError !== undefined) {
          reactiveTargetNode.data.processInputError =
            handlerResult.processInputError;
        }
        if (handlerResult.outputData !== undefined) {
          // Handler also generates outputData
          reactiveTargetNode.data.outputData = handlerResult.outputData;
        }
        if (handlerResult.updated_at !== undefined) {
          // Handler might set updated_at
          reactiveTargetNode.data.updated_at = handlerResult.updated_at;
        }
        // Avoid spreading entire handlerResult if it might contain fields that shouldn't overwrite, like 'id' or 'type'
      }
      ```

4.  **Refactor `components/cards/EmpathMapCard.vue`:**

    - **Props**: Expect `props.data` to contain `analyzedData`, `analysisStatus`, `processInputError`.
    - **Remove `analyzeTextData` function** and its complex `watch`er.
    - **Computed `isAnalyzing`**: `computed(() => props.data?.analysisStatus === 'processing');`
    - **Computed `displayError`**: `computed(() => props.data?.processInputError || (props.data?.analyzedData as any)?.error);`
    - **Conditional Rendering Logic**:
      ```html
      <div v-if="isAnalyzing"><!-- Loading indicator --></div>
      <div
        v-else-if="props.data?.analysisStatus === 'completed' && props.data?.analyzedData && Object.keys(props.data.analyzedData).length > 0 && !(props.data.analyzedData as any)?.error"
      >
        <!-- Quadrants -->
      </div>
      <div v-else-if="displayError">
        <!-- Error Message: {{ displayError }} -->
      </div>
      <div v-else>
        <!-- "Connect data source" or "No data analyzed" message -->
      </div>
      ```
    - **`forceRefreshAnalysis` Method**: Calls `taskFlowStore.requestNodeReprocessing(props.id)`.

5.  **Add/Ensure `requestNodeReprocessing` action in `stores/taskFlow.ts`:**
    - Takes `nodeId: string`.
    - Calls `processNodeInputs(nodeId)` (which handles calling the handler and then `propagateOutput`).
      ```typescript
      async function requestNodeReprocessing(nodeId: string) {
        const node = nodes.value.find((n) => n.id === nodeId);
        if (node) {
          // Set status to processing immediately for faster UI feedback if desired,
          // though the handler will also do this.
          // updateNodeData(nodeId, { analysisStatus: 'processing' }); // Optional immediate UI update
          await processNodeInputs(nodeId);
        }
      }
      ```

**IV. Test Considerations (`tests/taskFlow.spec.ts`):**

1.  **Review `propagateOutput` Tests**:

    - The test `it("should correctly merge cumulative context based on version", ...)` is the most critical.
    - **Ensure Mock Handler Returns New Fields**: When mocking `nodeHandlers` for these tests, ensure the mock `processInput` for relevant node types returns `analyzedData`, `analysisStatus`, and `processInputError` as part of its `Partial<NodeData>` result.
    - **Verify Assertions**:
      - Existing assertions for `inputData` (derived from parent `outputData`) and `cumulativeContext` should still pass.
      - Add new assertions to check that `analyzedData`, `analysisStatus`, and `processInputError` are correctly populated on the target node's data after `propagateOutput` runs, based on the mock handler's output.
    - Example (conceptual addition to the test):

      ```typescript
      // In test setup for propagateOutput
      const mockEmpathMapHandler = {
        // ... other handler methods
        processInput: vi.fn().mockResolvedValue({
          analyzedData: { says: ["test"] },
          analysisStatus: "completed",
          processInputError: null,
          outputData: { empathy_map: { says: ["test"] } }, // Handler also defines its output
        }),
      };
      // Mock getNodeHandler to return this for 'empathMap' type

      // After store.propagateOutput('sourceNodeId');
      const targetNode = store.nodes.find((n) => n.id === "targetNodeId");
      expect(targetNode.data.analyzedData).toEqual({ says: ["test"] });
      expect(targetNode.data.analysisStatus).toBe("completed");
      expect(targetNode.data.processInputError).toBeNull();
      expect(targetNode.data.inputData.sourceNodeId).toEqual(sourceNodeOutput); // Existing check
      ```

2.  **No Changes Expected For**:

    - Context compression tests.
    - `removeEdge` cleanup tests (unless the structure of `NodeData` fundamentally changes how these are asserted, which is not the case here).

3.  **General**:
    - Ensure all mocks (Supabase, other stores, node handlers) are robust and reflect the new data structures and return types where necessary.

**V. Mermaid Diagram (Updated Flow):**

```mermaid
graph TD
    subgraph Data Source Nodes
        DSN1[Data Source Node 1] -- Output1 --> P_OutputCollect
        DSN2[Survey Node 1] -- Output2 --> P_OutputCollect
    end

    subgraph TaskFlow Store Logic
        P_OutputCollect(Collect Parent Outputs for EmpathMapNode)
        P_OutputCollect -- Aggregated parentOutputs --> SetInputData["EmpathMapNode.data.inputData = parentOutputs"]
        SetInputData --> EmpathMapNodeDataStore[(EmpathMapNode in Store with .inputData)]

        EmpathMapNodeDataStore -- Current NodeData & parentOutputs --> Call_EM_Handler{empathMapNodeHandler.processInput()}

        subgraph EmpathMapNodeHandler
            direction LR
            Call_EM_Handler -- Sets status: 'processing' --> AICall[/api/ai/empathMapAnalysis/]
            AICall -- Success: {analyzedData, status: 'completed', ...} --> EM_HandlerResult
            AICall -- Failure: {error, status: 'error', ...} --> EM_HandlerResult
            Call_EM_Handler -- No valid input --> EM_HandlerResult_Idle["{status: 'idle', ...}"]
        end

        EM_HandlerResult --> Update_EM_Node_Data{propagateOutput merges handlerResult into EmpathMapNode.data}
        EM_HandlerResult_Idle --> Update_EM_Node_Data
        Update_EM_Node_Data -- Patched NodeData (with .analyzedData, .analysisStatus, .inputData) --> EmpathMapNodeDataStoreUpdated[(EmpathMapNode in Store - Updated)]
    end

    subgraph EmpathMapCard.vue
        EmpathMapNodeDataStoreUpdated -- props.data (contains .analyzedData, .analysisStatus, .inputData) --> EMC[EmpathMapCard]
        EMC -- Reads props.data.analysisStatus === 'processing' --> ShowLoading{Show 'Analisando...'}
        EMC -- Reads props.data.analysisStatus === 'completed' & .analyzedData --> ShowQuadrants[Display Quadrants]
        EMC -- Reads props.data.analysisStatus === 'error' --> ShowError[Display Error Message]
        EMC -- Reads props.data.analysisStatus === 'idle' OR no processable input --> ShowConnectMsg[Display 'Connect Data Source']

        RefreshButton(Atualizar Análise Button) -- Click --> RequestReprocessAction{taskFlowStore.requestNodeReprocessing(nodeId)}
        RequestReprocessAction --> Call_EM_Handler
    end
```
