type NodeRecord = {
  id: string;
  type: string;
  data: any;
  computedPosition?: any;
};

const db: Record<string, { nodes: NodeRecord[] }> = {}; // taskId -> flow

export async function getNodeById(taskId: string, nodeId: string) {
  const flow = db[taskId];
  return flow?.nodes.find((n) => n.id === nodeId) ?? null;
}

export async function updateNodeDataInFlow(
  taskId: string,
  nodeId: string,
  data: any
) {
  const flow = (db[taskId] ??= { nodes: [] });
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error("NodeNotFound");
  node.data = data;
  return node;
}

export async function createNodeInFlow(
  taskId: string,
  nodeType: string,
  data: any,
  parentId: string | null
) {
  const flow = (db[taskId] ??= { nodes: [] });
  const id = `${nodeType}-${Math.random().toString(36).slice(2, 8)}`;
  const node: NodeRecord = { id, type: nodeType, data };
  // se quiser, defina computedPosition / relação com parentId aqui
  flow.nodes.push(node);
  return node;
}

export async function deleteNodeFromFlow(taskId: string, nodeId: string) {
  const flow = db[taskId];
  if (!flow) return;
  const idx = flow.nodes.findIndex((n) => n.id === nodeId);
  if (idx >= 0) flow.nodes.splice(idx, 1);
}
