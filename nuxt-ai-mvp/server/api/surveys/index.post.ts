import { serverSupabaseClient, serverSupabaseUser } from "#supabase/server";
import type {
  SupabaseClient,
  User as SupabaseUser,
} from "@supabase/supabase-js";
import type { H3Event } from "h3";

// Define a type for the request body
interface RequestBody {
  task_id: string;
}

// Define a type for the Survey object (based on your DB schema and select)
interface Survey {
  id: string;
  task_id: string;
  user_id: string;
  // Add other survey properties if selected or available
  [key: string]: any;
}

// Define a type for the Question/Block object (based on your DB schema)
interface QuestionBlock {
  survey_id: string;
  task_id: string;
  type: "intro" | "thanks" | string; // More specific types if available
  questionText: string;
  user_id: string;
  extra?: Record<string, any>;
  // Add other question properties
}

// Define a type for the successful response
interface SuccessResponse {
  survey: Survey;
}

// Define a type for error responses
interface ErrorResponse {
  error: string;
  survey?: Survey; // Optionally include survey if created before block error
}

export default defineEventHandler(
  async (event: H3Event): Promise<SuccessResponse | ErrorResponse> => {
    const supabase: SupabaseClient = await serverSupabaseClient(event);
    const body = await readBody<RequestBody>(event);
    const { task_id } = body;

    if (!task_id) {
      console.error("[API /api/surveys] task_id ausente no body:", body);
      event.node.res.statusCode = 400; // Bad Request
      return { error: "task_id is required" };
    }

    const user: SupabaseUser | null = await serverSupabaseUser(event);
    if (!user?.id) {
      event.node.res.statusCode = 401; // Unauthorized
      return { error: "Usuário não autenticado" };
    }

    // Create the survey
    const { data: survey, error: surveyError } = await supabase
      .from("surveys")
      .insert([{ task_id, user_id: user.id }])
      .select("*") // Consider selecting specific fields
      .single();

    if (surveyError) {
      console.error("[API /api/surveys] surveyError:", surveyError);
      event.node.res.statusCode = 500; // Internal Server Error
      return { error: surveyError.message };
    }

    if (!survey) {
      console.error(
        "[API /api/surveys] Failed to create survey, no data returned."
      );
      event.node.res.statusCode = 500; // Internal Server Error
      return { error: "Failed to create survey." };
    }

    // Create intro and thanks blocks
    const introDefault: QuestionBlock = {
      survey_id: survey.id,
      task_id: survey.task_id,
      type: "intro",
      questionText:
        "Bem-vindo à pesquisa! Por favor, leia as instruções antes de começar.",
      user_id: user.id,
      extra: {
        title: "Você foi convidado para participar de um estudo.",
        description:
          'Sua opinião é importante. Siga sua intuição durante a pesquisa e lembre-se:\n\n• Não tem problema se você travar em alguma parte do processo.\n• Você pode encerrar a pesquisa a qualquer momento.\n• Quando estiver pronto, clique em "Começar".',
      },
    };

    const thanksDefault: QuestionBlock = {
      survey_id: survey.id,
      task_id: survey.task_id,
      type: "thanks",
      questionText: "Obrigado por participar da pesquisa!",
      user_id: user.id,
      extra: {
        title: "Obrigado!",
        description:
          "Obrigado por dedicar seu tempo para participar desta sessão e nos ajudar a melhorar nosso produto.",
      },
    };

    const { error: blockError } = await supabase
      .from("questions")
      .insert([introDefault, thanksDefault]);

    if (blockError) {
      console.error("[API /api/surveys] blockError:", blockError);
      // Decide if the survey creation should be rolled back or if returning the survey with an error is acceptable
      event.node.res.statusCode = 500; // Internal Server Error
      return { error: blockError.message, survey }; // Return survey as it was created
    }

    event.node.res.statusCode = 201; // Created
    return { survey };
  }
);
