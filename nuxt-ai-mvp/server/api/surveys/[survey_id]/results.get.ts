import { getSupabase } from "~/server/utils/supabase";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
  H3Event,
} from "h3";

// Interface for a question as fetched from the DB
interface Question {
  id: string;
  questionText: string;
  type: string; // Consider a more specific string literal type e.g., 'intro' | 'text' | 'multiple-choice'
  options?: any[] | null; // Define more specifically if possible
  order: number | null;
}

// Interface for a raw survey response as fetched from the DB
interface SurveyResponseRaw {
  id: string;
  question_id: string;
  response_value: any;
  created_at: string; // ISO date string
  respondent_session_id: string | null;
  submission_id: string;
}

// Interface for the accumulator in the reduce function
interface SubmissionDataAccumulator {
  [submissionId: string]: {
    submission_id: string;
    submitted_at: string | null; // Will be updated to the latest response's created_at
    answers: Record<string, any>; // question_id -> response_value
    raw_responses: SurveyResponseRaw[];
  };
}

// Interface for the final structured submission
interface FinalSubmission {
  submission_id: string;
  submitted_at: string; // ISO date string
  answers: Record<string, any>; // question_id -> response_value
}

// Interface for the successful response of this endpoint
interface ResultsResponse {
  questions: Question[];
  submissions: FinalSubmission[];
}

// Interface for error responses
interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<ResultsResponse | ErrorResponse> => {
    const client: SupabaseClient = getSupabase(event);
    const surveyId = getRouterParam(event, "survey_id");

    if (!surveyId) {
      setResponseStatus(event, 400); // Bad Request
      return { error: "Survey ID is required" };
    }

    try {
      // 1. Fetch all questions for the survey
      const { data: questionsData, error: questionsError } = await client
        .from("questions")
        .select("id, questionText, type, options, order")
        .eq("survey_id", surveyId)
        .order("order", { ascending: true });

      if (questionsError) {
        console.error(
          `[API] Error fetching questions for survey ${surveyId}:`,
          questionsError
        );
        setResponseStatus(event, 500); // Internal Server Error
        return { error: questionsError.message };
      }

      const questions: Question[] = questionsData || [];
      const actualQuestions = questions.filter(
        (q) => q.type !== "intro" && q.type !== "thanks"
      );

      if (actualQuestions.length === 0) {
        return { questions: [], submissions: [] }; // No actual questions to process
      }

      // 2. Fetch all responses for the survey
      const { data: responsesData, error: responsesError } = await client
        .from("survey_responses")
        .select(
          "id, question_id, response_value, created_at, respondent_session_id, submission_id"
        )
        .eq("survey_id", surveyId);

      if (responsesError) {
        console.error(
          `[API] Error fetching responses for survey ${surveyId}:`,
          responsesError
        );
        setResponseStatus(event, 500); // Internal Server Error
        return { error: responsesError.message };
      }

      const responses: SurveyResponseRaw[] = responsesData || [];

      if (responses.length === 0) {
        return { questions: actualQuestions, submissions: [] }; // No responses yet
      }

      // 3. Group responses by submission_id
      const responsesBySubmission = responses.reduce<SubmissionDataAccumulator>(
        (acc, response) => {
          const submissionId = response.submission_id;
          if (!submissionId) {
            console.warn(
              `[API] Skipping response ID ${response.id} due to missing submission_id.`
            );
            return acc;
          }

          if (!acc[submissionId]) {
            acc[submissionId] = {
              submission_id: submissionId,
              submitted_at: null, // Placeholder
              answers: {},
              raw_responses: [],
            };
          }
          acc[submissionId].answers[response.question_id] =
            response.response_value;
          acc[submissionId].raw_responses.push(response);
          return acc;
        },
        {}
      );

      // 4. Convert grouped submissions into the final submissions array
      const submissions: FinalSubmission[] = Object.values(
        responsesBySubmission
      )
        .filter(
          (submissionData) =>
            submissionData.raw_responses &&
            submissionData.raw_responses.length > 0
        )
        .map((submissionData): FinalSubmission => {
          const latestResponse = submissionData.raw_responses.reduce(
            (latest, current) => {
              return new Date(current.created_at) > new Date(latest.created_at)
                ? current
                : latest;
            },
            submissionData.raw_responses[0] // Safe due to filter
          );
          return {
            submission_id: submissionData.submission_id,
            submitted_at: latestResponse.created_at,
            answers: submissionData.answers,
          };
        });

      submissions.sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() -
          new Date(a.submitted_at).getTime()
      );

      setResponseStatus(event, 200); // OK
      return { questions: actualQuestions, submissions };
    } catch (err: any) {
      console.error(
        `[API] Unexpected error fetching results for survey ${surveyId}:`,
        err
      );
      setResponseStatus(event, 500); // Internal Server Error
      return {
        error: err.message || "An unexpected error occurred processing results",
      };
    }
  }
);
