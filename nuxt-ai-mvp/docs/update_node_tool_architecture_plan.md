# Architecture and Implementation Plan for Unified `updateNodeTool`

## 1. Problem Statement

Currently, the system uses two distinct tools for updating nodes: `updateNodeTool` for direct updates and `proposeUpdateNode` for updates requiring human approval. The `nodeTypes.json` configuration for the "problem" node specifically uses "proposeUpdateNode" with an `approvalStyle` of "text", which is counter-intuitive as "propose" implies visual approval. The goal is to unify these into a single `updateNodeTool` that intelligently handles both "text" (direct) and "visual" (proposed, then approved) approval styles.

## 2. Proposed Architecture

The core idea is to merge the functionality of `proposeUpdateNode` into `updateNodeTool` and introduce a new parameter (`isApprovedUpdate`) to control its behavior, along with the `approvalStyle` and `diffFields` parameters.

```mermaid
graph TD
    A[Agent Execution Logic] -->|1. Call updateNodeTool with approvalStyle| B{updateNodeTool}

    B -->|approvalStyle = "text" OR isApprovedUpdate = true| C[Direct Update Logic]
    C --> D[updateNodeDataInFlow()]
    D --> E[Node Updated]

    B -->|approvalStyle = "visual" AND isApprovedUpdate = false| F[Proposal Logic]
    F --> G[Compute Diff]
    F --> H[Dispatch UI Side Effects (FOCUS_NODE, OPEN_MODAL, APPLY_DIFF_IN_MODAL)]
    F --> I{Return pending_confirmation}
    I --> J[Human Approval Process]
    J -->|User Approves| A
    J -->|User Rejects| K[Abort/Handle Rejection]
```

## 3. Detailed Implementation Plan

### Phase 1: Merge and Refactor `updateNodeTool.ts`

1.  **Move `computeJsonDiff`:**

    - Copy the `computeJsonDiff` function from `server/utils/agent-tools/proposeUpdateNode.ts` to `server/utils/agent-tools/updateNodeTool.ts`.

2.  **Update `UpdateNodeSchema`:**

    - Modify the `UpdateNodeSchema` in `server/utils/agent-tools/updateNodeTool.ts` to include the new parameters:
      ```typescript
      const UpdateNodeSchema = z.object({
        taskId: z.string().describe("Id do task_flow que contém o nó"),
        nodeId: z.string().describe("Id do nó a ser atualizado"),
        newData: z
          .record(z.any())
          .describe("Novo objeto de dados a ser mesclado"),
        approvalStyle: z
          .enum(["text", "visual"])
          .optional()
          .describe(
            "Estilo de aprovação para a atualização do nó. 'text' para atualização direta, 'visual' para proposta que requer revisão."
          ),
        diffFields: z
          .array(z.string())
          .optional()
          .describe(
            "Campos que devem aparecer no diff. Se omitido, calcula diff em todo o objeto."
          ),
        isApprovedUpdate: z
          .boolean()
          .optional()
          .describe(
            "Indica se a atualização já foi aprovada visualmente. True para aplicar a atualização, false para propor."
          ),
      });
      ```

3.  **Integrate `proposeUpdateNode` Logic into `invoke`:**

    - Modify the `invoke` method in `server/utils/agent-tools/updateNodeTool.ts` to include the conditional logic:

    ```typescript
    async invoke({
      taskId,
      nodeId,
      newData,
      approvalStyle,
      diffFields,
      isApprovedUpdate,
    }: z.infer<typeof UpdateNodeSchema>) {
      consola.info("[updateNode] processing", nodeId, newData, { approvalStyle, isApprovedUpdate });

      // Create Supabase client (Nitro will inject the event internally)
      // @ts-ignore
      const supabase = await serverSupabaseClient();

      // Fetch current node for diff calculation if needed
      const { data: currentFlow, error: flowError } = await supabase
        .from("task_flows")
        .select("nodes")
        .eq("id", taskId)
        .single();

      if (flowError) {
        throw new Error(`Failed to fetch task flow ${taskId}: ${flowError.message}`);
      }

      const currentNode = currentFlow?.nodes?.find((n: { id: string }) => n.id === nodeId);

      if (!currentNode) {
        throw new Error(`Node ${nodeId} not found in task flow ${taskId}`);
      }

      // Determine if this is a direct update or a proposal
      if (isApprovedUpdate || approvalStyle === "text" || !approvalStyle) {
        // Direct update or approved visual update
        consola.info("[updateNode] Applying direct update or approved visual update for node", nodeId);
        const node = await updateNodeDataInFlow(taskId, nodeId, newData);
        return { updated: true, node };
      } else if (approvalStyle === "visual" && !isApprovedUpdate) {
        // This is a visual proposal
        consola.info("[updateNode] Proposing visual update for node", nodeId);

        // Compute the diff
        const diff = computeJsonDiff(
          currentNode.data ?? {},
          newData,
          diffFields?.length ? diffFields : undefined
        );

        // The tool should return the pending_confirmation, and the agent execution logic
        // will then handle the UI side effects and the human approval node.
        return {
          pending_confirmation: {
            tool_name: "updateNode", // The tool to call after approval
            parameters: {
              taskId,
              nodeId,
              newData,
              isApprovedUpdate: true, // Flag for the next call
            },
            displayMessage: "Confirmar alterações neste nó?",
            diff, // Pass diff for display in modal
            nodeId, // Pass nodeId for modal context
          },
        };
      }
      // Fallback for unexpected scenarios
      throw new Error("Invalid updateNode tool invocation: Missing approvalStyle or isApprovedUpdate flag.");
    }
    ```

### Phase 2: Update Agent Execution Logic (Conceptual)

- The agent execution logic (e.g., in `server/utils/agent/agentGraph.ts` or related files that handle tool invocation and `pending_confirmation` responses) will need to be updated to:
  - Pass the `approvalStyle` and `diffFields` from `nodeTypes.json` to the `updateNodeTool` when it's initially called.
  - When `updateNodeTool` returns a `pending_confirmation` (for visual approval):
    - Extract the `diff`, `nodeId`, and `displayMessage` from the `pending_confirmation` payload.
    - Dispatch the necessary UI side effects (`FOCUS_NODE`, `OPEN_MODAL`, `APPLY_DIFF_IN_MODAL`) to display the `DiffReviewModal.vue`.
    - Potentially create a `humanApprovalNode` in the flow, which would then, upon user approval, trigger the second call to `updateNodeTool` with `isApprovedUpdate: true`.

### Phase 3: Clean Up and Update Definitions

1.  **Delete `proposeUpdateNode.ts`:**

    - Remove the file `server/utils/agent-tools/proposeUpdateNode.ts`.

2.  **Update `nodeTypes.json`:**
    - Change the `tool` property for the "problem" node's "update" action:
      ```json
      "update": {
        "tool": "updateNode", // Changed from "proposeUpdateNode"
        "needsApproval": true,
        "approvalStyle": "text", // or "visual" as needed
        "executionMode": "backend",
        "refinementPrompt": "problemRefine.md"
      }
      ```
    - Ensure `diffFields` is correctly configured in `nodeTypes.json` if visual approval is used for other node types in the future. For the "problem" node, it's already defined in `ui.diffFields`.

## 4. Detailed Implementation Flow Diagram

```mermaid
graph TD
    subgraph "Agent Execution Flow"
        A[Agent Invokes Tool] -->|Initial Call: approvalStyle, newData| B{updateNodeTool}
        B -->|isApprovedUpdate=false & approvalStyle="visual"| C[Return pending_confirmation]
        C --> D[Agent Logic: Handle pending_confirmation]
        D --> E[Agent Logic: Dispatch UI Side Effects (Open Modal)]
        E --> F[User Reviews & Approves in UI]
        F --> G[Agent Logic: Re-invoke updateNodeTool]
        G -->|Second Call: isApprovedUpdate=true, newData| B
        B -->|isApprovedUpdate=true OR approvalStyle="text"| H[Apply Update]
        H --> I[updateNodeDataInFlow()]
        I --> J[Node Updated]
    end

    subgraph "Files"
        K[server/utils/agent-tools/updateNodeTool.ts]
        L[server/utils/agent-tools/proposeUpdateNode.ts]
        M[server/utils/agent/registry/nodeTypes.json]
    end

    style K fill:#f9f,stroke:#333,stroke-width:2px
    style L fill:#f9f,stroke:#333,stroke-width:2px
    style M fill:#f9f,stroke:#333,stroke-width:2px

    K -- Merge Logic From --> L
    B -- Reads/Writes --> K
    A -- Reads --> M
    G -- Reads --> M
```
