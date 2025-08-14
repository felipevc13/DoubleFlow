/**
 * Central service for all persistence operations related to the task‑flow
 * (nodes, edges) stored in the `task_flows` table on Supabase.
 *
 * ⚠️ Importante:
 * Este service agora é um "façade" fino que delega todas as operações
 * ao repositório único `~/repositories/flows` (Single Source of Truth).
 * Mantemos as mesmas assinaturas públicas (com `event`) por compatibilidade,
 * e agora passamos o `event` para as funções do repositório.
 */

import type { H3Event } from "h3";
import {
  getFlowByTaskId as repoGetFlowByTaskId,
  getNodeById as repoGetNodeById,
  createNodeInFlow as repoCreateNodeInFlow,
  updateNodeDataInFlow as repoUpdateNodeDataInFlow,
  deleteNodeFromFlow as repoDeleteNodeFromFlow,
  type FlowRecord,
  type NodeRecord,
} from "~/repositories/flows";

import { getSupabase, serverSupabaseService } from "~/server/utils/supabase";

function getDb(event?: H3Event | null) {
  return event ? getSupabase(event) : serverSupabaseService();
}

/* -------------------------------------------------------------------------- */
/* Public API (compatível)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Obtém o flow completo de uma task (nodes + edges) a partir do banco.
 * Agora passamos o `event` para o repositório.
 */
export async function getFlowByTaskId(
  event: H3Event | null | undefined,
  taskId: string
): Promise<FlowRecord | null> {
  return await repoGetFlowByTaskId(event, taskId);
}

/**
 * Obtém um nó específico pelo ID diretamente do repositório.
 * Agora passamos o `event` para o repositório.
 */
export async function getNodeById(
  event: H3Event | null | undefined,
  taskId: string,
  nodeId: string
): Promise<NodeRecord | null> {
  return await repoGetNodeById(event, taskId, nodeId);
}

/**
 * Atualiza o `data` de um nó existente e persiste no banco.
 * Agora passamos o `event` para o repositório.
 */
export async function updateNodeDataInFlow(
  event: H3Event | null | undefined,
  taskId: string,
  nodeId: string,
  newData: Record<string, any>
): Promise<NodeRecord> {
  return await repoUpdateNodeDataInFlow(event, taskId, nodeId, newData);
}

/**
 * Cria um novo nó do tipo `type` com `initialData` opcional.
 * Se `parentId` for informado, a relação (edge) poderá ser criada pela camada de repositório.
 * O `canvasContext` é usado como seed inicial quando o flow do banco está vazio (ex.: para garantir o nó `problem`).
 */
export async function createNodeInFlow(
  event: H3Event | null | undefined,
  taskId: string,
  type: string,
  initialData: Record<string, any> = {},
  parentId?: string | null,
  canvasContext?: { nodes?: any[]; edges?: any[] } | null
): Promise<NodeRecord> {
  return await repoCreateNodeInFlow(
    event,
    taskId,
    type,
    initialData,
    parentId ?? null,
    canvasContext ?? undefined
  );
}

/**
 * Deleta um nó (e as edges conectadas a ele) e persiste no banco.
 * Agora passamos o `event` para o repositório.
 */
export async function deleteNodeFromFlow(
  event: H3Event | null | undefined,
  taskId: string,
  nodeId: string
): Promise<{ deleted: boolean; nodeId: string }> {
  await repoDeleteNodeFromFlow(event, taskId, nodeId);
  return { deleted: true, nodeId };
}
