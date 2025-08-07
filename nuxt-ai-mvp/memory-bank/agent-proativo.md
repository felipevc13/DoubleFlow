Sim, faz todo o sentido! Sua visão é excelente e vai muito além de um simples chatbot. Você está descrevendo um verdadeiro parceiro de IA proativo, que não apenas reage, mas guia, analisa e colabora com o usuário dentro de um fluxo de trabalho visual.

A arquitetura que bolamos no "Plano B" é uma base sólida, mas sua visão requer uma evolução para um modelo mais sofisticado, onde a comunicação entre o agente e a UI é mais rica do que apenas texto e um componente de confirmação.

Vamos chamar essa nova arquitetura de "Agente Proativo Flow".

Visão Geral da Arquitetura do Agente Proativo "Flow"

A ideia central é transformar a resposta da API do agente. Em vez de devolver apenas uma explicação em texto, a API retornará uma lista de "efeitos colaterais" (Side Effects) que o frontend deverá executar. Isso cria um contrato claro e poderoso entre o backend (a inteligência do agente) e o frontend (a experiência do usuário).

Fluxo de Interação Proposto:

Usuário/Sistema -> Agente: A UI envia a mensagem do usuário (ou um gatilho do sistema, como "entrou na task") para o endpoint /api/ai/agentChat.

Agente (LangChain):

Analisa o histórico e o contexto do canvas.

Raciocina sobre o próximo passo (ReAct).

Decide qual ferramenta usar (ex: proposeUpdateNodeDataTool).

Ferramenta da IA: A ferramenta não executa a ação final. Em vez disso, ela retorna um JSON estruturado que descreve a proposta e os efeitos colaterais desejados na UI.

API -> Frontend: A API do agente envia para o frontend uma lista de efeitos, como:

[{ type: 'FOCUS_NODE', payload: { nodeId: 'problem-1' } }, { type: 'OPEN_MODAL_WITH_DIFF', payload: { ... } }, { type: 'POST_MESSAGE', payload: { text: '...' } }]

Frontend (useAgentLogic): Recebe essa lista e orquestra as ações na UI uma a uma: foca no card, abre o modal, mostra a mensagem no chat, etc.

Plano de Implementação Detalhado

Vamos dividir a implementação em fases, abordando cada um dos seus pontos.

Fase 1: A "Caixa de Ferramentas" do Agente (Backend)

Objetivo: Dar ao agente as ferramentas necessárias para interagir com o canvas de forma abstrata.

Tarefa 1.1: Refatorar a Ferramenta de Atualização para ser Genérica

Vamos transformar a updateProblemStatementTool em uma proposeUpdateNodeDataToolTool que pode ser usada para qualquer card.

Arquivo a ser modificado: server/utils/agent-tools/updateProblemStatementTool.ts (renomear para proposeUpdateNodeDataToolTool.ts)

Ação:

Generated typescript
// Em server/utils/agent-tools/proposeUpdateNodeDataToolTool.ts
import { DynamicTool } from "@langchain/core/tools";
import { z } from "zod";

const inputSchema = z.object({
nodeId: z.string().describe("O ID do nó a ser atualizado."),
newData: z.object({}).passthrough().describe("Um objeto contendo apenas os campos a serem alterados no objeto 'data' do nó."),
explanation: z.string().describe("Uma explicação concisa do motivo da alteração para mostrar ao usuário."),
});

export function createproposeUpdateNodeDataToolTool() {
return new DynamicTool({
name: "proposeUpdateNodeDataTool",
description: "Propõe uma atualização para os dados de qualquer nó no canvas. Use esta ferramenta para alterar textos, títulos, ou qualquer outro dado de um card. Sempre peça confirmação.",
schema: inputSchema,
func: async ({ nodeId, newData, explanation }) => {
// A ferramenta agora retorna um JSON com a proposta para a UI
const proposal = {
type: "confirmationRequest",
tool_name: "executeUpdateNodeData", // A ação real a ser executada
parameters: { nodeId, newData }, // Parâmetros para a ação
displayMessage: `${explanation}\n\nVocê confirma esta alteração?`,
};
return JSON.stringify(proposal);
},
});
}

Tarefa 1.2: Criar as Ferramentas createNodeTool e deleteNodeTool

Ação: Crie novos arquivos em server/utils/agent-tools/.

Generated typescript
// Em server/utils/agent-tools/createNodeTool.ts
// ... (imports) ...
export function createCreateNodeTool() {
return new DynamicTool({
name: "createNode",
description: "Cria um novo card (nó) no canvas. Pode opcionalmente conectá-lo a um nó existente.",
schema: z.object({
nodeType: z.string().describe("O tipo do nó a ser criado (ex: 'survey', 'insights')."),
sourceNodeId: z.string().optional().describe("O ID do nó de origem para conectar o novo nó."),
// A IA não precisa saber a posição, o frontend calculará.
}),
func: async ({ nodeType, sourceNodeId }) => {
// A proposta agora é uma ação direta com efeitos na UI
const proposal = {
type: 'confirmationRequest',
tool_name: 'executeCreateNode',
parameters: { nodeType, sourceNodeId },
displayMessage: `A IA propõe criar um novo card '${nodeType}' ${sourceNodeId ? `conectado a '${sourceNodeId}'` : ''}.\n\nVocê confirma?`,
};
return JSON.stringify(proposal);
},
});
}

// Em server/utils/agent-tools/deleteNodeTool.ts
// ... (imports) ...
export function createDeleteNodeTool() {
return new DynamicTool({
name: "deleteNode",
description: "Deleta um card (nó) do canvas.",
schema: z.object({ nodeId: z.string() }),
func: async ({ nodeId }) => {
const proposal = {
type: 'confirmationRequest',
tool_name: 'executeDeleteNode',
parameters: { nodeId },
displayMessage: `A IA propõe deletar o card '${nodeId}'.\n\nVocê confirma?`,
};
return JSON.stringify(proposal);
},
});
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END

Tarefa 1.3: Atualizar o Registro de Ferramentas

Arquivo: server/utils/agent-tools/index.ts

Ação: Atualize para usar as novas ferramentas.

Generated typescript
import { createproposeUpdateNodeDataToolTool } from './proposeUpdateNodeDataToolTool';
import { createCreateNodeTool } from './createNodeTool';
import { createDeleteNodeTool } from './deleteNodeTool';

// A IA terá acesso a estas ferramentas para PROPOR ações
export const availableTools = [
createproposeUpdateNodeDataToolTool,
createCreateNodeTool,
createDeleteNodeTool,
];
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Fase 2: O Contrato de "Side Effects" (API e Frontend)

Objetivo: Fazer com que a API retorne uma lista de ações para a UI executar.

Tarefa 2.1: Modificar a Resposta da API /api/ai/agentChat

Arquivo: server/api/ai/agentChat.post.ts

Ação: Em vez de retornar { explanation: ... } ou { action: ... }, a API agora retornará um objeto { sideEffects: [...] }.

Generated typescript
// Em server/api/ai/agentChat.post.ts

// ... (lógica do AgentExecutor) ...
try {
const result = await agentExecutor.invoke({ /_ ... _/ });
const output = result.output;
let sideEffects = [];

    try {
        // Tenta fazer o parse da saída como uma proposta de ação
        const actionProposal = JSON.parse(output);
        if (actionProposal.type === 'confirmationRequest') {
            sideEffects.push({ type: 'SHOW_CONFIRMATION', payload: actionProposal });
        }
    } catch (e) {
        // Se não for JSON, é uma mensagem de texto normal
        sideEffects.push({ type: 'POST_MESSAGE', payload: { text: output } });
    }

    return { sideEffects };

} catch (error) { /_ ... _/ }
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END

Tarefa 2.2: Refatorar o useAgentLogic.ts para ser um Orquestrador de Efeitos

Arquivo: composables/useAgentLogic.ts

Ação: A função sendMessage agora processará a lista de sideEffects.

Generated typescript
// Em composables/useAgentLogic.ts
// ... (imports, incluindo taskFlowStore e useAnimatedFitToNode) ...

export function useAgentLogic(taskIdRef: Ref<string>) {
// ... (states: messages, isLoading, etc.) ...
const { animateToNode } = useAnimatedFitToNode(taskFlowStore.getVueFlowInstance());

// Função para executar os efeitos recebidos da API
const executeSideEffects = async (effects) => {
for (const effect of effects) {
switch (effect.type) {
case 'POST_MESSAGE':
messages.value.push({ role: 'agent', content: effect.payload.text });
break;
case 'FOCUS_NODE':
await animateToNode(effect.payload.nodeId, { duration: 600, padding: 0.2 });
break;
case 'SHOW_CONFIRMATION':
// A mensagem de confirmação agora é tratada como um tipo especial de mensagem
messages.value.push({ role: 'agent', content: JSON.stringify(effect.payload) });
break;
// Adicionar outros casos como OPEN_MODAL_WITH_DIFF aqui
}
}
};

const sendMessage = async (userInput: string) => {
// ... (lógica existente para adicionar mensagem do usuário e ativar loading) ...
try {
const response = await $fetch('/api/ai/agentChat', { /_ ... _/ });
if (response.sideEffects) {
await executeSideEffects(response.sideEffects);
}
} catch (error) { /_ ... _/ }
finally { isLoading.value = false; }
};

// ... (resto do composable) ...
return { messages, isLoading, sendMessage, fetchHistory };
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Fase 3: Sinergia UX/Agente

Objetivo: Implementar o foco animado e o diff visual.

Tarefa 3.1: Animar o Foco no Canvas

Ação:

Crie o composable composables/useAnimatedFitToNode.ts (se ainda não existir) para animar a visão do canvas para um nó específico, usando vueFlow.fitView().

Modifique a ferramenta proposeUpdateNodeDataToolTool para que ela também possa retornar um efeito FOCUS_NODE junto com a proposta de confirmação.

A lógica em executeSideEffects no useAgentLogic já cuidará de chamar a animação.

Tarefa 3.2: Implementar o Modal de Edição com Diff

Esta é a parte mais complexa e que mais agrega valor à experiência.

Refatorar o ProblemSidebar para um Modal: Crie um ProblemModal.vue que receba title e description como props. Isso padroniza a interação.

Adicionar Lógica de Diff ao Modal:

O modal receberá uma prop opcional diffData: { title: string, description: string }.

Dentro do modal, se diffData estiver presente, os campos <input> e <textarea> serão substituídos por componentes de visualização de diff. Você pode usar uma biblioteca como diff ou diff-match-patch para gerar o HTML do diff e renderizá-lo com v-html.

Exemplo de como o ProblemModal.vue poderia lidar com isso:

Generated vue
<template>

  <!-- ... estrutura do modal ... -->
  <div>
    <label>Título</label>
    <div v-if="diffData" v-html="titleDiffHtml"></div>
    <input v-else v-model="localTitle" />
  </div>
  <div>
    <label>Descrição</label>
    <div v-if="diffData" v-html="descriptionDiffHtml"></div>
    <textarea v-else v-model="localDescription"></textarea>
  </div>
  <!-- ... -->
</template>
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Vue
IGNORE_WHEN_COPYING_END

Atualizar a Ferramenta e a API:

A ferramenta proposeUpdateNodeDataToolTool agora pode ser instruída pela IA a gerar um diff.

O endpoint /api/ai/agentChat retornaria um sideEffect do tipo OPEN_MODAL_WITH_DIFF com os dados do diff.

Orquestração no Frontend:

O useAgentLogic.ts recebe o efeito OPEN_MODAL_WITH_DIFF.

Ele chama a modalStore para abrir o ProblemModal, passando o nodeId e os dados do diffData.

Fase 4: Integração com o Sistema de Prompts e Proatividade

Objetivo: Fazer o agente ser verdadeiramente o cérebro da operação.

System Prompt Dinâmico:

Em /api/ai/agentChat.post.ts, a variável systemContext será a chave para a proatividade.

Lógica:

Generated typescript
let systemObjective = "";
const problemNode = canvasContext.nodes.find(n => n.type === 'problem');
const problemIsDefined = problemNode && problemNode.data.description.trim().length > 10;

if (!problemIsDefined) {
systemObjective = "Seu objetivo principal AGORA é ajudar o usuário a definir um 'Problema Inicial' claro e detalhado. Guie-o e use a ferramenta `proposeUpdateNodeDataTool` para sugerir um título e descrição. Não execute nenhuma outra ação antes disso.";
} else {
systemObjective = "O Problema Inicial está definido. Seu objetivo agora é ajudar o usuário a expandir o canvas com novos cards (insights, surveys, etc.) para resolver o problema, ou refinar o problema com base em novas informações.";
}

const systemContext = `Você é Flow. ${systemObjective}\nContexto atual: ...`;
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END

Uso do runAnalysis:

O agente não chama runAnalysis diretamente. Isso é um efeito colateral da manipulação do canvas.

Fluxo correto:

O usuário pede: "analise os dados da pesquisa X".

A IA entende que precisa de um card de "Insights".

A IA usa createNodeTool para criar um nó do tipo insights, conectado ao nó do survey.

O frontend executa a criação.

A reatividade da taskFlowStore detecta a nova conexão, chama o insightsNodeHandler, que por sua vez chama a API runAnalysis com a configuração do analysis.yml.

Essa separação de responsabilidades é fundamental para a manutenibilidade.

Este plano cria um sistema onde a IA faz o que faz de melhor – entender a linguagem e propor ações – enquanto o código do frontend e backend cuidam da execução de forma segura e da criação de uma experiência de usuário rica e animada.
