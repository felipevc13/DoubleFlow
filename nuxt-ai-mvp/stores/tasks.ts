import { defineStore } from "pinia";
import { useSlug } from "../composables/useSlug";
import type {
  SupabaseClient,
  User as SupabaseUser,
  PostgrestError,
} from "@supabase/supabase-js";

// Interface for the problem_statement object within a Task
interface ProblemStatement {
  title: string;
  description: string;
  updated_at: string; // ISO date string
}

// Interface for a Task object (based on your DB schema and selects)
export interface Task {
  id: string;
  name: string;
  slug: string;
  problem_statement: ProblemStatement;
  user_id: string;
  created_at: string; // ISO date string
  // Add any other fields that are part of the 'tasks' table
  [key: string]: any; // Allow other properties for flexibility if schema varies
}

// Interface for the data payload when creating a new task
interface CreateTaskPayload {
  name: string;
  // Add other fields if task creation requires more than just a name initially
}

// Interface for the data payload when updating a task's name/slug
interface UpdateTaskPayload {
  name: string;
  // Potentially other updatable fields, but current logic only updates name/slug
}

// Interface for the data payload when updating a task's problem statement
interface UpdateProblemStatementPayload {
  title?: string;
  description?: string;
  // updated_at is handled internally
}

// Interface for the state of the tasks store
interface TasksState {
  tasks: Task[];
  // Consider adding loading/error states if needed for UI feedback
  // loading: boolean;
  // error: string | null;
}

export const useTasksStore = defineStore("tasks", {
  state: (): TasksState => ({
    tasks: [],
    // loading: false,
    // error: null,
  }),
  actions: {
    async createTask(
      supabase: SupabaseClient,
      taskData: CreateTaskPayload
    ): Promise<Task> {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { generateSlug } = useSlug();

      if (!user?.id) {
        throw new Error("Usuário não autenticado para criar tarefa.");
      }
      if (!taskData.name) {
        throw new Error("O nome da tarefa é obrigatório.");
      }

      const initialSlug = generateSlug(taskData.name);
      let uniqueSlug = initialSlug;
      let counter = 1;

      const initialProblemStatement: ProblemStatement = {
        title: taskData.name,
        description: "",
        updated_at: new Date().toISOString(),
      };

      while (true) {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            name: taskData.name,
            slug: uniqueSlug,
            problem_statement: initialProblemStatement,
            user_id: user.id,
          })
          .select()
          .single<Task>();

        if (error) {
          console.error("Erro ao inserir tarefa:", error);
          if (error.code === "23505") {
            // Unique constraint violation
            uniqueSlug = `${initialSlug}-${counter}`;
            counter++;
            continue;
          }
          throw new Error(`Falha ao criar tarefa: ${error.message}`);
        }
        if (!data) {
          // Should not happen if error is null, but good practice
          throw new Error("Falha ao criar tarefa: Nenhum dado retornado.");
        }

        await this.fetchTasks(supabase);
        return data;
      }
    },

    async updateTask(
      supabase: SupabaseClient,
      taskId: string,
      taskData: UpdateTaskPayload
    ): Promise<Task> {
      const { generateSlug } = useSlug();

      if (!taskData.name) {
        throw new Error("O nome da tarefa é obrigatório.");
      }

      const initialSlug = generateSlug(taskData.name);
      let uniqueSlug = initialSlug;
      let counter = 1;

      while (true) {
        const { data, error } = await supabase
          .from("tasks")
          .update({
            name: taskData.name,
            slug: uniqueSlug,
          })
          .eq("id", taskId)
          .select()
          .single<Task>();

        if (error) {
          console.error("Erro ao atualizar tarefa:", error);
          if (error.code === "23505") {
            // Unique constraint violation
            uniqueSlug = `${initialSlug}-${counter}`;
            counter++;
            continue;
          }
          throw new Error(`Falha ao atualizar tarefa: ${error.message}`);
        }
        if (!data) {
          throw new Error("Falha ao atualizar tarefa: Nenhum dado retornado.");
        }
        await this.fetchTasks(supabase);
        return data;
      }
    },

    async updateTaskProblemStatement(
      supabase: SupabaseClient,
      taskId: string,
      problemData: UpdateProblemStatementPayload
    ): Promise<Task> {
      const updatedProblemStatement: ProblemStatement = {
        title: problemData.title || "", // Default to empty string if undefined
        description: problemData.description || "", // Default to empty string
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
          .from("tasks")
          .update({
            problem_statement: updatedProblemStatement,
          })
          .eq("id", taskId)
          .select()
          .single<Task>();

        if (error) {
          console.error("Erro ao atualizar problem_statement:", error);
          throw new Error(
            `Falha ao atualizar problem_statement: ${error.message}`
          );
        }
        if (!data) {
          throw new Error(
            "Falha ao atualizar problem_statement: Nenhum dado retornado."
          );
        }

        const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          // Create a new object for reactivity
          this.tasks[taskIndex] = {
            ...this.tasks[taskIndex],
            problem_statement: { ...updatedProblemStatement }, // Ensure problem_statement is also a new object
          };
        }
        return data;
      } catch (err: any) {
        console.error("Erro ao atualizar problem_statement:", err.message);
        throw err;
      }
    },

    async deleteTask(supabase: SupabaseClient, taskId: string): Promise<void> {
      // First, delete all related surveys
      const { error: surveyError } = await supabase
        .from("surveys")
        .delete()
        .eq("task_id", taskId);

      if (surveyError) {
        console.error(
          "Erro ao excluir surveys relacionados à tarefa:",
          surveyError
        );
        throw new Error(
          `Falha ao excluir surveys relacionados: ${surveyError.message}`
        );
      }

      // Now, delete the task
      const { error: taskDeleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId);

      if (taskDeleteError) {
        console.error("Erro ao excluir tarefa no Supabase:", taskDeleteError);
        throw new Error(`Falha ao excluir tarefa: ${taskDeleteError.message}`);
      }

      await this.fetchTasks(supabase);
    },

    async fetchTaskBySlug(
      supabase: SupabaseClient,
      slug: string
    ): Promise<Task> {
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("slug", slug)
          .single<Task>();

        if (error) {
          console.error(
            "[tasks.ts] Erro ao buscar tarefa pelo slug:",
            error.message,
            error.code
          );
          if (error.code === "PGRST116" && attempt < maxRetries - 1) {
            // PGRST116: "Query returned no rows"
            console.warn(
              `Tarefa com slug ${slug} não encontrada, tentando novamente... (tentativa ${
                attempt + 1
              })`
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
            attempt++;
            continue;
          }
          throw new Error(`Falha ao buscar tarefa pelo slug: ${error.message}`);
        }
        if (!data) {
          // Should be caught by PGRST116, but as a safeguard
          throw new Error(
            `Falha ao buscar tarefa pelo slug ${slug}: Nenhum dado retornado.`
          );
        }
        return data;
      }
      throw new Error(
        `Falha ao buscar tarefa com slug ${slug} após várias tentativas.`
      );
    },

    async fetchTask(supabase: SupabaseClient, id: string): Promise<Task> {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id)
        .single<Task>();

      if (error) {
        console.error("Erro ao buscar tarefa:", error);
        throw new Error(`Falha ao buscar tarefa: ${error.message}`);
      }
      if (!data) {
        throw new Error(
          `Falha ao buscar tarefa com id ${id}: Nenhum dado retornado.`
        );
      }
      return data;
    },

    async fetchTasks(supabase: SupabaseClient): Promise<Task[]> {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        this.tasks = [];
        return [];
      }
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar tarefas:", error);
        throw new Error(`Falha ao buscar tarefas: ${error.message}`);
      }
      this.tasks = (data as Task[]) || [];
      return this.tasks;
    },
  },
});
