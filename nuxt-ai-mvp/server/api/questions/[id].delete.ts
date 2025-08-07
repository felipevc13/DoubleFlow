import { serverSupabaseClient } from "#supabase/server";
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
      event.node.res.statusCode = 400;
      return { error: "question id is required" };
    }

    const supabase: SupabaseClient = await serverSupabaseClient(event);
    const { error } = await supabase.from("questions").delete().eq("id", id);

    if (error) {
      event.node.res.statusCode = 500;
      return { error: error.message };
    }

    event.node.res.statusCode = 200;
    return { success: true };
  }
);
