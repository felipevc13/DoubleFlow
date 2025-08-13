import { serverSupabase } from "~/server/utils/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defineEventHandler,
  getRouterParam,
  readBody,
  setResponseStatus,
  H3Event,
} from "h3";

// Define the structure of a Survey based on your select query
interface Survey {
  id: string;
  created_at: string; // Or Date
  user_id: string;
  task_id: string | null;
  is_active: boolean;
}

// Define the expected structure of the request body
interface UpdateSurveyBody {
  is_active: boolean;
  // Add other fields here if they can also be updated via PUT
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<Survey | ErrorResponse> => {
    const client: SupabaseClient = serverSupabase();
    const surveyId = getRouterParam(event, "id");
    const body = await readBody<UpdateSurveyBody>(event);

    if (!surveyId) {
      setResponseStatus(event, 400); // Bad Request
      return { error: "Survey ID is required" };
    }

    // Validate the is_active field in the body
    if (typeof body?.is_active !== "boolean") {
      setResponseStatus(event, 400); // Bad Request
      return { error: "Invalid request body: is_active (boolean) is required" };
    }

    const newStatus = body.is_active;

    try {
      const { data, error } = await client
        .from("surveys")
        .update({ is_active: newStatus })
        .eq("id", surveyId)
        .select("id, created_at, user_id, task_id, is_active");

      if (error) {
        console.error(`[API] Error updating survey ${surveyId}:`, error);
        setResponseStatus(event, 500); // Internal Server Error
        return { error: error.message };
      }

      if (!data || data.length === 0) {
        console.warn(
          `[API] Survey ${surveyId} not found or update failed (no data returned).`
        );
        setResponseStatus(event, 404); // Not Found
        return { error: "Survey not found or update failed" };
      }

      if (data.length > 1) {
        console.warn(
          `[API] Multiple surveys found/updated for ID ${surveyId}. Returning the first one.`
        );
      }

      const updatedSurvey: Survey = data[0] as Survey;
      setResponseStatus(event, 200); // OK
      return updatedSurvey;
    } catch (err: any) {
      console.error(`[API] Unexpected error updating survey ${surveyId}:`, err);
      setResponseStatus(event, 500); // Internal Server Error
      return { error: err.message || "An unexpected error occurred" };
    }
  }
);
