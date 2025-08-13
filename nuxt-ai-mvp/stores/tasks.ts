import { defineStore } from "pinia";
import { useSlug } from "../composables/useSlug";
import { useSupabaseClient } from "#imports";
import type { Json } from "~/types/supabase";
import { ref } from "vue";

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

export const useTasksStore = defineStore("tasks", () => {
  const tasks = ref<Task[]>([]);
  const supabase = useSupabaseClient();

  function toProblemStatement(json: any): ProblemStatement {
    if (json && typeof json === "object") {
      const {
        title = "",
        description = "",
        updated_at = new Date().toISOString(),
      } = json as any;
      return { title, description, updated_at };
    }
    return { title: "", description: "", updated_at: new Date().toISOString() };
  }

  function normalizeTaskRow(row: any): Task {
    return {
      ...row,
      problem_statement: toProblemStatement(row?.problem_statement),
    } as Task;
  }

  async function createTask(taskData: CreateTaskPayload): Promise<Task> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { generateSlug } = useSlug();

    if (!user?.id)
      throw new Error("Usuário não autenticado para criar tarefa.");
    if (!taskData.name) throw new Error("O nome da tarefa é obrigatório.");

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
          problem_statement: initialProblemStatement as unknown as Json,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        if ((error as any).code === "23505") {
          uniqueSlug = `${initialSlug}-${counter++}`;
          continue;
        }
        throw new Error(`Falha ao criar tarefa: ${error.message}`);
      }
      if (!data)
        throw new Error("Falha ao criar tarefa: Nenhum dado retornado.");

      await fetchTasks();
      return normalizeTaskRow(data);
    }
  }

  async function updateTask(
    taskId: string,
    taskData: UpdateTaskPayload
  ): Promise<Task> {
    const { generateSlug } = useSlug();
    if (!taskData.name) throw new Error("O nome da tarefa é obrigatório.");

    const initialSlug = generateSlug(taskData.name);
    let uniqueSlug = initialSlug;
    let counter = 1;

    while (true) {
      const { data, error } = await supabase
        .from("tasks")
        .update({ name: taskData.name, slug: uniqueSlug })
        .eq("id", taskId)
        .select()
        .single();

      if (error) {
        if ((error as any).code === "23505") {
          uniqueSlug = `${initialSlug}-${counter++}`;
          continue;
        }
        throw new Error(`Falha ao atualizar tarefa: ${error.message}`);
      }
      if (!data)
        throw new Error("Falha ao atualizar tarefa: Nenhum dado retornado.");

      await fetchTasks();
      return normalizeTaskRow(data);
    }
  }

  async function updateTaskProblemStatement(
    taskId: string,
    problemData: UpdateProblemStatementPayload
  ): Promise<Task> {
    const updatedProblemStatement: ProblemStatement = {
      title: problemData.title || "",
      description: problemData.description || "",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("tasks")
      .update({ problem_statement: updatedProblemStatement as unknown as Json })
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      throw new Error(`Falha ao atualizar problem_statement: ${error.message}`);
    }
    if (!data) {
      throw new Error(
        "Falha ao atualizar problem_statement: Nenhum dado retornado."
      );
    }

    const idx = tasks.value.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      tasks.value[idx] = {
        ...tasks.value[idx],
        problem_statement: { ...updatedProblemStatement },
      } as Task;
    }
    return normalizeTaskRow(data);
  }

  async function deleteTask(taskId: string): Promise<void> {
    const { error: surveyError } = await supabase
      .from("surveys")
      .delete()
      .eq("task_id", taskId);
    if (surveyError) {
      throw new Error(
        `Falha ao excluir surveys relacionados: ${surveyError.message}`
      );
    }

    const { error: taskDeleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);
    if (taskDeleteError) {
      throw new Error(`Falha ao excluir tarefa: ${taskDeleteError.message}`);
    }

    await fetchTasks();
  }

  async function fetchTaskBySlug(slug: string): Promise<Task> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("slug", slug)
        .single();

      if (error) {
        if ((error as any).code === "PGRST116" && attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 500));
          attempt++;
          continue;
        }
        throw new Error(`Falha ao buscar tarefa pelo slug: ${error.message}`);
      }
      if (!data) {
        throw new Error(
          `Falha ao buscar tarefa pelo slug ${slug}: Nenhum dado retornado.`
        );
      }
      return normalizeTaskRow(data);
    }
    throw new Error(
      `Falha ao buscar tarefa com slug ${slug} após várias tentativas.`
    );
  }

  async function fetchTask(id: string): Promise<Task> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new Error(`Falha ao buscar tarefa: ${error.message}`);
    if (!data)
      throw new Error(
        `Falha ao buscar tarefa com id ${id}: Nenhum dado retornado.`
      );
    return normalizeTaskRow(data);
  }

  async function fetchTasks(): Promise<Task[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      tasks.value = [];
      return [];
    }
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Falha ao buscar tarefas: ${error.message}`);
    tasks.value = (data || []).map((row: any) => normalizeTaskRow(row));
    return tasks.value;
  }

  return {
    tasks,
    createTask,
    updateTask,
    updateTaskProblemStatement,
    deleteTask,
    fetchTaskBySlug,
    fetchTask,
    fetchTasks,
  };
});
