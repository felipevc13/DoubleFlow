import { serverSupabase } from "~/server/utils/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { H3Event } from "h3";

interface EventParams {
  id?: string;
}

interface ErrorResponse {
  error: string;
}

interface SuccessResponse {
  success: boolean;
}

export default defineEventHandler(
  async (event: H3Event): Promise<ErrorResponse | SuccessResponse> => {
    const params = event.context.params as EventParams;
    const { id } = params;

    if (!id) {
      event.node.res.statusCode = 400; // Bad Request
      return { error: "survey id is required" };
    }

    // A linha abaixo estava faltando a instanciação do SupabaseClient
    const supabase: SupabaseClient = serverSupabase();
    const { error } = await supabase.from("surveys").delete().eq("id", id);

    if (error) {
      console.error("Error deleting survey:", error);
      event.node.res.statusCode = 500; // Internal Server Error
      return { error: error.message };
    }

    event.node.res.statusCode = 200; // OK
    return { success: true };
  }
);
