<template>
  <div class="flex min-h-screen bg-[#171717] text-white">
    <div class="flex-1 transition-all duration-300">
      <div
        v-if="tasksStore.tasks.length === 0"
        class="flex flex-col items-center justify-center text-center w-full h-full"
      >
        <div>
          <h1 class="text-3xl font-bold mb-4">Bem-vindo ao Design Tools</h1>
          <p class="text-gray-400 mb-6">
            Você ainda não tem nenhuma tarefa. Crie uma nova tarefa para
            começar!
          </p>
          <button
            @click="openTaskForm"
            class="btn btn-primary bg-[#4D6BFE] rounded-[8px]"
          >
            Criar Nova Tarefa
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useModalStore } from "~/stores/modal";

const tasksStore = useTasksStore();
const supabase = useSupabaseClient(); // Obter a instância do Supabase client
const modalStore = useModalStore();

definePageMeta({
  middleware: ["redirect-to-first-task"],
});

onMounted(() => {
  tasksStore.fetchTasks(supabase); // Passar o Supabase client para fetchTasks
});

const openTaskForm = () => {
  modalStore.openModal("taskForm", { task: null });
};

const editTask = (task) => {
  modalStore.openModal("taskForm", { task });
};
</script>
