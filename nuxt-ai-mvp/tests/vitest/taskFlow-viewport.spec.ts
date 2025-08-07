import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
// Adjust the import path below to match your aliases (Nuxt usually maps "@/...")
import { useTaskFlowStore } from "~/stores/taskFlow";

// Stub $vueFlow globally to avoid fitView errors during unit tests
(globalThis as any).$vueFlow = { fitView: vi.fn() };

describe("taskFlow – clamp / viewport logic", () => {
  let store: ReturnType<typeof useTaskFlowStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTaskFlowStore();

    // Fake an active task so addNodeAndConnect doesn't early‑return
    store.currentTaskId = "test-task";

    // Pretend the user is looking at a canvas 800×600, zoom 1
    store.updateViewportAndSave({
      x: 0,
      y: 0,
      zoom: 1,
      width: 800,
      height: 600,
    });
  });

  const insideViewportAssertions = (node: any) => {
    // Margin defined in clampToViewport is 50 px
    const M = 50;
    expect(node).not.toBeNull();
    expect(node.position.x).toBeGreaterThanOrEqual(M);
    expect(node.position.x).toBeLessThanOrEqual(800 - M);
    expect(node.position.y).toBeGreaterThanOrEqual(M);
    expect(node.position.y).toBeLessThanOrEqual(600 - M);
  };

  it("places a node inside the viewport when target point is inside", async () => {
    const node = await store.addNodeAndConnect(
      "dataSource",
      null,
      null,
      null,
      400,
      300 // center of the viewport
    );

    insideViewportAssertions(node);
  });

  it("clamps a node into the viewport when target point is far outside", async () => {
    const node = await store.addNodeAndConnect(
      "dataSource",
      null,
      null,
      null,
      4000, // far outside
      4000
    );

    insideViewportAssertions(node);
  });
});
