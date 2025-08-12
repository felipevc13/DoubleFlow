export type ApprovalRender = "chat" | "modal";

export interface OperationPolicy {
  needsApproval: boolean;
  approvalRender: ApprovalRender; // UI de aprovação
  diffFields?: string[]; // campos p/ diff (quando aplicável)
  validateWith?: string; // opcional: id de validador
}

export interface NodeTypeConfig {
  version: string;
  fields: {
    editable: string[];
    readonly?: string[];
    labels?: Record<string, string>;
  };
  operations: Record<string, OperationPolicy>; // ex.: create, update, patch, delete
  ui?: { defaultRender?: ApprovalRender };
}

export type NodeTypesMap = Record<string, NodeTypeConfig>;
