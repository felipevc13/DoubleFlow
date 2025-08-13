import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defineEventHandler,
  getRouterParam,
  readBody,
  setResponseStatus,
  H3Event,
} from "h3";
import { getSupabase } from "~/server/utils/supabase";

// Define the structure of the request body
interface ResponseBody {
  question_id: string;
  response_value: any; // Can be string, number, array, object depending on question type
  respondent_session_id?: string;
  submission_id: string;
}

// Define the structure of a SurveyResponse (based on your DB schema and select)
interface SurveyResponse {
  id: string; // Assuming 'id' is the primary key and auto-generated
  survey_id: string;
  question_id: string;
  response_value: any;
  respondent_session_id: string | null;
  submission_id: string;
  created_at: string; // Assuming 'created_at' is auto-generated
  // Add other fields if they are part of the survey_responses table and selected
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<SurveyResponse | ErrorResponse> => {
    const client: SupabaseClient = getSupabase(event);
    const surveyId = getRouterParam(event, "survey_id"); // Matches directory name
    const body = await readBody<ResponseBody>(event);

    if (!surveyId) {
      setResponseStatus(event, 400); // Bad Request
      return { error: "Survey ID is required" };
    }

    const {
      question_id,
      response_value,
      respondent_session_id,
      submission_id,
    } = body;

    if (!question_id) {
      setResponseStatus(event, 400); // Bad Request
      return { error: "Invalid request body: question_id is required" };
    }
    // response_value can be null, but its key must be present
    if (response_value === undefined) {
      setResponseStatus(event, 400); // Bad Request
      return {
        error: "Invalid request body: response_value is required (can be null)",
      };
    }
    if (!submission_id) {
      setResponseStatus(event, 400); // Bad Request
      return { error: "Invalid request body: submission_id is required" };
    }

    try {
      const insertData = {
        survey_id: surveyId,
        question_id: question_id,
        response_value: response_value,
        respondent_session_id: respondent_session_id || null,
        submission_id: submission_id,
      };

      const { data, error } = await client
        .from("survey_responses")
        .insert(insertData)
        .select() // Select all columns from the inserted row
        .single(); // Expect a single row to be inserted

      if (error) {
        console.error(`[API] Error inserting survey response:`, error);
        setResponseStatus(event, 500); // Internal Server Error
        // Consider more specific error codes based on PostgrestError if needed
        return { error: error.message };
      }

      if (!data) {
        console.error(
          `[API] Failed to insert survey response, no data returned.`
        );
        setResponseStatus(event, 500); // Internal Server Error
        return { error: "Failed to save response" };
      }

      setResponseStatus(event, 201); // Created
      return data as SurveyResponse; // Return the newly created response record
    } catch (err: any) {
      console.error(`[API] Unexpected error saving survey response:`, err);
      setResponseStatus(event, 500); // Internal Server Error
      return { error: err.message || "An unexpected error occurred" };
    }
  }
);
