const nodeTypesRaw = {
  // PROBLEM: somente update/patch (não criável, não deletável)
  problem: {
    version: "1.2.0",
    fields: { editable: ["title", "description"] },
    operations: {
      update: {
        needsApproval: true,
        approvalRender: "modal",
        diffFields: ["title", "description"],
      },
      patch: {
        needsApproval: true,
        approvalRender: "modal",
        diffFields: ["title", "description"],
      },
    },
    ui: { defaultRender: "modal" },
  },

  // NOTE: exemplo de card simples, criável e deletável
  note: {
    version: "1.0.0",
    fields: { editable: ["text"] },
    operations: {
      create: { needsApproval: false, approvalRender: "chat" },
      update: {
        needsApproval: false,
        approvalRender: "chat",
        diffFields: ["text"],
      },
      delete: { needsApproval: true, approvalRender: "chat" }, // exija confirmação p/ deletar
      patch: {
        needsApproval: false,
        approvalRender: "chat",
        diffFields: ["text"],
      },
    },
    ui: { defaultRender: "chat" },
  },

  // DATASOURCE: somente criação e deleção (sem update/patch)
  dataSource: {
    version: "1.0.0",
    aliases: [
      "card de dados",
      "dados",
      "fonte de dados",
      "data card",
      "dataset",
    ],
    purpose: "Armazena fontes/planilhas/datasets para análises.",
    fields: {
      editable: ["title", "description", "sources"],
    },
    operations: {
      // criação não precisa aprovação (UI abre modal para selecionar fontes)
      create: { needsApproval: false, approvalRender: "modal" },

      // deleção exige confirmação no chat
      delete: { needsApproval: true, approvalRender: "chat" },
    },
    ui: { defaultRender: "modal" },
  },
};

export default nodeTypesRaw;
