import { getSupabaseAuth } from "~/server/utils/supabase";
import { validate as validateUUID } from "uuid";

export default defineEventHandler(async (event) => {
  // Obtém o parâmetro taskId da rota
  const taskId = getRouterParam(event, "taskId");
  const { supabase, user } = await getSupabaseAuth(event);

  console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
  console.log(
    "SUPABASE_KEY (prefixo):",
    process.env.SUPABASE_KEY?.slice(0, 12)
  );
  console.log("User context:", user);

  if (!user) {
    throw createError({ statusCode: 401, message: "Não autorizado" });
  }
  if (!taskId || !validateUUID(taskId)) {
    throw createError({
      statusCode: 400,
      message: "O ID da Tarefa precisa ser um UUID válido.",
    });
  }

  // Busca a conversa para este taskId (assumindo que agent_conversations.id = tasks.id)
  const { data, error } = await supabase
    .from("agent_conversations")
    .select("id, history")
    .eq("id", taskId)
    .single();

  // Se não encontrou, retorna vazio (não erro 404)
  if (error && error.code !== "PGRST116") {
    throw createError({ statusCode: 500, message: error.message });
  }

  // Se não há conversa, retorna estrutura padrão
  return data || { id: taskId, history: [] };
});
