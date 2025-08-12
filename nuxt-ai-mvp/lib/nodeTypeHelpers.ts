import nodeTypesRaw from "../config/nodeTypes-raw";
import type { NodeTypesMap, OperationPolicy } from "../types/nodeTypes";

function normalizePolicy(p: any): OperationPolicy {
  const render =
    p?.approvalRender ?? (p?.approvalStyle === "visual" ? "modal" : "chat");
  return {
    needsApproval: !!p?.needsApproval,
    approvalRender: render,
    diffFields: p?.diffFields ?? [],
    validateWith: p?.validateWith,
  };
}

export const nodeTypes: NodeTypesMap = Object.fromEntries(
  Object.entries(nodeTypesRaw as Record<string, any>).map(([k, v]) => {
    const ops = Object.fromEntries(
      Object.entries(v.operations ?? {}).map(([op, pol]) => [
        op,
        normalizePolicy(pol),
      ])
    );
    return [k, { ...v, operations: ops }];
  })
);

export function getTypeConfig(nodeType: string) {
  return nodeTypes[nodeType];
}
export function getPolicy(nodeType: string, operation: string) {
  return getTypeConfig(nodeType)?.operations?.[operation];
}
