import { defineNuxtRouteMiddleware, useNuxtApp, navigateTo } from "#imports";
import type { RouteLocationNormalized } from "vue-router";
// middleware/redirect-to-first-task.js

import { useTasksStore } from "~/stores/tasks";
import { useLoadingStore } from "~/stores/loading";

export default defineNuxtRouteMiddleware(
  async (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    // Run only on client; the Supabase plugin instance isn't available on SSR
    if (process.server) return;

    const { $supabase } = useNuxtApp();
    if (!$supabase) return; // plugin might not be ready yet

    // Public routes that don't require auth
    const publicPaths = new Set<string>(["/", "/login", "/register"]);

    try {
      const { data, error } = await $supabase.auth.getUser();
      if (error) {
        console.warn("[redirect-to-first-task] auth.getUser error:", error);
      }
      const user = data?.user ?? null;

      // If not authenticated and route is protected → redirect to /login
      if (!user && !publicPaths.has(to.path)) {
        return navigateTo("/login");
      }

      // If authenticated and trying to access / or /login → redirect to first task or /home
      if (user && (to.path === "/" || to.path === "/login")) {
        const loadingStore = useLoadingStore();
        const taskStore = useTasksStore();

        let started = false;
        if (!taskStore.tasks || taskStore.tasks.length === 0) {
          started = true;
          loadingStore.startLoading();
          await taskStore.fetchTasks($supabase);
        }

        try {
          const tasks = taskStore.tasks;
          if (tasks && tasks.length > 0) {
            const firstTaskSlug = tasks[0]?.slug as string | undefined;
            if (firstTaskSlug && to.path !== `/task/${firstTaskSlug}`) {
              return navigateTo(`/task/${firstTaskSlug}`, { replace: true });
            }
          } else {
            return navigateTo("/home", { replace: true });
          }
        } catch (err) {
          console.error(
            "[redirect-to-first-task] Error loading tasks or redirecting:",
            err
          );
        } finally {
          if (started && loadingStore.isLoading) {
            loadingStore.stopLoading();
          }
        }
      }
    } catch (e) {
      console.error("[redirect-to-first-task] unexpected error:", e);
    }
  }
);
