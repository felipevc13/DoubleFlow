import { serverSupabaseClient } from '#supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { H3Event } from 'h3';

// Define a type for the event context parameters
interface EventParams {
  survey_id?: string;
}

// Define a type for the Question object (adjust based on your actual 'questions' table schema)
interface Question {
  id: string;
  survey_id: string;
  order: number | null;
  // Add all other properties of a question
  [key: string]: any; // Allow other properties
}

// Define a type for the successful response
interface SuccessResponse {
  questions: Question[];
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
}

export default defineEventHandler(
  async (event: H3Event): Promise<SuccessResponse | ErrorResponse> => {
    const params = event.context.params as EventParams;
    const { survey_id } = params;

    if (!survey_id) {
      event.node.res.statusCode = 400; // Bad Request
      return { error: 'survey_id is required' };
    }

    const supabase: SupabaseClient = await serverSupabaseClient(event);
    const { data, error } = await supabase
      .from('questions')
      .select('*') // Consider selecting specific columns for better performance and type safety
      .eq('survey_id', survey_id)
      .order('order', { ascending: true });

    if (error) {
      console.error(`Error fetching questions for survey ${survey_id}:`, error);
      event.node.res.statusCode = 500; // Internal Server Error
      return { error: error.message };
    }

    event.node.res.statusCode = 200; // OK
    return { questions: (data as Question[]) || [] }; // Ensure data is cast and handle null case
  }
);