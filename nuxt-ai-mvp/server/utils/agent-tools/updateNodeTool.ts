import { consola } from "consola";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cleanToolSchema } from "~/server/utils/cleanToolSchema";
import { updateNodeDataInFlow } from "~/server/services/taskFlowService";
/* ------------------------------------------------------------------
 * Local helper types – keep in sync with real ones if/when they exist
 * ------------------------------------------------------------------ */
interface ToolExecuteParams {
  /** Current LangGraph state */
  state: any;
  /** Push a side‑effect to be handled by the front‑end */
  sideEffect: (effect: { type: string; payload: any }) => void;
  event: any; // Add the event object here
}

interface ToolReturn {
  pending_confirmation?: {
    tool_name: string;
    parameters: any;
    displayMessage: string;
    diff?: Record<string, { before: unknown; after: unknown }>;
    nodeId?: string;
  };
  updated?: boolean;
  node?: any; // Consider a more specific type for 'node' if available
}

/* ------------------------------------------------------------------
 * computeJsonDiff – naive diff of JSON objects
 * ------------------------------------------------------------------ */
function computeJsonDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fields?: string[]
) {
  const keys = fields?.length
    ? fields
    : Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));

  const diff: Record<string, { before: unknown; after: unknown }> = {};

  keys.forEach((k) => {
    if (oldData[k] !== newData[k]) {
      diff[k] = { before: oldData[k], after: newData[k] };
    }
  });

  return diff;
}

const UpdateNodeSchema = z.object({
  taskId: z.string().describe("Id do task_flow que contém o nó"),
  nodeId: z.string().describe("Id do nó a ser atualizado"),
  newData: z.record(z.any()).describe("Novo objeto de dados a ser mesclado"),
  canvasContext: z
    .any()
    .describe("O estado atual do canvas enviado pelo frontend."), // NOVO
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

/**
 * LangChain-compatible tool creator.  The id in the catalog ("problem.update")
 * maps to this implementation via the name `"updateNode"`.
 */
export function createUpdateNodeTool() {
  return {
    name: "updateNode",
    description: "Atualiza os dados de um nó existente no canvas",
    parameters: cleanToolSchema(zodToJsonSchema(UpdateNodeSchema)),
    async invoke(
      {
        taskId,
        nodeId,
        newData,
        canvasContext,
        approvalStyle,
        diffFields,
        isApprovedUpdate,
      }: z.infer<typeof UpdateNodeSchema>,
      config?: any // Add config parameter here
    ): Promise<ToolReturn> {
      consola.info("[updateNode] processing", nodeId, newData, {
        approvalStyle,
        isApprovedUpdate,
      });

      consola.debug("[updateNode] received config:", config);
      consola.debug("[updateNode] config.configurable:", config?.configurable);
      consola.debug(
        "[updateNode] config.configurable.event:",
        config?.configurable?.event
      );

      const nodes = Array.isArray(canvasContext?.nodes)
        ? canvasContext.nodes
        : [];
      const currentNode = nodes.find((n: { id: string }) => n.id === nodeId);

      if (!currentNode) {
        throw new Error(
          `Node ${nodeId} not found in task flow ${taskId} provided by canvasContext`
        );
      }

      // Determine if this is a direct update or a proposal
      if (isApprovedUpdate || approvalStyle === "text" || !approvalStyle) {
        // Direct update or approved visual update
        consola.info(
          "[updateNode] Applying direct update or approved visual update for node",
          nodeId
        );
        // EXTRAI EVENTO DO CONFIG
        const event = config?.configurable?.event;
        if (!event) {
          throw new Error(
            "Objeto de evento H3 não encontrado no config da ferramenta."
          );
        }
        const node = await updateNodeDataInFlow(event, taskId, nodeId, newData);
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
              ...arguments[0],
              isApprovedUpdate: true,
            },
            displayMessage: "Confirmar alterações neste nó?",
            diff, // Pass diff for display in modal
            nodeId, // Pass nodeId for modal context
          },
        };
      }
      // Fallback for unexpected scenarios
      throw new Error(
        "Invalid updateNode tool invocation: Missing approvalStyle or isApprovedUpdate flag."
      );
    },
  };
}
