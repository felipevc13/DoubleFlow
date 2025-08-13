// composables/taskflow/useTaskFlowPersistence.ts
import { ref } from "vue";
import { useSupabaseClient } from "#imports";

type TaskFlowNode = Record<string, any>;
type TaskFlowEdge = Record<string, any>;
type Viewport = Record<string, any>;

export function useTaskFlowPersistence() {
  const saving = ref(false);
  const supabase = useSupabaseClient();
  async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }

  async function loadFlow(taskId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("task_flows")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", user.id)
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
    // Proteção: não persistir estado vazio (evita sobrescrever o banco por engano)
    if (!Array.isArray(nodes) || !Array.isArray(edges)) return;
    if (nodes.length === 0 && edges.length === 0) {
      return;
    }
    const user = await getCurrentUser();
    // Using the top-level `supabase` client created via runtime config
    if (!user) return;

    saving.value = true;
    try {
      const { error } = await supabase
        .from("task_flows")
        .upsert([
          {
            id: taskId,
            user_id: user.id,
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
