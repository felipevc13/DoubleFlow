/**
 * Central service for all persistence operations related to the task‑flow
 * (nodes, edges) stored in the `task_flows` table on Supabase.
 *
 * This service MUST be used from server‑side context only (Nitro runtime).
 * Agent tools and API routes can import these helpers to avoid duplicating
 * Supabase logic.
 */

import { serverSupabaseClient } from "#supabase/server";
import type { H3Event } from "h3";
import type { Database } from "~/types/supabase";
import type { Json } from "~/types/supabase";
import type { TaskFlowNode, TaskFlowEdge } from "~/types/taskflow";
import type { SupabaseClient } from "@supabase/supabase-js";
type Supa = SupabaseClient<Database>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function getTaskFlow(
  supabase: Supa,
  taskId: string
): Promise<{ nodes: TaskFlowNode[]; edges: TaskFlowEdge[] }> {
  const { data, error } = await supabase
    .from("task_flows")
    .select("nodes, edges")
    .eq("id", taskId)
    .single();

  if (error) {
    throw new Error(
      `[taskFlowService] Could not fetch task flow ${taskId}: ${error.message}`
    );
  }

  // CORREÇÃO: Parseia os campos JSON antes de retornar
  const nodes =
    data?.nodes && typeof data.nodes === "string"
      ? JSON.parse(data.nodes)
      : data?.nodes || [];
  const edges =
    data?.edges && typeof data.edges === "string"
      ? JSON.parse(data.edges)
      : data?.edges || [];

  return {
    nodes: Array.isArray(nodes) ? nodes : [],
    edges: Array.isArray(edges) ? edges : [],
  };
}

async function persistTaskFlow(
  supabase: Supa,
  taskId: string,
  nodes: TaskFlowNode[],
  edges: TaskFlowEdge[]
) {
  const { data, error } = await supabase
    .from("task_flows")
    .update({
      nodes: nodes as unknown as Json,
      edges: edges as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select();

  if (error) {
    throw new Error(
      `[taskFlowService] Falha ao persistir task flow ${taskId}: ${error.message}`
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      `[taskFlowService] Falha ao persistir task flow ${taskId}: Nenhuma linha foi atualizada. Verifique as políticas de Row-Level Security (RLS).`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Updates the data of an existing node.
 */
export async function updateNodeDataInFlow(
  event: H3Event,
  taskId: string,
  nodeId: string,
  newData: Record<string, any>
) {
  const supabase = await serverSupabaseClient<Database>(event);

  const { nodes, edges } = await getTaskFlow(supabase, taskId);
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) {
    throw new Error(`[taskFlowService] Node ${nodeId} not found in flow.`);
  }

  nodes[idx] = {
    ...nodes[idx],
    data: {
      ...(nodes[idx].data ?? {}),
      ...newData,
      updated_at: new Date().toISOString(),
    },
  };

  await persistTaskFlow(supabase, taskId, nodes, edges);

  return nodes[idx];
}

/**
 * Creates a new node of `type` and (optionally) links it to `sourceNodeId`.
 * Returns the created node.
 */
export async function createNodeInFlow(
  event: H3Event,
  taskId: string,
  type: string,
  sourceNodeId?: string
) {
  const supabase = await serverSupabaseClient<Database>(event);

  const { nodes, edges } = await getTaskFlow(supabase, taskId);

  const nodeId = `node-${
    globalThis.crypto?.randomUUID?.() || (await import("uuid")).v4()
  }`;
  const newNode: TaskFlowNode = {
    id: nodeId,
    type,
    position: { x: 0, y: 0 },
    data: {} as any,
    width: 180,
    height: 120,
    selected: false,
    dragging: false,
    resizing: false,
    computedPosition: { x: 0, y: 0 },
  } as any;

  const nextNodes = [...nodes, newNode];

  let nextEdges = edges;
  if (sourceNodeId) {
    const newEdge: TaskFlowEdge = {
      id: `edge-${crypto.randomUUID()}`,
      source: sourceNodeId,
      target: nodeId,
      sourceHandle: null,
      targetHandle: null,
      type: "default",
      data: {},
      selected: false,
    } as any;
    nextEdges = [...edges, newEdge];
  }

  await persistTaskFlow(supabase, taskId, nextNodes, nextEdges);

  return newNode;
}

/**
 * Deletes a node (and any edges connected to it).
 */
export async function deleteNodeFromFlow(
  event: H3Event,
  taskId: string,
  nodeId: string
) {
  const supabase = await serverSupabaseClient<Database>(event);

  const { nodes, edges } = await getTaskFlow(supabase, taskId);

  const nextNodes = nodes.filter((n) => n.id !== nodeId);
  const nextEdges = edges.filter(
    (e) => e.source !== nodeId && e.target !== nodeId
  );

  await persistTaskFlow(supabase, taskId, nextNodes, nextEdges);

  return { deleted: true, nodeId };
}
