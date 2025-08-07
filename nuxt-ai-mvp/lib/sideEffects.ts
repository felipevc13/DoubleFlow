import { z } from "zod";

/** Definição dos payloads individuais */
const PostMessage = z.object({
  type: z.literal("POST_MESSAGE"),
  payload: z.object({ text: z.string() }),
});
const FocusNode = z.object({
  type: z.literal("FOCUS_NODE"),
  payload: z.object({ nodeId: z.string() }),
});
const OpenModal = z.object({
  type: z.literal("OPEN_MODAL"),
  payload: z.object({ nodeId: z.string() }),
});
const CloseModal = z.object({
  type: z.literal("CLOSE_MODAL"),
  payload: z.object({}),
});
const RefetchTaskFlow = z.object({
  type: z.literal("REFETCH_TASK_FLOW"),
  payload: z.object({}).strict(),
});
export const ShowConfirm = z.object({
  type: z.literal("SHOW_CONFIRMATION"),
  payload: z.object({
    tool_name: z.string(),
    parameters: z.record(z.any()),
    displayMessage: z.string(),
    approvalStyle: z.string().optional(),
    diffFields: z.array(z.string()).optional(),
    originalData: z.record(z.any()).optional(),
    proposedData: z.record(z.any()).optional(),
    nodeId: z.string().optional(),
    modalTitle: z.string().optional(),
  }),
});
const ExecuteAction = z.object({
  type: z.literal("EXECUTE_ACTION"),
  payload: z.object({
    tool_name: z.string(),
    parameters: z.record(z.any()),
    feedbackMessage: z.string().optional(),
  }),
});

/**
 * Schema para comandos diretos que podem ser passados como input
 * para o classificador de intenção.
 */
export const DirectCmdSchema = z.object({
  tool_name: z.enum(["createNode", "updateNode", "deleteNode"]),
  parameters: z.record(z.any()),
});

/** União discriminada — fonte única da verdade para os efeitos colaterais */
export const effectSchemas = z.union([
  PostMessage,
  FocusNode,
  OpenModal,
  CloseModal,
  ShowConfirm,
  ExecuteAction,
  RefetchTaskFlow,
]);

/** Tipo TypeScript derivado */
export type SideEffect = z.infer<typeof effectSchemas>;
