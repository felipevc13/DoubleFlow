import { getSupabaseAuth } from "~/server/utils/supabase";
import type {
  SupabaseClient,
  User as SupabaseUser,
} from "@supabase/supabase-js";
import type { H3Event } from "h3";

// Define a type for the event context parameters
interface EventParams {
  survey_id?: string;
}

// Define a type for the request body (all potential fields for a new question)
interface QuestionRequestBody {
  type: string; // Consider a more specific string literal union if types are known
  questionText: string;
  options?: any[] | null; // Define more specifically if possible
  allowMultiple?: boolean | null;
  minValue?: number | null;
  maxValue?: number | null;
  startLabel?: string | null;
  endLabel?: string | null;
  isRequired?: boolean; // Will be defaulted to false if not provided or not boolean
}

// Define a type for the Survey object when fetching task_id
interface SurveyForTaskId {
  task_id: string;
}

// Define a type for existing questions when fetching order
interface ExistingQuestionOrder {
  order: number | null;
}

// Define a type for the newly created Question object (adjust based on your actual 'questions' table schema)
interface NewQuestion {
  id: string; // Assuming 'id' is auto-generated
  survey_id: string;
  task_id: string;
  type: string;
  questionText: string;
  options?: any[] | null;
  allowMultiple?: boolean | null;
  minValue?: number | null;
  maxValue?: number | null;
  startLabel?: string | null;
  endLabel?: string | null;
  isRequired: boolean;
  user_id: string;
  order: number;
  // Add all other properties of a question
  [key: string]: any; // Allow other properties
}

// Define a type for the successful response
interface SuccessResponse {
  question: NewQuestion;
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<SuccessResponse | ErrorResponse> => {
    const { supabase, user } = await getSupabaseAuth(event);

    const params = event.context.params as EventParams;
    const { survey_id } = params;

    const body = await readBody<QuestionRequestBody>(event);
    const {
      type,
      questionText,
      options,
      allowMultiple,
      minValue,
      maxValue,
      startLabel,
      endLabel,
      isRequired,
    } = body;

    // Ensure isRequired is always a boolean
    const safeIsRequired = typeof isRequired === "boolean" ? isRequired : false;

    if (!survey_id || !type || !questionText) {
      event.node.res.statusCode = 400;
      return { error: "survey_id, type e questionText são obrigatórios" };
    }
    if (!user?.id) {
      event.node.res.statusCode = 401;
      return { error: "Usuário não autenticado" };
    }

    // Fetch task_id from the corresponding survey
    const { data: surveyData, error: surveyError } = await supabase
      .from("surveys")
      .select("task_id")
      .eq("id", survey_id)
      .single<SurveyForTaskId>();

    if (surveyError || !surveyData?.task_id) {
      console.error(
        `Error fetching task_id for survey ${survey_id}:`,
        surveyError
      );
      event.node.res.statusCode = 404; // Or 500 if it's an unexpected DB error
      return {
        error:
          surveyError?.message ||
          "task_id não encontrado para o survey_id informado.",
      };
    }
    const task_id = surveyData.task_id;

    // Determine the next order value for the survey
    const { data: existingQuestionsData, error: orderError } = await supabase
      .from("questions")
      .select("order")
      .eq("survey_id", survey_id)
      .not("type", "in", '("intro","thanks")') // Exclude intro/thanks blocks
      .order("order", { ascending: false })
      .limit(1)
      .single<ExistingQuestionOrder | null>(); // Use single for potentially one or no result

    let nextOrder = 0;
    if (
      !orderError &&
      existingQuestionsData &&
      typeof existingQuestionsData.order === "number"
    ) {
      nextOrder = existingQuestionsData.order + 1;
    } else if (orderError) {
      // Log error but proceed with nextOrder = 0 if it's a "no rows" error (PGRST116)
      if (orderError.code !== "PGRST116") {
        // PGRST116: "Query returned no rows"
        console.error(
          `Error fetching max order for survey ${survey_id}:`,
          orderError
        );
        // Potentially return error if this is critical
      }
    }

    const insertPayload = {
      survey_id,
      task_id, // Fetched from survey
      type,
      questionText,
      options: options || null,
      allowMultiple: allowMultiple || null,
      minValue: minValue || null,
      maxValue: maxValue || null,
      startLabel: startLabel || null,
      endLabel: endLabel || null,
      isRequired: safeIsRequired,
      user_id: user.id,
      order: nextOrder,
    };

    const { data: newQuestionData, error: insertError } = await supabase
      .from("questions")
      .insert([insertPayload])
      .select("*") // Select all fields of the newly created question
      .single<NewQuestion>();

    if (insertError) {
      console.error(
        `Error inserting new question for survey ${survey_id}:`,
        insertError
      );
      event.node.res.statusCode = 500;
      return { error: insertError.message };
    }

    if (!newQuestionData) {
      console.error(
        `Failed to insert new question for survey ${survey_id}, no data returned.`
      );
      event.node.res.statusCode = 500;
      return { error: "Failed to create question." };
    }

    event.node.res.statusCode = 201; // Created
    return { question: newQuestionData };
  }
);
