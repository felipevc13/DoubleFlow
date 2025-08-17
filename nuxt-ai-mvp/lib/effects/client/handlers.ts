// lib/effects/client/handlers.ts
import { z } from "zod";
import { effectRegistry } from "./registry";
import { runAgentAction } from "~/lib/agentActions";

// Debug helper – consistent, compact logs
const d = {
  log: (...a: any[]) => console.debug("[effects]", ...a),
  err: (...a: any[]) => console.error("[effects]", ...a),
};

effectRegistry.register(
  "FOCUS_NODE",
  (p, { graphStore }) => {
    d.log("FOCUS_NODE: received", { nodeId: p.nodeId });
    const res = graphStore.focusNode?.(p.nodeId);
    d.log("FOCUS_NODE: applied", { nodeId: p.nodeId, res });
    return res;
  },
  z.object({ nodeId: z.string() })
);

effectRegistry.register("CLOSE_MODAL", (_p, { modalStore }) =>
  modalStore.closeModal?.()
);

effectRegistry.register(
  "OPEN_MODAL",
  (p, { modalStore }) => {
    d.log("OPEN_MODAL: received", {
      nodeId: p.nodeId,
      nodeType: p.nodeType,
      payload: p,
    });
    return modalStore.openModal?.(p.nodeType ?? "node", p, p.nodeId);
  },
  z
    .object({
      nodeId: z.string().optional(),
      nodeType: z.string().optional(),
    })
    .passthrough()
);

effectRegistry.register(
  "SHOW_CONFIRMATION",
  (p, { modalStore, sendResumePayload, pushChatMessage }) => {
    d.log("SHOW_CONFIRMATION: received", {
      render: p.render,
      summary: p.summary,
      nodeId: p.nodeId,
      nodeType: p.nodeType,
      correlationId: p.correlationId,
      parameters: p.parameters,
    });

    if (p.render === "modal") {
      modalStore.openModal?.(
        p.nodeType ?? "node",
        {
          mode: "confirm",
          modalTitle: p.summary ?? "Confirme a ação",
          message: p.summary ?? "Confirme a ação",
          diff: p.diff,
          actionToConfirm: {
            tool_name: "nodeTool",
            parameters: p.parameters ?? {},
            correlationId: p.correlationId ?? "",
          },
          confirmLabel: "Confirmar",
          cancelLabel: "Cancelar",
          onConfirm: async () => {
            d.log("SHOW_CONFIRMATION:onConfirm → sendResumePayload", {
              correlationId: p.correlationId,
              taskId: p.parameters?.taskId,
            });
            return sendResumePayload({
              resume: true,
              correlationId: p.correlationId ?? "",
              taskId: p.parameters?.taskId,
            });
          },
          onCancel: async () => {
            d.log("SHOW_CONFIRMATION:onCancel → sendResumePayload", {
              correlationId: p.correlationId,
              taskId: p.parameters?.taskId,
            });
            return sendResumePayload({
              resume: false,
              correlationId: p.correlationId ?? "",
              taskId: p.parameters?.taskId,
            });
          },
        },
        p.nodeId
      );
      d.log("SHOW_CONFIRMATION: modal opened", { nodeId: p.nodeId });
    } else {
      // via chat: empurra card de confirmação
      d.log("SHOW_CONFIRMATION: push chat confirmation", {
        nodeId: p.nodeId,
        correlationId: p.correlationId,
      });
      pushChatMessage?.({
        role: "confirmation",
        content: p.summary ?? "Confirme a ação proposta",
        action: {
          tool_name: "nodeTool",
          parameters: p.parameters ?? {},
          nodeId: p.nodeId,
          correlationId: p.correlationId ?? "",
        },
      });
    }
  },
  z.object({
    render: z.enum(["chat", "modal"]),
    summary: z.string().optional(),
    diff: z.any().optional(),
    parameters: z.record(z.any()).optional(),
    nodeId: z.string().optional(),
    nodeType: z.string().optional(),
    correlationId: z.string().optional(),
  })
);

effectRegistry.register(
  "POST_MESSAGE",
  (p, { pushChatMessage }) => {
    d.log("POST_MESSAGE: received", { text: p.text });
    return pushChatMessage?.({ role: "agent", content: p.text });
  },
  z.object({ text: z.string() })
);

effectRegistry.register("REFETCH_TASK_FLOW", async (_p, { graphStore }) => {
  d.log("REFETCH_TASK_FLOW: requested");
  return graphStore.refetchTaskFlow?.();
});

// Executes an action requested by the backend (e.g., deleteNode, createNode)
effectRegistry.register(
  "EXECUTE_ACTION",
  async (p, { graphStore }) => {
    d.log("EXECUTE_ACTION: received", {
      tool: p.tool_name,
      parameters: p.parameters,
    });
    try {
      const payload = { type: p.tool_name, ...(p.parameters || {}) } as any;
      d.log("EXECUTE_ACTION → runAgentAction", payload);

      const result = await runAgentAction(payload);
      d.log("EXECUTE_ACTION: runAgentAction result", result);

      // Useful runtime hints about current store shape (won't throw if missing)
      const snapshot: Record<string, any> = {};
      try {
        // Prefer common shapes, fallbacks included
        // @ts-ignore – purely diagnostic
        snapshot.focusNodeId =
          graphStore?.focusedNodeId || graphStore?.focusNodeId;
        // @ts-ignore
        const nodes =
          (graphStore?.graph && graphStore.graph.nodes) ||
          graphStore?.nodes ||
          graphStore?.getNodes?.();
        snapshot.nodesCount = Array.isArray(nodes) ? nodes.length : undefined;
        // @ts-ignore
        snapshot.hasRefetch = typeof graphStore?.refetchTaskFlow === "function";

        try {
          const nodeId = (p?.parameters as any)?.nodeId;
          if (nodeId && Array.isArray(nodes)) {
            const stillThere = nodes.some((n: any) => n?.id === nodeId);
            snapshot.nodePresent = { nodeId, stillThere };
          }
        } catch {}
      } catch (e) {
        // ignore snapshot errors
      }
      d.log("EXECUTE_ACTION: after action snapshot", snapshot);
    } catch (error) {
      d.err("EXECUTE_ACTION: error", error);
      throw error;
    }
  },
  z.object({
    tool_name: z.string(),
    parameters: z.record(z.any()).optional(),
  })
);
