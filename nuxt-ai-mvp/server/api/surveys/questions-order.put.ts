import { getSupabaseAuth } from "~/server/utils/supabase";
import type {
  SupabaseClient,
  PostgrestError,
  PostgrestResponse,
} from "@supabase/supabase-js";
import type { H3Event } from "h3";

interface RequestBody {
  order: string[];
  survey_id: string;
}

// Define a type for the items in the results array
interface UpdateResultItem {
  questionId: string;
  data: any[] | null; // Supabase returns an array of updated records, or null
  error: PostgrestError | null;
  count: number | null;
}

interface SuccessResponse {
  success: boolean;
  results: UpdateResultItem[];
}

interface ErrorResponse {
  error: string;
  details?: PostgrestError;
  results?: UpdateResultItem[]; // Optionally include partial results on error
}

export default defineEventHandler(
  async (event: H3Event): Promise<SuccessResponse | ErrorResponse> => {
    const body = await readBody<RequestBody>(event);
    const { order, survey_id } = body;

    if (
      !Array.isArray(order) ||
      order.some((id) => typeof id !== "string") ||
      !survey_id ||
      typeof survey_id !== "string"
    ) {
      event.node.res.statusCode = 400;
      return {
        error:
          "Invalid request body: order (array of strings) and survey_id (string) are required.",
      };
    }

    if (order.length === 0) {
      // If an empty order is acceptable (e.g., to clear order), handle accordingly.
      // For now, assuming it implies no operation or should be an error if an update is expected.
      // To make it an error:
      // event.node.res.statusCode = 400;
      // return { error: 'Order array cannot be empty if an update is intended.' };
      // Or, to simply do nothing and return success:
      // return { success: true, results: [] };
    }

    const { supabase, user } = await getSupabaseAuth(event);
    if (!user) {
      event.node.res.statusCode = 401;
      return { error: "unauthorized" };
    }
    const results: UpdateResultItem[] = [];

    try {
      for (let idx = 0; idx < order.length; idx++) {
        const questionId = order[idx];
        // The .select() here will return the updated rows.
        // If you don't need the updated data back, you can remove .select().
        const response: PostgrestResponse<any> = await supabase
          .from("questions")
          .update({ order: idx })
          .eq("id", questionId)
          .eq("survey_id", survey_id) // Ensure the question belongs to the specified survey
          .select();

        results.push({
          questionId,
          data: response.data,
          error: response.error,
          count: response.count,
        });

        if (response.error) {
          console.error(
            `Error updating question ${questionId} for survey ${survey_id}:`,
            response.error
          );
          event.node.res.statusCode = 500; // Or 400 if it's a client-side issue like wrong ID
          return {
            error: `Erro ao atualizar pergunta ${questionId}`,
            details: response.error,
            results, // Return partial results
          };
        }
      }

      event.node.res.statusCode = 200;
      return { success: true, results };
    } catch (e: any) {
      console.error(
        `Unexpected error during question order update for survey ${survey_id}:`,
        e
      );
      event.node.res.statusCode = 500;
      return { error: e.message || "An unexpected error occurred.", results };
    }
  }
);
