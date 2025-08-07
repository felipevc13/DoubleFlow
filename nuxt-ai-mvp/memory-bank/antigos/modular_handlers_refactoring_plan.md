# TaskFlow Store Refactoring Plan: Modular Node Handlers

**Goal:** Refactor the `stores/taskFlow.ts` Pinia store to improve modularity, maintainability, scalability, and testability by separating node-specific logic into individual handler modules. This is motivated by the increasing complexity of the central store and the requirement for distinct data processing logic for specialized node types.

**Plan:**

1.  **Define Core Interface:** ✅ **DONE**

    - Create a TypeScript interface, `INodeHandler`, in a shared types file (`types/nodeHandler.ts`).
    - This interface will define the common methods required for each node type's logic, such as:
      - `initializeData(initialConfig?: any): NodeData`
      - `processInput(currentNodeData: NodeData, parentOutputs: Record<string, any>): NodeData | Promise<NodeData>` (Processes aggregated input from connected parent nodes - **Updated to allow async**)
      - `generateOutput(currentNodeData: NodeData): Record<string, any> | Promise<Record<string, any>>` (**Updated to allow async**)
      - `getDisplayData?(currentNodeData: NodeData): any` (Optional: Formats data specifically for the card UI)
      - `handleAction?(action: string, payload: any, currentNodeData: NodeData): Promise<NodeData | void>` (Optional: For node-specific actions like API calls)

2.  **Create Handler Directory:** ✅ **DONE**

    - Create a new directory: `lib/nodeHandlers/`.

3.  **Implement Node Handlers:** ✅ **DONE (for problem, dataSource, survey, empathMap)**

    - For each existing node type (`problem`, `dataSource`, `survey`, `empathMap`), create a corresponding file in `lib/nodeHandlers/`.
    - Each file will implement the `INodeHandler` interface.
    - Move the specific data processing, input aggregation, and output generation logic currently within `stores/taskFlow.ts` into the respective handler files.
    - **Bug Fix Focus:** Logic for `knowledge_base` output moved to `dataSourceNodeHandler.ts`.

4.  **Refactor `stores/taskFlow.ts`:** ⏳ **IN PROGRESS**

    - Remove the detailed, node-specific logic identified in step 3. **(NEXT STEP)**
    - Import all the node handlers from `lib/nodeHandlers/`. **(NEXT STEP)**
    - Create a mapping or registry (`lib/nodeHandlers/index.ts`) to easily access the correct handler based on a node's `type`. ✅ **DONE**
    - Modify core functions (`addNode`, `addEdge`, `propagateOutput`, `updateNodeData`) to act as orchestrators: **(NEXT STEP)**
      - `addNode`: Calls `handler.initializeData()` for the new node type. **(NEXT STEP)**
      - `addEdge`: Triggers `propagateOutput`. **(NEXT STEP)**
      - `propagateOutput`: Gets the source node's output via `sourceHandler.generateOutput()`, aggregates inputs for the target, and updates the target node's data via `targetHandler.processInput()`. **(NEXT STEP)**
      - `updateNodeData`: May call `handler.handleAction()` if the update involves a specific node action. **(NEXT STEP)**

5.  **Testing:** ❌ **TODO**
    - Adapt existing tests or create new ones to verify the logic within each node handler in isolation.
    - Ensure integration tests still cover the end-to-end flow of data propagation.

**Conceptual Diagram:**

```mermaid
graph TD
    subgraph TaskFlow Store (`stores/taskFlow.ts`)
        direction LR
        A[Nodes State]
        B[Edges State]
        C[Viewport State]
        D[Persistence (Supabase)]
        E[Orchestration Logic\n(Uses Handler Registry)]
        F[Handler Registry\n(Map<NodeType, INodeHandler>)]
    end

    subgraph Node Handlers (`lib/nodeHandlers/`)
        direction TB
        G[problemNodeHandler.ts\n(Implements INodeHandler)]
        H[dataSourceNodeHandler.ts\n(Implements INodeHandler)]
        I[surveyNodeHandler.ts\n(Implements INodeHandler)]
        J[...]
    end

    subgraph Shared Types (`types/`)
        K[INodeHandler Interface]
    end

    E --> F
    F --> G
    F --> H
    F --> I
    F --> J

    G --> K
    H --> K
    I --> K
    J -- Implements --> K


    style TaskFlow Store fill:#f9f,stroke:#333,stroke-width:2px
    style Node Handlers fill:#ccf,stroke:#333,stroke-width:2px
    style Shared Types fill:#cfc,stroke:#333,stroke-width:2px

```

**Benefits:** This refactoring will result in a cleaner, more organized codebase that is easier to understand, maintain, test, and extend with new specialized node types in the future.
