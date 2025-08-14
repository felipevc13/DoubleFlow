import { useSidebarStore } from "~/stores/sidebar";
import { useVueFlow } from "@vue-flow/core";

export function useGlobalAdd(flowId = "task-flow") {
  const sidebarStore = useSidebarStore();
  const { project } = useVueFlow(flowId);

  function openAddAtFlowCenter(flowContainerEl?: HTMLElement | null) {
    const container =
      flowContainerEl ?? document.querySelector(".vue-flow-container");
    if (!container) return sidebarStore.openSidebar("addNode", null, null);
    const pane = container.querySelector?.(
      ".vue-flow__pane"
    ) as HTMLElement | null;
    if (!pane) return sidebarStore.openSidebar("addNode", null, null);

    const rect = pane.getBoundingClientRect();
    const screenCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    let flowCenter;
    try {
      flowCenter = project(screenCenter);
    } catch {
      return sidebarStore.openSidebar("addNode", null, null);
    }

    sidebarStore.openSidebar(
      "addNode",
      { targetFlowX: flowCenter.x, targetFlowY: flowCenter.y },
      null
    );
  }

  return { openAddAtFlowCenter };
}
