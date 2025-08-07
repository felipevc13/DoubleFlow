<template>
  <BaseModal
    :isOpen="isOpen"
    :title="computedTitle"
    size="sm"
    :hide-default-header="false"
    :hide-default-footer="true"
    @close="$emit('close')"
    :isLoading="loading"
    loading-text="Salvando..."
  >
    <div class="p-6">
      <div class="form-control">
        <div class="grid grid-cols-[25%_75%] gap-4 items-start mr-4">
          <label class="label" for="taskNameInput">
            <span class="label-text text-[14px] text-[#B4B4B4] text-wrap"
              >Nome da Tarefa</span
            >
          </label>
          <input
            id="taskNameInput"
            v-model="taskName"
            class="input input-bordered border-[#393939] w-full bg-[#FAFAFA]/[3%] focus:border-blue-500 focus:outline-none focus:ring-0 text-white"
            required
            @keydown.enter.prevent="save"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div
        class="flex justify-end gap-3 px-6 py-4 bg-[#232227] rounded-b-lg border-t border-t-[#393939]"
      >
        <button
          @click="$emit('close')"
          class="btn btn-sm btn-ghost"
          :disabled="loading"
        >
          Cancelar
        </button>
        <button
          @click="save"
          class="btn btn-sm btn-primary bg-[#4D6BFE]"
          :disabled="loading || !taskName.trim()"
        >
          Salvar
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useTasksStore } from "../stores/tasks";
import { useSupabaseClient } from "#imports";
import { useNuxtApp } from "#app";
import BaseModal from "./BaseModal.vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  task: {
    type: Object,
    default: null,
  },
});
const emit = defineEmits(["close", "save"]);

const tasksStore = useTasksStore();
const { $toast } = useNuxtApp();
const router = useRouter();
const supabase = useSupabaseClient();

const taskName = ref("");
const loading = ref(false);

const computedTitle = computed(() =>
  props.task ? "Editar Tarefa" : "Nova Tarefa"
);

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      taskName.value = props.task ? props.task.name : "";
      loading.value = false;
    }
  },
  { immediate: true }
);

const save = async () => {
  if (!taskName.value.trim()) {
    $toast?.error("Por favor, preencha o nome da tarefa.");
    return;
  }

  loading.value = true;
  try {
    let savedTask;
    if (props.task) {
      savedTask = await tasksStore.updateTask(supabase, props.task.id, {
        name: taskName.value,
      });
      $toast?.success("Tarefa atualizada com sucesso!");
    } else {
      savedTask = await tasksStore.createTask(supabase, {
        name: taskName.value,
      });
      $toast?.success("Tarefa criada com sucesso!");
      if (savedTask?.id) {
        router.push(`/task/${savedTask.slug}`);
      }
    }

    emit("save", savedTask);
  } catch (error) {
    console.error("Erro ao salvar tarefa:", error);
    $toast?.error(`Falha ao salvar a tarefa: ${error.message}`);
  } finally {
    loading.value = false;
  }
};
</script>
