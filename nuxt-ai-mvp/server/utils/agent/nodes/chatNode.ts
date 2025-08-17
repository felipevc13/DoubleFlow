import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { PlanExecuteState } from "../graphState";
import { GEMINI_15_FLASH, GEMINI_20_FLASH_LITE } from "~/config/aiModels";

const gemini15Flash = new ChatGoogleGenerativeAI({
  model: GEMINI_15_FLASH,
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.8,
});
const gemini20FlashLite = new ChatGoogleGenerativeAI({
  model: GEMINI_20_FLASH_LITE,
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.8,
});

async function invokeWithFallback(messages: BaseMessage[]) {
  try {
    const response = await gemini15Flash.invoke(messages);
    console.log("[chatNode] Modelo utilizado: gemini-1.5-flash-latest");
    return response;
  } catch (err) {
    if (
      (err as any)?.message?.includes("503") ||
      (err as any)?.status === 503
    ) {
      console.warn(
        "[chatNode] Gemini 1.5 Flash indisponível, tentando 2.0 Flash-Lite"
      );
      try {
        const response = await gemini20FlashLite.invoke(messages);
        console.log("[chatNode] Modelo utilizado: gemini-2.0-flash-lite");
        return response;
      } catch (err2) {
        console.error(
          "[chatNode] Falha também no Gemini 2.0 Flash-Lite:",
          err2
        );
        throw err2;
      }
    }
    throw err;
  }
}

export async function chatNode(
  state: PlanExecuteState
): Promise<Partial<PlanExecuteState>> {
  const { input, messages } = state;

  console.log("[chatNode] Executando com input:", input);

  try {
    // The current human input is already part of the state.input.
    // The chat model should process the input directly, and the chat_history
    // should only contain past messages.
    const response = await invokeWithFallback([
      ...messages,
      new HumanMessage(input as string),
    ]);

    const text = response.content as string;

    console.log("[chatNode] Resposta da IA:", text);

    // Cria o histórico final para esta execução
    // The newMessages should include the current human input and the AI's response.
    // Ensure the human input is added only once to the final history.
    const newMessages: BaseMessage[] = [
      ...messages,
      new HumanMessage(input as string), // Add the current human input to the history
      new AIMessage(text), // Add the AI's response
    ];

    return {
      // Substitui o histórico antigo pelo novo, evitando duplicações
      messages: newMessages,
      input: "",
    };
  } catch (error) {
    console.error("[chatNode] Erro ao invocar o modelo:", error);
    const errorMsg = new AIMessage("Desculpe, ocorreu um erro ao responder.");
    return {
      // Anexa uma mensagem de erro no histórico para manter a UI em sincronia sem sideEffects
      messages: [...(state.messages || []), errorMsg],
      input: "",
    };
  }
}
