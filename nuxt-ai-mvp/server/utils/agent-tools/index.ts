// server/utils/agent-tools/index.ts
import { createCreateNodeTool } from "./createNodeTool";
import { createDeleteNodeTool } from "./deleteNodeTool";
import { createUpdateNodeTool } from "./updateNodeTool";

// Adicione outras ferramentas aqui

export const availableTools = [
  createCreateNodeTool(),
  createDeleteNodeTool(),
  createUpdateNodeTool(),
];
