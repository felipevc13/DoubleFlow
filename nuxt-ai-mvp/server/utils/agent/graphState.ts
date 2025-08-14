// Em: server/utils/agent/graphState.ts
import type { BaseMessage } from "@langchain/core/messages";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import type { SideEffect } from "~/lib/sideEffects";
import { Annotation } from "@langchain/langgraph";

// Representa a tupla de [ação da ferramenta, observação/resultado]
export type AgentStep = [AgentAction, string];

// Representa um único passo no plano gerado pela IA
export interface PlanStep {
  tool: "problemNode" | "chatNode"; // O nó/sub-grafo que deve executar o passo
  toolInput: string | object; // O input para essa ferramenta ou nó
  rationale: string; // A justificativa da IA para este passo
}

// Resultado do passo de ASK_CLARIFY
export type ClarifyResult = {
  kind: "ASK_CLARIFY";
  answers: Record<string, any>;
};

// Proposta de ação aguardando confirmação do usuário (server‑driven)
export interface ActionProposal {
  tool_name: string; // normalmente "nodeTool"
  parameters: any; // payload idempotente para execução
  render: "chat" | "modal"; // como aprovar
  summary: string; // resumo curto para UI
  diff?: any; // estrutura de diff (se houver)
  effects?: SideEffect[]; // efeitos sugeridos
  kind?: "ASK_CLARIFY" | "PROPOSE_PATCH"; // tipo de proposta
  questions?: Array<{
    id: string;
    label: string;
    placeholder?: string;
    required?: boolean;
  }>; // para ASK_CLARIFY
}

// O estado unificado para o novo grafo híbrido
export interface PlanExecuteState {
  // Metadados opcionais adicionados por roteadores (legado/opcional)
  action_metadata?: Record<string, any>;
  taskId?: string; // Add taskId to the state
  // Entradas Iniciais do Usuário/Sistema
  input: string | object;
  canvasContext: any;
  messages: BaseMessage[];
  intent?: string;
  // Resultado mais recente vindo do classificador de intenção
  last_intent_result?: {
    target?: { type: string; id?: string };
    action?: string;
    args?: any;
    refinement?: boolean;
  };

  // Estado do Planejamento
  plan: PlanStep[];
  past_steps: Array<[string, string]>; // Pares de [passo serializado, resultado serializado]
  response: string; // A resposta final em texto para o usuário

  // Saídas & Estado Intermediário (compatível com ReAct)
  agent_outcome?: AgentAction | AgentFinish;
  intermediate_steps: AgentStep[];
  sideEffects: SideEffect[];
  pending_confirmation?: ActionProposal | null;

  // Resultado de perguntas de esclarecimento (ASK_CLARIFY)
  clarify_result?: ClarifyResult | null;

  // Execução direta (catálogo)
  pending_execute?: {
    tool_name: string;
    parameters: any;
    nodeId?: string;
  } | null;
  last_tool_result?: any;
  next_step?: "agentNode" | "chatNode" | "__end__";
}

export const PlanExecuteAnnotation = Annotation.Root({
  input: Annotation<string | object>({
    reducer: (x: string | object | undefined, y: string | object) => y,
    default: () => "",
  }),
  taskId: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  }),
  canvasContext: Annotation<any>({
    reducer: (x: any, y: any) => y,
    default: () => null,
  }),
  messages: Annotation<BaseMessage[]>({
    // The reducer should replace the history if a node provides the full updated history.
    // Nodes like chatNode return the complete history for the turn.
    reducer: (x: BaseMessage[] | undefined, y: BaseMessage[]) => y,
    default: () => [],
  }),
  intent: Annotation<string | undefined>({
    reducer: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  }),
  plan: Annotation<PlanStep[]>({
    reducer: (x: PlanStep[] | undefined, y: PlanStep[]) => y,
    default: () => [],
  }),
  past_steps: Annotation<Array<[string, string]>>({
    reducer: (
      x: Array<[string, string]> | undefined,
      y: Array<[string, string]>
    ) => (x || []).concat(y),
    default: () => [],
  }),
  response: Annotation<string>({
    reducer: (x: string | undefined, y: string) => y,
    default: () => "",
  }),
  last_intent_result: Annotation<any>({
    reducer: (_x: any, y: any) => y,
    default: () => undefined,
  }),
  agent_outcome: Annotation<AgentAction | AgentFinish | undefined>({
    reducer: (
      x: (AgentAction | AgentFinish | undefined) | undefined,
      y: AgentAction | AgentFinish | undefined
    ) => y,
    default: () => undefined,
  }),
  intermediate_steps: Annotation<AgentStep[]>({
    reducer: (x: AgentStep[] | undefined, y: AgentStep[]) =>
      (x || []).concat(y),
    default: () => [],
  }),
  sideEffects: Annotation<SideEffect[]>({
    reducer: (x: SideEffect[] | undefined, y: SideEffect[]) => y,
    default: () => [],
  }),
  pending_confirmation: Annotation<ActionProposal | null>({
    reducer: (
      currentValue: ActionProposal | null,
      newValue: ActionProposal | null
    ) => newValue ?? null,
    default: () => null,
  }),
  clarify_result: Annotation<ClarifyResult | null>({
    reducer: (_current: ClarifyResult | null, incoming: ClarifyResult | null) =>
      incoming ?? null,
    default: () => null,
  }),
  pending_execute: Annotation<{
    tool_name: string;
    parameters: any;
    nodeId?: string;
  } | null>({
    reducer: (
      _current: { tool_name: string; parameters: any } | null,
      incoming: { tool_name: string; parameters: any } | null
    ) => incoming ?? null,
    default: () => null,
  }),
  last_tool_result: Annotation<any>({
    reducer: (_x: any, y: any) => y,
    default: () => undefined,
  }),
  action_metadata: Annotation<Record<string, any> | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
  next_step: Annotation<"agentNode" | "chatNode" | "__end__" | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
});

export type { BaseMessage, AgentAction, AgentFinish };
export type { SideEffect };
