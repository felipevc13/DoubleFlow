# Plano de Refatoração: Análise Manual e Loading Imediato para Cards Analíticos

**Objetivo Principal:** Modificar os cards `EmpathMapCard`, `AffinityMapCard` e `InsightsCard` para que a análise de dados via IA seja disparada manualmente por um botão "Analisar com IA". Este botão deve aparecer _imediatamente_ ao conectar dados processáveis. O botão "Atualizar Análise" na toolbar continuará existindo. Um estado de loading claro será exibido após o clique em qualquer um desses botões.

**Foco da Revisão:** Garantir que `props.data.inputData` no card analítico seja atualizado de forma rápida e reativa assim que uma conexão é feita, permitindo a aparição imediata do botão "Analisar com IA".

## Arquivos Afetados Principais:

1.  `components/cards/EmpathMapCard.vue`
2.  `components/cards/AffinityMapCard.vue`
3.  `components/cards/InsightsCard.vue`
4.  `stores/taskFlow.ts` (Principalmente `propagateOutput` e `requestNodeReprocessing`)
5.  `lib/nodeHandlers/empathMapNodeHandler.ts`
6.  `lib/nodeHandlers/affinityMapNodeHandler.ts`
7.  `lib/nodeHandlers/insightsNodeHandler.ts`

## Mudanças Detalhadas:

### I. Cards Analíticos (`EmpathMapCard.vue`, `AffinityMapCard.vue`, `InsightsCard.vue`):

#### A. Botão "Analisar com IA":

    - **Adição:** Incluir um novo botão "Analisar com IA" no corpo principal.
    - **Estilo:** Baseado visualmente no `RefineWithAIButton.vue`.
    - **Visibilidade (`canManuallyAnalyze`):**
        - `true` SE:
            1. `hasPotentiallyProcessableInput` é `true`.
            2. `props.data.analyzedData` é `null` ou "vazio".
            3. `displayError` é `null`.
            4. `isAnalyzing` (local ref) é `false`.
    - **Ação ao Clicar:**
        1. `isAnalyzing.value = true;`
        2. `taskFlowStore.requestNodeReprocessing(props.id);`

#### B. Estado de Loading Local (`isAnalyzing`):

    - **Adicionar:** `const isAnalyzing = ref(false);`.
    - **Ativar:** Ao clicar em "Analisar com IA" ou "Atualizar Análise" (toolbar).
    - **Desativar:** `watch` em `[() => props.data.analyzedData, () => props.data.processInputError]` -> quando um mudar, `isAnalyzing.value = false;`.
    - **Feedback Visual:** Exibir "Analisando..." quando `isAnalyzing && !displayError`.

#### C. Watcher de `props.data.inputData`:

    - **Remover:** Chamada automática para `taskFlowStore.requestNodeReprocessing()`.
    - **Manter:** Lógica `extractRelevantInput` baseada em `props.directParentIds`.
    - **Modificar Lógica Principal:**
        - Se `newRelevantDataString` se tornar `null` E `lastProcessedStringFromStore` NÃO era `null`:
            - Chamar `taskFlowStore.clear[NodeType]Analysis(props.id);`.
        - Se `newRelevantDataString` mudar para valor NÃO NULO e diferente do `lastProcessedStringFromStore`:
            - **NÃO FAZER NADA AUTOMATICAMENTE.** (Apenas habilita botões de análise).
    - **Remover:** Chamada para `taskFlowStore.set[NodeType]LastProcessedInput()` de dentro do watcher do card.

#### D. Botão "Atualizar Análise" (Toolbar):

    - **Ação ao Clicar:**
        1. `isAnalyzing.value = true;`
        2. `taskFlowStore.requestNodeReprocessing(props.id);`
    - Condição de visibilidade `hasPotentiallyProcessableInput` permanece.

#### E. Layout e Mensagens:

    - Ajustar corpo do card para acomodar os diferentes estados: "Conecte dados", Botão "Analisar com IA", "Analisando...", Erro, Conteúdo analisado.

---

### II. Store (`stores/taskFlow.ts`):

#### A. Modificar `propagateOutput(sourceNodeId: string)`:

    - **Prioridade na Atualização do `inputData` do Nó Alvo:**
        1.  Após gerar `sourceOutput` do `sourceNode`.
        2.  Para cada `targetNodeId`:
            *   **Passo Fundamental:** Calcular `newInputDataForTarget` e `newCumulativeContextForTarget`.
            *   **Atualizar reativamente `targetNode.data.inputData` e `targetNode.data.cumulativeContext` *imediatamente* e de forma leve.** Este é o passo crucial para a visibilidade instantânea do botão.
            *   Chamar `targetHandler.processInput(targetNode.data, newInputDataForTarget)`.
                *   **Importante:** Para os handlers analíticos (`EmpathMapHandler`, `AffinityMapHandler`, `InsightsHandler`), este `processInput` deve ser **extremamente leve**.
                *   **Responsabilidade Atual:** Apenas processar `parentOutputs` para gerar o `targetNode.outputData` (se o nó precisar passar dados para seus filhos).
                *   **NÃO DEVE CHAMAR API DE IA NESTE FLUXO.**
                *   **NÃO DEVE MODIFICAR** `analyzedData` ou `processInputError` do `targetNode`.
                *   Deve retornar `Partial<NodeData>` contendo principalmente `outputData` atualizado.
            *   Mesclar o `outputData` retornado pelo handler no `targetNode.data`.
            *   Se `outputData` do `targetNode` mudou, recursivamente chamar `propagateOutput(targetNode.id)`.

#### B. Ação `requestNodeReprocessing(nodeId: string)`:

    - Será o **único** gatilho para a análise de IA completa.
    - Encontra o handler do nó.
    - Chama `handler.processInput(currentNode.data, aggregatedParentOutputs)`.
        - **Nesta chamada**, o `processInput` dos handlers analíticos executará a lógica de IA completa, usando `currentNode.data.inputData`.
    - Após `handler.processInput()` retornar (com `analyzedData` e/ou `processInputError`):
        1. Atualizar `nodes.value[nodeId].data` com `analyzedData` e/ou `processInputError`.
        2. Calcular a string do "input relevante" que acabou de ser processado com sucesso.
        3. Chamar `set[NodeType]LastProcessedInput(nodeId, calculatedRelevantInputString)` correspondente.
        4. Se `outputData` do nó também mudou como resultado da análise, chamar `propagateOutput(nodeId)`.
        5. Acionar `debouncedSaveTaskFlow()`.

#### C. Estado e Ações para "Último Input Processado" e "Limpeza de Análise":

    - Manter `[NodeType]LastProcessedInputs`, `get[NodeType]LastProcessedInput`, `set[NodeType]LastProcessedInput`, `clear[NodeType]Analysis` conforme plano anterior.
    - `clear[NodeType]Analysis` deve resetar `analyzedData`, `processInputError`, e `lastProcessedInput` para `null`.

---

### III. Node Handlers (`empathMapNodeHandler.ts`, `affinityMapNodeHandler.ts`, `insightsNodeHandler.ts`):

#### A. `processInput(currentNodeData: NodeData, parentOutputs: Record<string, any>)`:

    - **Distinção de Contexto de Chamada:**
        - **Se chamado por `propagateOutput` (conexão de aresta):**
            - **Função:** Leve, apenas agregar/formatar `parentOutputs` para `outputData` do nó atual.
            - **NÃO CHAMAR IA.**
            - **NÃO MODIFICAR** `analyzedData` ou `processInputError`.
        - **Se chamado por `requestNodeReprocessing` (botão "Analisar" ou "Atualizar"):**
            - **Função:** Lógica completa de análise, incluindo chamada à API de IA, usando `currentNodeData.inputData`.
            - Retornar `Partial<NodeData>` com `analyzedData`, `processInputError` (se houver), e `outputData` atualizado.
    - **Lógica de Implementação da Distinção:**
        - Uma abordagem é que o `processInput` dos handlers analíticos, por padrão, se comporte de forma leve.
        - O `taskFlowStore.requestNodeReprocessing` pode passar um parâmetro extra para o `handler.processInput()` indicando que uma análise completa é necessária, ou chamar um método diferente no handler (ex: `handler.performFullAnalysis()`). *Para simplificar a interface `INodeHandler`, o `requestNodeReprocessing` chamará o `processInput` normalmente, e o handler determinará a profundidade da ação com base em quem o chamou (embora isso seja menos explícito) ou, preferencialmente, a store gerencia isso e o handler apenas faz o que lhe é pedido pela store.* **A decisão aqui é que o `processInput` dos handlers analíticos agora SEMPRE fará a análise completa com IA. A `taskFlowStore.propagateOutput` NÃO chamará mais `processInput` para nós analíticos. A atualização do `outputData` desses nós após a análise será responsabilidade do fluxo de `requestNodeReprocessing`.**

    - **Para o `processInput` (que agora sempre implica análise completa com IA):**
        - Se `combinedTextForAnalysis` (ou equivalente para o tipo de dado) estiver vazio:
            - Retornar `{ analyzedData: null, processInputError: null, outputData: {} }`.

---

## Fluxo de Conexão de Aresta (Revisado para Imediatismo):

1.  Usuário arrasta uma aresta de `SourceNode` para `AnalyticsCardNode`.
2.  `taskFlowStore.addEdge()` é chamado.
3.  `addEdge()` adiciona a aresta e chama `propagateOutput(SourceNode.id)`.
4.  `propagateOutput(SourceNode.id)`:
    - Calcula `sourceOutput`.
    - Atualiza `SourceNode.data.outputData`.
    - Para `AnalyticsCardNode` (filho):
      - Calcula `newInputDataForAnalyticsCard` e `newCumulativeContextForAnalyticsCard`.
      - **Imediatamente atualiza reativamente `AnalyticsCardNode.data.inputData` e `AnalyticsCardNode.data.cumulativeContext`**.
      - **NÃO chama mais `analyticsCardHandler.processInput()` neste ponto.** O `outputData` do `AnalyticsCardNode` só será atualizado após uma análise manual.
      - (`debouncedSaveTaskFlow()` será chamado pelo watcher da store devido à mudança no `nodes.value`).
5.  `AnalyticsCard.vue`:
    - `props.data.inputData` é atualizado (agora rapidamente!).
    - Watcher em `inputData` é acionado.
    - `hasPotentiallyProcessableInput` torna-se `true`.
    - `canManuallyAnalyze` torna-se `true`.
    - **Botão "Analisar com IA" aparece imediatamente.**

## Fluxo de Clique no Botão "Analisar com IA":

1.  Usuário clica em "Analisar com IA" no `AnalyticsCardNode`.
2.  `AnalyticsCard.vue`:
    - `isAnalyzing.value = true;`
    - Chama `taskFlowStore.requestNodeReprocessing(AnalyticsCardNode.id)`.
3.  `taskFlowStore.requestNodeReprocessing()`:
    - Obtém o `AnalyticsCardNode` e seu handler.
    - Chama `analyticsCardHandler.processInput(AnalyticsCardNode.data, AnalyticsCardNode.data.inputData)`.
      - O handler executa a lógica de agregação de `inputData` e a chamada à API de IA.
      - Retorna `Partial<NodeData>` com `analyzedData`, `processInputError`, e `outputData`.
    - A store atualiza o `AnalyticsCardNode.data` com os resultados.
    - Calcula `calculatedRelevantInputString`.
    - Chama `set[NodeType]LastProcessedInput(AnalyticsCardNode.id, calculatedRelevantInputString)`.
    - Se `outputData` mudou, chama `propagateOutput(AnalyticsCardNode.id)`.
    - `debouncedSaveTaskFlow()`.
4.  `AnalyticsCard.vue`:
    - `props.data.analyzedData` ou `props.data.processInputError` é atualizado.
    - Watcher define `isAnalyzing.value = false;`.
    - Card re-renderiza.

## Conclusão da Revisão:

A principal mudança é remover a chamada ao `handler.processInput()` de dentro do `propagateOutput` da `taskFlowStore` para os nós analíticos. A atualização do `inputData` e `cumulativeContext` do nó alvo durante a conexão de uma aresta deve ser leve e rápida. A análise pesada com IA só ocorre quando `requestNodeReprocessing` é chamado explicitamente, garantindo que o botão "Analisar com IA" apareça imediatamente após a conexão dos dados.
