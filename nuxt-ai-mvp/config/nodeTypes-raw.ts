const nodeTypesRaw = {
  // PROBLEM: somente update/patch (não criável, não deletável)
  problem: {
    version: "1.2.0",
    fields: { editable: ["title", "description"] },
    operations: {
      update: {
        needsApproval: true,
        approvalRender: "chat",
        diffFields: ["title", "description"],
      },
      patch: {
        needsApproval: true,
        approvalRender: "chat",
        diffFields: ["title", "description"],
      },
    },
    ui: { defaultRender: "chat" },
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
};

export default nodeTypesRaw;
