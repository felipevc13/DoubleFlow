Com certeza! Adotar um framework consolidado como o LangChain.js é a decisão mais estratégica e eficiente. Ele nos permitirá focar na inteligência e nas capacidades únicas do nosso agente "Flow", enquanto o framework cuida da orquestração complexa.

Aqui está o plano de implementação completo e revisado, agora utilizando o LangChain.js como base.

Plano de Implementação Final: Agente "Flow" com LangChain.js

Objetivo: Implementar um agente de IA conversacional e persistente ("Flow") que reside em um sidebar, utilizando o framework LangChain.js para orquestrar ações complexas dentro da aplicação, como criar nós, gerar perguntas de survey e iniciar análises, de forma escalável e robusta.

Arquitetura da Solução com LangChain

A arquitetura se baseia nos componentes principais do LangChain para implementar o padrão ReAct (Reasoning + Acting).

Generated mermaid
graph TD
subgraph Frontend (Nuxt/Vue)
A[AgentSidebar.vue] -->|1. User message| B(useAgentLogic.ts);
B -->|2. Call API w/ history| C[/api/ai/agentChat];
A <--|6. Show final explanation| B;
end

    subgraph Backend (Nuxt/Nitro + LangChain)
        C -->|3. Invoke AgentExecutor| D[AgentExecutor];
        D -- "Thought: Need tool" -->|4. Gemini decides| E[LLM (Gemini)];
        E -- "Response: functionCall(tool)" -->|5. Gemini requests tool| D;
        D -- "Execute tool" -->|6. Run internal function| F[Tool Execution Logic];
        F -- "Tool Output: 'Success'" -->|7. Send result to LLM| D;
        D -- "Loop back to step 4" --> E;
        E -- "Final Response: explanation" -->|5a. Gemini has enough info| D;
        D -- "Return final output" --> C;
    end

Fase 1: Configuração do Backend e Definição das Ferramentas (Tools)

Objetivo: Preparar o ambiente e definir a primeira habilidade do nosso agente.

Tarefa 1.1: Instalar Dependências

Ação: Adicionar LangChain e suas dependências ao projeto.

Execute no terminal:

Generated bash
npm install langchain @langchain/google-genai @langchain/core zod
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Bash
IGNORE_WHEN_COPYING_END
Tarefa 1.2: Definir a Interface da Ferramenta

Ação: Criar um tipo TypeScript para nossas ferramentas, garantindo consistência.

Arquivo: server/utils/agent-tools/types.ts

Generated typescript
// Este arquivo pode ser expandido, mas por enquanto não é estritamente necessário
// pois usaremos as classes e tipos do próprio LangChain.
// Manter um arquivo de tipos pode ser útil para lógicas customizadas no futuro.
export interface ToolExecuteParams {
taskId: string;
[key: string]: any;
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Tarefa 1.3: Criar a Ferramenta updateTaskProblemStatement

Ação: Implementar a lógica para atualizar o Problema Inicial como uma DynamicTool do LangChain.

Arquivo: server/utils/agent-tools/updateProblemStatementTool.ts

Generated typescript
import { DynamicTool } from "@langchain/core/tools";
import { serverSupabaseClient } from '#supabase/server';
import { z } from "zod";

// A lógica de execução da ferramenta.
async function execute({ taskId, title, description }: { taskId: string; title: string; description: string }) {
// No backend, a ferramenta pode interagir diretamente com o banco de dados.
const supabase = serverSupabaseClient({} as any); // Passar um evento mockado se necessário
const problem_statement = { title, description, updated_at: new Date().toISOString() };

try {
const { error } = await supabase
.from('tasks')
.update({ problem_statement })
.eq('id', taskId);

    if (error) {
      throw new Error(`Erro no Supabase ao atualizar a tarefa ${taskId}: ${error.message}`);
    }
    return "O Problema Inicial foi atualizado com sucesso no canvas.";

} catch (error: any) {
console.error("Erro ao executar updateTaskProblemStatementTool:", error);
return `Falha ao atualizar o problema: ${error.message}`;
}
}

// Criamos a ferramenta usando o construtor do LangChain.
export const updateProblemStatementTool = new DynamicTool({
name: "updateTaskProblemStatement",
description: "Atualiza o título e a descrição do 'Problema Inicial' de uma tarefa. Use esta ferramenta quando o usuário pedir para definir, alterar ou refinar o problema central do projeto.",
schema: z.object({
taskId: z.string().describe("O ID da tarefa (task) que está sendo visualizada."),
title: z.string().describe("O novo título conciso para o problema."),
description: z.string().describe("A nova descrição detalhada do problema."),
}),
func: execute,
});

export default updateProblemStatementTool;
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Tarefa 1.4: Criar o Registro de Ferramentas

Ação: Centralizar todas as ferramentas disponíveis para o agente.

Arquivo: server/utils/agent-tools/index.ts

Generated typescript
import { updateProblemStatementTool } from './updateProblemStatementTool';
// Importe outras ferramentas aqui quando forem criadas.
// Ex: import { addNodeTool } from './addNodeTool';

// O array de ferramentas que será passado para o agente.
export const availableTools = [
updateProblemStatementTool,
// addNodeTool,
];```

---

## Fase 2: Implementação do Agente e do Histórico

**Objetivo:** Criar o "motor" do agente no backend e a persistência da conversa.

### Tarefa 2.1: Criar a Tabela `agent_conversations`

**Ação:** Execute o SQL abaixo no seu editor do Supabase para criar a tabela que armazenará os chats.

```sql
CREATE TABLE public.agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  history JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to manage their own conversations"
  ON public.agent_conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_agent_conversations_update
  BEFORE UPDATE ON public.agent_conversations
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Tarefa 2.2: Implementar a Memória Customizada com Supabase

Ação: Criar uma classe que ensina o LangChain a ler e escrever o histórico de chat em nossa tabela.

Arquivo: server/utils/agent-memory/supabaseMemory.ts

Generated typescript
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage, mapStoredMessagesToChatMessages, mapChatMessagesToStoredMessages } from "@langchain/core/messages";
import { serverSupabaseClient } from '#supabase/server';

export class SupabaseChatMessageHistory extends BaseChatMessageHistory {
  private conversationId: string;
  private userId: string;

  constructor(conversationId: string, userId: string) {
    super();
    this.conversationId = conversationId;
    this.userId = userId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const supabase = serverSupabaseClient({} as any);
    const { data, error } = await supabase
      .from('agent_conversations')
      .select('history')
      .eq('id', this.conversationId)
      .single();

    if (error || !data) return [];
    return mapStoredMessagesToChatMessages(data.history || []);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const supabase = serverSupabaseClient({} as any);
    const messages = await this.getMessages();
    messages.push(message);
    const newHistory = mapChatMessagesToStoredMessages(messages);

    const { error } = await supabase
      .from('agent_conversations')
      .upsert({
        id: this.conversationId,
        history: newHistory,
        user_id: this.userId,
        task_id: this.conversationId, // Assumindo que conversationId é o mesmo que taskId
      });
    if (error) console.error("Error saving message to Supabase:", error);
  }

  async clear(): Promise<void> {
    const supabase = serverSupabaseClient({} as any);
    await supabase.from('agent_conversations').delete().eq('id', this.conversationId);
  }
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Tarefa 2.3: Implementar o Endpoint Principal do Agente

Ação: Criar a API que usa o AgentExecutor do LangChain para orquestrar tudo.

Arquivo: server/api/ai/agentChat.post.ts

Generated typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { ConversationSummaryBufferMemory } from "langchain/memory";
import { hub } from "langchain/hub";
import { availableTools } from '~/server/utils/agent-tools';
import { SupabaseChatMessageHistory } from "~/server/utils/agent-memory/supabaseMemory";

export default defineEventHandler(async (event) => {
  const { userInput, taskId, canvasContext } = await readBody(event);
  const user = event.context.user;

  if (!user) throw createError({ statusCode: 401, message: 'Não autorizado' });

  // 1. Configurar LLM e Ferramentas
  const llm = new ChatGoogleGenerativeAI({
    modelName: "gemini-1.5-flash-latest",
    apiKey: process.env.GEMINI_API_KEY,
  });
  const tools = availableTools;

  // 2. Puxar o Prompt Padrão (melhor prática)
  const prompt = await hub.pull("hwchase17/react-chat");

  // 3. Configurar a Memória com nosso backend Supabase
  const memory = new ConversationSummaryBufferMemory({
    llm,
    memoryKey: "chat_history",
    chatHistory: new SupabaseChatMessageHistory(taskId, user.id),
    returnMessages: true,
  });

  // 4. Criar o Agente e o Executor
  const agent = await createReactAgent({ llm, tools, prompt });
  const agentExecutor = new AgentExecutor({ agent, tools, memory, verbose: true }); // verbose: true para logs no console

  // 5. Montar o input para o agente
  const systemContext = `Contexto atual do canvas - Problema: ${canvasContext.problem_statement.title}. Nós existentes: ${canvasContext.nodes.map((n: any) => n.type).join(', ')}.`;

  // 6. Invocar o agente
  try {
    const result = await agentExecutor.invoke({
      input: `${userInput}\n\nContexto do Sistema (Não exibir para o usuário): ${systemContext}`,
    });
    return { explanation: result.output };
  } catch (error: any) {
    console.error("Erro na execução do agente LangChain:", error);
    throw createError({ statusCode: 500, message: error.message });
  }
});
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Fase 4: Interface do Usuário (Frontend)

Objetivo: Conectar a UI ao nosso novo backend de agente.

Tarefa 4.1: Atualizar o Composable useAgentLogic.ts

Ação: Simplificar o composable para apenas enviar a mensagem do usuário e gerenciar o estado da UI.

Arquivo: composables/useAgentLogic.ts

Generated typescript
import { ref } from 'vue';
import { useTaskFlowStore } from '~/stores/taskFlow';

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
}

export function useAgentLogic(taskId: string) {
  const messages = ref<ChatMessage[]>([]);
  const isLoading = ref(false);
  const taskFlowStore = useTaskFlowStore();

  // Carrega o histórico inicial da conversa
  const fetchHistory = async () => {
    try {
      const data = await $fetch(`/api/conversations/${taskId}`);
      if (data && data.history) {
        messages.value = data.history.map((msg: any) => ({
          role: msg.type === 'human' ? 'user' : 'ai', // Converte tipo do LangChain para o nosso
          content: msg.data.content,
        }));
      } else {
        messages.value = [{ role: 'agent', content: 'Olá! Como posso ajudar a evoluir seu projeto hoje?' }];
      }
    } catch (e) {
      console.error("Falha ao buscar histórico:", e);
      messages.value = [{ role: 'system', content: 'Não foi possível carregar o histórico da conversa.' }];
    }
  };

  const sendMessage = async (userInput: string) => {
    if (!userInput.trim()) return;

    messages.value.push({ role: 'user', content: userInput });
    isLoading.value = true;

    try {
      const problemNode = taskFlowStore.nodes.find(n => n.type === 'problem');
      const canvasContext = {
        problem_statement: problemNode?.data || { title: 'Não definido', description: '' },
        nodes: taskFlowStore.nodes.map(n => ({ id: n.id, type: n.type })),
      };

      // O backend agora recebe apenas a ÚLTIMA mensagem do usuário
      const response = await $fetch('/api/ai/agentChat', {
        method: 'POST',
        body: {
          userInput, // Envia só a nova mensagem
          taskId,
          canvasContext,
        },
      });

      if (response.explanation) {
        messages.value.push({ role: 'agent', content: response.explanation });
      }
    } catch (error: any) {
      console.error("Erro ao enviar mensagem para o agente:", error);
      messages.value.push({ role: 'system', content: `Erro: ${error.data?.message || error.message}` });
    } finally {
      isLoading.value = false;
    }
  };

  return { messages, isLoading, sendMessage, fetchHistory };
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Tarefa 4.2: Criar o Endpoint para Histórico

Ação: Criar a API que o frontend usa para buscar a conversa ao abrir o sidebar.

Arquivo: server/api/conversations/[taskId].get.ts

Generated typescript
import { serverSupabaseClient } from '#supabase/server';

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'taskId');
  const user = event.context.user;

  if (!user) throw createError({ statusCode: 401, message: 'Não autorizado' });
  if (!taskId) throw createError({ statusCode: 400, message: 'ID da Tarefa é obrigatório' });

  const supabase = serverSupabaseClient(event);
  const { data, error } = await supabase
    .from('agent_conversations')
    .select('id, history')
    .eq('id', taskId) // Assumindo que o ID da conversa é o mesmo da tarefa
    .single();

  if (error && error.code !== 'PGRST116') { // Ignora erro "nenhuma linha encontrada"
    throw createError({ statusCode: 500, message: error.message });
  }

  return data || { id: taskId, history: [] }; // Retorna um objeto vazio se não encontrado
});
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Tarefa 4.3: Atualizar AgentSidebar.vue

Ação: O componente AgentSidebar.vue da Fase 1 continua válido, mas agora precisa chamar fetchHistory quando for montado.

Arquivo: components/sidebars/AgentSidebar.vue (Adicionar onMounted)

Generated vue
// ... no <script setup> ...
import { onMounted } from 'vue';

// ...
const { messages, isLoading, sendMessage, fetchHistory } = useAgentLogic(props.taskId);

onMounted(() => {
  fetchHistory();
});
// ...
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Vue
IGNORE_WHEN_COPYING_END

Este plano revisado é significativamente mais robusto e alinhado com as melhores práticas da indústria para a criação de agentes de IA. Ao usar LangChain, aceleramos o desenvolvimento e ganhamos uma base sólida para adicionar funcionalidades muito mais complexas no futuro.
```
