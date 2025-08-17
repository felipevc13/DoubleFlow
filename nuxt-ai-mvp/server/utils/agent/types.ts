// Tipos compartilhados entre os intents/nodes do agente

export type CanvasNode = {
  id: string;
  type: string;
  title?: string;
  description?: string;
  // Mantemos data como "any" para não engessar os cards existentes
  data?: Record<string, any>;
};

export type CanvasEdge = {
  source: string;
  target: string;
};

export type CanvasSummary = {
  countsByType: Record<string, number>;
  existingTypes: string[];
};

export type CanvasProblemStatement = {
  id: string | null;
  title: string;
  description: string;
};

export type CanvasCatalog = Record<
  string,
  {
    purpose?: string;
    aliases?: string[];
    operations?: string[];
  }
>;

export type CanvasContext = {
  goal?: string;
  problem_statement: CanvasProblemStatement;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  summary: CanvasSummary;
  // Nem sempre enviamos, então deixe opcional
  catalog?: CanvasCatalog;
};

// ===== Agente: tipos compartilhados para aprovação e esclarecimento =====

// Pedido de aprovação (visual/chat)
export type ApprovalPending = {
  kind: "APPROVAL";
  render: "chat" | "modal";
  summary: string;
  diff?: unknown;
  parameters: Record<string, unknown>;
};

// Estrutura de questões para ASK_CLARIFY
export type ClarifyQuestion = {
  key: string; // ex: "impacto"
  label: string; // ex: "Qual é o impacto?"
  placeholder?: string;
  required?: boolean;
  type?: "text" | "number" | "select" | "textarea";
  options?: string[];
};

// Interrupção para pedir esclarecimentos ao usuário
export type ClarifyRequest = {
  kind: "ASK_CLARIFY";
  reason: string; // por que estamos pedindo
  questions: ClarifyQuestion[];
  context?: Record<string, unknown>;
  suggested?: Record<string, string>; // sugestões do modelo
};

// Resultado das respostas do usuário ao ASK_CLARIFY
export type ClarifyResult = {
  kind: "ASK_CLARIFY_RESULT";
  answers: Record<string, unknown>;
};

// Estado mínimo do grafo compartilhado
export interface GraphState {
  input: string;
  taskId: string;
  canvasContext?: CanvasContext;
  messages?: any[];
  plan?: any[];
  past_steps?: any[];
  response?: string;
  intermediate_steps?: any[];
  sideEffects?: any[];

  // Pedidos ao humano
  pending_confirmation: ApprovalPending | null; // somente aprovação
  clarify_request: ClarifyRequest | null; // pedido de esclarecimento
  clarify_result: ClarifyResult | null; // respostas do usuário

  // Outros campos do seu runtime podem existir
  pending_execute?: any;
}
