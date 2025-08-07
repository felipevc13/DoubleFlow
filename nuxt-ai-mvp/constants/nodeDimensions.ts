// constants/nodeDimensions.ts
/**
 * Dimensões de fallback para cada tipo de nó.
 * Usamos Record<string, NodeDims> para permitir indexação dinâmica
 * sem perder checagem de tipos nas propriedades width/height.
 */
export interface NodeDims {
  width: number;
  height: number;
}

export const ESTIMATED_NODE_DIMENSIONS: Record<string, NodeDims> = {
  problem: { width: 300, height: 151 },
  dataSource: { width: 300, height: 180 },
  survey: { width: 350, height: 220 },
  default: { width: 300, height: 150 },
};

/**
 * Retorna a estimativa de dimensões para o tipo informado.
 * Se não houver entrada específica, cai no default.
 */
export function getEstimatedDims(type: string): NodeDims {
  return ESTIMATED_NODE_DIMENSIONS[type] ?? ESTIMATED_NODE_DIMENSIONS.default;
}
