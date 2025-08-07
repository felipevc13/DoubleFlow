# Reactivity Refactoring Plan for taskFlow.ts Store

**Overall Goal:** Refactor the `taskFlow.ts` store and related data flow patterns to establish robust, predictable reactivity, ensuring that UI components (cards on the canvas) update immediately and correctly when their underlying data changes.

**Diagnosis Summary:**

The core problems likely stem from a combination of:

1.  **Complex Propagation Logic:** The `propagateOutput` function in `taskFlow.ts` has intricate steps involving context merging, multiple state updates using `splice` within loops, and potentially fragile change detection using `JSON.stringify`. This complexity makes it prone to errors and unpredictable reactive behavior.
2.  **Component Reactivity Pattern:** Components like `SurveyCard.vue` copy `props.data` into local refs (`localSurveyData = ref({ ...props.data })`). This pattern can break reactivity if the underlying prop reference doesn't change or if the watcher doesn't fire reliably.
3.  **Potential Mutation Issues:** While `splice` is used for top-level array updates, the merging logic (`...`) within `updateNodeData` and `propagateOutput` _might_ inadvertently reuse nested object references, hindering Vue's deep reactivity detection.
4.  **Data Duplication/Inconsistency:** Storing related data in multiple places (e.g., `surveyId` and `is_active` both at the top level of `node.data` and within `node.data.surveyData`) increases complexity and the risk of stale data.

**Refactoring Plan:**

**Phase 1: Refactor Component Reactivity (Highest Priority)**

- **Objective:** Ensure cards react directly to prop changes without relying on potentially stale local copies.
- **Actions:**
  - In `SurveyCard.vue`, `EmpathMapCard.vue`, and potentially other card components:
    - Remove the pattern of copying `props.data` into a local `ref` (e.g., remove `localSurveyData`).
    - Modify templates and logic to use `computed` properties derived _directly_ from `props.data`.
- **Rationale:** Aligns with Vue best practices and often resolves UI update issues if the store _is_ updating correctly but the component isn't reacting properly.

**Phase 2: Simplify and Solidify Store Updates (`updateNodeData`)**

- **Objective:** Make `updateNodeData` the single, robust entry point for modifying node data, guaranteeing immutability.
- **Actions:**
  - In `taskFlow.ts` -> `updateNodeData`:
    - **Deep Clone:** Always start by creating a deep clone of the existing `node.data` using `structuredClone()` (preferred) or `JSON.parse(JSON.stringify())`.
    - **Merge:** Merge the `newData` payload onto the _cloned_ data object.
    - **New Node Object:** Create the `finalUpdatedNode` by spreading the `oldNode` for top-level properties (`id`, `type`, `position`) and assigning the _newly created_ merged data object to the `data` property.
    - **Simplify Action Handling:** Encourage callers to provide the complete desired state in `newData` rather than relying on `_action` processing. If `_action` is kept, ensure `handleAction` returns the _full_ new `NodeData` object.
- **Rationale:** Guarantees immutability at the node and node.data level, making changes easier for Vue to detect. Simplifies the update logic.

**Phase 3: Refactor Propagation Logic (`propagateOutput`)**

- **Objective:** Reduce complexity, minimize intermediate updates, and improve clarity.
- **Actions:**
  - In `taskFlow.ts` -> `propagateOutput`:
    - **Single Update per Target:** Calculate the final state for a target node _before_ performing the `splice` update. Avoid multiple `splice` calls for the same node within one propagation cycle.
    - **Decouple `processInput`:** Consider separating the `processInput` call from `propagateOutput`. `propagateOutput` could focus on delivering updated `inputData`/`cumulativeContext`. A separate mechanism could trigger `processInput` for affected nodes.
    - **Review Context Logic:** Re-evaluate the versioned/compressed `cumulativeContext` implementation.
- **Rationale:** Reduces the chance of race conditions and makes the data flow easier to follow and debug.

**Phase 4: Ensure Data Consistency**

- **Objective:** Establish a single source of truth for data within `node.data`.
- **Actions:**
  - Identify and consolidate duplicated fields (e.g., `surveyId`, `is_active`).
  - Update all code (store, handlers, components) to use the canonical location.
- **Rationale:** Prevents inconsistencies and simplifies data management.

**Phase 5: Standardize Modal/Sidebar Saving**

- **Objective:** Ensure user edits are reliably saved back to the store.
- **Actions:**
  - Review save logic in modals/sidebars.
  - Ensure they call the refactored `taskFlowStore.updateNodeData` correctly.
  - Implement a save mechanism on modal/sidebar close, potentially debounced.
- **Rationale:** Prevents data loss and ensures the store reflects the user's latest input.

**Target Flow Diagram:**

```mermaid
graph TD
    subgraph UserInteraction[User Interaction]
        UI_Action[e.g., Save Survey Modal] --> Prepare_Payload[Prepare newData Payload];
    end

    subgraph TaskFlowStore[taskFlow.ts Store]
        Store_Action[updateNodeData(nodeId, newData)] --> Deep_Clone[Deep Clone oldNode.data];
        Deep_Clone --> Merge_Data[Merge newData into Cloned Data];
        Merge_Data --> Create_New_Node[Create finalUpdatedNode (New Refs)];
        Create_New_Node --> Splice_Update[nodes.value.splice(idx, 1, finalUpdatedNode)];
        Splice_Update --> Trigger_Processing[Trigger Node Processing (if needed)];
        Trigger_Processing --> Process_Logic[Node Processing Logic (e.g., call handler.processInput)];
        Process_Logic --> Update_Self_Again[Update Node Again via updateNodeData (if processing changes state)];
        Splice_Update --> Trigger_Propagation[Trigger propagateOutput(nodeId)];
        Trigger_Propagation --> Propagate_Logic[propagateOutput Logic (Simplified: Update children's input/context)];
         Propagate_Logic --> Update_Children[Update Children via updateNodeData];
        Splice_Update --> Debounced_Save[Debounced Save];
    end

    subgraph VueReactivity[Vue Reactivity Engine]
        Splice_Update --> Detect_Change[Detects change in store's `nodes` array];
    end

    subgraph UICards[UI Components on Canvas]
       Detect_Change --> Card_Props_Update[Card receives new props.data reference];
       Card_Props_Update --> Card_Computed_Update[Card's computed properties re-evaluate];
       Card_Computed_Update --> Card_ReRender[Card re-renders with new data];
    end
```
