<template>
  <div
    class="flex min-h-screen h-screen bg-[#171717] text-white overflow-hidden"
  >
    <div class="flex-1 flex flex-row h-full">
      <div class="flex-1 flex flex-col transition-all duration-300 h-full">
        <template v-if="isLoading">
          <div class="flex justify-center items-center h-64">
            <div class="loading loading-spinner loading-lg text-blue-500"></div>
          </div>
        </template>
        <template v-else-if="error">
          <div class="p-6">
            <div class="text-red-500 text-center">
              <p>{{ error }}</p>
              <NuxtLink to="/home" class="text-blue-500 hover:underline">
                Voltar para a Home
              </NuxtLink>
            </div>
          </div>
        </template>
        <template v-else>
          <ClientOnly>
            <div class="flex-1 relative h-full">
              <TaskFlow
                ref="taskFlowRef"
                class="absolute inset-0"
                :task-id="task?.id"
                :task-name="task?.name"
                @rename="openRenameForm"
                @delete="deleteTask"
                @update-problem="updateProblemStatement"
                @node-clicked="handleNodeClicked"
              />
            </div>
            <template #fallback>
              <div class="flex justify-center items-center h-64">
                <div
                  class="loading loading-spinner loading-lg text-blue-500"
                ></div>
              </div>
            </template>
          </ClientOnly>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watchEffect, nextTick, computed, onMounted } from "vue";
import { useRoute, navigateTo } from "#app";
import { useTasksStore } from "~/stores/tasks";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { useSidebarStore } from "~/stores/sidebar";
import { useSidenavStore } from "~/stores/sidenav";
import { useNodeActions } from "~/composables/useNodeActions";
import { useModalStore } from "~/stores/modal";
import { useSeoMeta } from "nuxt/app";

definePageMeta({
  middleware: ["redirect-to-first-task"],
  layout: "default",
});

const sidebarStore = useSidebarStore();
const sidenavStore = useSidenavStore();
const route = useRoute();
const tasksStore = useTasksStore();
const taskFlowStore = useTaskFlowStore();
const task = ref(null);

watchEffect(() => {
  if (task.value && task.value.name) {
    useSeoMeta({
      title: task.value.name,
      description:
        task.value.problem_statement ||
        "Acompanhe e gerencie esta tarefa visualmente com o DoubleFlow.",
      ogTitle: task.value.name,
      ogDescription: task.value.problem_statement,
      // ogImage: 'URL_DA_IMAGEM_TAREFA.png', // Personalize se quiser imagem única
      // twitterCard: 'summary_large_image',
    });
  }
});

const isLoading = ref(true);
const error = ref(null);

const { handleNodeClick, handleCloseSidebar } = useNodeActions();

const layoutClass = computed(() => ({
  "ml-[72px]": sidenavStore.isCollapsed,
  "ml-[234px]": !sidenavStore.isCollapsed,
}));

const taskFlowRef = ref(null);
const lastClickedNode = ref(null);

const supabase = useSupabaseClient();
const user = useSupabaseUser();

const modalStore = useModalStore();

onMounted(() => {
  watchEffect(async () => {
    if (user.value && route.params.slug) {
      isLoading.value = true;
      try {
        await nextTick();

        // Pass supabase client as the first argument
        task.value = await tasksStore.fetchTaskBySlug(
          supabase,
          route.params.slug
        );

        if (!task.value) throw new Error("Tarefa não encontrada.");

        await taskFlowStore.loadTaskFlow(task.value.id);

        error.value = null;
      } catch (err) {
        console.error("[slug.vue] Erro ao carregar tarefa:", err);
        error.value = err.message || "Falha ao carregar a tarefa.";
      } finally {
        isLoading.value = false;
      }
    }
  });
});

const updateProblemStatement = async (statement) => {
  console.warn(
    "updateProblemStatement called in [slug].vue - re-evaluate necessity/logic"
  );
  // Option 1: Call the store action directly if this function is still triggered
  // const nodeId = 'problem-1'; // Or get the actual node ID if available
  // await taskFlowStore.updateNodeData(nodeId, statement);

  // Option 2: Keep existing logic (but it might conflict/be redundant)
  // try { ... } catch { ... }
};

const openTaskForm = () => {
  modalStore.openModal("taskForm", { task: null });
};

const openRenameForm = () => {
  modalStore.openModal("taskForm", { task: task.value });
};

const deleteTask = async () => {
  if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
  try {
    // Exclui a tarefa no Supabase
    await tasksStore.deleteTask(supabase, task.value.id);
    taskFlowStore.clearTaskFlowState();

    // Atualiza a lista de tarefas após exclusão
    await tasksStore.fetchTasks(supabase);

    const tasks = tasksStore.tasks;
    if (tasks && tasks.length > 0) {
      // Se houver tasks, navega para a primeira
      navigateTo(`/task/${tasks[0].slug}`);
    } else {
      // Se não houver, navega para /home
      navigateTo("/home");
    }
  } catch (error) {
    console.error("Erro ao excluir tarefa:", error);
    alert("Falha ao excluir a tarefa.");
  }
};

const handleNodeClicked = (eventNode) => {
  if (!eventNode || !eventNode.id) {
    console.warn(
      "⚠️ [TaskPage] Evento node-clicked recebido sem nó válido:",
      eventNode
    );
    return;
  }

  lastClickedNode.value = eventNode;
};
</script>
