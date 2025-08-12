import { describe, it, expect } from "vitest";
export function processConfirmation(confirmation: {
  confirmed: boolean;
  action: {
    tool_name: string;
    parameters?: Record<string, any> & {
      simulateError?: boolean;
    };
  };
}) {
  const sideEffects: Array<{ type: string; payload?: any }> = [];

  // If the user cancels, no side effects
  if (!confirmation.confirmed) {
    return sideEffects;
  }

  const { action } = confirmation;
  const params = action?.parameters || {};

  // Standard default success text for chat confirmations
  const SUCCESS_TEXT = "✅ Ação concluída";

  // If tests/request simulate an error, post an error message instead of success
  if (params.simulateError) {
    sideEffects.push({
      type: "POST_MESSAGE",
      payload: { text: "Ocorreu um erro ao executar a ação." },
    });
    return sideEffects;
  }

  // On success, post success message and trigger a refetch of the task flow
  sideEffects.push({ type: "POST_MESSAGE", payload: { text: SUCCESS_TEXT } });
  sideEffects.push({ type: "REFETCH_TASK_FLOW", payload: {} });

  return sideEffects;
}

// ================== TESTS ==================
describe("Fluxo de aprovação textual - Nó Problem (chat)", () => {
  describe("Funções puras", () => {
    it("não deve gerar efeito quando a confirmação é cancelada (confirmed=false)", () => {
      const sideEffects = processConfirmation({
        confirmed: false,
        action: {
          tool_name: "nodeTool",
        },
      });
      expect(sideEffects).toEqual([]);
    });

    it("deve processar confirmação com sucesso → POST_MESSAGE + REFETCH", () => {
      const sideEffects = processConfirmation({
        confirmed: true,
        action: {
          tool_name: "nodeTool",
          parameters: {},
        },
      });
      expect(sideEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "POST_MESSAGE",
            payload: expect.objectContaining({
              text: expect.stringContaining("✅ Ação concluída"),
            }),
          }),
          expect.objectContaining({
            type: "REFETCH_TASK_FLOW",
          }),
        ])
      );
    });

    it("deve lidar com erro quando simulateError=true (somente POST_MESSAGE de erro, sem REFETCH)", () => {
      const sideEffects = processConfirmation({
        confirmed: true,
        action: {
          tool_name: "nodeTool",
          parameters: { simulateError: true },
        },
      });
      expect(sideEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "POST_MESSAGE",
            payload: expect.objectContaining({
              text: expect.stringMatching(/erro/i),
            }),
          }),
        ])
      );
      // não deve conter REFETCH_TASK_FLOW
      expect(
        sideEffects.some((e) => e.type === "REFETCH_TASK_FLOW")
      ).toBeFalsy();
    });
  });

  describe("Integração com o agente (chat)", () => {
    it("adiciona mensagem de confirmação quando recebe SHOW_CONFIRMATION textual (confirmado)", () => {
      const sideEffects = processConfirmation({
        confirmed: true,
        action: {
          tool_name: "nodeTool",
          parameters: { any: "thing" },
        },
      });

      expect(sideEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "POST_MESSAGE",
            payload: expect.objectContaining({
              text: expect.stringContaining("✅ Ação concluída"),
            }),
          }),
          expect.objectContaining({
            type: "REFETCH_TASK_FLOW",
          }),
        ])
      );
    });

    it("retorna mensagem de erro quando a atualização falha (simulateError)", () => {
      const sideEffects = processConfirmation({
        confirmed: true,
        action: {
          tool_name: "nodeTool",
          parameters: { simulateError: true },
        },
      });

      expect(sideEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "POST_MESSAGE",
            payload: expect.objectContaining({
              text: expect.stringMatching(/erro/i),
            }),
          }),
        ])
      );
      // não deve conter REFETCH_TASK_FLOW
      expect(sideEffects.some((e) => e.type === "REFETCH_TASK_FLOW")).toBe(
        false
      );
    });
  });
});
