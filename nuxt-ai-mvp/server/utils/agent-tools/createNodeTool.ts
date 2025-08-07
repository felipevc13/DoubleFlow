import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { cleanToolSchema } from "~/server/utils/cleanToolSchema";
import { nodeDisplayMetaList } from "~/lib/nodeDisplayMeta";
import { consola } from "consola";
import { createNodeInFlow } from "~/server/services/taskFlowService";
// @ts-ignore – Nitro injects event internally
import { serverSupabaseClient } from "#supabase/server";

const CreateNodeSchema = z.object({
  taskId: z.string().describe("Id do task_flow em que o nó será criado"),
  nodeType: z
    .string()
    .describe("Tipo do nó a ser criado (ex: 'survey', 'insight')."),
  sourceNodeId: z
    .string()
    .optional()
    .describe("Id de um nó existente ao qual conectar o novo nó."),
});

export function createCreateNodeTool() {
  const ALLOWED_NODE_TYPES = nodeDisplayMetaList.map((n) => n.type);

  return {
    name: "createNode",
    description:
      "Cria um novo node (card) no canvas e, opcionalmente, conecta-o a um nó existente.",
    parameters: cleanToolSchema(zodToJsonSchema(CreateNodeSchema)),
    async invoke({
      taskId,
      nodeType,
      sourceNodeId,
      event,
    }: z.infer<typeof CreateNodeSchema> & { event: any }) {
      if (!ALLOWED_NODE_TYPES.includes(nodeType)) {
        throw new Error(
          `Tipo de nó '${nodeType}' não é suportado. Válidos: ${ALLOWED_NODE_TYPES.join(
            ", "
          )}`
        );
      }

      consola.info("[createNode] creating", nodeType, "source:", sourceNodeId);

      // @ts-ignore – Nitro injects event internally
      const supabase = await serverSupabaseClient(event);

      const newNode = await createNodeInFlow(
        event,
        taskId,
        nodeType,
        sourceNodeId
      );

      return { created: true, nodeId: newNode.id };
    },
  };
}
