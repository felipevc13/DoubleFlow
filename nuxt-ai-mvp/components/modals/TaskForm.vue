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

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { useTasksStore } from "~/stores/tasks";
import { useNuxtApp } from "#imports";
import BaseModal from "./BaseModal.vue";

type TaskLite = { id: string; name: string; slug: string };

const props = withDefaults(
  defineProps<{ isOpen: boolean; task: TaskLite | null }>(),
  {
    isOpen: false,
    task: null,
  }
);
const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", task: TaskLite | undefined): void;
}>();

const tasksStore = useTasksStore();
const { $toast, $supabase } = useNuxtApp();
const router = useRouter();

const taskName = ref<string>("");
const loading = ref<boolean>(false);

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

function log(...args: any[]) {
  // eslint-disable-next-line no-console
  console.debug("[TaskForm]", ...args);
}

const save = async () => {
  if (!taskName.value.trim()) {
    $toast?.error("Por favor, preencha o nome da tarefa.");
    return;
  }

  log("save:start", {
    nameRaw: taskName.value,
    nameTrimmed: taskName.value.trim(),
    typeofName: typeof taskName.value,
    hasPropsTask: !!props.task,
    propsTaskId: props.task?.id || null,
  });

  loading.value = true;
  try {
    let savedTask: TaskLite | undefined;
    if (props.task) {
      log("updateTask:payload", { id: props.task.id, name: taskName.value });
      savedTask = await tasksStore.updateTask(props.task.id, {
        name: taskName.value,
      });
      log("updateTask:success", { savedTask });
      $toast?.success("Tarefa atualizada com sucesso!");
    } else {
      const createPayload = { name: taskName.value };
      log("createTask:payload", createPayload);
      savedTask = await tasksStore.createTask(createPayload);
      log("createTask:success", { savedTask });
      $toast?.success("Tarefa criada com sucesso!");
      if (savedTask?.id) {
        router.push(`/task/${savedTask.slug}`);
      }
    }

    emit("save", savedTask);
  } catch (error: unknown) {
    const err = error as { message?: string };
    log("save:error", { message: err?.message, error: err });
    $toast?.error(`Falha ao salvar a tarefa: ${err?.message}`);
  } finally {
    loading.value = false;
  }
};
</script>
