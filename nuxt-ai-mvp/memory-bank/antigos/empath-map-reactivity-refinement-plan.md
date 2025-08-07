# Plan to Refine EmpathMapCard Reactivity

## 1. Goal

Ensure the `EmpathMapCard` re-analyzes its content **if and only if** a **directly connected parent node** provides new or updated relevant data. This will prevent the card from reacting to changes in unconnected nodes.

## 2. Current Behavior Analysis

- **Data Source:** The `EmpathMapCard` uses `props.data.inputData` (populated by the `taskFlowStore`) to get information from its connected parent nodes. Analysis results are displayed from `props.data.analyzedData`.
- **Analysis Trigger:** A `watch` function in `EmpathMapCard.vue` (lines 421-476) monitors `props.data.inputData`.
  - When `props.data.inputData` changes, this watcher extracts all survey submissions and "pesquisa com usuário" (user research) files from _all_ entries in `inputData`.
  - If this combined relevant data changes, it calls `taskFlowStore.requestNodeReprocessing(props.id)`, which triggers the re-analysis.
- **The Core Issue:** The current watcher does not verify if the node that caused the change in `inputData` is a direct, connected parent. It reacts if the overall "relevant data" extracted from _any_ part of its `inputData` changes.

## 3. Proposed Solution

Modify the `watch`er in `components/cards/EmpathMapCard.vue` (lines 421-476) as follows:

1.  The watcher will continue to observe `props.data.inputData`.
2.  When a change is detected:
    - Identify which specific `sourceNodeId`(s) within `newInputData` actually had their data changed compared to `oldInputData`. (The `inputData` prop is an object where keys are the IDs of source/parent nodes).
    - For each `sourceNodeId` whose data has changed:
      - Verify if this `sourceNodeId` is a direct parent of the current `EmpathMapCard`. This check involves:
        - Getting the `EmpathMapCard`'s own ID (`props.id`).
        - Accessing `taskFlowStore.edges.value`.
        - Looking for an edge where `edge.source === sourceNodeId` AND `edge.target === props.id`.
    - If a changed `sourceNodeId` **is confirmed to be a direct parent**:
      - Proceed to extract relevant data (survey results with submissions, or "pesquisa_usuario" files with content) _specifically from this parent's entry_ in `newInputData`.
    - The `extractRelevantInput` function (lines 425-465) will need to be adjusted or used in a way that it processes data _only from confirmed, direct, and changed parent nodes_.
    - If the new, relevant data from these direct, changed parents is different from the previous relevant data from those same parents, then call `taskFlowStore.requestNodeReprocessing(props.id)`.
3.  The `taskFlowStore.requestNodeReprocessing` function (which likely calls the `empathMapNodeHandler.ts`) will remain largely the same.

### Mermaid Diagram of Proposed Logic Change in `EmpathMapCard.vue` watcher:

```mermaid
graph TD
    A[props.data.inputData changes] --> B{Iterate changed sourceNodeId(s) in inputData};
    B -- For each changed sourceNodeId --> C{Is sourceNodeId a direct parent?};
    C -- Yes --> D{Extract relevant data from this parent};
    C -- No --> E[Ignore this change];
    D --> F{Aggregate relevant data from ALL changed direct parents};
    F --> G{Has aggregated relevant data changed vs. previous state?};
    G -- Yes --> H[Call taskFlowStore.requestNodeReprocessing(props.id)];
    G -- No --> I[Do nothing];
```

## 4. Testing Strategy

After implementation, test the following scenarios:

1.  **Connected Survey Edit (Triggers Analysis):**
    - Flow: Problem Card → Survey Card A (with results) → EmpathMap Card A.
    - Action: Edit Survey Card A (e.g., add more results).
    - **Expected:** EmpathMap Card A re-analyzes.
2.  **Unconnected Survey Edit (Does NOT Trigger Analysis - Bug Fix):**
    - Flow 1: Problem Card → Survey Card A → EmpathMap Card A.
    - Flow 2: Problem Card B → Survey Card B.
    - Action: Edit Survey Card B (add results).
    - **Expected:** EmpathMap Card A does NOT re-analyze.
3.  **Connected Survey Edit (No Relevant Data Change - No Trigger):**
    - Flow: Problem Card → Survey Card A (no results) → EmpathMap Card A.
    - Action: Edit Survey Card A (e.g., change question text, but still no results).
    - **Expected:** EmpathMap Card A does NOT re-analyze.
4.  **Connected DataSource Edit (Triggers Analysis):**
    - Flow: Problem Card → DataSource Card A (with "pesquisa com usuário" files) → EmpathMap Card A.
    - Action: Edit/update DataSource Card A's relevant files.
    - **Expected:** EmpathMap Card A re-analyzes.
5.  **Card Position Change (No Trigger):**
    - Flow: Any valid flow resulting in an analyzed EmpathMap Card.
    - Action: Move any card in the flow on the canvas.
    - **Expected:** EmpathMap Card does NOT re-analyze due to position change alone.

## 5. Future Work (Post-Implementation)

- Write automated tests (e.g., Vitest component tests or e2e tests) to cover the scenarios in the testing strategy, ensuring this behavior doesn't regress.
- Consider the user's earlier point about a broader test plan for reactivity between cards and how card position changes might affect other card logics.
