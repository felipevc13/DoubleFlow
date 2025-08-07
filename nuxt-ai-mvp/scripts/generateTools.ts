#!/usr/bin/env ts-node

/**
 * Generates `server/utils/agent/tools/auto/index.ts` from the node‑catalog
 * (`server/utils/agent/registry/nodeTypes.json`).
 *
 * Run:
 *   pnpm dlx ts-node scripts/generateTools.ts
 * or:
 *   npx ts-node scripts/generateTools.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve project root relative to this script location ---------------------------------
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

// Paths -------------------------------------------------------------------------------
const registryPath = path.join(
  projectRoot,
  "server/utils/agent/registry/nodeTypes.json"
);
const outDir = path.join(projectRoot, "server/utils/agent/tools/auto");
const outFile = path.join(outDir, "index.ts");

// Helpers -----------------------------------------------------------------------------
function abort(msg: string): never {
  console.error(`❌  ${msg}`);
  process.exit(1);
}

// Load catalog ------------------------------------------------------------------------
if (!fs.existsSync(registryPath)) {
  abort(`Catalog not found: ${registryPath}`);
}

let catalog: any;
try {
  catalog = JSON.parse(fs.readFileSync(registryPath, "utf8"));
} catch (err) {
  abort(`Failed to parse catalog JSON – ${err}`);
}

// Build output ------------------------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });

const toolEntries: string[] = [];

for (const [nodeType, conf] of Object.entries<any>(catalog)) {
  const actions = (conf as any).actions ?? {};
  for (const [action, spec] of Object.entries<any>(actions)) {
    const id = `${nodeType}.${action}`;
    const promptPath = spec.refinementPrompt
      ? `"${spec.refinementPrompt}"`
      : "undefined";

    toolEntries.push(`  {
    id: "${id}",
    nodeType: "${nodeType}",
    action: "${action}",
    langchainTool: "${spec.tool}",
    needsApproval: ${spec.needsApproval ?? false},
    approvalStyle: ${
      spec.approvalStyle ? `"${spec.approvalStyle}"` : "undefined"
    },
    executionMode: ${
      spec.executionMode ? `"${spec.executionMode}"` : '"backend"'
    },
    promptPath: ${promptPath}
  }`);
  }
}

const fileContents = `// ⚠️  AUTO-GENERATED — DO NOT EDIT.
// This file is created by \`scripts/generateTools.ts\`

export const autoTools = [
${toolEntries.join(",\n")}
] as const;
`;

fs.writeFileSync(outFile, fileContents, "utf8");

console.log(`✅  autoTools written to ${path.relative(projectRoot, outFile)}`);
