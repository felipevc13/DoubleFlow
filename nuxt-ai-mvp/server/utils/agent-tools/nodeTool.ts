import jsonpatch from "fast-json-patch";
import * as uuid from "uuid";
type PatchOp = import("fast-json-patch").Operation;
import { getPolicy, getTypeConfig } from "../../../lib/nodeTypeHelpers";
import { problemDiff, simpleFieldDiff } from "../../../lib/diff";

// Schemas
import { ProblemSchema } from "../../schema/problem";
import { NoteSchema } from "../../schema/note";
import { DataSourceSchema } from "../../schema/dataSource";

// Service central (delegando ao repositório)
import {
  getNodeById as svcGetNodeById,
  updateNodeDataInFlow as svcUpdateNodeDataInFlow,
} from "~/server/services/taskFlowService";

import type { H3Event } from "h3";

/* eslint-disable no-console */
const LOG_NS = "[nodeTool]";
function log(stage: string, payload?: any) {
  try {
    if (payload !== undefined) console.info(`${LOG_NS} ${stage}`, payload);
    else console.info(`${LOG_NS} ${stage}`);
  } catch {
    // noop – logging must never break the tool
  }
}

type Base = {
  taskId: string;
  nodeType: string; // "problem" | "note" | "survey" | ...
  event?: H3Event | null;
};

// Create
type CreateParams = Base & {
  operation: "create";
  parentId?: string | null; // se precisar inserir em um container/flow
  newData?: Record<string, any>; // dados iniciais
  canvasContext?: any;
  isApprovedOperation?: boolean;
};

// Update
type UpdateParams = Base & {
  operation: "update";
  nodeId: string;
  newData: Record<string, any>;
  canvasContext?: any;
  isApprovedOperation?: boolean;
};

// Patch
type PatchParams = Base & {
  operation: "patch";
  nodeId: string;
  patch: PatchOp[];
  canvasContext?: any;
  isApprovedOperation?: boolean;
};

// Delete
type DeleteParams = Base & {
  operation: "delete";
  nodeId: string;
  canvasContext?: any;
  isApprovedOperation?: boolean;
};

type Params = CreateParams | UpdateParams | PatchParams | DeleteParams;

export async function nodeTool(params: Params) {
  const op = params.operation;
  const nodeIdMaybe = (params as any)?.nodeId;
  const isApproved = (params as any)?.isApprovedOperation === true;
  log("REQUEST", {
    taskId: params.taskId,
    nodeType: params.nodeType,
    operation: op,
    nodeId: nodeIdMaybe,
    isApprovedOperation: isApproved,
  });

  const { taskId, nodeType } = params;
  const policy = getPolicy(nodeType, params.operation);
  log("POLICY", { needsApproval: !!policy?.needsApproval });

  // Escolhe schema por tipo
  const schema = pickSchema(nodeType);
  log("SCHEMA", { hasSchema: !!schema, nodeType });
  if (!schema) {
    return {
      ok: false,
      error: `No schema registered for nodeType "${nodeType}"`,
    };
  }

  const cfg = getTypeConfig(nodeType);
  const editable = new Set(cfg?.fields.editable ?? []);

  // ==== CREATE ==============================================================
  if (params.operation === "create") {
    const { newData = {} } = params as CreateParams;
    log("CREATE:begin", {
      nodeType,
      newDataKeys: Object.keys(newData || {}),
      needsApproval: !!policy.needsApproval,
      isApprovedOperation: (params as any)?.isApprovedOperation === true,
    });

    // sanitize inicial (mantém só campos editáveis)
    const sanitized = Object.fromEntries(
      Object.entries(newData).filter(([k]) => editable.has(k))
    );
    const draft = { ...sanitized, updated_at: new Date().toISOString() };

    // IMPORTANTE: não validar no servidor na criação — a criação agora é executada pela UI
    // (mesmo pipeline do "+ contextual"), que aplicará defaults/validações próprias.

    // aprovação
    if (policy.needsApproval && !params.isApprovedOperation) {
      const summary = buildCreateSummary(nodeType, draft);
      const { event: _omit, ...rest } = params as any;
      log("CREATE:pending_confirmation", { summary, params: { ...rest } });
      return {
        pending_confirmation: {
          render: policy.approvalRender,
          summary,
          diff: null,
          parameters: {
            ...rest,
            isApprovedOperation: true,
            event: "[POST] /api/ai/agentChat",
          },
        },
      };
    }

    // Delegar criação ao front via EXECUTE_ACTION (mesma UX do + contextual, tool_name: "create")
    const createSideEffects = [
      {
        type: "EXECUTE_ACTION",
        payload: {
          tool_name: "create",
          parameters: {
            nodeType,
            sourceNodeId: (params as CreateParams).parentId ?? undefined,
            newData: draft,
          },
        },
        seq: 1,
        phase: "post",
        uiHints: {
          successMessage: "Nó criado com sucesso.",
          focusNodeId: null,
        },
      },
      {
        type: "POST_MESSAGE",
        payload: { text: "✅ Nó criado." },
        seq: 2,
        phase: "post",
      },
    ] as const;
    log(
      "CREATE:sideEffects",
      createSideEffects.map((e) => ({ type: e.type, payload: e.payload }))
    );
    return {
      ok: true,
      scheduled: true,
      txId: uuid.v4(),
      sideEffects: createSideEffects,
    };
  }

  // ==== DELETE ==============================================================
  if (params.operation === "delete") {
    const { nodeId } = params as DeleteParams;
    log("DELETE:begin", {
      nodeType,
      nodeId,
      needsApproval: !!policy.needsApproval,
      isApprovedOperation: (params as any)?.isApprovedOperation === true,
    });

    // Proteção básica contra remoção do problema
    if (nodeType === "problem" && nodeId === "problem-1") {
      return { ok: false, error: "CannotDeleteProblemNode" };
    }

    // Para aprovação: tenta obter dados do nó a partir do canvasContext,
    // mas a remoção em si será sempre delegada ao cliente (UI/store).
    let forSummary: any = null;
    const cc = (params as any)?.canvasContext;
    if (cc) {
      if (Array.isArray(cc.nodes)) {
        forSummary = cc.nodes.find((n: any) => n?.id === nodeId) ?? null;
      }
      if (!forSummary && cc?.problem_statement && nodeType === "problem") {
        forSummary = {
          id: nodeId,
          type: "problem",
          data: {
            title: cc.problem_statement.title,
            description: cc.problem_statement.description,
          },
        } as any;
      }
    }
    log("DELETE:forSummary", {
      fromCanvas: !!cc,
      summaryId: forSummary?.id,
      title: forSummary?.data?.title,
    });

    if (policy.needsApproval && !params.isApprovedOperation) {
      const summary = buildDeleteSummary(
        nodeType,
        forSummary ?? { id: nodeId, data: {} }
      );
      const { event: _omit, ...rest } = params as any;
      log("DELETE:pending_confirmation", { summary, params: { ...rest } });
      return {
        pending_confirmation: {
          render: policy.approvalRender,
          summary,
          diff: null,
          parameters: {
            ...rest,
            isApprovedOperation: true,
            event: "[POST] /api/ai/agentChat",
          },
        },
      };
    }

    // Delegar: quem deleta é o cliente (mesmo pipeline do botão de lixeira, tool_name: "delete")
    const deleteSideEffects = [
      {
        type: "EXECUTE_ACTION",
        payload: {
          tool_name: "delete",
          parameters: { nodeId },
        },
        seq: 1,
        phase: "post",
        uiHints: {
          successMessage: "Nó deletado com sucesso.",
          focusNodeId: null,
        },
      },
      {
        type: "POST_MESSAGE",
        payload: { text: "🗑️ Nó deletado." },
        seq: 2,
        phase: "post",
      },
    ] as const;
    log(
      "DELETE:sideEffects",
      deleteSideEffects.map((e) => ({ type: e.type, payload: e.payload }))
    );
    return {
      ok: true,
      scheduled: true,
      nodeId,
      txId: uuid.v4(),
      sideEffects: deleteSideEffects,
    };
  }

  // ==== UPDATE / PATCH ======================================================
  const { nodeId } = params as UpdateParams | PatchParams;
  log("UPDATE_OR_PATCH:begin", {
    nodeType,
    nodeId,
    operation: params.operation,
  });
  let currentNode = await svcGetNodeById(
    (params as any)?.event ?? null,
    taskId,
    nodeId
  ).catch(() => null as any);
  log("FETCH:repo", { found: !!currentNode });

  // Fallback: usa canvasContext quando o repositório ainda não tem o nó
  if (!currentNode && (params as any)?.canvasContext) {
    const cc = (params as any).canvasContext;
    const fromNodes = Array.isArray(cc?.nodes)
      ? cc.nodes.find((n: any) => n?.id === nodeId)
      : null;
    if (fromNodes) currentNode = fromNodes;
    // fallback extra para problem_statement → monta nó sintético
    if (
      !currentNode &&
      cc?.problem_statement &&
      (params as any).nodeType === "problem"
    ) {
      currentNode = {
        id: nodeId,
        type: "problem",
        data: {
          title: cc.problem_statement.title,
          description: cc.problem_statement.description,
        },
      } as any;
    }
    if (!currentNode) {
      log("FETCH:canvas", { used: false });
    } else {
      log("FETCH:canvas", {
        used: true,
        id: currentNode?.id,
        type: currentNode?.type,
      });
    }
  }

  if (!currentNode) return { ok: false, error: "NodeNotFound" };
  log("FETCH:final", { id: currentNode?.id, type: currentNode?.type });

  const currentData = currentNode?.data ?? {};
  let draft: any;

  if (params.operation === "update") {
    const sanitized = Object.fromEntries(
      Object.entries((params as UpdateParams).newData ?? {}).filter(([k]) =>
        editable.has(k)
      )
    );
    draft = {
      ...currentData,
      ...sanitized,
      updated_at: new Date().toISOString(),
    };
  } else {
    // patch
    const res = jsonpatch.applyPatch(
      structuredClone(currentData),
      (params as PatchParams).patch,
      false,
      false
    );
    draft = { ...res.newDocument, updated_at: new Date().toISOString() };
  }

  // Allow only editable fields (plus 'updated_at') to proceed to validation,
  // preventing patches from touching non-editable fields.
  const allowed = new Set([...(cfg?.fields.editable ?? []), "updated_at"]);
  log("VALIDATION:pre", { allowedKeys: Array.from(allowed) });
  const nextDraft = Object.fromEntries(
    Object.entries(draft).filter(([k]) => allowed.has(k))
  );

  const parsed = schema.safeParse(nextDraft);
  log("VALIDATION:result", {
    success: parsed.success,
    errors: parsed.success ? undefined : parsed.error.flatten(),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: "ValidationError",
      details: parsed.error.flatten(),
    };
  const nextData = parsed.data;

  // Diff friendly por tipo
  const diff = buildDiff(
    nodeType,
    cfg?.fields.editable ?? [],
    currentData,
    nextData
  );
  log("DIFF", { count: Array.isArray(diff) ? diff.length : diff ? 1 : 0 });

  if (policy.needsApproval && !params.isApprovedOperation) {
    const summary = buildUpdateSummary(nodeType, diff, nextData);
    const { event: _omit, ...rest } = params as any;
    log("UPDATE_OR_PATCH:pending_confirmation", { summary });
    return {
      pending_confirmation: {
        render: policy.approvalRender,
        summary,
        diff,
        parameters: {
          ...rest,
          isApprovedOperation: true,
          event: "[POST] /api/ai/agentChat",
        },
      },
    };
  }

  const updatedNode = await svcUpdateNodeDataInFlow(
    (params as any)?.event ?? null,
    taskId,
    nodeId,
    nextData
  );
  const updateSideEffects = [
    { type: "REFETCH_TASK_FLOW", payload: {}, seq: 1, phase: "post" as const },
    {
      type: "POST_MESSAGE",
      payload: { text: "✅ Nó atualizado." },
      seq: 2,
      phase: "post" as const,
      uiHints: {
        focusNodeId: nodeId,
        successMessage: "Nó atualizado com sucesso.",
      },
    },
  ];
  log(
    "UPDATE_OR_PATCH:sideEffects",
    updateSideEffects.map((e) => ({ type: e.type, payload: e.payload }))
  );
  return {
    ok: true,
    updated: true,
    node: updatedNode,
    txId: uuid.v4(),
    sideEffects: updateSideEffects,
  };
}

// ----------------- Helpers -----------------

function pickSchema(nodeType: string) {
  switch (nodeType) {
    case "problem":
      return ProblemSchema;
    case "note":
      return NoteSchema;
    case "dataSource":
      return DataSourceSchema;
    default:
      return null; // registre mais schemas aqui (survey, etc.)
  }
}

function buildDiff(
  nodeType: string,
  fields: string[],
  oldData: any,
  newData: any
) {
  if (nodeType === "problem") return problemDiff(oldData, newData);
  return simpleFieldDiff(oldData, newData, fields);
}

function buildCreateSummary(nodeType: string, nextData: any) {
  switch (nodeType) {
    case "note":
      return `Criar nota: “${(nextData.text ?? "").slice(0, 40)}”`;
    case "dataSource":
      return `Criar data source: “${(nextData.title ?? "").slice(0, 40)}”`;
    default:
      return `Criar ${nodeType}`;
  }
}
function buildDeleteSummary(nodeType: string, currentNode: any) {
  switch (nodeType) {
    case "note":
      return `Deletar nota: “${(currentNode?.data?.text ?? "").slice(0, 40)}”`;
    case "dataSource":
      return `Deletar data source: “${(currentNode?.data?.title ?? "").slice(
        0,
        40
      )}”`;
    default:
      return `Deletar ${nodeType} (${currentNode?.id})`;
  }
}
function buildUpdateSummary(nodeType: string, diff: any, nextData: any) {
  if (nodeType === "problem") {
    const parts: string[] = [];
    if (diff.find((d: any) => d.field === "title"))
      parts.push(`Título → “${nextData.title}”`);
    if (diff.find((d: any) => d.field === "description"))
      parts.push("Descrição atualizada");
    return parts.join(" • ");
  }
  // genérico
  return `Alterações: ${Array.isArray(diff) ? diff.length : 1}`;
}
