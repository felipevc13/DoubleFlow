// composables/waitForNode.ts
import { nextTick } from "vue";
import { useVueFlow } from "@vue-flow/core";

export async function waitForNodeMounted(
  id: string,
  { tries = 50, delay = 40 } = {}
) {
  const { getNode } = useVueFlow();

  // Compat: em algumas versões getNode é uma função; em outras, um ComputedRef de função
  const callGetNode = (nid: string) => {
    const maybeRef = getNode as unknown as { value?: (id: string) => any };
    if (typeof (getNode as any) === "function") {
      return (getNode as any)(nid);
    }
    if (maybeRef && typeof maybeRef.value === "function") {
      return maybeRef.value(nid);
    }
    return undefined;
  };

  for (let i = 0; i < tries; i++) {
    await nextTick();

    // força recálculo de bounds/dimensões quando disponível
    try {
      const { updateNodeInternals } = useVueFlow() as any;
      if (typeof updateNodeInternals === "function") {
        updateNodeInternals(id);
      }
    } catch {}

    // aguarda um frame de pintura para garantir layout
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));

    const n = callGetNode(id);
    if (n?.id && n?.dimensions?.width && n?.dimensions?.height) return n;
    await new Promise((r) => setTimeout(r, delay));
  }
  const last = callGetNode(id);
  if (last?.id) return last as any;
  throw new Error(`[waitForNodeMounted] Nó ${id} não ficou pronto a tempo`);
}
