import { serverSupabase } from "~/server/utils/supabase";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { H3Event } from "h3";

interface EventParams {
  survey_id?: string;
}

interface RequestBody {
  order: string[];
}

interface QuestionId {
  id: string;
}

interface SuccessResponse {
  success: boolean;
}

interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<SuccessResponse | ErrorResponse> => {
    const params = event.context.params as EventParams;
    const surveyId = params.survey_id;

    if (!surveyId) {
      event.node.res.statusCode = 400;
      return { error: "Survey ID is required." };
    }

    const body = await readBody<RequestBody>(event);
    const { order } = body;

    if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
      event.node.res.statusCode = 400;
      return { error: "Invalid order array: must be an array of strings." };
    }

    if (order.length === 0) {
      // Arguably, an empty order could be valid if it means clearing all orders,
      // but current logic implies it's for setting a new non-empty order.
      // For now, let's consider it an acceptable state that does nothing or implies clearing.
      // If it should be an error, uncomment the following:
      // event.node.res.statusCode = 400;
      // return { error: 'Order array cannot be empty.' };
    }

    const client: SupabaseClient = serverSupabase();

    try {
      // Optional: Verify all question IDs in the order belong to the survey
      // This adds an extra layer of validation.
      const { data: questionsInSurvey, error: fetchQuestionsError } =
        await client
          .from("questions")
          .select("id")
          .eq("survey_id", surveyId)
          .in("id", order); // Only check IDs present in the order array

      if (fetchQuestionsError) {
        console.error(
          `Error fetching questions for survey ${surveyId}:`,
          fetchQuestionsError
        );
        event.node.res.statusCode = 500;
        return { error: "Error verifying questions in survey." };
      }

      const questionIdsInSurvey = questionsInSurvey?.map((q) => q.id) || [];
      const invalidIds = order.filter(
        (id) => !questionIdsInSurvey.includes(id)
      );

      if (invalidIds.length > 0) {
        event.node.res.statusCode = 400;
        return {
          error: `Invalid question IDs in order: ${invalidIds.join(
            ", "
          )}. They do not belong to survey ${surveyId} or do not exist.`,
        };
      }

      // Create update promises
      const updatePromises = order.map(
        (questionId, idx) =>
          client
            .from("questions")
            .update({ order: idx })
            .eq("id", questionId)
            .eq("survey_id", surveyId) // Ensure question belongs to the survey
      );

      // Execute all updates
      const results = await Promise.all(updatePromises);

      // Check for errors in any of the updates
      const updateErrors = results
        .map((r) => r.error)
        .filter((e) => e !== null) as PostgrestError[];
      if (updateErrors.length > 0) {
        console.error(
          `Errors updating question order for survey ${surveyId}:`,
          updateErrors
        );
        // Consolidate error messages or return the first one
        event.node.res.statusCode = 500;
        return {
          error: `Failed to update order for some questions: ${updateErrors
            .map((e) => e.message)
            .join("; ")}`,
        };
      }

      event.node.res.statusCode = 200;
      return { success: true };
    } catch (e: any) {
      console.error(
        `Unexpected error updating question order for survey ${surveyId}:`,
        e
      );
      event.node.res.statusCode = 500;
      return { error: e.message || "An unexpected error occurred." };
    }
  }
);
