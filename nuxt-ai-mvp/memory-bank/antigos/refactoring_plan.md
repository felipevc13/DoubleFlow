# Refactoring Plan: Cumulative Payload with Versioning & Compression

**Objective:** Refactor `stores/taskFlow.js` (assuming path relative to project root) to enable any node to receive the complete context (outputs of all ancestors) without breaking the current contract of `inputData`/`outputData`. This plan uses a cumulative payload technique with versioning and optional compression.

**Context:**

- **Stack:** Vue 3 + Pinia + VueFlow.
- **Existing Store:** Contains `nodes`, `edges`, `propagateOutput`, `updateTargetNodeInput`, `addEdge`, `removeEdge`.
- **Persistence:** Supabase (Note: potential row size limits, e.g., ~16MB, though actual limits might vary).

**Functional Requirements:**

1.  **New Data Field:**

    - Add `data.cumulativeContext` to each node.
    - Structure: `node.data.cumulativeContext: { compressed: boolean, blob: string | { [ancestorId: string]: { output: any, version: number } } }`
      - If `compressed: true`, `blob` is a base64 string of the gzipped JSON.
      - If `compressed: false`, `blob` is the actual context object: `{ [ancestorId]: { output: <outputData>, version: <timestamp> } }`.
    - Modify `validateNode` to initialize `data.cumulativeContext = { compressed: false, blob: {} }`.

2.  **Modify `propagateOutput(nodeId)`:**

    - Calculate `localOutput` for the source node.
    - Add a version timestamp: `const version = Date.now();`
    - Retrieve and decompress the source node's current context: `const sourceContext = getAggregatedContext(sourceNode); // Uses helper`
    - Construct the raw `newContextObject`:
      ```javascript
      const newContextObject = {
        ...sourceContext,
        [nodeId]: { output: localOutput, version: version },
      };
      ```
    - **Compression Check:**
      - Estimate size: `const contextString = JSON.stringify(newContextObject);`
      - If `contextString.length > 200 * 1024` (200 kB threshold):
        - Compress using `pako.gzip`: `const compressedBlob = btoa(pako.gzip(contextString, { to: 'string' })); // Base64 encode`
        - Set `cumulativeContextToSave = { compressed: true, blob: compressedBlob };`
      - Else:
        - Set `cumulativeContextToSave = { compressed: false, blob: newContextObject };`
    - **Update Source Node:** Update `sourceNode.data.outputData` (with original `localOutput`, no version needed here) and `sourceNode.data.cumulativeContext` (with `cumulativeContextToSave`) reactively.
    - **Propagate to Children:** For each `childId`, call `updateTargetNodeInput(childId, nodeId, localOutput, cumulativeContextToSave);` (Pass the potentially compressed context).

3.  **Modify `updateTargetNodeInput(targetId, sourceId, directInput, incomingCumulativeContext)`:**

    - **Update `inputData`:** Reactively update `targetNode.data.inputData[sourceId] = directInput;` (maintains compatibility).
    - **Update `cumulativeContext`:**
      - Decompress the target's current context: `const currentContext = getAggregatedContext(targetNode);`
      - Decompress the incoming context: `const incomingContext = decompress(incomingCumulativeContext); // Uses helper`
      - Merge using versioning: `const mergedContextObject = mergeByVersion(currentContext, incomingContext);`
      - Re-apply compression check (as merging might change size) and save the result to `targetNode.data.cumulativeContext` reactively.
    - **`mergeByVersion(existingCtx, newCtx)` function:** Iterates through keys in `newCtx`. For each key, if it doesn't exist in `existingCtx` or if `newCtx[key].version > existingCtx[key].version`, it takes the entry from `newCtx`. Otherwise, it keeps the `existingCtx` entry. Returns the merged object.

4.  **Reactivity:**

    - When updating nodes in the store's `nodes` ref, use techniques like `structuredClone` for the node object and `nodes.value.splice(index, 1, updatedNode)` to ensure Vue 3's reactivity system tracks the changes correctly, especially for nested properties like `data`.

5.  **Cleanup Logic:**

    - Modify `removeEdge(edgeId)`:
      - Find the `sourceId` and `targetId` from the edge.
      - Find the `targetNode`.
      - Remove the entry from the target node's direct inputs: `delete targetNode.data.inputData[sourceId];`
      - **Context Cleanup:**
        - Check if any _other_ remaining parent edges connected to `targetNode` originate from the same `sourceId`.
        - If _no other parent_ provides context from `sourceId`:
          - Decompress `targetNode.data.cumulativeContext`.
          - Delete the entry: `delete decompressedContext[sourceId];`
          - Re-compress if necessary and save the updated `cumulativeContext` back to the `targetNode` reactively.

6.  **Helper Functions (`src/utils/nodeContext.js` or similar):**
    - `getAggregatedContext(node)`: Retrieves `node.data.cumulativeContext` and returns the decompressed object using the `decompress` helper. Returns `{}` if context is null/undefined.
    - `decompress(context)`: Checks `context.compressed`. If true, decodes base64 (`atob`), ungzip (`pako.ungzip`), and parses JSON. If false, returns `context.blob`. Handles potential errors.
    - `mergeByVersion(existingCtx, newCtx)`: Implements the version-based merging logic described in point 3.
    - Ensure `pako` library is installed (`npm install pako @types/pako` or `pnpm add pako @types/pako`).

**Non-Functional Requirements:**

- **API Compatibility:** Public API of Vue components using the store should remain unchanged. Components needing ancestor data should use the new `getAggregatedContext` helper.
- **Testing (Vitest):** Create/update `tests/taskFlow.spec.ts` to cover:
  1.  A graph (e.g., A->C, B->C) where C receives updates from A and B; verify `cumulativeContext` has the latest versions from both.
  2.  Propagation of a payload > 200 kB, verifying it's stored compressed and `getAggregatedContext` returns the original data correctly.
  3.  `removeEdge` correctly removes `inputData` and only removes `cumulativeContext` entry if no other parent provides it.

**Files to Modify / Create:**

- `stores/taskFlow.js` (Main implementation)
- `utils/nodeContext.js` (Or appropriate location for helpers: `decompress`, `getAggregatedContext`, `mergeByVersion`)
- `tests/taskFlow.spec.ts` (Unit/integration tests)

**Commit Instructions:**

1.  Work on a branch, e.g., `feature/cumulative-context`.
2.  Use small, semantic commits (e.g., `feat: add cumulativeContext structure`, `feat: implement versioned merging`, `fix: handle compression edge case`, `test: cover context cleanup`).
3.  Run tests (`pnpm test` or `npm test`) before creating a Pull Request.
