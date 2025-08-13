// server/api/flows/[taskId].get.ts
import { getFlowByTaskId } from "~/server/services/taskFlowService";
export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, "taskId")!;
  const flow = await getFlowByTaskId(event as any, taskId);
  return flow ?? { task_id: taskId, nodes: [], edges: [] };
});
