// composables/taskflow/useTaskFlowPersistence.ts
import { ref } from "vue";
import { useSupabaseClient, useSupabaseUser } from "#imports";
import type { TaskFlowNode, TaskFlowEdge, Viewport } from "~/types/taskflow";

export function useTaskFlowPersistence() {
  const supabase = useSupabaseClient();
  const saving = ref(false);

  async function loadFlow(taskId: string) {
    const user = useSupabaseUser();
    if (!user.value) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("task_flows")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", user.value.id)
      .maybeSingle(); // Changed from .single()

    if (error) {
      // Log o erro mas não necessariamente lança para todos os casos,
      // PGRST116 (0 rows for maybeSingle) não é um erro aqui.
      // Outros erros de DB (conexão, etc.) ainda seriam lançados implicitamente ou tratados.
      // Se o erro for especificamente sobre "0 rows" com maybeSingle, ele não deveria ocorrer.
      // Se for outro tipo de erro (ex: problema de rede, RLS), ele será lançado.
      console.error(
        "[useTaskFlowPersistence] Supabase error in loadFlow:",
        error
      );
      throw error;
    }

    if (!data) {
      return {
        nodes: [] as TaskFlowNode[],
        edges: [] as TaskFlowEdge[],
        viewport: {} as Partial<Viewport>,
      };
    }

    // CORREÇÃO: Verifica o tipo antes de fazer o parse.
    const nodes =
      typeof data.nodes === "string"
        ? (JSON.parse(data.nodes) as TaskFlowNode[])
        : (data.nodes as TaskFlowNode[]) || [];

    const edges =
      typeof data.edges === "string"
        ? (JSON.parse(data.edges) as TaskFlowEdge[])
        : (data.edges as TaskFlowEdge[]) || [];

    const viewport =
      typeof data.viewport === "string"
        ? (JSON.parse(data.viewport) as Partial<Viewport>)
        : (data.viewport as Partial<Viewport>) || {};

    return { nodes, edges, viewport };
  }

  // debounce ficará aqui dentro para ser compartilhado
  let timer: ReturnType<typeof setTimeout> | null = null;
  function saveFlowDebounced(payload: {
    taskId: string;
    nodes: TaskFlowNode[];
    edges: TaskFlowEdge[];
    viewport: Viewport;
  }) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveFlowNow(payload), 800);
  }

  async function saveFlowNow({
    taskId,
    nodes,
    edges,
    viewport,
  }: {
    taskId: string;
    nodes: TaskFlowNode[];
    edges: TaskFlowEdge[];
    viewport: Viewport;
  }) {
    const user = useSupabaseUser();
    const supabase = useSupabaseClient();
    if (!user.value) return;

    saving.value = true;
    try {
      const { error } = await supabase
        .from("task_flows")
        .upsert([
          {
            id: taskId,
            user_id: user.value.id,
            task_id: taskId,
            nodes: JSON.stringify(nodes),
            edges: JSON.stringify(edges),
            viewport: JSON.stringify(viewport),
            updated_at: new Date().toISOString(),
          },
        ])
        .select("id"); // force returning row so we can detect RLS failures
      if (error) {
        console.error(
          "[useTaskFlowPersistence] Supabase error in saveFlowNow:",
          error
        );
        // Optionally re‑throw so callers can react
        throw error;
      }
    } finally {
      saving.value = false;
    }
  }

  return { loadFlow, saveFlowDebounced, saving };
}
