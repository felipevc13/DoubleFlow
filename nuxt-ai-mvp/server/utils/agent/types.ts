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
