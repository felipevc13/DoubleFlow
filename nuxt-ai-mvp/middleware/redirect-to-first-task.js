// middleware/redirect-to-first-task.js

import { useTasksStore } from "../stores/tasks";
import { useLoadingStore } from "../stores/loading"; // Import the loading store

// Wrap the middleware logic with defineNuxtRouteMiddleware
export default defineNuxtRouteMiddleware(async (to, from) => {
  const supabase = useSupabaseClient();
  const user = await supabase.auth.getUser();

  const publicPaths = ["/", "/login", "/register"];
  if (!user.data.user && !publicPaths.includes(to.path)) {
    return navigateTo("/login");
  }

  if (user.data.user && (to.path === "/login" || to.path === "/")) {
    const loadingStore = useLoadingStore();
    const taskStore = useTasksStore();

    let shouldStartLoading = false;
    if (!taskStore.tasks || taskStore.tasks.length === 0) {
      shouldStartLoading = true;
      loadingStore.startLoading();
      await taskStore.fetchTasks(supabase);
    }

    try {
      const tasks = taskStore.tasks;
      if (tasks && tasks.length > 0) {
        const firstTaskSlug = tasks[0]?.slug;
        if (firstTaskSlug && to.path !== `/task/${firstTaskSlug}`) {
          return navigateTo(`/task/${firstTaskSlug}`, { replace: true });
        }
      } else {
        // Se não tem tarefas, vai para /home
        if (to.path !== "/home") {
          return navigateTo("/home", { replace: true });
        }
      }
    } catch (error) {
      console.error("Middleware: Error loading tasks or redirecting:", error);
      if (shouldStartLoading && loadingStore.isLoading) {
        loadingStore.stopLoading();
      }
    } finally {
      if (shouldStartLoading && loadingStore.isLoading) {
        loadingStore.stopLoading();
      }
    }
  }
});
