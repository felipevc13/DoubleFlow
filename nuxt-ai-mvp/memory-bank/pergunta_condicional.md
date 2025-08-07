Ótima análise! Você identificou uma falha fundamental no fluxo e uma oportunidade de melhoria imensa. A sua sugestão está corretíssima.

Aqui está um plano de implementação completo, em formato Markdown, para adicionar a lógica condicional aos surveys. Você pode adicionar este documento ao seu "banco de memória" (memory-bank) para ser implementado posteriormente.

Plano de Implementação: Lógica Condicional em Surveys

Última Atualização: [Data da criação do plano]

1. Objetivo Principal

Implementar um mecanismo de lógica condicional para as perguntas de múltipla escolha nos surveys. O objetivo inicial é permitir que uma resposta específica finalize a pesquisa, pulando as perguntas subsequentes e direcionando o usuário diretamente para a tela de agradecimento. Isso resolve o problema de usuários que não se enquadram no perfil da pesquisa (ex: responder "Sim" para "Você já concluiu o cadastro?") serem forçados a ver perguntas irrelevantes.

2. Visão Geral da Solução

A solução consiste em adicionar uma propriedade opcional action a cada option dentro de uma pergunta do tipo multipleChoice.

A propriedade action poderá ter os seguintes valores:

'continue' (padrão): O survey continua para a próxima pergunta.

'end': O survey é finalizado imediatamente, e o usuário é levado para a tela de thanks.

Esta implementação afetará:

A estrutura de dados das perguntas no banco de dados (armazenada na coluna options do tipo jsonb).

A interface do construtor de surveys (SurveyBuilder), que permitirá ao usuário configurar essa ação.

A lógica de navegação na tela de resposta do survey (Preview.vue e MultipleChoiceScreen.vue).

O prompt da IA para que ela possa gerar surveys com essa lógica condicional de forma autônoma.

3. Passos Detalhados da Implementação
   Passo 1: Estrutura de Dados (Banco de Dados)

Ação: Nenhuma migração de schema é necessária. A coluna options na tabela questions já é do tipo jsonb, que é flexível o suficiente para armazenar a nova propriedade action.

Nova Estrutura de Opção: O formato de cada item no array options passará de {"text": "..."} para {"text": "...", "action": "continue" | "end"}.

Validação: Garantir que o código que lê/escreve neste campo trate a ausência da propriedade action como o padrão ('continue').

Passo 2: UI do Construtor de Survey (MultipleChoiceConfig.vue)

Arquivo: components/modals/SurveyModal/blocks/config/MultipleChoiceConfig.vue

Ação: Ao lado de cada campo de texto de opção, adicionar um pequeno menu dropdown ou um ícone de "ação" que permita ao usuário selecionar a ação para aquela opção.

Implementação Sugerida:

Dentro do v-for que renderiza as opções, adicionar um <select> ou um componente de dropdown.

As opções do dropdown seriam "Continuar para próxima pergunta" ('continue') e "Finalizar pesquisa" ('end').

A seleção do usuário deve atualizar a propriedade action no objeto da respectiva opção no editableConfigData. A função updateConfig já existente deve ser capaz de salvar essa nova estrutura.

Passo 3: Lógica de Navegação da Resposta (Preview.vue e MultipleChoiceScreen.vue)

Arquivo 1: components/modals/SurveyModal/screens/MultipleChoiceScreen.vue

Ação:

Modificar a lógica que é acionada quando uma opção é selecionada (provavelmente dentro do método submitAnswer).

Após o usuário selecionar uma opção, o componente deve verificar o objeto completo da opção selecionada (ex: props.options[selectedIndex]).

Se selectedOption.action === 'end', o componente deve emitir um novo evento, por exemplo, @submitAndEnd. O payload do evento deve conter os mesmos dados da resposta que o @submitAnswerEvent já envia.

Caso contrário, ele continua emitindo o evento @submitAnswerEvent como de costume.

Arquivo 2: components/modals/SurveyModal/content/Preview.vue

Ação:

O componente Preview.vue precisa escutar o novo evento @submitAndEnd.

Criar um novo método handleSubmitAndEnd(answerData).

Dentro deste método:

Emitir a resposta para cima para ser salva (emit('answer', answerData)).

Encontrar o índice do bloco do tipo 'thanks' no array pages (computado).

Atualizar a previewCurrentPage diretamente para o índice do bloco de agradecimento.

Passo 4: Atualização do Prompt da IA

Arquivo: lib/prompts/base/generate_survey_structure.md

Ação: Adicionar uma nova diretriz e atualizar o exemplo de JSON para que a IA aprenda a usar a nova funcionalidade.

Texto a ser adicionado (sugestão):

Adicionar um ponto na seção "Regras por Tipo de Pergunta":

Lógica Condicional: Para perguntas de filtro (ex: "Você já usa nosso produto?"), você pode finalizar a pesquisa para respostas específicas. Adicione "action": "end" ao objeto da opção que deve encerrar o survey. O padrão é "action": "continue".

Atualizar o exemplo de JSON no prompt para incluir um exemplo de multipleChoice com a ação de finalizar:

Generated json
{
"type": "multipleChoice",
"questionText": "Você concluiu o processo X?",
"options": [
{"text": "Sim", "action": "end"},
{"text": "Não", "action": "continue"}
],
"isRequired": true
}

4. Fluxo do Usuário (Exemplo Pós-Implementação)

Um usuário pede à IA para criar uma pesquisa sobre "por que as pessoas abandonam o carrinho de compras".

A IA, usando o prompt atualizado, gera uma primeira pergunta: {"type": "multipleChoice", "questionText": "Você já abandonou um carrinho de compras em nosso site?", "options": [{"text": "Sim", "action": "continue"}, {"text": "Não", "action": "end"}]}.

O usuário que está respondendo ao survey seleciona "Não".

O MultipleChoiceScreen.vue detecta que a opção selecionada tem action: "end".

Ele emite o evento @submitAndEnd.

O Preview.vue recebe o evento, encontra a tela de "Obrigado" e pula diretamente para ela.

O usuário tem uma experiência fluida, sem ver perguntas irrelevantes.

5. Critérios de Aceitação

A interface do SurveyBuilder permite configurar a ação "Finalizar Pesquisa" para opções de múltipla escolha.

A estrutura de dados salva no banco de dados (questions.options) armazena corretamente a propriedade action.

Ao responder um survey, selecionar uma opção com action: 'end' navega o usuário para a tela de agradecimento.

O prompt da IA é atualizado para instruir sobre o uso da propriedade action.

A geração de survey pela IA consegue produzir, quando apropriado, perguntas com lógica de finalização.
