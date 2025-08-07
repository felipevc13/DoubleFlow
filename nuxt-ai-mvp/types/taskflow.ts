// types/taskflow.ts
import type {
  XYPosition,
  GraphEdge,
  GraphNode,
  EdgeEventsHandler,
} from "@vue-flow/core";

export type { XYPosition };

// Para os KPIs da Análise Quantitativa
export interface KpiMetric {
  metric: string; // Ex: "NPS (Pergunta X)" ou "Opção mais votada (Pergunta Y)"
  value: string; // Ex: "8.2" ou "Opção C"
  details?: string; // Ex: "Média de 150 respostas" ou "Com 45% dos votos"
  distribution?: Record<string, number>; // Para gráficos: { "Opção A": 10, "Opção B": 20 }
  startLabel?: string; // Ex: "Muito Insatisfeito"
  endLabel?: string; // Ex: "Muito Satisfeito"
}

// Para os insights temáticos da Análise Qualitativa
export interface ThemedInsight {
  theme: string; // Ex: "Problemas com a Performance"
  summary: string; // Ex: "Usuários relatam que a velocidade de carregamento é um ponto de atrito."
  supportingQuotes?: string[]; // Ex: ["'O app é muito lento'", "'Demora para carregar os dados'"]
}

// Para as Recomendações
export interface ActionRecommendation {
  priority: "high" | "medium" | "low";
  text: string;
}

// Estrutura principal REALISTA do analyzedData para o InsightsCard
export interface InsightsAnalysisPayload {
  quantitativeKpis: KpiMetric[];
  qualitativeInsights: ThemedInsight[];
  actionableRecommendations: ActionRecommendation[];
}

// Em types/taskflow.ts, a propriedade em NodeData seria:
// analyzedData: InsightsAnalysisPayload | /* outros tipos de analysis */ | null;

/* 1. Tipos de contexto */
export interface AncestorContextData {
  output: any;
  version: number;
  type?: string;
}
export interface CumulativeContextBlob {
  [ancestorId: string]: AncestorContextData;
}
export type CumulativeContextWrapper =
  | {
      compressed: true;
      blob: string; // Base64 gzipped JSON string
    }
  | {
      compressed: false;
      blob: CumulativeContextBlob; // O objeto JSON direto
    };

/* 2. Dados do nó */
export interface NodeData {
  label?: string;
  title?: string;
  description?: string;
  sources?: any[];
  inputData: Record<string, any> | null;
  outputData: SurveyOutputData | null;
  cumulativeContext: CumulativeContextWrapper;
  updated_at: string | null;
  processInputError?: string | Record<string, any> | null;
  is_active?: boolean;
  responseCount?: number;
  isLoadingEdgeConnection?: boolean;
  surveyId?: string;
  surveyStructure?: any;
  analyzedData?: any; // This will be refined by specific node types
  isProcessing?: boolean; // Added to indicate processing state
  initialized?: boolean; // Added to indicate if the node has been initialized
  wasActivated?: boolean;
  // …outros que você precisar
}

export interface AnalyzedReportData {
  report_id: string | number;
  title: string;
  summary: string;
}

export interface ReportNodeData extends NodeData {
  analyzedData: AnalyzedReportData | null;
  // processInputError is already in NodeData, but can be refined if needed
  // processInputError: string | object | null;
}

/* 3. Nó e Aresta */
export interface TaskFlowNode extends GraphNode {
  id: string;
  type: string;
  position: XYPosition;
  data: NodeData;
  selected: boolean;
  positionAbsolute?: XYPosition;
  isValid?: boolean;
  resizing: boolean;
  events: Record<string, any>;
}

export type TaskFlowEdge = Omit<GraphEdge, "sourceNode" | "targetNode"> & {
  sourceNode?: GraphNode;
  targetNode?: GraphNode;
};

/* 4. Viewport */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export interface SurveyResponse {
  id: number;
  answer: string;
  rating: number | null;
}

export interface SurveyResults {
  submissions: SurveyResponse[];
  responses?: { answer: string }[];
  summary?: Record<string, any>;
}

export interface SurveyOutputData extends Record<string, any> {
  survey_results?: SurveyResults;
}

export interface ProblemStatement {
  title: string;
  description: string;
  updated_at: string;
}
