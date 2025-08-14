// lib/plusActions.ts (novo helper super fino)
import { useTaskFlowStore } from "~/stores/taskFlow";

export async function addFromPlusProgrammatically(
  targetType: string,
  originId: string,
  originPosition: { x: number; y: number },
  originHeight?: number,
  _options?: { initialData?: Record<string, any>; connectIfAllowed?: boolean }
) {
  // Note: _options currently unused because the store only supports 4 arguments
  const taskFlowStore = useTaskFlowStore();
  await taskFlowStore.requestAddNodeAndPrepareConnection(
    targetType,
    originId,
    originPosition,
    originHeight
  );
}
