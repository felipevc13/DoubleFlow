// composables/taskflow/useSmartNodePlacement.ts
import type { TaskFlowNode, XYPosition } from "~/types/taskflow";
import type { Dimensions } from "@vue-flow/core"; // Para as dimensões
import { clampToViewport } from "~/composables/taskflow/useNodeLayout";
import type { Viewport } from "~/types/taskflow";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Helper to stringify a Rect for easier reading in logs
function rectToString(r: Rect) {
  return `x:${r.x},y:${r.y},w:${r.width},h:${r.height}`;
}

function doRectanglesOverlap(rect1: Rect, rect2: Rect): boolean {
  // Lógica para verificar se dois retângulos se sobrepõem
  return !(
    (
      rect1.x >= rect2.x + rect2.width || // rect1 está à direita de rect2
      rect1.x + rect1.width <= rect2.x || // rect1 está à esquerda de rect2
      rect1.y >= rect2.y + rect2.height || // rect1 está abaixo de rect2
      rect1.y + rect1.height <= rect2.y
    ) // rect1 está acima de rect2
  );
}

const EXTRA_GAP = 8; // folga visual mínima entre nós mesmo após ficar “livre”

export function useSmartNodePlacement() {
  /**
   * Encontra uma posição livre no canvas para um novo nó,
   * tentando evitar sobreposições com nós existentes.
   *
   * @param allNodes - Array de todos os nós existentes no fluxo.
   * @param newNodeDimensions - Dimensões estimadas do novo nó.
   * @param initialCandidatePosition - A posição inicial preferida (ex: centro do viewport).
   * @param options - Opções como gridStep, searchRadius, safeMargin.
   * @param viewport - Viewport atual para clamp da posição.
   * @returns Uma XYPosition para o novo nó.
   */
  const findFreePosition = (
    allNodes: TaskFlowNode[],
    newNodeDimensions: Dimensions,
    initialCandidatePosition: XYPosition,
    options: {
      gridStep?: number;
      searchRadius?: number;
      safeMargin?: number;
    } = {},
    viewport?: Viewport
  ): XYPosition => {
    const {
      gridStep = 20,
      searchRadius = 500,
      safeMargin: rawSafeMargin,
    } = options;
    const safeMargin = Math.max(rawSafeMargin ?? 100, 100); // Increase safe margin to 100px for better spacing

    // Garante que vamos avaliar já considerando o padding do canvas,
    // evitando encontrar uma posição "livre" que depois passe a colidir
    // quando for clampada.
    const pad = 40; // mesmo valor‑default usado em clampToCanvas
    let candidateX = Math.max(pad, initialCandidatePosition.x);
    let candidateY = Math.max(pad, initialCandidatePosition.y);

    const newRectCandidate: Rect = {
      x: candidateX - safeMargin,
      y: candidateY - safeMargin,
      width: newNodeDimensions.width + safeMargin * 2,
      height: newNodeDimensions.height + safeMargin * 2,
    };

    let isOverlapping = false;
    for (const existingNode of allNodes) {
      if (existingNode.dimensions && existingNode.position) {
        // Garante que os nós existentes tenham dimensões e posição
        const existingRect: Rect = {
          x: existingNode.position.x - safeMargin,
          y: existingNode.position.y - safeMargin,
          width: existingNode.dimensions.width + safeMargin * 2,
          height: existingNode.dimensions.height + safeMargin * 2,
        };
        if (doRectanglesOverlap(newRectCandidate, existingRect)) {
          isOverlapping = true;
          break;
        }
      }
    }

    if (!isOverlapping) {
      // Confere de novo – usando dimensões reais conhecidas – se ainda há sobreposição
      const stillOverlaps = allNodes.some((n) => {
        if (!n.dimensions || !n.position) return false;
        const existingRect: Rect = {
          x: n.position.x - safeMargin,
          y: n.position.y - safeMargin,
          width: n.dimensions.width + safeMargin * 2,
          height: n.dimensions.height + safeMargin * 2,
        };
        return doRectanglesOverlap(newRectCandidate, existingRect);
      });

      return clampToViewport(
        { x: candidateX + EXTRA_GAP, y: candidateY + EXTRA_GAP },
        newNodeDimensions,
        viewport!
      );
    }

    // Estratégia de busca simples: espiral em torno da posição inicial
    // (Pode ser melhorada com algoritmos mais sofisticados se necessário)
    let currentX = initialCandidatePosition.x;
    let currentY = initialCandidatePosition.y;
    let leg = 0; // 0: R, 1: D, 2: L, 3: U
    let stepSize = gridStep;
    let stepsInLeg = 1;
    let currentSteps = 0;
    let attempts = 0;
    const maxAttempts = Math.pow(Math.ceil(searchRadius / gridStep) * 2 + 1, 2); // Aproximação do número de pontos na área de busca
    const visited = new Set<string>();

    while (attempts < maxAttempts) {
      // Aplica o clamp ANTES de verificar colisão
      const clampedSpiralX = Math.max(pad, currentX);
      const clampedSpiralY = Math.max(pad, currentY);
      const key = `${clampedSpiralX}:${clampedSpiralY}`;
      if (visited.has(key)) {
        // Já avaliamos este ponto – avança a espiral sem contar nova tentativa
      } else {
        visited.add(key);
        attempts++;

        console.debug("[findFreePosition] Tentativa", attempts, "candidato", {
          x: clampedSpiralX,
          y: clampedSpiralY,
        });

        newRectCandidate.x = clampedSpiralX - safeMargin;
        newRectCandidate.y = clampedSpiralY - safeMargin;
        isOverlapping = false;
        for (const existingNode of allNodes) {
          if (existingNode.dimensions && existingNode.position) {
            const existingRect: Rect = {
              x: existingNode.position.x - safeMargin,
              y: existingNode.position.y - safeMargin,
              width: existingNode.dimensions.width + safeMargin * 2,
              height: existingNode.dimensions.height + safeMargin * 2,
            };
            if (doRectanglesOverlap(newRectCandidate, existingRect)) {
              console.warn("[findFreePosition] Sobreposição detectada", {
                candidato: { x: clampedSpiralX, y: clampedSpiralY },
                candidatoRect: rectToString(newRectCandidate),
                existingNode: {
                  id: existingNode.id,
                  position: existingNode.position,
                  dimensions: existingNode.dimensions,
                },
                existingRect: rectToString(existingRect),
                safeMargin,
                attemptsSoFar: attempts,
                visitedCount: visited.size,
              });
              isOverlapping = true;
              break;
            }
          }
        }

        if (!isOverlapping) {
          // Confere de novo – usando dimensões reais conhecidas – se ainda há sobreposição
          const stillOverlaps = allNodes.some((n) => {
            if (!n.dimensions || !n.position) return false;
            const existingRect: Rect = {
              x: n.position.x - safeMargin,
              y: n.position.y - safeMargin,
              width: n.dimensions.width + safeMargin * 2,
              height: n.dimensions.height + safeMargin * 2,
            };
            return doRectanglesOverlap(newRectCandidate, existingRect);
          });

          return clampToViewport(
            { x: clampedSpiralX + EXTRA_GAP, y: clampedSpiralY + EXTRA_GAP },
            newNodeDimensions,
            viewport!
          );
        }
      }

      // Move para o próximo ponto na espiral
      switch (leg) {
        case 0: // Direita
          currentX += stepSize;
          break;
        case 1: // Baixo
          currentY += stepSize;
          break;
        case 2: // Esquerda
          currentX -= stepSize;
          break;
        case 3: // Cima
          currentY -= stepSize;
          break;
      }

      currentSteps++;
      if (currentSteps >= stepsInLeg) {
        leg = (leg + 1) % 4;
        currentSteps = 0;
        if (leg === 0 || leg === 2) {
          // Aumenta o tamanho do "braço" da espiral a cada duas pernas
          stepsInLeg++;
        }
      }
    }

    console.warn(
      "[findFreePosition] Retornando fallback após excesso de tentativas.",
      {
        fallback: {
          x:
            initialCandidatePosition.x +
            newNodeDimensions.width / 2 +
            gridStep +
            safeMargin,
          y:
            initialCandidatePosition.y +
            newNodeDimensions.height / 2 +
            gridStep +
            safeMargin,
        },
        safeMargin,
        newNodeDimensions,
      }
    );
    console.warn(
      "[useSmartNodePlacement] Não foi possível encontrar um local completamente livre após",
      maxAttempts,
      "tentativas. Retornando posição inicial com pequeno offset."
    );
    // Fallback: se não encontrar, retorna a posição inicial com um pequeno offset
    // (ou poderia ter uma lógica de fallback mais sofisticada)
    const fallbackPos = {
      x:
        initialCandidatePosition.x +
        newNodeDimensions.width +
        gridStep * 2 +
        safeMargin * 2, // Double the offset to ensure no overlap
      y:
        initialCandidatePosition.y +
        newNodeDimensions.height +
        gridStep * 2 +
        safeMargin * 2, // Double the offset to ensure no overlap
    };
    return clampToViewport(
      { x: fallbackPos.x + EXTRA_GAP, y: fallbackPos.y + EXTRA_GAP },
      newNodeDimensions,
      viewport!
    );
  };

  return { findFreePosition };
}
