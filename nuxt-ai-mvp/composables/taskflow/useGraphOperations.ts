// composables/taskflow/useGraphOperations.ts
import { nextTick, type Ref } from "vue";
import { nanoid } from "nanoid";
import type { TaskFlowNode, TaskFlowEdge } from "../../types/taskflow";

export function useGraphOperations() {
  /**
   * Adiciona um nó ao array de nós de forma reativa.
   * Garante que não haja duplicatas de ID e que um novo array seja atribuído para reatividade.
   *
   * @param nodesRef Ref para o array de TaskFlowNode.
   * @param nodeToAdd O TaskFlowNode a ser adicionado.
   */
  async function addNodeToState(
    nodesRef: Ref<TaskFlowNode[]>,
    nodeToAdd: TaskFlowNode
  ): Promise<void> {
    if (nodesRef.value.some((n) => n.id === nodeToAdd.id)) {
      console.warn(
        `[useGraphOperations] Tentativa de adicionar nó com ID duplicado: ${nodeToAdd.id}. Ignorando.`
      );
      return Promise.resolve();
    }
    // Cria um novo array para garantir a reatividade do Vue
    nodesRef.value = [...nodesRef.value, nodeToAdd];
    await nextTick();
  }

  /**
   * Remove um nó e suas arestas conectadas do estado.
   * Retorna o nó removido e as arestas afetadas.
   *
   * @param nodesRef Ref para o array de TaskFlowNode.
   * @param edgesRef Ref para o array de TaskFlowEdge.
   * @param nodeId O ID do nó a ser removido.
   * @returns Um objeto contendo o nó removido e as arestas afetadas, ou undefined se o nó não foi encontrado.
   */
  function removeNodeFromState(
    nodesRef: Ref<TaskFlowNode[]>,
    edgesRef: Ref<TaskFlowEdge[]>,
    nodeId: string
  ):
    | { removedNode?: TaskFlowNode; affectedEdges?: TaskFlowEdge[] }
    | undefined {
    const nodeIndex = nodesRef.value.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) {
      console.warn(
        `[useGraphOperations] Nó com ID ${nodeId} não encontrado para remoção.`
      );
      return undefined;
    }

    const removedNode = nodesRef.value[nodeIndex];

    // Remove o nó (novo array para reatividade)
    const newNodes = nodesRef.value.filter((n) => n.id !== nodeId);
    nodesRef.value = newNodes;

    // Remove arestas conectadas
    const affectedEdges = edgesRef.value.filter(
      (e) => e.source === nodeId || e.target === nodeId
    );
    const newEdges = edgesRef.value.filter(
      (e) => e.source !== nodeId && e.target !== nodeId
    );
    edgesRef.value = newEdges;

    return { removedNode, affectedEdges };
  }

  /**
   * Adiciona uma aresta ao array de arestas de forma reativa.
   * Valida se os nós source e target existem e se a aresta já não existe.
   *
   * @param edgesRef Ref para o array de TaskFlowEdge.
   * @param allNodesRef Ref para o array de todos os TaskFlowNode (para validação).
   * @param partialEdge Dados parciais da aresta a ser criada (source e target são obrigatórios).
   * @returns A TaskFlowEdge criada e adicionada, ou null se a adição falhar.
   */
  function addEdgeToState(
    edgesRef: Ref<TaskFlowEdge[]>,
    allNodesRef: Ref<TaskFlowNode[]>,
    partialEdge: Partial<TaskFlowEdge>
  ): TaskFlowEdge | null {
    if (!partialEdge.source || !partialEdge.target) {
      console.warn(
        "[useGraphOperations][addEdgeToState] Source ou Target faltando:",
        partialEdge
      );
      return null;
    }

    // Validação de existência dos nós
    const sourceNodeExists = allNodesRef.value.some(
      (n) => n.id === partialEdge.source
    );
    const targetNodeExists = allNodesRef.value.some(
      (n) => n.id === partialEdge.target
    );

    if (!sourceNodeExists || !targetNodeExists) {
      console.warn(
        `[useGraphOperations][addEdgeToState] Source node (${partialEdge.source}, exists: ${sourceNodeExists}) ou target node (${partialEdge.target}, exists: ${targetNodeExists}) NÃO encontrados.`,
        { allNodeIds: allNodesRef.value.map((n) => n.id), partialEdge }
      );
      return null;
    }

    // Checa se já existe uma edge igual
    const existingEdge = edgesRef.value.find(
      (e) => e.source === partialEdge.source && e.target === partialEdge.target
    );
    if (existingEdge) {
      console.warn(
        `[useGraphOperations][addEdgeToState] Edge JÁ EXISTE de ${partialEdge.source} para ${partialEdge.target} com id ${existingEdge.id}.`,
        { existingEdge, allEdges: edgesRef.value }
      );
      return null;
    }

    const newEdge: TaskFlowEdge = {
      id:
        partialEdge.id ||
        `edge_${partialEdge.source}-${partialEdge.target}_${nanoid(5)}`,
      source: partialEdge.source,
      target: partialEdge.target,
      type: partialEdge.type || "smoothstep",
      events: {},
      sourceX: partialEdge.sourceX || 0,
      sourceY: partialEdge.sourceY || 0,
      targetX: partialEdge.targetX || 0,
      targetY: partialEdge.targetY || 0,
      label: partialEdge.label,
      animated: partialEdge.animated ?? false,
      selected: partialEdge.selected ?? false,
      data: partialEdge.data || {},
      ...partialEdge,
    };

    edgesRef.value = [...edgesRef.value, newEdge];

    return newEdge;
  }

  /**
   * Remove uma aresta do estado.
   * Retorna a aresta removida.
   *
   * @param edgesRef Ref para o array de TaskFlowEdge.
   * @param edgeId O ID da aresta a ser removida.
   * @returns A TaskFlowEdge removida, ou null se não encontrada.
   */
  function removeEdgeFromState(
    edgesRef: Ref<TaskFlowEdge[]>,
    edgeId: string
  ): TaskFlowEdge | null {
    const edgeIndex = edgesRef.value.findIndex((e) => e.id === edgeId);
    if (edgeIndex === -1) {
      console.warn(
        `[useGraphOperations][removeEdgeFromState] Edge with ID ${edgeId} not found for removal.`,
        { availableEdgeIds: edgesRef.value.map((e) => e.id) }
      );
      return null;
    }

    const removedEdge = edgesRef.value[edgeIndex];
    const newEdges = edgesRef.value.filter((e) => e.id !== edgeId);
    edgesRef.value = newEdges;

    return removedEdge;
  }

  return {
    addNodeToState,
    removeNodeFromState,
    addEdgeToState,
    removeEdgeFromState,
  };
}
