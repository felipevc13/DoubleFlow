// composables/taskflow/useCumulativeContext.ts
import { ref } from "vue";
import type { Ref } from "vue";
import pako from "pako";
import type {
  TaskFlowNode,
  NodeData,
  CumulativeContextWrapper,
  CumulativeContextBlob,
  AncestorContextData,
  TaskFlowEdge,
} from "~/types/taskflow"; // Ajuste o caminho se os tipos estiverem em outro lugar

// --- Funções Auxiliares Internas (Movidas de utils/nodeContext.ts) ---

/**
 * Descomprime o cumulativeContext se estiver comprimido.
 * @param contextWrapper - O objeto de contexto { compressed: boolean, blob: string | object }.
 * @returns O objeto de contexto descomprimido, ou um objeto vazio se a entrada for inválida/vazia.
 */
export function decompressContextBlob(
  contextWrapper: CumulativeContextWrapper | null | undefined
): CumulativeContextBlob {
  if (!contextWrapper || !contextWrapper.blob) {
    return {};
  }

  if (contextWrapper.compressed) {
    if (typeof contextWrapper.blob !== "string") {
      console.error(
        "[useCumulativeContext] Erro de descompressão: blob não é uma string quando compressed é true.",
        contextWrapper
      );
      return {};
    }
    try {
      const binaryString = atob(contextWrapper.blob);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const decompressedString = pako.ungzip(bytes, { to: "string" });
      return JSON.parse(decompressedString);
    } catch (error) {
      console.error(
        "[useCumulativeContext] Erro ao descomprimir contexto:",
        error,
        "ContextWrapper:",
        {
          ...contextWrapper,
          blob: contextWrapper.blob.substring(0, 100) + "...",
        } // Log truncado
      );
      return {};
    }
  } else {
    if (
      typeof contextWrapper.blob === "object" &&
      contextWrapper.blob !== null
    ) {
      // Retorna um clone para evitar mutações no estado original da store se o blob for um objeto
      try {
        return JSON.parse(
          JSON.stringify(contextWrapper.blob)
        ) as CumulativeContextBlob;
      } catch (e) {
        console.error(
          "[useCumulativeContext] Erro ao clonar blob não comprimido (objeto inválido?):",
          e,
          contextWrapper.blob
        );
        return {};
      }
    } else if (contextWrapper.blob === null) {
      // Permite blob nulo se não comprimido
      return {};
    }
    console.warn(
      "[useCumulativeContext] Blob não comprimido não é um objeto válido ou é nulo. Retornando objeto vazio. Blob:",
      contextWrapper.blob
    );
    return {};
  }
}

/**
 * Comprime um objeto de contexto se seu tamanho stringificado exceder um limite.
 * @param contextObject - O objeto de contexto bruto.
 * @param threshold - O limite de tamanho em bytes (padrão: 200 kB).
 * @returns A estrutura de contexto pronta para armazenamento.
 */
function compressContextIfNeeded(
  contextObject: CumulativeContextBlob,
  threshold: number = 200 * 1024
): CumulativeContextWrapper {
  try {
    // Garante que contextObject seja sempre um objeto, mesmo que vazio.
    const safeContextObject =
      typeof contextObject === "object" && contextObject !== null
        ? contextObject
        : {};
    const contextString = JSON.stringify(safeContextObject);

    if (contextString.length > threshold) {
      const compressedData: Uint8Array = pako.gzip(contextString);
      let binaryString = "";
      // Nota: new TextDecoder('latin1').decode(compressedData) seria mais eficiente mas pode ter problemas de compatibilidade.
      for (let i = 0; i < compressedData.length; i++) {
        binaryString += String.fromCharCode(compressedData[i]);
      }
      const base64String = btoa(binaryString);
      return { compressed: true, blob: base64String };
    } else {
      return { compressed: false, blob: safeContextObject };
    }
  } catch (error) {
    console.error(
      "[useCumulativeContext] Erro durante a verificação de compressão:",
      error,
      "Objeto de Contexto (chaves):",
      Object.keys(contextObject || {})
    );
    // Fallback seguro: não comprime se houver erro.
    return { compressed: false, blob: contextObject || {} };
  }
}

/**
 * Mescla dois objetos de contexto com base no timestamp de versão de cada entrada.
 * Mantém a entrada com o número de versão maior.
 * Se a entrada `incomingEntry` tiver `output` como `undefined` ou `null` ou `{}` (objeto vazio não array),
 * e sua versão for >= à existente, a entrada existente é removida.
 * @param existingCtx - O objeto de contexto atual.
 * @param incomingCtx - O novo objeto de contexto a ser mesclado.
 * @returns O objeto de contexto mesclado.
 */
function mergeContextsByVersion(
  existingCtx: CumulativeContextBlob,
  incomingCtx: CumulativeContextBlob
): CumulativeContextBlob {
  const merged: CumulativeContextBlob = { ...existingCtx };

  for (const key in incomingCtx) {
    if (!Object.prototype.hasOwnProperty.call(incomingCtx, key)) continue;

    const incomingEntry = incomingCtx[key];
    const incomingVersion =
      typeof incomingEntry?.version === "number" &&
      !isNaN(incomingEntry.version)
        ? incomingEntry.version
        : 0; // Trata NaN como 0
    const incomingOutput = incomingEntry?.output;
    const incomingType = incomingEntry?.type;

    // Considerar o output como "vazio" se for undefined, null, ou um objeto vazio (mas não um array vazio)
    const isIncomingOutputEffectivelyEmpty =
      incomingOutput === undefined ||
      incomingOutput === null ||
      (typeof incomingOutput === "object" &&
        !Array.isArray(incomingOutput) &&
        Object.keys(incomingOutput).length === 0);

    const existingEntry = merged[key];
    const existingVersion =
      typeof existingEntry?.version === "number" &&
      !isNaN(existingEntry.version)
        ? existingEntry.version
        : -1; // Trata NaN como -1 para dar preferência ao incoming

    if (isIncomingOutputEffectivelyEmpty) {
      // Se o output do incoming é efetivamente vazio e sua versão é mais recente ou igual,
      // remove a entrada existente do merged.
      if (existingEntry && incomingVersion >= existingVersion) {
        delete merged[key];
      }
    } else {
      // Se o output do incoming não é vazio:
      // Adiciona/atualiza se não existir ou se a versão do incoming for mais recente.
      if (!existingEntry || incomingVersion > existingVersion) {
        merged[key] = { ...incomingEntry }; // Inclui output, version, e type
      } else if (incomingVersion === existingVersion) {
        // Se as versões são iguais, precisamos de uma regra de desempate.
        // Por exemplo, podemos mesclar os outputs se forem objetos, ou preferir o incoming.
        // Para simplificar, vamos preferir o incoming se as versões forem iguais,
        // assumindo que uma nova propagação com a mesma versão significa uma atualização.
        // Isso pode ser ajustado conforme necessário.
        // No entanto, o atual `mergeByVersion` já substitui se `>` for verdadeiro.
        // Se as versões são estritamente iguais, o comportamento original era manter `existingCtx`.
        // Para ser mais explícito com o `type`: se o `type` do `incomingEntry` for diferente
        // e a versão for a mesma, podemos preferir atualizar.
        // Por ora, a lógica `!existingEntry || incomingVersion > existingVersion` já cobre bem.
        // O caso de `incomingVersion === existingVersion` manterá o `existingEntry` a menos que queiramos mudar.
        // Vamos manter o comportamento atual: só substitui se a versão for MAIOR.
      }
    }
  }
  return merged;
}

/**
 * Recupera e descomprime o `cumulativeContext` de um nó de forma global.
 * Esta função pode ser usada diretamente sem precisar instanciar o composable.
 * @param node - O objeto do nó do TaskFlow.
 * @returns O CumulativeContextBlob descomprimido, ou um objeto vazio se não houver contexto.
 */
export function getContextBlobFromNode(
  node: TaskFlowNode | null | undefined
): CumulativeContextBlob {
  if (!node || !node.data || !node.data.cumulativeContext) {
    return {};
  }
  return decompressContextBlob(node.data.cumulativeContext);
}

// --- Composable Exportado ---

export function useCumulativeContext() {
  /**
   * Constrói o `cumulativeContext` completo para um nó específico,
   * agregando os contextos de todos os seus pais diretos.
   * @param nodeId - O ID do nó para o qual construir o contexto.
   * @param allNodesRef - Uma Ref para o array de todos os nós no fluxo.
   * @param allEdgesRef - Uma Ref para o array de todas as arestas no fluxo.
   * @returns O `CumulativeContextWrapper` para o nó alvo.
   */
  function buildCompleteCumulativeContextForNode(
    nodeId: string,
    allNodesRef: Ref<TaskFlowNode[]>,
    allEdgesRef: Ref<TaskFlowEdge[]>
  ): CumulativeContextWrapper {
    let aggregatedContextBlob: CumulativeContextBlob = {};
    const incomingEdges = allEdgesRef.value.filter((e) => e.target === nodeId);

    for (const edge of incomingEdges) {
      const parentNode = allNodesRef.value.find((n) => n.id === edge.source);
      if (parentNode) {
        // 1. Mesclar o contexto CUMULATIVO do próprio pai
        const parentOwnCumulativeContextBlob =
          getContextBlobFromNode(parentNode);
        aggregatedContextBlob = mergeContextsByVersion(
          aggregatedContextBlob,
          parentOwnCumulativeContextBlob
        );

        // 2. Adicionar/Sobrescrever a entrada para o PAI DIRETO
        const parentVersion = parentNode.data.updated_at
          ? Date.parse(parentNode.data.updated_at)
          : Date.now(); // Usar timestamp de updated_at

        const parentDirectEntry: AncestorContextData = {
          type: parentNode.type,
          output: parentNode.data?.outputData ?? null, // Usa null se outputData for undefined
          version: isNaN(parentVersion) ? Date.now() : parentVersion,
        };
        aggregatedContextBlob = mergeContextsByVersion(aggregatedContextBlob, {
          [edge.source]: parentDirectEntry,
        });
      }
    }
    return compressContextIfNeeded(aggregatedContextBlob);
  }

  /**
   * Limpa a entrada direta de um `sourceNode` do `cumulativeContext` de um `targetNode`.
   * Isso é útil ao remover uma aresta.
   * @param currentTargetNodeCumulativeContext - O `CumulativeContextWrapper` atual do nó alvo.
   * @param removedSourceId - O ID do `sourceNode` cuja conexão foi removida.
   * @returns O novo `CumulativeContextWrapper` para o nó alvo após a limpeza.
   */
  function cleanDirectInputFromCumulativeContext(
    currentTargetNodeCumulativeContext: CumulativeContextWrapper,
    removedSourceId: string
  ): CumulativeContextWrapper {
    const currentContextBlob = decompressContextBlob(
      currentTargetNodeCumulativeContext
    );

    if (currentContextBlob[removedSourceId]) {
      delete currentContextBlob[removedSourceId];
      return compressContextIfNeeded(currentContextBlob);
    }
    // Se a entrada não existia, retorna o contexto original (potencialmente já comprimido)
    return currentTargetNodeCumulativeContext;
  }

  // --- Funções para ler o contexto para os Handlers ---
  // Esta função pode ser chamada por `usePropagation.triggerNodeProcessing`
  // para construir o argumento `parentOutputs` para `handler.processInput`.
  function getDirectParentOutputsForHandler(
    nodeId: string,
    allNodesRef: Ref<TaskFlowNode[]>,
    allEdgesRef: Ref<TaskFlowEdge[]>
  ): Record<string, any> {
    const parentOutputs: Record<string, any> = {};
    const incomingEdges = allEdgesRef.value.filter((e) => e.target === nodeId);

    for (const edge of incomingEdges) {
      const parentNode = allNodesRef.value.find((n) => n.id === edge.source);
      if (parentNode) {
        parentOutputs[edge.source] = {
          type: parentNode.type,
          output: parentNode.data?.outputData ?? {
            warning: "Parent output data missing during processing.",
          },
        };
      }
    }
    return parentOutputs;
  }

  return {
    decompressContextBlob,
    compressContextIfNeeded,
    mergeContextsByVersion,
    buildCompleteCumulativeContextForNode,
    cleanDirectInputFromCumulativeContext,
    getDirectParentOutputsForHandler, // Nova função exportada
  };
}
