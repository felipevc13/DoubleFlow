<template>
  <div>
    <h2 class="text-xl font-semibold mb-6 text-white">Submissões</h2>
    <div v-if="isLoading" class="text-gray-400">Carregando resultados...</div>
    <div v-else-if="error" class="text-red-500">
      Erro ao carregar resultados: {{ error.message }}
    </div>
    <div v-else-if="submissions.length > 0" class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-700">
        <thead class="bg-gray-800">
          <tr>
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
            >
              Submetido em
            </th>
            <th
              v-for="question in questions"
              :key="question.id"
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
            >
              {{ question.questionText }}
            </th>
          </tr>
        </thead>
        <tbody class="bg-gray-900 divide-y divide-gray-700">
          <tr
            v-for="(submission, index) in submissions"
            :key="submission.submission_id || index"
            class="hover:bg-gray-700"
          >
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
              {{ formatDate(submission.submitted_at) }}
            </td>
            <td
              v-for="question in questions"
              :key="question.id"
              class="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
            >
              {{ submission.answers[question.id] || "-" }}
              <!-- Show answer or '-' if missing -->
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="text-gray-400">
      Ainda não há resultados para esta pesquisa.
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(["loaded", "error"]);
import { ref, watch, onMounted, computed } from "vue"; // Add computed

const props = defineProps({
  surveyId: {
    type: [String, Number],
    required: true,
  },
});

const questions = ref([]); // Store questions for header
const submissions = ref([]); // Store submissions for rows
const isLoading = ref(false);
const error = ref(null);

async function fetchResults() {
  if (!props.surveyId) {
    questions.value = [];
    submissions.value = [];
    error.value = new Error("Survey ID is missing.");
    isLoading.value = false;
    emit("error", error.value);
    emit("loaded"); // Garante que o loading sempre termina
    return;
  }

  isLoading.value = true;
  error.value = null;
  questions.value = [];
  submissions.value = [];

  try {
    // API now returns { questions: [], submissions: [] }
    const data = await $fetch(`/api/surveys/${props.surveyId}/results`);

    if (
      data &&
      Array.isArray(data.questions) &&
      Array.isArray(data.submissions)
    ) {
      questions.value = data.questions;
      submissions.value = data.submissions;
    } else {
      console.error("[Results.vue] Unexpected API response structure:", data);
      throw new Error("Formato de resposta da API inválido.");
    }
  } catch (err) {
    console.error(
      `[Results.vue] Error fetching results for survey ${props.surveyId}:`,
      err
    );
    error.value = err;
    questions.value = [];
    submissions.value = [];
    emit("error", err);
  } finally {
    emit("loaded"); // <-- sempre finaliza o loading
    isLoading.value = false;
  }
}

// Fetch results when the component mounts or when the surveyId changes
onMounted(fetchResults);
watch(() => props.surveyId, fetchResults);

// Helper to format date
const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch (e) {
    console.error("Error formatting date:", e);
    return dateString; // Return original string if formatting fails
  }
};
</script>

<style scoped>
/* Add any specific styles for the results tab here */
</style>
