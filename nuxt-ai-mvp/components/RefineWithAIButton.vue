<template>
  <div class="relative group flex flex-col items-end gap-2">
    <button
      class="inline-flex w-fit items-center justify-center gap-2 px-4 py-2 hover:bg-[#3C3B40] text-white rounded-lg border border-[#4D6BFE] transition-colors"
      @click="refineWithAI"
      :disabled="isLoading"
    >
      <AiIcon></AiIcon>
      <span>Refinar com IA</span>
      <div v-if="isLoading" class="loading loading-spinner loading-xs"></div>
    </button>
    <span
      class="absolute bottom-full right-0 mb-2 w-max max-w-[200px] px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 text-left whitespace-normal"
    >
      Use a IA para reformular o título e descrição do problema inicial
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useTasksStore } from "~/stores/tasks";
import AiIcon from "./icon/AiIcon.vue";
import { useNuxtApp } from "nuxt/app";

const props = defineProps({
  taskId: {
    type: String,
    required: true,
  },
  currentTitle: {
    type: String,
    required: true,
  },
  currentDescription: {
    type: String,
    required: true,
  },
  nodeId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["update", "loading"]);
const isLoading = ref(false);
const tasksStore = useTasksStore();
const { $toast } = useNuxtApp();

const refineWithAI = async () => {
  // Validação dos campos de entrada
  const isNumeric = (str: string) => /^\d+$/.test(str.trim());
  const titleIsNumeric = isNumeric(props.currentTitle);
  const descIsNumeric = isNumeric(props.currentDescription);
  const titleIsEmpty = !props.currentTitle.trim();
  const descIsEmpty = !props.currentDescription.trim();

  if (
    (titleIsEmpty && descIsEmpty) ||
    ((titleIsEmpty || titleIsNumeric) && (descIsEmpty || descIsNumeric))
  ) {
    console.warn(
      "[RefineWithAI] Input contains only numbers or is empty. Skipping AI call."
    );
    if ($toast) {
      ($toast as any).info(
        "Por favor, forneça um título ou descrição com mais texto para a IA refinar."
      );
    } else {
      alert(
        "Por favor, forneça um título ou descrição com mais texto para a IA refinar."
      );
    }
    return;
  }

  try {
    isLoading.value = true;
    emit("loading", true, props.nodeId);

    // Corpo para a API nova, seguindo a arquitetura de análise configurável
    const reqBody = {
      nodeData: {
        inputData: {
          currentTitle: props.currentTitle,
          currentDescription: props.currentDescription,
        },
      },
      analysisKey: "refineProblemStatement",
    };

    // Chamada ao endpoint genérico
    const response = await fetch("/api/ai/runAnalysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AI API call failed: ${response.statusText} - ${
          errorData.statusMessage || "Unknown error"
        }`
      );
    }

    const result = await response.json();

    const refinedContent =
      result.outputData?.problem_refined || result.analyzedData || null;

    if (
      !refinedContent ||
      typeof refinedContent.title === "undefined" ||
      typeof refinedContent.description === "undefined" ||
      !Array.isArray(refinedContent.recommendations)
    ) {
      throw new Error("AI response is missing required fields.");
    }

    emit("update", refinedContent);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Erro ao refinar com IA:", error);
    if ($toast) {
      ($toast as any).error(`Erro ao refinar: ${errorMessage}`);
    } else {
      alert(`Erro ao refinar: ${errorMessage}`);
    }
  } finally {
    isLoading.value = false;
    emit("loading", false, props.nodeId);
  }
};
</script>
