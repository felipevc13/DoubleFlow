import type { H3Event } from "h3";
import {
  getSupabaseAuth,
  getSupabase,
  serverSupabaseService,
} from "~/server/utils/supabase";

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
  viewport?: { x: number; y: number; zoom: number };
};

async function getAuth(event?: H3Event | null) {
  // Quando houver request HTTP, respeita a sessão (RLS)
  if (event) {
    const { supabase, user } = await getSupabaseAuth(event);
    // Em rotas protegidas você pode exigir user; aqui deixamos opcional para reuso.
    return { supabase, user: user ?? null };
  }
  // Fora de request (e.g., tools/graph/jobs), usa Service Role
  const supabase = serverSupabaseService();
  return { supabase, user: null as any };
}

export async function getFlowByTaskId(
  event: H3Event | null | undefined,
  taskId: string
): Promise<FlowRecord | null> {
  const { supabase } = await getAuth(event);
  const { data, error } = await supabase
    .from("task_flows")
    .select("task_id, nodes, edges, viewport")
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
    viewport: (data as any).viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

function ensureProblemPresent(arr?: NodeRecord[]): NodeRecord[] {
  const nodes = Array.isArray(arr) ? [...arr] : [];
  const hasProblem = nodes.some((n) => n?.type === "problem");
  if (!hasProblem) {
    // fallback mínimo — garante existência do problema mesmo sem canvasContext
    nodes.unshift({
      id: "problem-1",
      type: "problem",
      data: {
        title: "Problema",
        description: "",
        updated_at: new Date().toISOString(),
      },
      deletable: false,
    });
  } else {
    // normaliza como não-deletável
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].type === "problem")
        nodes[i] = { ...nodes[i], deletable: false };
    }
  }
  return nodes;
}

function mergeById<T extends { id: string }>(base?: T[], incoming?: T[]): T[] {
  const out = new Map<string, T>();
  (base ?? []).forEach((n) => out.set(n.id, n));
  (incoming ?? []).forEach((n) =>
    out.set(n.id, { ...(out.get(n.id) as any), ...n })
  );
  return Array.from(out.values());
}

async function upsertFlow(
  event: H3Event | null | undefined,
  flow: FlowRecord
): Promise<void> {
  const { supabase, user } = await getAuth(event);

  const finalNodes = ensureProblemPresent(flow.nodes);

  const payload: any = {
    task_id: flow.task_id,
    nodes: finalNodes,
    edges: Array.isArray(flow.edges) ? flow.edges : [],
    viewport: flow.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
  if (user?.id) {
    payload.user_id = user.id;
  }

  const { error } = await supabase
    .from("task_flows")
    .upsert(payload, { onConflict: "task_id" });
  if (error) throw error;
}

export async function getNodeById(
  event: H3Event | null | undefined,
  taskId: string,
  nodeId: string
) {
  const flow = await getFlowByTaskId(event, taskId);
  if (!flow) return null;
  return flow.nodes.find((n) => n.id === nodeId) ?? null;
}

export async function createNodeInFlow(
  event: H3Event | null | undefined,
  taskId: string,
  nodeType: string,
  data: any,
  parentId?: string | null,
  canvasContext?: { nodes?: any[]; edges?: any[] } // optional seeding
) {
  const flow = (await getFlowByTaskId(event, taskId)) ?? {
    task_id: taskId,
    nodes: [],
    edges: [],
  };

  // Seed inicial do canvas quando não há estado no banco (primeiro insert desse taskId)
  const ctxNodes = Array.isArray(canvasContext?.nodes)
    ? (canvasContext!.nodes as any[]).filter(Boolean)
    : [];
  const ctxEdges = Array.isArray(canvasContext?.edges)
    ? (canvasContext!.edges as any[]).filter(Boolean)
    : [];

  // 1) Clone arrays (defensivo)
  let nodes = Array.isArray(flow.nodes) ? [...flow.nodes] : [];
  let edges = Array.isArray(flow.edges) ? [...flow.edges] : [];

  if (nodes.length === 0 && ctxNodes.length > 0) {
    // inclui nós do contexto inicial (ex.: problem-1) sem duplicar
    for (const n of ctxNodes) {
      const id = String((n as any).id ?? "");
      if (id && !nodes.some((nn) => nn.id === id)) {
        nodes.push({
          id,
          type: String(
            (n as any).type ?? (id.startsWith("problem") ? "problem" : "note")
          ),
          data: (n as any).data ?? {},
          position: (n as any).position,
          dimensions: (n as any).dimensions,
          computedPosition: (n as any).computedPosition,
          deletable:
            (n as any).deletable ?? String((n as any).type) !== "problem",
        });
      }
    }
  }

  if (edges.length === 0 && ctxEdges.length > 0) {
    for (const e of ctxEdges) {
      const source = String((e as any).source ?? "");
      const target = String((e as any).target ?? "");
      if (
        source &&
        target &&
        !edges.some((ee) => ee.source === source && ee.target === target)
      ) {
        edges.push({
          id: String((e as any).id ?? `e-${source}-${target}`),
          source,
          target,
          type: (e as any).type ?? "default",
          data: (e as any).data,
        });
      }
    }
  }

  // Garante que o problem-1 existe (fallback)
  if (!nodes.some((n) => n.type === "problem")) {
    const ps = (canvasContext as any)?.problem_statement;
    if (ps?.id) {
      nodes.push({
        id: String(ps.id),
        type: "problem",
        data: {
          title: ps.title ?? "Problema",
          description: ps.description ?? "",
          updated_at: new Date().toISOString(),
        },
        deletable: false,
      });
    }
  }

  // 2) Cria id (respeita data.id se vier)
  const id =
    data && data.id
      ? String(data.id)
      : `${nodeType}-${Math.random().toString(36).slice(2, 8)}`;

  // 3) Monta nó (preserva data anterior se já existir id)
  const existingIdx = nodes.findIndex((n) => n.id === id);
  const baseNode: NodeRecord =
    existingIdx >= 0 ? nodes[existingIdx] : { id, type: nodeType, data: {} };

  const node: NodeRecord = {
    ...baseNode,
    type: nodeType,
    data: {
      ...(baseNode.data ?? {}),
      ...(data ?? {}),
      updated_at: new Date().toISOString(),
    },
    deletable: baseNode.deletable ?? true,
  };

  if (existingIdx >= 0) {
    nodes[existingIdx] = node;
  } else {
    nodes.push(node);
  }

  // 4) Se houver parentId, cria edge (evita duplicata)
  if (parentId) {
    const edgeId = `e-${parentId}-${node.id}`;
    const exists = edges.some(
      (e) => e.source === parentId && e.target === node.id
    );
    if (!exists) {
      edges.push({
        id: edgeId,
        source: parentId,
        target: node.id,
        type: "default",
      });
    }
  }

  // 5) Persiste
  const updated: FlowRecord = {
    task_id: flow.task_id,
    nodes,
    edges,
  };
  await upsertFlow(event, updated);
  return node;
}

export async function updateNodeDataInFlow(
  event: H3Event | null | undefined,
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

  flow.nodes[idx] = {
    ...flow.nodes[idx],
    data: {
      ...(flow.nodes[idx].data ?? {}),
      ...(data ?? {}),
      updated_at: new Date().toISOString(),
    },
  };
  await upsertFlow(event, flow);
  return flow.nodes[idx];
}

export async function deleteNodeFromFlow(
  event: H3Event | null | undefined,
  taskId: string,
  nodeId: string
) {
  const flow = await getFlowByTaskId(event, taskId);
  if (!flow) return;

  const nodes = [...flow.nodes];
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return;

  const removed = nodes[idx];
  if (removed?.type === "problem" || removed?.id === "problem-1") {
    throw new Error("ProtectedNode: problem node cannot be deleted");
  }
  nodes.splice(idx, 1);

  const edges = (flow.edges ?? []).filter(
    (e) => e.source !== removed.id && e.target !== removed.id
  );

  const updated: FlowRecord = { ...flow, nodes, edges };
  await upsertFlow(event, updated);
}
