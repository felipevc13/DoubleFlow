import { useTaskFlowStore } from "~/stores/taskFlow";
import { nextTick, type Ref } from "vue";
import { until } from "@vueuse/core";
import type { VueFlowStore } from "@vue-flow/core";

type FitToNodeOptions = {
  duration?: number;
  padding?: number;
};

export function useAnimatedFitToNode(vueFlowRef?: Ref<VueFlowStore | null>) {
  const taskFlowStore = useTaskFlowStore();

  async function getInstance(): Promise<VueFlowStore> {
    // Cenário 1: usamos o ref se foi passado
    if (vueFlowRef) {
      await (until(vueFlowRef) as any).toBeTruthy({
        timeout: 3000,
        throwOnTimeout: true,
      });
      return vueFlowRef.value as unknown as VueFlowStore;
    }

    // Cenário 2: fallback via store (espera o flag isVueFlowInstanceReady)
    await (until(() => taskFlowStore.isVueFlowInstanceReady) as any).toBeTruthy(
      {
        timeout: 5000,
        throwOnTimeout: true,
      }
    );
    return await taskFlowStore.vueFlowInstancePromise;
  }

  /**
   * Anima e centraliza o viewport até o nó alvo.
   * @param nodeId ID do nó a focar
   * @param options Opções de animação: duration, padding
   */
  async function animateToNode(
    nodeId: string,
    options: FitToNodeOptions = {}
  ): Promise<void> {
    const { duration = 600, padding = 0.2 } = options;

    try {
      // Usa a promise controlada da store para aguardar a instância de forma segura.
      const instance = await getInstance();

      await (until(() => instance.findNode(nodeId)) as any).toBeTruthy({
        timeout: 2000,
        throwOnTimeout: true,
      });

      await nextTick();

      const node = instance.findNode(nodeId);

      if (!node) {
        console.warn(
          `[useAnimatedFitToNode] Nó com ID '${nodeId}' não encontrado.`
        );
        return;
      }

      // @ts-ignore - fitView aceita opções conforme a documentação do VueFlow
      await instance.fitView({
        nodes: [nodeId],
        duration,
        padding,
      });
    } catch (err) {
      console.error("[useAnimatedFitToNode] Falha ao animar para o nó:", err);
    }
  }

  return { animateToNode };
}
