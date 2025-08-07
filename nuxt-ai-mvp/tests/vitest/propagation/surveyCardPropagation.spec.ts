import type { NodeData } from "~/types/taskflow";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTaskFlowStore } from "~/stores/taskFlow";
import { surveyNodeHandler } from "~/lib/nodeHandlers/surveyNodeHandler";
import { mount } from "@vue/test-utils";
import NodeIOViewer from "~/components/modals/DataSourceModal/content/NodeIOViewer.vue";
import { decompress } from "~/utils/nodeContext";

// Supondo que o handler do problema já existe (mock)
const problemOutput = {
  problem_definition: "Como melhorar a satisfação dos usuários?",
};

const MOCK_SURVEY_ID = "test-survey-123";

vi.mock("#app", () => ({
  useState: vi.fn((_, init) => ({ value: init() })),
  useFetch: vi.fn((url) => {
    // This mock might be overridden or less relevant if global.$fetch is used by handlers
    if (
      url.includes(`/api/surveys/${MOCK_SURVEY_ID}/questions`) ||
      url.includes("/api/surveys/structure")
    ) {
      return {
        // survey_structure: { // Original structure from #app mock
        questions: [{ id: "q1", text: "O que melhorar?" }],
        // },
      };
    }
    return {};
  }),
}));
describe("Propagação: Survey Card", () => {
  let store: ReturnType<typeof useTaskFlowStore>;

  beforeEach(() => {
    // Reinicia a store antes de cada teste
    store = useTaskFlowStore();
    store.$reset();
    store.currentTaskId = "mock-task-id";
    // Mock global fetch
    (global.$fetch as any) = vi.fn(async (url: string) => {
      if (url === `/api/surveys/${MOCK_SURVEY_ID}/results`) {
        return {
          submissions: [
            { id: 1, answer: "Mais feedback", rating: 4 },
            { id: 2, answer: "Melhor suporte", rating: 5 },
          ],
          questions: [{ id: "q1", text: "O que melhorar?" }],
        };
      }
      if (url === `/api/surveys/${MOCK_SURVEY_ID}`) {
        // For metadata (e.g., is_active)

        return {
          is_active: true, // Example value
          // other survey metadata if needed by handler
        };
      }
      if (url === `/api/surveys/${MOCK_SURVEY_ID}/questions`) {
        // For survey structure

        return {
          questions: [{ id: "q1", text: "O que melhorar?" }],
        };
      }
      console.warn(`[TEST MOCK $FETCH] Unhandled URL: ${url}`);
      return {};
    });
  });

  it("deve propagar output de Problem -> Survey e emitir respostas corretamente", async () => {
    // 1. Cria o nó de problema
    const problemNode = {
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: problemOutput,
        cumulativeContext: { compressed: false, blob: {} as any },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      dragging: false,
    };
    store.addNode(problemNode);

    // 2. Cria o nó de survey conectado ao problema
    const surveyNode = {
      id: "survey-1",
      type: "survey",
      position: { x: 200, y: 0 },
      data: {
        surveyId: MOCK_SURVEY_ID, // Added surveyId
        inputData: {},
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} as any },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 200, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      dragging: false,
    };
    store.addNode(surveyNode);

    // 3. Cria edge ligando problema -> survey
    store.addEdge({
      id: "e1",
      source: "problem-1",
      target: "survey-1",
    });

    await store.propagateOutput("problem-1");

    // Simula fetch real dos dados do survey após processInput
    const statusUpdate = surveyNodeHandler.handleAction
      ? await surveyNodeHandler.handleAction(
          "fetchSurveyStatus",
          {},
          { ...surveyNode, data: { ...surveyNode.data } },
          global.$fetch
        )
      : {};
    store.updateNodeData("survey-1", {
      ...(statusUpdate as Partial<NodeData>),
    });

    // 6. Verifica se o outputData do survey está correto (mockado)
    const updatedSurveyNode = store.nodes.find((n) => n.id === "survey-1");

    expect(
      updatedSurveyNode?.data.outputData?.survey_results?.submissions
    ).toHaveLength(2);
    expect(
      updatedSurveyNode?.data.outputData?.survey_results?.submissions[0]?.answer
    ).toBe("Mais feedback");

    // Checa cumulativeContext do Survey (deve conter o do problem)
    const surveyContext = decompress(updatedSurveyNode?.data.cumulativeContext);

    expect(surveyContext["problem-1"]).toHaveProperty("output.problem");

    // 7. (Opcional) Crie um nó filho (ex: reportCard) e propague output do survey para ele, validando a chegada dos dados
    // ...
  });

  it("deve exibir outputData no NodeIOViewer do modal", async () => {
    // Repete o fluxo para garantir estado esperado
    const problemNode = {
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {
          problem_definition: "Como melhorar a satisfação dos usuários?",
        },
        cumulativeContext: { compressed: false, blob: {} as any },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      dragging: false,
    };
    store.addNode(problemNode);

    const surveyNode = {
      id: "survey-1",
      type: "survey",
      position: { x: 200, y: 0 },
      data: {
        surveyId: MOCK_SURVEY_ID, // Added surveyId
        inputData: {},
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} as any },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 200, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      dragging: false,
    };
    store.addNode(surveyNode);

    store.addEdge({
      id: "e1",
      source: "problem-1",
      target: "survey-1",
    });

    // Propaga manualmente
    const parentOutputs = { "problem-1": problemNode.data.outputData };

    const surveyInputResult = await surveyNodeHandler.processInput(
      surveyNode.data,
      parentOutputs,
      global.$fetch
    );

    // Simula fetch real dos dados do survey após processInput
    const statusUpdate = surveyNodeHandler.handleAction
      ? await surveyNodeHandler.handleAction(
          "fetchSurveyStatus",
          {},
          { ...surveyNode, data: { ...surveyNode.data, ...surveyInputResult } },
          global.$fetch
        )
      : {};
    store.updateNodeData("survey-1", {
      ...surveyNode.data,
      ...surveyInputResult,
      ...(statusUpdate as Partial<NodeData>),
    });

    const updatedSurveyNode = store.nodes.find((n) => n.id === "survey-1");

    const wrapper = mount(NodeIOViewer, {
      props: {
        inputData: updatedSurveyNode?.data?.inputData,
        outputData: updatedSurveyNode?.data?.outputData,
        cumulativeContext: updatedSurveyNode?.data?.cumulativeContext,
      },
    });

    await wrapper.vm.$nextTick();

    // Garante que o outputData foi passado corretamente ao NodeIOViewer
    expect(
      (wrapper.props("outputData") as any)?.survey_results?.submissions
    ).toMatchObject([
      { id: 1, answer: "Mais feedback", rating: 4 },
      { id: 2, answer: "Melhor suporte", rating: 5 },
    ]);
  });

  it("propaga corretamente outputData e cumulativeContext em Problem -> Survey -> Report", async () => {
    // 1. Problem
    const problemNode = {
      id: "problem-1",
      type: "problem",
      position: { x: 0, y: 0 },
      data: {
        inputData: {},
        outputData: {
          problem_definition: "Como melhorar a satisfação dos usuários?",
        },
        cumulativeContext: { compressed: false, blob: {} as any },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 0, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      dragging: false,
    };
    store.addNode(problemNode);

    // 2. Survey
    const surveyNode = {
      id: "survey-1",
      type: "survey",
      position: { x: 200, y: 0 },
      data: {
        surveyId: MOCK_SURVEY_ID, // Added surveyId
        inputData: {},
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} as any },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 200, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      dragging: false,
    };
    store.addNode(surveyNode);

    store.addEdge({ id: "e1", source: "problem-1", target: "survey-1" });

    await store.propagateOutput("problem-1");

    // Simula fetch real dos dados do survey após processInput
    const statusUpdate = surveyNodeHandler.handleAction
      ? await surveyNodeHandler.handleAction(
          "fetchSurveyStatus",
          {},
          { ...surveyNode, data: { ...surveyNode.data } },
          global.$fetch
        )
      : {};
    store.updateNodeData("survey-1", {
      ...(statusUpdate as Partial<NodeData>),
    });

    await store.propagateOutput("survey-1");

    // Checa outputData do Survey
    const updatedSurveyNode = store.nodes.find((n) => n.id === "survey-1");

    expect(
      updatedSurveyNode?.data.outputData?.survey_results?.submissions
    ).toMatchObject([
      { id: 1, answer: "Mais feedback", rating: 4 },
      { id: 2, answer: "Melhor suporte", rating: 5 },
    ]);
    // Checa cumulativeContext do Survey
    const surveyContext = decompress(updatedSurveyNode?.data.cumulativeContext);

    expect(surveyContext["problem-1"]).toHaveProperty("output.problem");

    // 4. Report
    const reportNode = {
      id: "report-1",
      type: "reportCard",
      position: { x: 400, y: 0 },
      data: {
        inputData: {},
        outputData: null,
        cumulativeContext: { compressed: false, blob: {} as any },
        updated_at: null,
      },
      selected: false,
      resizing: false,
      events: {},
      computedPosition: { x: 400, y: 0, z: 0 },
      handleBounds: { source: [], target: [] },
      dimensions: { width: 0, height: 0 },
      isParent: false,
      dragging: false,
    };
    store.addNode(reportNode);

    store.addEdge({ id: "e2", source: "survey-1", target: "report-1" });

    // Supondo um handler básico para o reportCard só para o teste
    const reportCardNodeHandler = {
      processInput: vi.fn((nodeData, parentOutputs) => ({
        ...nodeData,
        outputData: { report: "mock-report", ...parentOutputs["survey-1"] },
        cumulativeContext: { compressed: false, blob: { ...parentOutputs } },
      })),
    };

    // Propaga Survey -> Report
    // The parentOutputs for the report node should be a flat structure of node_id: { output: ..., type: ..., version: ... }
    // For survey-1, its outputData is already what we need.
    // For problem-1, it's already in surveyContext correctly structured.
    const reportParentOutputs = {
      "survey-1": updatedSurveyNode?.data.outputData, // This is the direct output of survey-1
      "problem-1": surveyContext["problem-1"], // This is the cumulative context entry for problem-1 from survey's perspective
    };

    const reportInputResult = await reportCardNodeHandler.processInput(
      reportNode.data,
      reportParentOutputs
    );

    store.updateNodeData("report-1", reportInputResult);

    // Checa outputData do Report (deve conter o que veio do survey)
    // Checa outputData do Report (deve conter o que veio do survey)
    const updatedReportNode = store.nodes.find((n) => n.id === "report-1");

    expect(
      updatedReportNode?.data.outputData?.survey_results?.submissions
    ).toMatchObject([
      { id: 1, answer: "Mais feedback", rating: 4 },
      { id: 2, answer: "Melhor suporte", rating: 5 },
    ]);
    // Checa cumulativeContext do Report (deve conter o do problem e do survey)
    const reportContext = decompress(updatedReportNode?.data.cumulativeContext);

    // Check problem-1 context within report's cumulative context
    expect(reportContext["problem-1"]).toHaveProperty("output.problem");
    expect(reportContext["problem-1"].output).toMatchObject({
      problem: {
        title: "Problema sem título",
        description: "",
      },
    });
    // Check survey-1 context within report's cumulative context
    // The mock reportCardNodeHandler directly spreads parentOutputs["survey-1"] into its outputData,
    // and the whole parentOutputs (which includes "survey-1": updatedSurveyNode?.data.outputData) into cumulativeContext.blob
    expect(reportContext["survey-1"]).toMatchObject(
      updatedSurveyNode?.data.outputData ?? {}
    );
  });
});
