import type { INodeHandler } from "~/types/nodeHandler";

// Import individual handlers
import { problemNodeHandler } from "./problemNodeHandler";
import { dataSourceNodeHandler } from "./dataSourceNodeHandler";
import { surveyNodeHandler } from "./surveyNodeHandler";
import { defaultNodeHandler } from "./defaultNodeHandler"; // <<< Import default handler
import { analysisNodeHandler } from "./analysisNodeHandler";

// Import other handlers as they are created...

// Define the registry mapping node types to handlers
// Using a Map for potentially easier dynamic addition/removal if needed later
const nodeHandlerRegistry = new Map<string, INodeHandler>();

// Register the implemented handlers
nodeHandlerRegistry.set("problem", problemNodeHandler);
nodeHandlerRegistry.set("dataSource", dataSourceNodeHandler);
nodeHandlerRegistry.set("survey", surveyNodeHandler);
nodeHandlerRegistry.set("default", defaultNodeHandler); // <<< Register default handler
nodeHandlerRegistry.set("analysis", analysisNodeHandler);

// Register other handlers...

// Function to get a handler by type
export function getNodeHandler(nodeType: string): INodeHandler | undefined {
  const handler = nodeHandlerRegistry.get(nodeType);
  if (!handler) {
    console.warn(
      `[Node Handler Registry] No handler found for node type: ${nodeType}. Returning default handler.`
    );
    return nodeHandlerRegistry.get("default");
  }
  return handler;
}

// Export the registry itself if direct access is needed elsewhere (less common)
// export { nodeHandlerRegistry };
