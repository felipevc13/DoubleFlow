// lib/agentActions.ts
// Roteador central de ações do agente. Sempre reutiliza as MESMAS funções da UI
// para criar/conectar/deletar, sem manipular nodes/edges diretamente.

import { useTaskFlowStore } from "~/stores/taskFlow";
import { useConnectionControlStore } from "~/stores/connectionControl";
import { useVueFlow } from "@vue-flow/core";
import { canConnect } from "~/lib/connectionRules";
import { useGlobalAdd } from "~/composables/useGlobalAdd";
import { addFromPlusProgrammatically } from "~/lib/plusActions";

// Tipos de ação aceitos pelo agente
export type AgentCreateAction = {
  type: "create";
  nodeType: string; // ex.: "dataSource", "analysis", "survey", "note", ...
  originId?: string; // quando presente, é uma criação CONECTADA a partir desse nó
  initialData?: Record<string, any>; // opcional (nem toda store aceita ainda)
  position?: { x: number; y: number }; // opcional: criação solta em posição específica (se a store expuser)
};

export type AgentDeleteAction = {
  type: "delete";
  nodeId: string;
};

export type AgentAction = AgentCreateAction | AgentDeleteAction;

// Normaliza tipagens vindas do agente (ex.: "datasource" -> "dataSource")
function normalizeNodeType(t?: string) {
  if (!t) return t as any;
  const key = String(t).trim().toLowerCase();
  const MAP: Record<string, string> = {
    datasource: "dataSource",
    data_source: "dataSource",
    analysis: "analysis",
    survey: "survey",
    note: "note",
    problem: "problem",
  };
  return (MAP[key] ?? t) as string;
}

/**
 * Executa uma ação do agente utilizando exclusivamente as APIs públicas da UI/store.
 * - Create conectado: usa requestAddNodeAndPrepareConnection (mesma UX do "+ contextual").
 * - Create solto: aciona o "+ global" via useGlobalAdd (abre a mesma sidebar no centro).
 * - Delete: usa removeNode (mesma função do botão de lixeira).
 */
export async function runAgentAction(action: AgentAction) {
  const taskFlowStore = useTaskFlowStore();
  const connectionControlStore = useConnectionControlStore();
  const { findNode, getNodes } = useVueFlow("task-flow");
  const { openAddAtFlowCenter } = useGlobalAdd();

  if (action.type === "delete") {
    // Proteção básica: não deletar o Problema
    if (action.nodeId === "problem-1") {
      console.warn("[Agent] Tentativa de deletar o nó de Problema bloqueada.");
      return;
    }
    return await taskFlowStore.removeNode(action.nodeId);
  }

  // type === 'create'
  const targetType = normalizeNodeType(action.nodeType);

  // Helpers compartilhados: tentar conectar a partir de um nó e heurística de auto‑origem
  const tryConnectFrom = async (originNodeId: string) => {
    const origin = findNode(originNodeId);
    if (!origin) return false;
    const { allowed } = canConnect(
      (origin.type as any) ?? "",
      (targetType as any) ?? ""
    );
    if (!allowed) return false;
    try {
      connectionControlStore.setLastInteractionWasSimpleClickOnSource(true);
      await addFromPlusProgrammatically(
        targetType,
        origin.id,
        origin.position,
        (origin as any).dimensions?.height
      );
      return true;
    } finally {
      connectionControlStore.setLastInteractionWasSimpleClickOnSource(false);
    }
  };

  const attemptAutoOriginConnect = async (): Promise<boolean> => {
    // 1) tentar a partir do Problema
    const problem = findNode("problem-1");
    if (problem) {
      const ok = await tryConnectFrom(problem.id);
      if (ok) return true;
    }
    // 2) tentar a partir de qualquer outro nó permitido
    const nodeList =
      (getNodes as any)?.value ?? (taskFlowStore as any).nodes?.value ?? [];
    for (const n of nodeList) {
      if (!n?.id || n.id === "problem-1") continue;
      const { allowed } = canConnect(
        (n.type as any) ?? "",
        (targetType as any) ?? ""
      );
      if (!allowed) continue;
      const ok = await tryConnectFrom(n.id);
      if (ok) return true;
    }
    return false;
  };

  // Caminho 1: criação CONECTADA (quando houver originId)
  if (action.originId) {
    const origin = findNode(action.originId);
    if (!origin) {
      console.warn(
        "[Agent] Nó de origem não encontrado no canvas; tentando auto‑origem antes do + global.",
        action.originId
      );
      const autoOk = await attemptAutoOriginConnect();
      if (autoOk) return;
      return openAddAtFlowCenter();
    }

    const { allowed } = canConnect(
      (origin.type as any) ?? "",
      (targetType as any) ?? ""
    );

    if (!allowed) {
      // Regra não permite a conexão a partir da origem informada — tentar auto‑origem
      const autoOk = await attemptAutoOriginConnect();
      if (autoOk) return;
      return openAddAtFlowCenter();
    }

    // Usa exatamente o mesmo pipeline do "+ contextual"
    try {
      connectionControlStore.setLastInteractionWasSimpleClickOnSource(true);
      await addFromPlusProgrammatically(
        targetType,
        action.originId,
        origin.position,
        (origin as any).dimensions?.height
      );
    } finally {
      connectionControlStore.setLastInteractionWasSimpleClickOnSource(false);
    }
    return;
  }

  // Caminho 2: sem origem explícita → tentar auto‑origem
  const autoOk = await attemptAutoOriginConnect();
  if (autoOk) return; // conectado com sucesso

  // 2.3) Se não houver candidatos permitidos → usar o "+ global" (criação solta)
  return openAddAtFlowCenter();
}
