import { consola } from "consola";

type AgentConversationRow = {
  id: string;
  history: any[]; // Ajuste para StoredMessage[] se quiser mais estrito
  user_id: string;
  task_id: string;
};
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapStoredMessagesToChatMessages,
  mapChatMessagesToStoredMessages,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Checkpoint } from "@langchain/langgraph";

export class SupabaseChatMessageHistory extends BaseChatMessageHistory {
  private supabase: SupabaseClient;
  private conversationId: string;
  private userId: string;

  constructor(options: {
    client: SupabaseClient;
    conversationId: string;
    userId: string;
  }) {
    super();
    this.supabase = options.client;
    this.conversationId = options.conversationId;
    this.userId = options.userId;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    // Implementação mínima para compatibilidade
    await this.addMessages([message]);
  }

  async getMessages(): Promise<BaseMessage[]> {
    consola.debug(
      `[SupabaseChatMessageHistory] getMessages called for conversationId: ${this.conversationId}`
    );
    const { data, error } = await this.supabase
      .from("agent_conversations")
      .select("history")
      .eq("id", this.conversationId)
      .limit(1); // Fetch at most one row

    if (error) {
      consola.error(
        `[SupabaseChatMessageHistory] Error getting messages for ${this.conversationId}:`,
        error
      );
      return [];
    }

    // If data is an array, take the first element. If no data, it will be null/undefined.
    const conversationData = data?.[0];

    if (!conversationData) {
      consola.debug(
        `[SupabaseChatMessageHistory] No data found for conversationId: ${this.conversationId}`
      );
      return [];
    }

    const messages = mapStoredMessagesToChatMessages(
      (conversationData as { history: any[] }).history || []
    );
    consola.debug(
      `[SupabaseChatMessageHistory] Loaded ${messages.length} messages for ${this.conversationId}. First message:`,
      messages[0]
    );
    return messages;
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    consola.debug(
      `[SupabaseChatMessageHistory] addMessages for conversationId: ${this.conversationId}, count: ${messages.length}`
    );

    // Carrega o histórico atual uma vez só
    const currentMessages = await this.getMessages();
    currentMessages.push(...messages);
    const newHistory = mapChatMessagesToStoredMessages(currentMessages);

    const { error: upsertError } = await this.supabase
      .from("agent_conversations")
      .upsert(
        {
          id: this.conversationId,
          history: newHistory,
          user_id: this.userId,
          task_id: this.conversationId,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      consola.error(
        `[SupabaseChatMessageHistory] Error saving messages in Supabase via upsert for ${this.conversationId}:`,
        upsertError
      );
    } else {
      consola.success(
        `[SupabaseChatMessageHistory] Messages saved successfully via upsert for ${this.conversationId}.`
      );
    }
  }

  async clear(): Promise<void> {
    await this.supabase
      .from("agent_conversations")
      .delete()
      .eq("id", this.conversationId);
  }
  async addUserMessage(text: string): Promise<void> {
    await this.addMessage(new HumanMessage(text));
  }

  async addAIChatMessage(text: string): Promise<void> {
    await this.addMessage(new AIMessage(text));
  }

  get lc_namespace() {
    return ["langchain", "memory", "chat_histories", "supabase"];
  }
}
