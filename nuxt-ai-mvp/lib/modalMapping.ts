import type { Component } from "vue";

// Importe todos os componentes de modal do app
import ProblemModal from "~/components/modals/ProblemModal.vue";
import SurveyModal from "~/components/modals/SurveyModal/SurveyModal.vue";
import DataSourceModal from "~/components/modals/DataSourceModal/DataSourceModal.vue";
import TaskForm from "~/components/modals/TaskForm.vue";
import ConfirmDeleteModal from "~/components/modals/ConfirmDeleteModal.vue";
import AnalysisModal from "~/components/modals/AnalysisModal.vue";

// Mapeamento centralizado: tipo de modal (string) -> componente de modal
export const modalComponents: Record<string, Component> = {
  problem: ProblemModal,
  survey: SurveyModal,
  dataSource: DataSourceModal,
  taskForm: TaskForm,
  newTask: TaskForm,
  confirmDelete: ConfirmDeleteModal,
  analysis: AnalysisModal,
  // Adicione outros modais aqui conforme necessário
};
