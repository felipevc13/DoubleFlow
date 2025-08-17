// server/utils/agent/nodes/agentNode.ts

import { consola } from "consola";
import type { PlanExecuteState } from "../graphState";
import {
  classifyIntentGenericRunnable,
  toolLookup,
} from "~/server/api/ai/classifyIntentGeneric";
// ✅ IMPORT CORRIGIDO
import { refineProblemHelper } from "../intents/problemRefinement";
import type { ClarifyRequest } from "../types";

export async function agentNode(
  state: PlanExecuteState
): Promise<Partial<PlanExecuteState>> {
  consola.info("[agentNode] Analisando input e contexto...");

  const classification = await classifyIntentGenericRunnable.invoke({
    userInput: state.input,
    canvasContext: state.canvasContext ?? {},
  });

  const { action, target, args, refinement } = classification;
  // args pode conter chaves dinâmicas conforme o intent; tipamos como any para flexibilidade
  const _args: any = args ?? {};

  // Normaliza o tipo vindo do classificador (ex.: "datasource" -> "dataSource")
  const rawType = target?.type as string | undefined;
  const targetType = rawType === "datasource" ? "dataSource" : rawType;

  // Rota 1: Refinamento de Conteúdo (sempre que tentar alterar "problem")
  // Regras:
  // - Se a ação mira o nó "problem" e é update/patch, SEMPRE passamos pelo helper de refinamento
  //   antes de propor/execultar (CONFIRM). Isso garante o fluxo ASK_CLARIFY → PROPOSE_PATCH → CONFIRM.
  // - Caso queira pular explicitamente, o classificador pode enviar args.skip_refinement = true.
  if (
    targetType === "problem" &&
    (action === "update" || action === "patch") &&
    !_args?.skip_refinement
  ) {
    consola.info(
      "[agentNode] Refinamento forçado para alterações em 'problem'."
    );

    const userText = typeof state.input === "string" ? state.input : "";
    const refineOut: any = await refineProblemHelper.detect(
      userText,
      (state.canvasContext as any) ?? {}
    );

    // Tratamento de erro do helper
    if (refineOut && typeof refineOut === "object" && "error" in refineOut) {
      consola.debug("[agentNode] Erro no refinamento", {
        error: refineOut.error,
      });
      return {
        sideEffects: [
          {
            type: "POST_MESSAGE",
            payload: { text: `❌ Erro no refinamento: ${refineOut.error}` },
          },
        ],
        next_step: "chatNode" as any,
      };
    }

    // Caso 1: precisamos pedir esclarecimentos ao usuário (ASK_CLARIFY)
    if (refineOut && refineOut.kind === "clarify") {
      const msg =
        refineOut.message ||
        refineOut.question ||
        "Preciso de mais detalhes para refinar o problema. O que você quer ajustar (título, descrição, ou ambos)?";

      const clarifyReq: ClarifyRequest = {
        kind: "ASK_CLARIFY",
        reason: msg,
        questions: (refineOut.questions as any[])?.map((q: any) => ({
          key: q.key ?? q.id, // compat: aceita formato antigo
          label: q.label,
          placeholder: q.placeholder,
          required: !!q.required,
          type: q.type,
          options: q.options,
        })) ?? [
          {
            key: "scope",
            label: "Você quer ajustar o título, a descrição, ou ambos?",
            placeholder: "Escolha: título, descrição ou ambos",
            required: true,
          },
          {
            key: "context",
            label:
              "Existe algum contexto (usuário afetado, quando ocorre, impacto) que devo manter?",
            placeholder: "Descreva o contexto essencial (opcional)",
            required: false,
          },
        ],
        context: {
          nodeId: state.canvasContext?.problem_statement?.id,
          canvasContext: state.canvasContext,
        },
      };

      consola.debug("[agentNode] Saída clarify", { clarifyReq });
      return {
        clarify_request: clarifyReq,
        pending_confirmation: null,
        last_tool_result: null,
        // não decide UI aqui; orquestrador emite SHOW_CLARIFY/FOCUS se necessário
      };
    }

    // Caso 2: já temos uma proposta de alteração (PROPOSE_PATCH)
    const proposal: any = refineOut?.proposal ?? refineOut;
    const parameters = proposal?.parameters;
    const approvalRender = proposal?.render ?? "chat";

    consola.debug("[agentNode] Saída proposal/patch", { proposal, parameters });
    // Não executar direto: encaminhar para CONFIRM e já preparar a execução
    return {
      pending_confirmation: proposal,
      pending_execute: {
        tool_name: "nodeTool",
        parameters,
      },
      last_tool_result: null,
    };
  }

  // ... (o resto do arquivo `agentNode` permanece o mesmo) ...

  // Rota 2: Se a intenção é uma chamada de ferramenta (criar, deletar, etc.)
  // 🚧 Política: nó "problem" não pode ser criado nem deletado
  if (
    targetType === "problem" &&
    (action === "create" || action === "delete")
  ) {
    consola.debug("[agentNode] Ação inválida em problem", {
      action,
      targetType,
    });
    return {
      response:
        "❌ Ação inválida: o nó 'problema' não pode ser criado nem removido.",
      next_step: "chatNode" as any,
      last_tool_result: null,
    };
  }
  const actionId = `${targetType}.${action}`;
  const meta = toolLookup[actionId];

  if (meta) {
    // Preenchimento básico de parâmetros quando o classificador não forneceu ids
    const lastNode = state.canvasContext?.nodes?.at?.(-1);
    const problemId = state.canvasContext?.problem_statement?.id;
    const filledArgs: any = { ..._args };

    // Descobrir nodeId de destino quando não informado (para update/delete)
    let resolvedNodeId = filledArgs.nodeId ?? target?.id;
    if (!resolvedNodeId && (action === "update" || action === "delete")) {
      const lastOfType = state.canvasContext?.nodes
        ?.slice()
        ?.reverse()
        ?.find((n: any) => n.type === targetType);
      resolvedNodeId = lastOfType?.id;
    }

    // Monta parâmetros esperados pelo nodeTool (server‑driven)
    const parameters: any = {
      taskId: state.taskId,
      nodeType: targetType,
      operation: action, // "create" | "update" | "patch" | "delete"
    };

    if (action === "create") {
      // default amigável para dataSource
      parameters.newData =
        targetType === "dataSource"
          ? { title: "Card de Dados", ...(filledArgs.newData ?? {}) }
          : filledArgs.newData ?? {};
      // Prefira conectar no problema por padrão; se o caller passou um sourceNodeId, respeite.
      // Isso evita encadeamentos indesejados (p.ex., dataSource->dataSource) quando o último nó não é o melhor alvo.
      parameters.parentId =
        filledArgs.sourceNodeId ?? problemId ?? lastNode?.id ?? undefined;
    } else if (action === "update") {
      parameters.nodeId = resolvedNodeId;
      parameters.newData = filledArgs.newData ?? args?.newData ?? {};
    } else if (action === "patch") {
      parameters.nodeId = resolvedNodeId;
      parameters.patch = filledArgs.patch ?? [];
    } else if (action === "delete") {
      parameters.nodeId = resolvedNodeId;
    }

    // 🔗 encaminha contexto atual para o backend (ajuda a montar diff/approval)
    parameters.canvasContext = state.canvasContext;

    const toolCall = {
      tool_name: "nodeTool", // 🔑 unificada
      parameters,
    };

    const displayMessage = `A IA propõe: ${actionId}. Você confirma?`;

    // Se a ferramenta requer aprovação, não executa direto: abre confirmação via orquestrador
    if (meta?.needsApproval) {
      consola.debug("[agentNode] Saída com approval pendente", {
        actionId,
        parameters,
      });
      return {
        pending_confirmation: {
          kind: "PROPOSE_PATCH",
          render: meta.approvalRender ?? "modal",
          summary: displayMessage,
          parameters,
        } as any,
        pending_execute: {
          tool_name: "nodeTool",
          parameters,
        },
        last_tool_result: null,
      };
    }

    // Caso contrário, executa direto
    consola.debug("[agentNode] Execução direta sem approval", {
      actionId,
      parameters,
    });
    return { pending_execute: toolCall, last_tool_result: null };
  }

  // Rota 3: Fallback para Chat
  consola.debug("[agentNode] Fallback → chatNode", { input: state.input });
  consola.info("[agentNode] Nenhuma ação clara, roteando para chatNode.");
  return { next_step: "chatNode" as any, last_tool_result: null };
}
