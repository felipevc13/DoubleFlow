import { CanvasContext, ClarifyQuestion } from "../types";

// Resultado interno do detector (usar discriminador 'kind')
type DetectResult =
  | { kind: "clarify"; questions: ClarifyQuestion[] }
  | { kind: "ok" };

export type PatchProposal = {
  patch: Partial<{ title: string; description: string }>;
  rationale: string[];
};

export type ValidationIssue = {
  principle: string;
  level: "error" | "warn";
  message: string;
};
export type ValidationReport = { ok: boolean; issues: ValidationIssue[] };

export type ProblemRefinementAdapter = {
  detect(input: string, ctx: CanvasContext): DetectResult;
  ask(ctx: CanvasContext): ClarifyQuestion[];
  propose(
    input: string,
    ctx: CanvasContext,
    answers?: Record<string, string>
  ): Promise<PatchProposal>;
  validate(
    current: { title: string; description: string },
    prop: PatchProposal
  ): ValidationReport;
  toConfirmation(
    current: { title: string; description: string },
    prop: PatchProposal,
    report: ValidationReport,
    ctx: CanvasContext
  ): {
    summary: string;
    diff: Array<{ field: "title" | "description"; from: string; to: string }>;
    parameters: {
      nodeType: "problem";
      operation: "update";
      nodeId: string;
      newData: any;
    };
  };
};

// IMPLEMENTAÇÃO/STUB para compilar agora; você pode trocar a lógica depois
export const problemRefinementAdapter: ProblemRefinementAdapter = {
  detect(input, _ctx) {
    const text = typeof input === "string" ? input : "";
    const shouldClarify = text.trim().length < 8;
    return shouldClarify
      ? {
          kind: "clarify",
          questions: [
            {
              key: "who",
              label: "Quem é o usuário afetado?",
              placeholder: "Ex.: novos usuários do app",
              required: true,
            },
            {
              key: "pain",
              label: "Qual é a dor/necessidade principal?",
              placeholder: "Ex.: app fecha ao abrir perfil",
              required: true,
            },
          ],
        }
      : { kind: "ok" };
  },
  ask(_ctx) {
    return [
      {
        key: "who",
        label: "Quem é o usuário afetado?",
        placeholder: "Ex.: novos usuários do app",
        required: true,
      },
      {
        key: "pain",
        label: "Qual é a dor/necessidade principal?",
        placeholder: "Ex.: app fecha ao abrir perfil",
        required: true,
      },
    ];
  },
  async propose(input, _ctx, answers) {
    const rawInput = typeof input === "string" ? input.trim() : "";
    const who = answers?.who?.trim();
    const pain = answers?.pain?.trim();

    const baseTitle = who ? `Problema do usuário: ${who}` : "Problema";
    const description = pain ? `Usuários enfrentam: ${pain}.` : rawInput;

    return {
      patch: {
        title: baseTitle,
        description: description || "",
      },
      rationale: ["Foco no usuário", "Clareza e especificidade"],
    };
  },
  validate(current, prop) {
    const issues: ValidationIssue[] = [];
    const { title, description } = prop.patch;

    const hasSolution = (s?: string) =>
      !!s && /soluç(ão|ao)|implementar|construir|fazer\s+\w+/i.test(s);

    if (hasSolution(title) || hasSolution(description)) {
      issues.push({
        principle: "Sem menção à solução",
        level: "error",
        message: "Não prescreva solução no problema.",
      });
    }
    if (typeof title === "string" && title.trim().length < 5) {
      issues.push({
        principle: "Clareza e Especificidade",
        level: "warn",
        message: "Título muito curto.",
      });
    }
    return { ok: !issues.some((i) => i.level === "error"), issues };
  },
  toConfirmation(current, prop, _report, ctx) {
    const patch = prop.patch;
    const diff: Array<{
      field: "title" | "description";
      from: string;
      to: string;
    }> = [];

    if (typeof patch.title === "string" && patch.title !== current.title) {
      diff.push({ field: "title", from: current.title ?? "", to: patch.title });
    }
    if (
      typeof patch.description === "string" &&
      patch.description !== current.description
    ) {
      diff.push({
        field: "description",
        from: current.description ?? "",
        to: patch.description,
      });
    }

    const problemId = ctx?.problem_statement?.id ?? "problem-1";

    return {
      summary: "Refinar Problema: aplicar alterações propostas",
      diff,
      parameters: {
        nodeType: "problem",
        operation: "update",
        nodeId: problemId,
        newData: patch,
      },
    };
  },
};

export const refineProblemHelper = problemRefinementAdapter;
