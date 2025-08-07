// composables/taskflow/usePropagation.ts
import { ref } from "vue";
import type { Ref } from "vue";
import type {
  TaskFlowNode,
  NodeData,
  TaskFlowEdge,
  CumulativeContextWrapper,
  CumulativeContextBlob,
} from "~/types/taskflow"; // Ajuste o caminho se necessário
import { getNodeHandler } from "~/lib/nodeHandlers";
import { useCumulativeContext } from "./useCumulativeContext";
// useGraphOperations não é diretamente usado aqui, mas a store principal o usará.

export function usePropagation() {
  const {
    buildCompleteCumulativeContextForNode,
    getContextBlobFromNode,
    getDirectParentOutputsForHandler, // Usado para preparar input para handler.processInput
  } = useCumulativeContext();

  /**
   * Propaga o output de um nó fonte para um nó filho específico.
   * Atualiza o `inputData` e o `cumulativeContext` do nó filho.
   * Esta função NÃO dispara o `processInput` do filho; ela apenas atualiza seus inputs.
   *
   * @param parentNode O nó pai que está propagando seu output.
   * @param childNodeId O ID do nó filho que receberá o input.
   * @param allNodesRef Ref para a lista de todos os nós.
   * @param allEdgesRef Ref para a lista de todas as arestas.
   * @returns `true` se o nó filho foi atualizado, `false` caso contrário.
   */
  function propagateInputAndContextToChild(
    parentNode: TaskFlowNode,
    childNodeId: string,
    allNodesRef: Ref<TaskFlowNode[]>,
    allEdgesRef: Ref<TaskFlowEdge[]> // Necessário para buildCompleteCumulativeContextForNode
  ): boolean {
    const childNodeIndex = allNodesRef.value.findIndex(
      (n) => n.id === childNodeId
    );
    if (childNodeIndex === -1) {
      console.warn(
        `[usePropagation] Nó filho ${childNodeId} não encontrado para propagação.`
      );
      return false;
    }

    const childNode = allNodesRef.value[childNodeIndex];
    let childNodeDataCopy: NodeData;

    try {
      childNodeDataCopy = JSON.parse(JSON.stringify(childNode.data));
    } catch (e) {
      console.error(
        `[usePropagation] Erro ao clonar dados do nó filho ${childNodeId}.`,
        e
      );
      return false;
    }

    // 1. Atualizar inputData direto do pai
    childNodeDataCopy.inputData = {
      ...(childNodeDataCopy.inputData || {}),
      [parentNode.id]: parentNode.data.outputData ?? null, // Usa null se outputData for undefined
    };

    // 2. Reconstruir o cumulativeContext completo do filho
    // Esta chamada considera TODOS os pais atuais do childNode, incluindo o parentNode que acabou de propagar.
    const newCumulativeContext = buildCompleteCumulativeContextForNode(
      childNodeId,
      allNodesRef,
      allEdgesRef // Passa a Ref das arestas
    );
    childNodeDataCopy.cumulativeContext = newCumulativeContext;
    childNodeDataCopy.updated_at = new Date().toISOString();

    // Atualiza o nó filho na store (de forma reativa)
    const updatedChildNode: TaskFlowNode = {
      ...childNode,
      data: childNodeDataCopy,
    };
    allNodesRef.value.splice(childNodeIndex, 1, updatedChildNode);

    // FORÇAR REATIVIDADE
    allNodesRef.value = [...allNodesRef.value];
    return true;
  }

  /**
   * Dispara o processamento de um nó.
   * Isso envolve chamar o `handler.processInput` do nó, que pode ser uma operação assíncrona (ex: chamada de IA).
   * O resultado do `processInput` (novos `analyzedData`, `processInputError`, `outputData`) é então mesclado
   * de volta no nó na store.
   *
   * @param nodeId O ID do nó a ser processado.
   * @param allNodesRef Ref para a lista de todos os nós.
   * @param allEdgesRef Ref para a lista de todas as arestas. (Usado por getDirectParentOutputsForHandler)
   * @returns Uma promessa que resolve para um objeto indicando se o output do nó mudou e as atualizações de dados.
   */
  async function triggerNodeProcessing(
    nodeId: string,
    allNodesRef: Ref<TaskFlowNode[]>,
    allEdgesRef: Ref<TaskFlowEdge[]>
  ): Promise<{ outputChanged: boolean; updates?: Partial<NodeData> }> {
    const nodeIndex = allNodesRef.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      console.warn(
        `[usePropagation] Nó ${nodeId} não encontrado para processamento.`
      );
      return { outputChanged: false };
    }

    const nodeToProcess = allNodesRef.value[nodeIndex];
    if (!nodeToProcess.type) {
      console.warn(`[usePropagation] Nó ${nodeId} não tem tipo definido.`);
      return { outputChanged: false };
    }

    const handler = getNodeHandler(nodeToProcess.type);
    if (!handler || typeof handler.processInput !== "function") {
      console.warn(
        `[usePropagation] Handler ou processInput não encontrado para o tipo ${nodeToProcess.type}.`
      );
      // Mesmo sem processInput, podemos tentar gerar um output se generateOutput existir
      if (handler && typeof handler.generateOutput === "function") {
        try {
          const newOutput = await handler.generateOutput(nodeToProcess);
          const outputChanged =
            JSON.stringify(nodeToProcess.data.outputData) !==
            JSON.stringify(newOutput);
          return { outputChanged, updates: { outputData: newOutput ?? {} } };
        } catch (e) {
          console.error(
            `[usePropagation] Erro em generateOutput para nó ${nodeId} sem processInput:`,
            e
          );
          return {
            outputChanged: false,
            updates: {
              processInputError: `Erro em generateOutput: ${
                (e as Error).message
              }`,
            },
          };
        }
      }
      return { outputChanged: false };
    }

    // Prepara os `parentOutputs` que o handler.processInput espera
    // Usa getDirectParentOutputsForHandler do useCumulativeContext.
    const parentOutputsForHandler = getDirectParentOutputsForHandler(
      nodeId,
      allNodesRef,
      allEdgesRef
    );

    try {
      const handlerUpdates = await handler.processInput(
        nodeToProcess.data, // Passa o NodeData atual
        parentOutputsForHandler,
        $fetch // Adiciona o terceiro argumento fetchInstance
      );

      // `handlerUpdates` é um Partial<NodeData>
      // Precisamos verificar se o outputData dentro dele realmente mudou
      const outputChanged =
        JSON.stringify(nodeToProcess.data.outputData) !==
        JSON.stringify(handlerUpdates?.outputData);

      return { outputChanged, updates: handlerUpdates };
    } catch (error) {
      console.error(
        `[usePropagation] Erro ao processar inputs para o nó ${nodeId}:`,
        error
      );
      return {
        outputChanged: false,
        updates: {
          processInputError: `Erro no handler.processInput: ${
            (error as Error).message
          }`,
        },
      };
    }
  }

  /**
   * Orquestra a geração de output de um nó fonte e propaga esse output
   * (e o contexto atualizado) para todos os seus filhos diretos.
   *
   * @param sourceNodeId O ID do nó cujo output será propagado.
   * @param allNodesRef Ref para a lista de todos os nós.
   * @param allEdgesRef Ref para a lista de todas as arestas.
   * @returns Promise<void>
   */
  async function propagateOutputFromNode(
    sourceNodeId: string,
    allNodesRef: Ref<TaskFlowNode[]>,
    allEdgesRef: Ref<TaskFlowEdge[]>
  ): Promise<void> {
    const sourceNodeIndex = allNodesRef.value.findIndex(
      (n) => n.id === sourceNodeId
    );
    if (sourceNodeIndex === -1) {
      console.warn(
        `[usePropagation] Nó fonte ${sourceNodeId} não encontrado para propagação de output.`
      );
      return;
    }

    let sourceNode = allNodesRef.value[sourceNodeIndex]; // Use 'let' para permitir reatribuição

    if (!sourceNode.type) {
      console.warn(
        `[usePropagation] Nó fonte ${sourceNodeId} não tem tipo definido.`
      );
      return;
    }

    const handler = getNodeHandler(sourceNode.type);
    if (!handler || typeof handler.generateOutput !== "function") {
      console.warn(
        `[usePropagation] Handler ou generateOutput não encontrado para o tipo ${sourceNode.type}. Output não será propagado.`
      );
      // Mesmo sem output, atualizamos o timestamp e o contexto cumulativo do sourceNode
      // para que os filhos recebam pelo menos um contexto atualizado (com a versão do sourceNode).
      const currentSourceNodeDataCopy = JSON.parse(
        JSON.stringify(sourceNode.data)
      );
      currentSourceNodeDataCopy.updated_at = new Date().toISOString();

      // O cumulativeContext do sourceNode é atualizado com sua própria entrada (output e versão).
      // Esta lógica é um pouco circular se chamada aqui. O `cumulativeContext` de um nó
      // deve refletir seus PAIS. O output do sourceNode é o que vai para o `inputData`
      // e para a entrada `sourceNodeId` no `cumulativeContext` dos FILHOS.
      // O `cumulativeContext` do `sourceNode` em si é construído a partir de SEUS pais.
      // Portanto, aqui, apenas atualizamos o `updated_at` e o `outputData` (que seria null/vazio).
      currentSourceNodeDataCopy.outputData = {}; // Ou null, se preferir

      const updatedSourceNodeWithoutOutput: TaskFlowNode = {
        ...sourceNode,
        data: currentSourceNodeDataCopy,
      };
      allNodesRef.value.splice(
        sourceNodeIndex,
        1,
        updatedSourceNodeWithoutOutput
      );
      sourceNode = updatedSourceNodeWithoutOutput; // Atualiza a referência local

      // Continuar para propagar o "vazio" ou "sem output" para os filhos
      // para que eles possam limpar seus inputs se necessário.
    } else {
      // Gera o novo output do nó fonte
      const newOutput = await handler.generateOutput(sourceNode);

      // Compara o novo output com o outputData existente no nó.
      // Se não houver mudança significativa no output, podemos evitar a atualização e propagação.
      // No entanto, a propagação do `cumulativeContext` (que inclui a `version` do sourceNode)
      // ainda pode ser importante mesmo se o `outputData` não mudar.
      // Por simplicidade e robustez, vamos sempre atualizar o `updated_at` e propagar.
      const sourceNodeDataCopy = JSON.parse(JSON.stringify(sourceNode.data));
      sourceNodeDataCopy.outputData = newOutput ?? {}; // Usa {} se newOutput for null/undefined
      sourceNodeDataCopy.updated_at = new Date().toISOString();

      const updatedSourceNodeWithOutput: TaskFlowNode = {
        ...sourceNode,
        data: sourceNodeDataCopy,
      };
      allNodesRef.value.splice(sourceNodeIndex, 1, updatedSourceNodeWithOutput);
      sourceNode = updatedSourceNodeWithOutput; // Atualiza a referência local
    }

    // Propagar para os filhos
    const outgoingEdges = allEdgesRef.value.filter(
      (e) => e.source === sourceNodeId
    );
    for (const edge of outgoingEdges) {
      propagateInputAndContextToChild(
        sourceNode,
        edge.target,
        allNodesRef,
        allEdgesRef
      );
    }
  }

  return {
    propagateInputAndContextToChild,
    triggerNodeProcessing,
    propagateOutputFromNode,
  };
}
