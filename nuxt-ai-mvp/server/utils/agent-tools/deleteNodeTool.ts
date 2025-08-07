// server/utils/agent-tools/deleteNodeTool.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cleanToolSchema } from "~/server/utils/cleanToolSchema";
import { consola } from "consola";
import { deleteNodeFromFlow } from "~/server/services/taskFlowService";

const DeleteNodeSchema = z.object({
  taskId: z.string().describe("Id do task_flow que contém o nó"),
  nodeId: z.string().describe("Id do nó a ser removido do canvas"),
});

export function createDeleteNodeTool() {
  return {
    name: "deleteNode",
    description: "Remove um nó existente do canvas.",
    parameters: cleanToolSchema(zodToJsonSchema(DeleteNodeSchema)),
    async invoke(
      { taskId, nodeId }: z.infer<typeof DeleteNodeSchema>,
      config?: any
    ) {
      const event = config?.configurable?.event;
      if (!event) throw new Error("H3 event object not found in tool config.");
      consola.info("[deleteNode] removing node", nodeId);

      await deleteNodeFromFlow(event, taskId, nodeId);

      return { deleted: true, nodeId };
    },
  };
}
