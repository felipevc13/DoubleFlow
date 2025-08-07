// ⚠️  AUTO-GENERATED — DO NOT EDIT.
// This file is created by `scripts/generateTools.ts`

export const autoTools = [
  {
    id: "problem.update",
    nodeType: "problem",
    action: "update",
    langchainTool: "updateNode",
    needsApproval: true,
    approvalStyle: "visual",
    executionMode: "backend",
    promptPath: "problemRefine.md"
  },
  {
    id: "datasource.create",
    nodeType: "datasource",
    action: "create",
    langchainTool: "createNode",
    needsApproval: false,
    approvalStyle: undefined,
    executionMode: "backend",
    promptPath: undefined
  },
  {
    id: "datasource.delete",
    nodeType: "datasource",
    action: "delete",
    langchainTool: "deleteNode",
    needsApproval: false,
    approvalStyle: undefined,
    executionMode: "backend",
    promptPath: undefined
  }
] as const;
