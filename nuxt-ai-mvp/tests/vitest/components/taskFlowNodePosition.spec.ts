import { setActivePinia, createPinia } from "pinia";
import { useTaskFlowStore } from "../../../stores/taskFlow";
import type { TaskFlowNode } from "../../../types/taskflow";
import { vi } from "vitest";
import { nextTick } from "vue";
import type { Node } from '@vue-flow/core';

describe("TaskFlow Node Position Persistence", () => {
  let taskFlowStore: ReturnType<typeof useTaskFlowStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    taskFlowStore = useTaskFlowStore();
    // Cria um nó inicial em uma posição conhecida
    taskFlowStore.nodes = [
      {
        id: "test-node-1",
        type: "dataSource",
        position: { x: 100, y: 100 },
        data: {
          inputData: {},
          outputData: {},
          cumulativeContext: { compressed: false, blob: {} },
          updated_at: null,
        },
        selected: false,
        positionAbsolute: { x: 100, y: 100 },
        resizing: false,
        events: {},
      } as TaskFlowNode,
    ];

    // Mock the updateNodePosition to prevent actual DB calls during tests
    vi.spyOn(taskFlowStore, "updateNodePosition").mockImplementation(
      async (nodeId: string, position: { x: number; y: number }) => {
        const node = taskFlowStore.nodes.find((n: Node) => n.id === nodeId);
        if (node) {
          node.position = { ...position };
        }
      }
    );
  });

  it("should keep the new node position after drag, even after nodes array is re-emitted (simulating VueFlow reset)", async () => {
    const nodeId = "test-node-1";
    const originalPosition = { x: 100, y: 100 };
    const newPosition = { x: 200, y: 250 };

    // Posição inicial
    expect(taskFlowStore.nodes.find((n: Node) => n.id === nodeId)?.position).toEqual(
      originalPosition
    );

    // Simula arrastar (drag)
    await taskFlowStore.updateNodePosition(nodeId, newPosition);
    expect(taskFlowStore.nodes.find((n) => n.id === nodeId)?.position).toEqual(
      newPosition
    );

    // Simula re-render ou "reset" de nodes como o Vue Flow faria (ex: store.nodes sobrescrito pelo snapshot)
    taskFlowStore.nodes = JSON.parse(JSON.stringify(taskFlowStore.nodes));

    // Agora, a posição deve continuar igual ao valor arrastado
    expect(taskFlowStore.nodes.find((n: Node) => n.id === nodeId)?.position).toEqual(
      newPosition
    );
  });
});
