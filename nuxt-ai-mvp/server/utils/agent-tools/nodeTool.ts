import jsonpatch from "fast-json-patch";
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
  const { taskId, nodeType } = params;
  const policy = getPolicy(nodeType, params.operation);

  if (!policy) {
    return {
      ok: false,
      error: `Operation "${params.operation}" is not allowed for nodeType "${nodeType}"`,
    };
  }

  // Escolhe schema por tipo
  const schema = pickSchema(nodeType);
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
      return {
        pending_confirmation: {
          render: policy.approvalRender,
          summary,
          diff: null,
          parameters: { ...params, isApprovedOperation: true },
        },
      };
    }

    // Delegar criação ao front via EXECUTE_ACTION (mesma UX do + contextual)
    return {
      ok: true,
      scheduled: true,
      sideEffects: [
        {
          type: "EXECUTE_ACTION",
          payload: {
            tool_name: "createNode",
            parameters: {
              nodeType,
              sourceNodeId: (params as CreateParams).parentId ?? undefined,
              newData: draft,
            },
          },
        },
        { type: "POST_MESSAGE", payload: { text: "✅ Nó criado." } },
      ],
    };
  }

  // ==== DELETE ==============================================================
  if (params.operation === "delete") {
    const { nodeId } = params as DeleteParams;
    const currentNode = await svcGetNodeById(
      (params as any)?.event ?? null,
      taskId,
      nodeId
    );
    if (!currentNode) return { ok: false, error: "NodeNotFound" };

    if (policy.needsApproval && !params.isApprovedOperation) {
      const summary = buildDeleteSummary(nodeType, currentNode);
      return {
        pending_confirmation: {
          render: policy.approvalRender,
          summary,
          diff: null,
          parameters: { ...params, isApprovedOperation: true },
        },
      };
    }

    return {
      ok: true,
      scheduled: true,
      nodeId,
      sideEffects: [
        {
          type: "EXECUTE_ACTION",
          payload: {
            tool_name: "deleteNode",
            parameters: { nodeId },
          },
        },
        { type: "POST_MESSAGE", payload: { text: "🗑️ Nó deletado." } },
      ],
    };
  }

  // ==== UPDATE / PATCH ======================================================
  const { nodeId } = params as UpdateParams | PatchParams;
  let currentNode = await svcGetNodeById(
    (params as any)?.event ?? null,
    taskId,
    nodeId
  ).catch(() => null as any);

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
  }

  if (!currentNode) return { ok: false, error: "NodeNotFound" };

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

  const parsed = schema.safeParse(draft);
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

  if (policy.needsApproval && !params.isApprovedOperation) {
    const summary = buildUpdateSummary(nodeType, diff, nextData);
    return {
      pending_confirmation: {
        render: policy.approvalRender,
        summary,
        diff,
        parameters: { ...params, isApprovedOperation: true },
      },
    };
  }

  const updatedNode = await svcUpdateNodeDataInFlow(
    (params as any)?.event ?? null,
    taskId,
    nodeId,
    nextData
  );
  return {
    ok: true,
    updated: true,
    node: updatedNode,
    sideEffects: [
      { type: "REFETCH_TASK_FLOW", payload: {} },
      { type: "POST_MESSAGE", payload: { text: "✅ Nó atualizado." } },
    ],
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
