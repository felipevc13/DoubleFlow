import jsonpatch from "fast-json-patch";
type PatchOp = import("fast-json-patch").Operation;
import { getPolicy, getTypeConfig } from "../../../lib/nodeTypeHelpers";
import { problemDiff, simpleFieldDiff } from "../../../lib/diff";

// Schemas
import { ProblemSchema } from "../../schema/problem";
import { NoteSchema } from "../../schema/note";

// Repositório (ajuste import p/ seu projeto)
import {
  getNodeById,
  updateNodeDataInFlow,
  createNodeInFlow,
  deleteNodeFromFlow,
} from "../../../repositories/flows";

type Base = {
  taskId: string;
  nodeType: string; // "problem" | "note" | "survey" | ...
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

    const parsed = schema.safeParse(draft);
    if (!parsed.success)
      return {
        ok: false,
        error: "ValidationError",
        details: parsed.error.flatten(),
      };

    // aprovação
    if (policy.needsApproval && !params.isApprovedOperation) {
      const summary = buildCreateSummary(nodeType, parsed.data);
      return {
        pending_confirmation: {
          render: policy.approvalRender,
          summary,
          diff: null,
          parameters: { ...params, isApprovedOperation: true },
        },
      };
    }

    // persistir
    const created = await createNodeInFlow(
      taskId,
      nodeType,
      parsed.data,
      (params as CreateParams).parentId ?? null
    );
    return {
      ok: true,
      created: true,
      node: created,
      sideEffects: [
        { type: "REFETCH_TASK_FLOW", payload: {} },
        { type: "POST_MESSAGE", payload: { text: "✅ Nó criado." } },
      ],
    };
  }

  // ==== DELETE ==============================================================
  if (params.operation === "delete") {
    const { nodeId } = params as DeleteParams;
    const currentNode = await getNodeById(taskId, nodeId);
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

    await deleteNodeFromFlow(taskId, nodeId);
    return {
      ok: true,
      deleted: true,
      nodeId,
      sideEffects: [
        { type: "REFETCH_TASK_FLOW", payload: {} },
        { type: "POST_MESSAGE", payload: { text: "🗑️ Nó deletado." } },
      ],
    };
  }

  // ==== UPDATE / PATCH ======================================================
  const { nodeId } = params as UpdateParams | PatchParams;
  let currentNode = await getNodeById(taskId, nodeId).catch(() => null as any);

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

  const updatedNode = await updateNodeDataInFlow(taskId, nodeId, nextData);
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
    default:
      return `Criar ${nodeType}`;
  }
}
function buildDeleteSummary(nodeType: string, currentNode: any) {
  switch (nodeType) {
    case "note":
      return `Deletar nota: “${(currentNode?.data?.text ?? "").slice(0, 40)}”`;
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
