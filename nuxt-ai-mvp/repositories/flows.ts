import { getSupabaseAuth } from "~/server/utils/supabase";

export type NodeRecord = {
  id: string;
  type: string;
  data: any;
  position?: { x: number; y: number };
  dimensions?: { width: number; height: number };
  computedPosition?: any;
  deletable?: boolean;
};

type EdgeRecord = {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: any;
};

export type FlowRecord = {
  task_id: string;
  nodes: NodeRecord[];
  edges: EdgeRecord[];
};

async function getAuth(event: any) {
  const { supabase, user } = await getSupabaseAuth(event);
  if (!user)
    throw new Error("Não autorizado: user ausente no contexto (event)");
  return { supabase, user };
}

export async function getFlowByTaskId(
  event: any,
  taskId: string
): Promise<FlowRecord | null> {
  const { supabase } = await getAuth(event);
  const { data, error } = await supabase
    .from("task_flows")
    .select("task_id, nodes, edges")
    .eq("task_id", taskId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Normalize Supabase JSON fields to our strong types
  const nodes: NodeRecord[] = Array.isArray(data.nodes)
    ? ((data.nodes as any[]).filter(Boolean) as NodeRecord[])
    : [];

  const edges: EdgeRecord[] = Array.isArray(data.edges)
    ? ((data.edges as any[]).filter(Boolean) as EdgeRecord[])
    : [];

  return {
    task_id: (data.task_id ?? taskId) as string,
    nodes,
    edges,
  };
}

async function upsertFlow(event: any, flow: FlowRecord): Promise<void> {
  const { supabase, user } = await getAuth(event);
  const { error } = await supabase.from("task_flows").upsert(
    {
      task_id: flow.task_id,
      user_id: user.id,
      nodes: flow.nodes ?? [],
      edges: flow.edges ?? [],
    },
    { onConflict: "task_id" }
  );

  if (error) throw error;
}

export async function getNodeById(event: any, taskId: string, nodeId: string) {
  const flow = await getFlowByTaskId(event, taskId);
  if (!flow) return null;
  return flow.nodes.find((n) => n.id === nodeId) ?? null;
}

export async function createNodeInFlow(
  event: any,
  taskId: string,
  nodeType: string,
  data: any,
  _parentId: string | null // mantido p/ compatibilidade
) {
  const flow = (await getFlowByTaskId(event, taskId)) ?? {
    task_id: taskId,
    nodes: [],
    edges: [],
  };

  const id = `${nodeType}-${Math.random().toString(36).slice(2, 8)}`;
  const node: NodeRecord = {
    id,
    type: nodeType,
    data: { ...data, updated_at: new Date().toISOString() },
    deletable: true,
  };

  const nodes = [...flow.nodes, node];
  const updated: FlowRecord = { ...flow, nodes };
  await upsertFlow(event, updated);
  return node;
}

export async function updateNodeDataInFlow(
  event: any,
  taskId: string,
  nodeId: string,
  data: any
) {
  const flow = (await getFlowByTaskId(event, taskId)) ?? {
    task_id: taskId,
    nodes: [],
    edges: [],
  };

  const idx = flow.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) throw new Error("NodeNotFound");

  flow.nodes[idx] = { ...flow.nodes[idx], data };
  await upsertFlow(event, flow);
  return flow.nodes[idx];
}

export async function deleteNodeFromFlow(
  event: any,
  taskId: string,
  nodeId: string
) {
  const flow = await getFlowByTaskId(event, taskId);
  if (!flow) return;

  const nodes = [...flow.nodes];
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return;

  const removed = nodes[idx];
  nodes.splice(idx, 1);

  const edges = (flow.edges ?? []).filter(
    (e) => e.source !== removed.id && e.target !== removed.id
  );

  const updated: FlowRecord = { ...flow, nodes, edges };
  await upsertFlow(event, updated);
}
