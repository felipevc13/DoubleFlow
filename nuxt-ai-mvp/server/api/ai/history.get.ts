import { getSupabaseWithAuth } from "~/server/utils/supabase";
import type { Tables, TablesInsert } from "~/types/supabase";

export default defineEventHandler(async (event) => {
  const { supabase, user } = await getSupabaseWithAuth(event);
  if (!user) return { history: [] };

  const taskId = getQuery(event).taskId as string;

  if (!taskId) return { history: [] };

  // Busca o histórico das mensagens da IA para essa taskId
  const { data, error } = (await supabase
    .from("agent_conversations")
    .select("history")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle()) as {
    data: Tables<"agent_conversations"> | null;
    error: any;
  };

  if (error) {
    console.error("Erro ao buscar histórico:", error);
    return { history: [] };
  }

  if (!data || !Array.isArray(data.history) || data.history.length === 0) {
    return {
      history: [
        {
          role: "agent",
          content:
            "Olá! Vamos definir o seu Problema Inicial. Para começar, preciso de algumas informações. Qual é o problema que você quer resolver? Seja o mais específico possível.",
        },
      ],
    };
  }

  // Caso haja histórico, retorna normalmente
  return {
    history: Array.isArray(data.history)
      ? data.history.map((item: any) => ({
          role: item.type === "human" ? "user" : "agent",
          content: item.data?.content || "",
        }))
      : [],
  };
});
