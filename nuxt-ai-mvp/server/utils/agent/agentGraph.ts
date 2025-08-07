// server/utils/agent/agentGraph.ts

import { StateGraph, END, START } from "@langchain/langgraph";
import { PlanExecuteAnnotation, type PlanExecuteState } from "./graphState";
import { agentNode } from "./nodes/agentNode";
import { toolNode } from "./nodes/toolNode";
import { humanApprovalNode } from "./nodes/humanApprovalNode";
import { chatNode } from "./nodes/chatNode";
import { wrapNode } from "~/server/utils/logger";

const allNodes = ["agent", "tools", "human", "chat"] as const;
type Node = (typeof allNodes)[number];

function primaryRouter(state: PlanExecuteState): Node | "__end__" {
  if ((state as any).next_step === "chatNode") {
    return "chat";
  }
  if (state.pending_confirmation) {
    return "human";
  }
  if (state.pending_execute) {
    return "tools";
  }
  return "__end__";
}

function afterApprovalRouter(state: PlanExecuteState): "tools" | "__end__" {
  if (state.pending_execute) {
    return "tools";
  }
  return "__end__";
}

// Roteador após execução de ferramenta: decide se volta para agentNode ou termina
function afterToolsRouter(state: PlanExecuteState): "agent" | "__end__" {
  if ((state as any).next_step === "agent") return "agent";
  return "__end__";
}

const workflow = new StateGraph({
  stateSchema: PlanExecuteAnnotation,
}) as StateGraph<PlanExecuteState>;

// Definir os Nós
workflow.addNode("agent", wrapNode("agentNode", agentNode));
workflow.addNode("tools", wrapNode("toolNode", toolNode));
workflow.addNode("human", wrapNode("humanApprovalNode", humanApprovalNode));
workflow.addNode("chat", wrapNode("chatNode", chatNode));

// Definir as Arestas
workflow.addEdge(START, "agent" as any);

workflow.addConditionalEdges("agent" as any, primaryRouter, {
  human: "human" as any,
  tools: "tools" as any,
  chat: "chat" as any,
  __end__: END as any,
});

workflow.addConditionalEdges("human" as any, afterApprovalRouter, {
  tools: "tools" as any,
  __end__: END as any,
});

workflow.addConditionalEdges("tools" as any, afterToolsRouter, {
  agent: "agent" as any,
  __end__: END as any,
});

workflow.addEdge("chat" as any, END);

export const getAgentGraph = (checkpointer: any) => {
  return workflow.compile({ checkpointer });
};
