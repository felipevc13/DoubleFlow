import { serverSupabase } from "~/server/utils/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
  H3Event,
} from "h3";

// Define the structure of a Survey based on your select query
interface Survey {
  id: string;
  created_at: string; // Or Date, if you parse it
  user_id: string; // Or a more specific type if available
  task_id: string | null; // Or a more specific type if available
  is_active: boolean;
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<Survey | ErrorResponse> => {
    const client: SupabaseClient = await serverSupabase();
    const surveyId = getRouterParam(event, "id");

    if (!surveyId) {
      setResponseStatus(event, 400); // Bad Request
      return { error: "Survey ID is required" };
    }

    try {
      const { data, error } = await client
        .from("surveys")
        .select("id, created_at, user_id, task_id, is_active")
        .eq("id", surveyId);

      if (error) {
        console.error(`[API] Error fetching survey ${surveyId}:`, error);
        setResponseStatus(event, 500); // Internal Server Error
        return { error: error.message };
      }

      if (!data || data.length === 0) {
        console.warn(
          `[API] Survey not found or no results for ID: ${surveyId}`
        );
        setResponseStatus(event, 404); // Not Found
        return { error: "Survey not found" };
      }

      if (data.length > 1) {
        console.warn(
          `[API] Multiple surveys found for ID ${surveyId}. Returning the first one.`
        );
      }

      // Explicitly cast the first element to Survey type
      const survey: Survey = data[0] as Survey;
      setResponseStatus(event, 200); // OK
      return survey;
    } catch (err: any) {
      // Catching 'any' or 'unknown' and then checking type is safer
      console.error(`[API] Unexpected error fetching survey ${surveyId}:`, err);
      setResponseStatus(event, 500); // Internal Server Error
      return { error: err.message || "An unexpected error occurred" };
    }
  }
);
