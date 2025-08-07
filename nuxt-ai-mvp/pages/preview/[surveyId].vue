<template>
  <div
    class="h-screen min-h-screen w-screen min-w-full flex flex-col bg-[#171717] relative"
  >
    <!-- Preview Banner -->
    <div
      v-if="!isLoading && isSurveyActive === false"
      class="absolute top-4 left-4 right-4 z-10 bg-blue-100 border border-blue-200 text-blue-800 text-sm px-4 py-3 rounded-md flex items-center justify-between shadow-sm"
      role="alert"
    >
      <div class="flex items-center">
        <svg
          class="fill-current w-4 h-4 mr-2"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
        >
          <path
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 102 0v-4zm-1-3a1 1 0 00-1 1v.01a1 1 0 102 0V5a1 1 0 00-1-1z"
          />
        </svg>
        <span
          >Esta é uma prévia do seu estudo, não coletaremos nenhum dado.</span
        >
      </div>
      <!-- Optional: Add a close button if needed -->
      <!--
       <button @click="isSurveyActive = null" class="ml-4">
         <svg class="fill-current h-6 w-6 text-blue-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
       </button>
       -->
    </div>

    <!-- Main Content Area -->
    <div
      v-if="isLoading"
      class="text-center py-12 text-gray-400 w-full flex items-center justify-center flex-grow"
    >
      <!-- Optional: Add a spinner SVG here -->
      Carregando pesquisa...
    </div>
    <Preview
      v-else-if="surveyStructure.length > 0"
      :blocks="surveyStructure"
      :preview-current-page="previewCurrentPage"
      :preview-total-pages="previewTotalPages"
      @preview-next-page="previewNextPage"
      @preview-prev-page="previewPrevPage"
      @answer="handleAnswer"
      :fullscreen="true"
      class="flex-grow"
      @jump-to-end="handleJumpToEnd"
    />
    <div
      v-else
      class="text-center py-12 text-gray-400 w-full flex items-center justify-center flex-grow"
    >
      Erro ao carregar pesquisa ou pesquisa vazia.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import Preview from "~/components/modals/SurveyModal/content/Preview.vue";
import { useSeoMeta, definePageMeta } from "#imports";

interface SurveyBlock {
  id?: string;
  type: string;
  extra?: {
    title?: string;
    description?: string;
  };
  [key: string]: any;
}

definePageMeta({ layout: "blank" });
// ---------- state & routing ----------
const route = useRoute();
const surveyId = route.params.surveyId as string;

const surveyStructure = ref<SurveyBlock[]>([]);
const previewCurrentPage = ref(0);
const previewTotalPages = ref(1);

const isSurveyActive = ref<boolean | null>(null); // null initially, true/false after fetch
const isLoading = ref<boolean>(true); // unified loading state
const submissionId = ref<string | null>(null); // ID único desta tentativa de resposta
// -------------------------------------

// Aplica SEO dinâmico com base no bloco de introdução do survey, se existir
watch(
  () => surveyStructure.value,
  (structure) => {
    const introBlock = Array.isArray(structure)
      ? structure.find((b: SurveyBlock) => b.type === "intro")
      : null;
    if (introBlock && introBlock.extra) {
      useSeoMeta({
        title:
          introBlock.extra.title || "Participe desta pesquisa - DoubleFlow",
        description:
          introBlock.extra.description ||
          "Sua opinião é muito importante para nós.",
        ogTitle: introBlock.extra.title,
        ogDescription: introBlock.extra.description,
        // ogImage: 'URL_DA_IMAGEM_SURVEY.png', // Adicione imagem se desejar
        // twitterCard: 'summary_large_image',
      });
    }
  },
  { immediate: true }
);

// Rename and modify the fetch function
async function fetchSurveyData() {
  isLoading.value = true;
  isSurveyActive.value = null; // Reset on fetch
  surveyStructure.value = []; // Reset structure
  try {
    // Fetch survey metadata (including is_active) - Assuming endpoint exists
    const surveyMeta: any = await $fetch(`/api/surveys/${surveyId}`); // NEW API CALL
    if (surveyMeta) {
      isSurveyActive.value = !!surveyMeta.is_active; // Store active status
      // Potentially store other metadata if needed: surveyMeta.title, etc.
    } else {
      isSurveyActive.value = false; // Assume inactive if metadata fetch fails? Or handle error
      console.error("Failed to fetch survey metadata");
    }

    // Fetch survey questions (existing logic)
    const questionsResp: any = await $fetch(
      `/api/surveys/${surveyId}/questions`
    );
    if (questionsResp && questionsResp.questions) {
      surveyStructure.value = questionsResp.questions;
      const pages = questionsResp.questions.filter(
        (b: SurveyBlock) =>
          b.type === "intro" ||
          b.type === "thanks" ||
          b.type === "openText" ||
          b.type === "multipleChoice" ||
          b.type === "rating" ||
          b.type === "opinionScale"
      );
      previewTotalPages.value = pages.length;
      previewCurrentPage.value = 0;
    } else {
      surveyStructure.value = [];
    }
  } catch (e) {
    console.error("Error fetching survey data:", e);
    surveyStructure.value = [];
    isSurveyActive.value = false; // Assume inactive on error
  } finally {
    isLoading.value = false;
  }
}

// Update hooks to use the new function name
onMounted(() => {
  fetchSurveyData();
  // Generate a unique ID for this submission attempt when the page loads
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    submissionId.value = crypto.randomUUID();
  } else {
    console.error(
      "[PreviewPage] crypto.randomUUID() not available. Cannot generate submission ID."
    );
    // Handle fallback if needed, e.g., show error or disable submission
  }
});
watch(() => surveyId, fetchSurveyData);

// Function to handle the answer submission from Preview component
async function handleAnswer(answerData: { questionId: string; value: any }) {
  // Only save if the survey is active and we have a valid answer value
  if (isSurveyActive.value === true && answerData.value !== undefined) {
    try {
      const response = await $fetch(`/api/surveys/${surveyId}/responses`, {
        method: "POST",
        body: {
          question_id: answerData.questionId,
          response_value: answerData.value, // Sending the value as is (string or array)
          submission_id: submissionId.value, // Include the generated submission ID
          // respondent_session_id: getOrCreateSessionId(), // Keep session ID if needed alongside submission ID
        },
      });
    } catch (error) {
      console.error("[PreviewPage] Failed to save response:", error);
      // TODO: Handle error saving response (e.g., show message to user?)
    }
  } else if (isSurveyActive.value === false) {
  } else {
  }

  // Note: Page advancement is handled by the @preview-next-page event emitted by Preview.vue
}

function previewNextPage() {
  // This function now ONLY handles the page advancement logic
  if (previewCurrentPage.value < previewTotalPages.value - 1) {
    previewCurrentPage.value++;
  }
}
function previewPrevPage() {
  if (previewCurrentPage.value > 0) {
    previewCurrentPage.value--;
  }
}

// ----- Navegar para tela de agradecimento quando Preview emitir jump-to-end -----
function handleJumpToEnd() {
  const structure = surveyStructure.value;
  if (!Array.isArray(structure)) return;

  const thanksIndex = structure.findIndex((b) => b.type === "thanks");
  if (thanksIndex !== -1) {
    previewCurrentPage.value = thanksIndex;
  } else {
    // Fallback para a última página, caso não exista bloco "thanks"
    previewCurrentPage.value = previewTotalPages.value - 1;
  }
}
</script>
