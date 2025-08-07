// utils/agentTestUtils.ts

// Função pura para gerar efeito de confirmação textual
export function generateApprovalSideEffect(input: string, nodeId: string) {
  if (input.startsWith("defina o problema como ")) {
    const novoTitulo = input.replace("defina o problema como ", "");
    return [
      {
        type: "SHOW_CONFIRMATION",
        payload: {
          tool_name: "problem.update",
          parameters: { nodeId, newData: { title: novoTitulo } },
          displayMessage: "Você aprova esta alteração textual?",
          approvalStyle: "text",
        },
      },
    ];
  }
  return [];
}

// Função pura para processar a confirmação
export function processConfirmation(confirm: {
  confirmed: boolean;
  action: any;
}) {
  if (confirm.confirmed && confirm.action.tool_name === "problem.update") {
    return [
      {
        type: "POST_MESSAGE",
        payload: { text: "Ação de texto concluída!" },
      },
      {
        type: "REFETCH_TASK_FLOW",
        payload: {},
      },
    ];
  }
  return [];
}
