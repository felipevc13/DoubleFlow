import { vi } from "vitest";

// --- Google GenAI
export const invokeMock = vi.fn();

vi.mock("@langchain/google-genai", () => {
  const mockChatGoogleGenerativeAIInstance: any = {
    invoke: invokeMock,
    bind: vi.fn(() => mockChatGoogleGenerativeAIInstance),
    pipe: vi.fn(() => mockChatGoogleGenerativeAIInstance),
  };
  return {
    ChatGoogleGenerativeAI: vi.fn(() => mockChatGoogleGenerativeAIInstance),
  };
});
