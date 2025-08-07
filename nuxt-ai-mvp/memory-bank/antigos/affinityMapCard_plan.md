# Affinity Map Card Development Plan

Este documento detalha o plano de desenvolvimento do novo card/node "Affinity Mapping", que será uma ferramenta analítica para agrupar insights qualitativos, inspirando-se fortemente no card existente "Empathy Map".

## Objetivos

- Criar um node analítico para agrupar visualmente insights relacionados.
- Garantir coerência com o comportamento do Empathy Map Card.
- Analisar automaticamente dados qualitativos recebidos.

## Requisitos Funcionais

### Interface e Interações

- UI inspirada no Empathy Map Card, mas adaptada para clusters dinâmicos:
  - Cabeçalho com título e ícone (similar ao Empathy Map).
  - Corpo exibindo os insights agrupados em clusters. Cada cluster será renderizado como um "card" contendo um título (determinado pela IA) e uma lista de "post-its" (insights), seguindo o visual da imagem de referência. O layout geral será uma coleção desses cards de cluster.
  - Toolbar com botões para atualizar análise e deletar node (similar ao Empathy Map).
- Exibição de mensagens claras quando não há dados ou há erro.

### Processamento de Dados

- Aceitar dados qualitativos (texto) dos nodes conectados (SurveyCard, DataSourceCard).
- Agrupar automaticamente insights usando uma API de IA.
- Armazenar dados agrupados em `analyzedData`. A estrutura será um array de objetos, onde cada objeto representa um cluster e contém `title` (string, nome do cluster determinado pela IA) e `items` (array de strings, os insights pertencentes a esse cluster), por exemplo: `[{ title: "Problemas no Checkout", items: ["Processo de checkout longo/confuso", "Problemas com formas de pagamento"] }, { title: "Preocupações com Custo", items: ["Custos de frete altos", "Comparando preços"] }, ...]`.

### Gerenciamento de Estado

- Estender o `taskFlowStore` para gerenciar o estado do Affinity Map (similar ao Empathy Map).

### Integração com API

- Novo endpoint API: `/api/ai/affinityMapAnalysis` para processar análise de insights. A API deverá retornar os dados no formato esperado para `analyzedData` (um array de objetos, cada um com `title` e `items`).

## Estrutura dos Componentes

- Novo arquivo `AffinityMapCard.vue` na pasta `components/cards/`.
- Novo handler `affinityMapNodeHandler.ts` em `lib/nodeHandlers/`.

## Estratégia de Testes

Utilizaremos Vitest para os testes unitários e de integração de componentes, seguindo o padrão estabelecido em `empathCard.spec.ts`. Os testes serão divididos entre o `affinityMapNodeHandler.ts` e o componente `AffinityMapCard.vue`.

### Cenários de Teste Detalhados

#### 1. Testes do `affinityMapNodeHandler.ts`

- **`initializeData()`**:
  - Verificar se retorna os dados iniciais corretos com valores padrão (título, descrição, `analyzedData` nulo, `processInputError` nulo, etc.).
  - Verificar se permite a sobrescrita dos valores padrão quando um objeto de configuração é fornecido.
- **`processInput(currentData, parentOutputs)`**:
  - **Agregação de Texto de Entrada:**
    - Testar com dados de entrada válidos de um `SurveyCard` (simulando resultados de pesquisa).
    - Testar com dados de entrada válidos de um `DataSourceCard` (simulando arquivos `pesquisa_usuario`).
    - Testar com dados de entrada combinados de múltiplos pais válidos.
    - Testar com dados de entrada vazios ou irrelevantes (não deve chamar a API ou deve tratar a situação de forma elegante, resultando em `analyzedData` nulo e, possivelmente, uma mensagem informativa).
  - **Interação com a API de IA (`/api/ai/affinityMapAnalysis`)**:
    - Simular uma resposta bem-sucedida da API com uma estrutura de clusters dinâmicos (array de `{title, items}`) e verificar se:
      - `analyzedData` é populado corretamente com essa estrutura.
      - `outputData` (para nós filhos) é gerado corretamente (ex: `{ affinity_map_clusters: analyzedData }`).
      - `processInputError` permanece nulo.
    - Simular falhas na chamada da API (erro de rede, status 500) e verificar se:
      - `processInputError` é preenchido com uma mensagem de erro apropriada.
      - `analyzedData` permanece nulo ou inalterado.
    - Simular uma resposta da API que contém uma mensagem de erro específica no corpo da resposta e verificar o tratamento adequado em `processInputError`.
    - Simular uma resposta da API com uma estrutura inválida ou inesperada e verificar o tratamento de erro.
  - **Gerenciamento de Estado (Interação com `taskFlowStore`)**:
    - Verificar se o handler interage corretamente com o `taskFlowStore` para, por exemplo, armazenar o `lastProcessedInputString` (ou mecanismo similar para evitar reprocessamento desnecessário), similar ao `empathMapNodeHandler`.
- **`generateOutput(currentData)`**:
  - Verificar se retorna corretamente o `analyzedData` (os clusters) para os nós filhos.
  - Verificar se retorna nulo ou uma estrutura vazia apropriada se `analyzedData` não estiver presente.
- **`getDisplayData(currentData)`**:
  - Verificar se retorna corretamente `analyzedData`, `processInputError`, e `inputData` para exibição no card.

#### 2. Testes do Componente `AffinityMapCard.vue`

- **Renderização Inicial e Estados Visuais**:
  - Exibir a mensagem "Conecte uma fonte de dados..." (ou similar) quando `props.data.analyzedData` for nulo, não houver erro e não estiver carregando.
  - Exibir uma mensagem de erro clara se `props.data.processInputError` estiver presente.
  - Exibir um indicador de carregamento (spinner ou mensagem) se `props.data.analysisStatus` (ou um estado equivalente gerenciado pelo `taskFlowStore`) indicar que a análise está em progresso.
  - Quando `props.data.analyzedData` estiver populado com um array de clusters:
    - Verificar a renderização correta de cada card de cluster.
    - Para cada cluster, verificar a exibição do `title` (título do cluster).
    - Para cada cluster, verificar a renderização de cada `item` (insight) como um "post-it".
  - Exibir uma mensagem apropriada (ex: "Nenhum agrupamento encontrado") se `props.data.analyzedData` for um array vazio (indicando que a IA não encontrou clusters).
  - Exibir "Sem dados" ou um placeholder dentro de um cluster se, hipoteticamente, a IA retornasse um cluster com um array `items` vazio (embora o ideal seja que a IA não produza tais clusters).
- **Interações da Toolbar**:
  - Verificar se o botão "Atualizar Análise" (ícone de refresh) está visível e funcional quando há dados de entrada processáveis.
  - Verificar se o botão "Atualizar Análise" está oculto ou desabilitado quando não há dados de entrada processáveis.
  - Verificar se o clique no botão "Atualizar Análise" dispara a ação correta no `taskFlowStore` (ex: `requestNodeReprocessing`).
  - Verificar se o botão "Excluir Nó" (ícone de lixeira) está visível e funcional.
  - Verificar se o clique no botão "Excluir Nó" dispara a ação correta no `taskFlowStore` (ex: `removeNode`).
- **Interação do Botão "+" (Adicionar Nó)**:
  - Verificar se o clique no botão "+" abre o `AddNodeSidebar` quando não há conexões de saída (`props.hasOutgoingConnection` é `false`).
  - Verificar se o botão "+" está oculto quando `props.hasOutgoingConnection` é `true`.
- **Aplicação de Props**:
  - Verificar se o estilo de "selecionado" é aplicado corretamente quando `props.selected` é `true`.
- **Reatividade a Mudanças em `props.data.inputData` (Watcher)**:
  - Verificar se o watcher dispara o reprocessamento (ex: chamando `requestNodeReprocessing` e atualizando o `lastProcessedInputString` no `taskFlowStore`) quando dados de entrada relevantes de pais DIRETOS mudam.
  - Verificar se o watcher NÃO dispara o reprocessamento se as mudanças nos dados de entrada são de pais NÃO DIRETOS.
  - Verificar se o watcher NÃO dispara o reprocessamento se os dados de entrada relevantes de pais DIRETOS não mudaram significativamente (comparando a representação em string, por exemplo).
  - Verificar se o watcher dispara uma ação para limpar a análise (ex: `clearAffinityMapAnalysis` no `taskFlowStore`) se `props.data.inputData` se tornar vazio ou nulo após ter contido dados.

## Passos para Implementação

1. **Configuração inicial**

   - Duplicar e renomear arquivos do Empathy Map como base.

2. **Desenvolvimento da UI**

   - Adaptar template e estilos para o novo card.

3. **Desenvolvimento da API**

   - Implementar rota backend para análise com IA.

4. **Gerenciamento de Estado**

   - Ajustar `taskFlowStore` para gerenciar novo estado.

5. **Integração**

   - Validar integração e fluxo com nodes existentes.

6. **Testes**

   - Escrever testes abrangentes utilizando padrões já estabelecidos.

7. **Documentação**
   - Atualizar documentação interna com instruções de uso.

## Critérios de Aceitação

- Exibição correta dos insights agrupados.
- 100% de cobertura em testes unitários.
- Compatibilidade plena com os cards existentes.
