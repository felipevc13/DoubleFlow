import { serverSupabaseClient } from "#supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { H3Event } from "h3";
import { getQuery } from "h3"; // Assuming getUserFromEvent is also from h3 or a similar utility

// Define a type for the user object (adjust based on actual structure)
interface User {
  id: string;
  // Add other user properties if available and needed
}

// Define a type for the query parameters
interface QueryParams {
  task_flow_id?: string;
}

// Define a type for the survey data (adjust based on your actual 'surveys' table schema)
interface Survey {
  id: string;
  task_flow_id: string;
  user_id: string;
  // Add other survey properties
  [key: string]: any; // Allow other properties
}

// Define a type for the successful response
interface SuccessResponse {
  surveys: Survey[];
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
}

// Placeholder for getUserFromEvent if it's a custom utility.
// If it's from a library, ensure the import is correct.
// For now, assuming it's globally available or correctly imported elsewhere by Nuxt.
declare function getUserFromEvent(event: H3Event): Promise<User | null>;

export default defineEventHandler(
  async (event: H3Event): Promise<SuccessResponse | ErrorResponse> => {
    const query = getQuery(event) as QueryParams;
    const { task_flow_id } = query;

    if (!task_flow_id) {
      event.node.res.statusCode = 400; // Bad Request
      return { error: "task_flow_id is required" };
    }

    const user: User | null = await getUserFromEvent(event);
    if (!user?.id) {
      event.node.res.statusCode = 401; // Unauthorized
      return { error: "Usuário não autenticado" };
    }

    const supabase: SupabaseClient = await serverSupabaseClient(event); // Correctly initialize client
    const { data, error } = await supabase
      .from("surveys")
      .select("*") // Consider selecting specific columns for better performance and type safety
      .eq("task_flow_id", task_flow_id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching surveys:", error);
      event.node.res.statusCode = 500; // Internal Server Error
      return { error: error.message };
    }

    event.node.res.statusCode = 200; // OK
    return { surveys: (data as Survey[]) || [] }; // Ensure data is cast and handle null case
  }
);
