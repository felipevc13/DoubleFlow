/**
 * Calcula a posição para um novo nó filho.
 * - Sempre posiciona o filho centralizado horizontalmente embaixo do pai.
 * - Usa um GAP vertical e horizontal configurável.
 * - Se já houver outros filhos, posiciona lado a lado com espaçamento.
 *
 * @param {Object} parentNode       - O nó pai ({ position, dimensions })
 * @param {Array}  existingChildren - Nós filhos já conectados ao pai (array de nodes)
 * @param {Object} newNodeDims      - Dimensões estimadas do novo nó ({ width, height })
 * @param {Object} options
 *     .gapY: espaço vertical mínimo (default 300)
 *     .gapX: espaço horizontal entre irmãos (default 40)
 *     .maxChildrenPerRow: máximo de filhos por linha (default 5)
 * @returns {Object} posição { x, y }
 */
import type { GraphNode } from "@vue-flow/core";
import type { XYPosition } from "~/types/taskflow";
import { getEstimatedDims } from "../../constants/nodeDimensions";

/**
 * Calcula a posição para um novo nó filho.
 * - Sempre posiciona o filho centralizado horizontalmente embaixo do pai.
 * - Usa um GAP vertical e horizontal configurável.
 * - Se já houver outros filhos, posiciona lado a lado com espaçamento.
 *
 * @param {Object} parentNode       - O nó pai ({ position, dimensions })
 * @param {Array}  existingChildren - Nós filhos já conectados ao pai (array de nodes)
 * @param {Object} newNodeDims      - Dimensões estimadas do novo nó ({ width, height })
 * @param {Object} options
 *     .gapY: espaço vertical mínimo (default 300)
 *     .gapX: espaço horizontal entre irmãos (default 40)
 *     .maxChildrenPerRow: máximo de filhos por linha (default 5)
 * @returns {Object} posição { x, y }
 */
interface CalculateChildNodePositionOptions {
  gapY?: number;
  gapX?: number;
}

/**
 * Calcula a posição para um novo nó filho em uma única linha horizontal,
 * populando do centro para fora em um padrão alternado (direita, esquerda, ...).
 * Nós já existentes nunca mudam de posição.
 *
 * @param parentNode - Nó pai ({ position, dimensions }).
 * @param existingChildren - Nós filhos já conectados ao pai (array de nós).
 * @param newNodeDims - Dimensões estimadas do novo nó ({ width, height }).
 * @param options - Opções de espaçamento (.gapY, .gapX).
 * @returns A posição { x, y } para o novo nó.
 */
export function calculateChildNodePosition(
  parentNode: GraphNode,
  existingChildren: GraphNode[] = [],
  newNodeDims?: { width: number; height: number },
  options: CalculateChildNodePositionOptions = {}
): XYPosition {
  // Usa dimensões estimadas globais se não forem fornecidas.
  const dims = newNodeDims ?? getEstimatedDims("default");

  const gapY = options.gapY ?? 160;
  const gapX = options.gapX ?? 50;

  if (!parentNode.position) {
    console.error(
      `[calculateChildNodePosition] Posição do nó pai ${parentNode.id} não definida!`
    );

    return { x: 0, y: 0 };
  }

  // --- LÓGICA REFINADA E MAIS ROBUSTA ---
  const parentHasRealWidth =
    parentNode.dimensions && parentNode.dimensions.width > 0;
  const parentWidth = parentHasRealWidth
    ? parentNode.dimensions.width
    : getEstimatedDims(parentNode.type).width;

  const parentHasRealHeight =
    parentNode.dimensions && parentNode.dimensions.height > 0;
  const parentHeight = parentHasRealHeight
    ? parentNode.dimensions.height
    : getEstimatedDims(parentNode.type).height;

  // 1. A posição Y é constante para todos os filhos, garantindo o alinhamento superior.
  const y = parentNode.position.y + parentHeight + gapY;

  // 2. O centro do nó pai é a nossa linha de referência vertical.
  const parentCenterX = parentNode.position.x + parentWidth / 2;

  // 3. O número de filhos existentes determina a posição do novo nó.
  const childIndex = existingChildren.length;

  if (childIndex === 0) {
    // O primeiro filho (índice 0) fica exatamente centralizado abaixo do pai.
    const x = parentCenterX - dims.width / 2;

    return { x, y };
  }

  // ---- Expansão meio‑para‑fora ----
  if (childIndex % 2 !== 0) {
    // ÍNDICES ÍMPARES (1, 3, 5…) → direita
    const rightmostChild = existingChildren.reduce((max, node) =>
      node.position.x > max.position.x ? node : max
    );

    const rightmostWidth = Math.max(
      rightmostChild.dimensions?.width && rightmostChild.dimensions.width > 0
        ? rightmostChild.dimensions.width
        : getEstimatedDims(rightmostChild.type).width,
      dims.width
    );

    const rightmostEdge = rightmostChild.position.x + rightmostWidth;

    const x = rightmostEdge + gapX;

    return { x, y };
  } else {
    // ÍNDICES PARES (2, 4, 6…) → esquerda
    const leftmostChild = existingChildren.reduce((min, node) =>
      node.position.x < min.position.x ? node : min
    );

    // Borda esquerda do nó mais à esquerda
    const leftmostEdge = leftmostChild.position.x;

    const x = leftmostEdge - gapX - dims.width;

    return { x, y };
  }
}

/**
 * Impede que a posição final fique fora da área visível do canvas.
 *
 * @param pos Posição candidata {x, y}
 * @param dims Dimensões do nó {width, height}
 * @param vp Viewport atual {x, y, width, height, zoom}
 * @param margin Margem de segurança em pixels (default = 50)
 * @returns XYPosition dentro dos limites da viewport.
 */
import type { Viewport } from "~/types/taskflow";
export function clampToViewport(
  pos: XYPosition,
  dims: { width: number; height: number },
  vp: Viewport | undefined,
  margin = 50
): XYPosition {
  if (!vp) {
    // Retorna a posição sem clamp se não tem viewport. Não quebra o app/teste.
    if (
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test"
    ) {
      console.warn(
        "[clampToViewport] Viewport não definido! Retornando posição sem clamp:",
        pos
      );
    }
    return pos;
  }
  const z = vp.zoom || 1;
  // Converte as coordenadas do viewport para o sistema de coordenadas do canvas (flow)
  const viewLeft = -vp.x / z;
  const viewTop = -vp.y / z;
  const viewRight = (-vp.x + vp.width) / z;
  const viewBottom = (-vp.y + vp.height) / z;

  // Calcula os limites permitidos para a posição (x,y) do nó
  const minX = viewLeft + margin / z;
  const minY = viewTop + margin / z;
  const maxX = viewRight - (dims.width + margin / z);
  const maxY = viewBottom - (dims.height + margin / z);

  return {
    x: Math.max(minX, Math.min(pos.x, maxX)),
    y: Math.max(minY, Math.min(pos.y, maxY)),
  };
}

/**
 * Verifica se um nó está totalmente visível na viewport atual do canvas.
 *
 * @param nodePos Posição do nó (canvas coordinates)
 * @param nodeDims Dimensões do nó {width, height}
 * @param vp Viewport atual {x, y, width, height, zoom}
 * @param padding Padding opcional em pixels (default = 0)
 * @returns boolean se o nó está 100% visível na viewport
 */
export function isNodeFullyVisibleInViewport(
  nodePos: XYPosition,
  nodeDims: { width: number; height: number },
  vp: Viewport,
  padding = 0
): boolean {
  if (!vp || vp.width === 0 || vp.height === 0) {
    console.warn(
      "[isNodeFullyVisibleInViewport] Viewport não inicializado ou com dimensões zero:",
      vp
    );
    return false;
  }
  const z = vp.zoom || 1;

  // Limites da viewport no sistema de coordenadas do canvas
  const vpLeft = -vp.x / z + padding / z;
  const vpTop = -vp.y / z + padding / z;
  const vpRight = (-vp.x + vp.width) / z - padding / z;
  const vpBottom = (-vp.y + vp.height) / z - padding / z;

  // Limites do nó no sistema de coordenadas do canvas
  const nodeLeft = nodePos.x;
  const nodeTop = nodePos.y;
  const nodeRight = nodePos.x + nodeDims.width;
  const nodeBottom = nodePos.y + nodeDims.height;

  const isVisible =
    nodeLeft >= vpLeft &&
    nodeRight <= vpRight &&
    nodeTop >= vpTop &&
    nodeBottom <= vpBottom;

  return isVisible;
}
