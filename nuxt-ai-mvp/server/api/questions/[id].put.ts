import { serverSupabase } from "~/server/utils/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { H3Event } from "h3";

// Define a type for the expected request body
interface QuestionUpdateBody {
  type?: string;
  questionText?: string;
  options?: any[]; // Consider defining a more specific type if possible
  allowMultiple?: boolean;
  allowOther?: boolean;
  minValue?: number;
  maxValue?: number;
  startLabel?: string;
  endLabel?: string;
  isRequired?: boolean;
  extra?: Record<string, any>; // Or a more specific type for 'extra'
}

// Define a type for the event context parameters
interface EventParams {
  id?: string;
}

// Define a type for the successful response
interface SuccessResponse {
  question: any; // Consider defining a more specific type for 'question' based on your DB schema
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<SuccessResponse | ErrorResponse> => {
    const params = event.context.params as EventParams;
    const { id } = params;
    const body: QuestionUpdateBody = await readBody(event);

    if (!id) {
      event.node.res.statusCode = 400; // Bad Request
      return { error: "question id is required" };
    }

    const supabase: SupabaseClient = serverSupabase();

    const { data, error } = await supabase
      .from("questions")
      .update({
        type: body.type,
        questionText: body.questionText,
        options: body.options,
        allowMultiple: body.allowMultiple,
        allowOther: body.allowOther,
        minValue: body.minValue,
        maxValue: body.maxValue,
        startLabel: body.startLabel,
        endLabel: body.endLabel,
        isRequired: body.isRequired,
        extra: body.extra,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating question:", error);
      event.node.res.statusCode = 500; // Internal Server Error
      return { error: error.message };
    }

    if (!data) {
      event.node.res.statusCode = 404; // Not Found
      return { error: "Question not found after update." };
    }

    event.node.res.statusCode = 200; // OK
    return { question: data };
  }
);
