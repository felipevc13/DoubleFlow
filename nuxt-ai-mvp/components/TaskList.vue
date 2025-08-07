<!-- components/TaskList.vue -->
<template>
  <div class="space-y-2">
    <h3 class="text-sm text-gray-400 mb-2">Tarefas</h3>
    <div v-if="tasks.length === 0" class="text-gray-500 text-sm">
      Nenhuma tarefa criada.
    </div>
    <div v-else class="space-y-1">
      <NuxtLink
        v-for="task in tasks"
        :key="task.id"
        :to="`/task/${task.slug}`"
        class="flex items-center space-x-2 text-gray-300 text-sm hover:bg-white/10 px-2 py-2 rounded-[8px]"
        :class="{
          'bg-white/10 text-white': currentRoute === `/task/${task.slug}`,
        }"
      >
        <span class="truncate">{{ task.name }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  currentRoute: {
    type: String,
    required: true,
  },
});

const tasksStore = useTasksStore();
const tasks = computed(() => tasksStore.tasks);
const supabase = useSupabaseClient(); // Get Supabase client instance

onMounted(async () => {
  try {
    await tasksStore.fetchTasks(supabase); // Pass supabase client
  } catch (error) {
    console.error("Erro ao carregar tarefas:", error);
    alert(
      "Falha ao carregar as tarefas. Verifique o console para mais detalhes."
    );
  }
});
</script>
