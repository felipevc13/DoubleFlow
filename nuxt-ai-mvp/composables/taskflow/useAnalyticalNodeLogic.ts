// composables/taskflow/useAnalyticalNodeLogic.ts
import { computed } from "vue";
import { useTaskFlowStore } from "~/stores/taskFlow";

interface NodeProps {
  id: string;
  data: any;
}

export function useAnalyticalNodeLogic(props: NodeProps) {
  const store = useTaskFlowStore();

  const nodeId = props.id;

  const isAnalyzing = computed(
    () => !!store.getLoadingState(nodeId)?.isLoading
  );

  const displayError = computed(() => {
    const nodeData = props.data;
    if (nodeData?.processInputError) {
      return typeof nodeData.processInputError === "string"
        ? nodeData.processInputError
        : JSON.stringify(nodeData.processInputError);
    }
    return null;
  });

  const hasPotentiallyProcessableInput = computed(() => {
    const nodeData = props.data;
    if (!nodeData?.inputData) return false;

    // Lógica especial para ReportCard (label ou rawNodeType)
    if (nodeData?.label === "Relatório" || nodeData?.rawNodeType === "report") {
      // Qualquer inputData não vazio
      return (
        Object.keys(nodeData.inputData).length > 0 &&
        Object.values(nodeData.inputData).some(
          (input: any) =>
            input && typeof input === "object" && Object.keys(input).length > 0
        )
      );
    }

    // Lógica anterior para os demais cards
    return Object.values(nodeData.inputData).some((input: any) => {
      if (!input || typeof input !== "object") return false;

      const hasSurveyData = input.survey_results?.submissions?.length > 0;

      const hasQualitativeFiles = input.uploaded_files?.some((f: any) => {
        // Aceita tanto content de texto (como antes) quanto inferred_survey_columns de planilha
        const hasTextContent =
          ["pesquisa_usuario", "transcricao_entrevista"].includes(f.category) &&
          f.content;
        const hasInferredColumns = f.inferred_survey_columns?.length > 0;
        return hasTextContent || hasInferredColumns;
      });

      return hasSurveyData || hasQualitativeFiles;
    });
  });

  const isEmptyAnalysis = computed(() => {
    const nodeData = props.data;
    const ad = nodeData.analyzedData;
    if (!ad) return true;
    if (Array.isArray(ad)) return ad.length === 0;
    if (typeof ad === "object")
      return Object.values(ad).every(
        (val) => Array.isArray(val) && val.length === 0
      );
    return true;
  });

  const canManuallyAnalyze = computed(
    () =>
      hasPotentiallyProcessableInput.value &&
      isEmptyAnalysis.value &&
      !displayError.value &&
      !isAnalyzing.value
  );

  const showNoResultsMessage = computed(
    () =>
      hasPotentiallyProcessableInput.value &&
      isEmptyAnalysis.value &&
      !isAnalyzing.value &&
      !displayError.value
  );

  const triggerAnalysis = () => store.requestNodeReprocessing(nodeId);
  const deleteNode = async () => {
    store.removeNode(nodeId);
  };

  return {
    isAnalyzing,
    displayError,
    hasPotentiallyProcessableInput,
    canManuallyAnalyze,
    showNoResultsMessage,
    triggerAnalysis,
    deleteNode,
  };
}
