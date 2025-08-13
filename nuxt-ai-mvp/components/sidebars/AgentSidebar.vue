<template>
  <BaseSidebar :is-open="isOpen">
    <div class="flex flex-col h-full bg-[#18181B] text-white">
      <!-- Header estilo Grok -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-[#23232A]"
      >
        <h2 class="text-xl font-semibold">Flow</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-white transition"
        >
          <OpenRight class="w-6 h-6" />
        </button>
      </div>

      <!-- Mensagens -->
      <div
        ref="chatContainer"
        class="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6"
      >
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="
            msg.role === 'confirmation'
              ? 'flex justify-start w-full'
              : bubbleClass(msg.role)
          "
        >
          <!-- DEBUG INFO -->
          <!-- <div v-if="msg.role === 'confirmation'">
            DEBUG: Role: {{ msg.role }} | Approval Style:
            {{ msg.action?.approvalStyle }} | Diff Fields:
            {{ msg.action?.diffFields }}
          </div> -->
          <!-- END DEBUG INFO -->

          <ActionConfirmation
            v-if="msg.role === 'confirmation' && msg.action"
            :action="ensureAction(msg.action)"
            @confirm="handleConfirmation(msg.action)"
            @cancel="handleCancellation(msg.action)"
          />
          <div
            v-else
            :class="[
              'prose prose-invert max-w-[75%] break-words text-base relative',
              msg.role === 'user'
                ? 'bg-[#23232A] text-white rounded-2xl px-5  shadow'
                : msg.role === 'agent'
                ? 'bg-transparent text-white rounded-2xl px-5 py-3 shadow'
                : 'bg-red-900 text-white rounded-2xl px-5 py-3 shadow',
            ]"
          >
            <div v-html="renderMarkdown(msg.content)" />
            <span
              v-if="msg.role === 'user'"
              class="absolute right-[-6px] top-3 w-3 h-3 bg-[#23232A] rotate-45"
            ></span>
          </div>
        </div>
        <div v-if="isLoading" class="flex justify-start">
          <div class="bg-[#23232A] rounded-2xl px-5 py-3 shadow">
            <span class="loading loading-dots loading-sm"></span>
          </div>
        </div>
      </div>

      <!-- Área do input idêntica ao Grok -->
      <div class="px-6 py-5 border-t border-[#23232A] bg-[#18181B]">
        <div class="flex items-end gap-2">
          <!-- Área principal do input -->
          <div class="flex-1 relative">
            <textarea
              v-model="userInput"
              @keydown="handleKeyDown"
              @input="autoResize"
              placeholder="Como o Flow pode ajudar?"
              class="w-full bg-[#23232A] text-white rounded-3xl py-3 pl-4 pr-16 border-none focus:outline-none resize-none shadow-inner"
              rows="2"
              :disabled="isLoading"
              style="min-height: 56px; max-height: 180px; overflow-y: auto"
            ></textarea>
            <!-- Botão send sobreposto no canto direito do textarea -->
            <button
              @click="handleSend"
              class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 bg-blue-600 hover:bg-blue-700 rounded-full transition disabled:opacity-60"
              :disabled="isLoading || !userInput.trim()"
              aria-label="Enviar"
              type="button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="w-5 h-5 text-white"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 12h14m-7-7l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseSidebar>
</template>

<script setup lang="ts">
import {
  ref,
  watch,
  nextTick,
  watchEffect,
  toRef,
  onMounted,
  onBeforeUnmount,
} from "vue";
import BaseSidebar from "./BaseSidebar.vue";
import OpenRight from "../icon/OpenRight.vue";
import { useAgentLogic } from "~/composables/useAgentLogic";
import { marked } from "marked"; // Para renderizar markdown nas respostas
import ActionConfirmation from "~/components/agent/ActionConfirmation.vue";
import { useSupabaseClient } from "#imports";
import type { User } from "@supabase/supabase-js";

// Minimal ActionProposal type shape expected by ActionConfirmation
type ActionProposal = {
  tool_name: string;
  parameters: Record<string, any>;
  displayMessage: string;
} & Record<string, any>;

function ensureAction(action: any): ActionProposal {
  return {
    tool_name: action?.tool_name ?? "",
    parameters: action?.parameters ?? {},
    displayMessage: action?.displayMessage ?? "Confirmar esta ação?",
    ...action,
  } as ActionProposal;
}

const props = defineProps({
  isOpen: Boolean,
  taskId: { type: String, required: true },
});
const emit = defineEmits(["close"]);

const taskIdRef = toRef(props, "taskId");

const userInput = ref("");
const chatContainer = ref<HTMLDivElement | null>(null);

const supabase = useSupabaseClient();
const user = ref<User | null>(null);
const isAuthChecked = ref(false);
let authUnsub: null | (() => void) = null;

onMounted(async () => {
  try {
    // get current user once
    const { data } = await supabase.auth.getUser();
    user.value = data?.user ?? null;
    isAuthChecked.value = true;

    // subscribe to auth changes so the sidebar stays in sync
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        user.value = session?.user ?? null;
        isAuthChecked.value = true;
      }
    );
    authUnsub = listener?.subscription?.unsubscribe ?? null;
  } catch (err) {
    console.error("[AgentSidebar] auth.getUser error:", err);
    user.value = null;
    isAuthChecked.value = true;
  }
});

onBeforeUnmount(() => {
  if (authUnsub) {
    try {
      authUnsub();
    } catch {}
    authUnsub = null;
  }
});

// Inicializa a lógica do agente
const {
  messages,
  isLoading,
  sendMessage,
  fetchHistory,
  handleConfirmation,
  handleCancellation,
} = useAgentLogic(taskIdRef);

// Limpa as mensagens quando o taskId muda
watch(
  () => props.taskId,
  () => {
    messages.value = [];
  }
);

// Busca histórico APENAS quando há user e o sidebar está aberto
watchEffect(() => {
  const userId = user.value?.id;
  // Só executa se taskId estiver válido
  if (!props.taskId) return;

  if (userId && props.isOpen && props.taskId) {
    if (messages.value.length === 0) {
      fetchHistory();
    }
  } else if (isAuthChecked.value && !userId && props.isOpen) {
    messages.value = [
      {
        role: "system",
        content: "Por favor, faça login para ver o histórico.",
      },
    ];
  }
});

const renderMarkdown = (text: string) => marked.parse(text || "");

const messageClass = (role: "user" | "agent" | "system") => ({
  chat: true,
  "chat-start": role === "agent" || role === "system",
  "chat-end": role === "user",
});

const bubbleClass = (role: "user" | "agent" | "system") => {
  if (role === "user") return "flex justify-end w-full";
  if (role === "agent") return "flex justify-start w-full";
  if (role === "system") return "flex justify-start w-full";
};

const handleSend = () => {
  if (!userInput.value.trim() || isLoading.value) return;
  console.log("[AgentSidebar] Sending message:", userInput.value);
  sendMessage(userInput.value);
  userInput.value = "";
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
  // Shift+Enter: quebra linha normalmente
};

const autoResize = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement;
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
};

watch(
  messages,
  async () => {
    console.log("[AgentSidebar] Messages updated:", messages.value);
    await nextTick();
    if (chatContainer.value) {
      const el = chatContainer.value as HTMLDivElement;
      el.scrollTop = el.scrollHeight;
    }
  },
  { deep: true }
);
</script>
