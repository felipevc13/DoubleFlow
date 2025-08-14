// server/utils/agent/intents/validators/problemRefinement.schema.ts
import { z } from "zod";

/**
 * Snapshot mínimo do contexto que o refinamento usa.
 * (Mantemos solto para não acoplar no Graph inteiro)
 */
export const CanvasContextSchema = z
  .object({
    problem_statement: z
      .object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .optional(),
    nodes: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
        })
      )
      .optional(),
    edges: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
        })
      )
      .optional(),
  })
  // aceita undefined (o chamador pode enviar {})
  .optional();

/**
 * Princípios de refinamento (flags) — todos opcionais;
 * quando true, o agente deve considerar a regra.
 */
export const RefinementPrinciplesSchema = z
  .object({
    focoNoUsuario: z.boolean().optional(),
    clarezaEspecificidade: z.boolean().optional(),
    semSolucao: z.boolean().optional(),
    relevanciaImpacto: z.boolean().optional(),
    contextoClaro: z.boolean().optional(),
    quantificarImpacto: z.boolean().optional(),
    fidelidadeEscopo: z.boolean().optional(),
  })
  .optional();

/**
 * Entrada para ASK_CLARIFY
 */
export const AskClarifyInputSchema = z.object({
  taskId: z.string(),
  canvasContext: CanvasContextSchema,
  // prompt base do clarifying (ex.: “quero refinar o problema X”)
  userInput: z.string().min(1),
  // princípios opcionais
  principles: RefinementPrinciplesSchema,
});

/**
 * Resposta do usuário ao ASK_CLARIFY
 */
export const ClarifyAnswerSchema = z.object({
  taskId: z.string(),
  answers: z
    .record(z.string(), z.union([z.string(), z.boolean(), z.number()]))
    .default({}),
});

/**
 * Proposta de alteração (PATCH PROPOSTO) — só título/descrição.
 * Mantemos “partial” e explicitamos diffs.
 */
export const ProblemPatchSchema = z.object({
  nodeId: z.string().min(1),
  patch: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

/**
 * Payload de pending_confirmation (PROPOSE_PATCH → CONFIRM)
 */
export const ProblemRefinementProposalSchema = z.object({
  render: z.literal("chat"),
  summary: z.string().min(1),
  diff: z
    .array(
      z.object({
        field: z.enum(["title", "description"]),
        before: z.string().nullable().optional(),
        after: z.string().nullable().optional(),
      })
    )
    .default([]),
  parameters: z.object({
    taskId: z.string(),
    nodeType: z.literal("problem"),
    operation: z.literal("patch"),
    nodeId: z.string(),
    canvasContext: CanvasContextSchema,
    // o que será efetivamente aplicado no nodeTool
    patch: z.array(
      z.object({
        op: z.literal("replace"),
        path: z.enum(["/title", "/description"]),
        value: z.string(),
      })
    ),
    // metadados informativos
    event: z.string().optional(),
    isApprovedOperation: z.boolean().optional(),
  }),
});
