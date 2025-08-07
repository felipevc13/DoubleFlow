# Plano de Desenvolvimento: Report Card

**Última Atualização:** [Data Atual]

## 1. Objetivos

- Criar um novo tipo de nó/card ("ReportCard") que permita aos usuários gerar relatórios sumarizados e acionáveis a partir de dados de entrada de outros nós.
- Utilizar um serviço de IA (Gemini via API) para analisar os dados de entrada e gerar o conteúdo do relatório.
- Exibir um título e um sumário do relatório diretamente no card.
- Fornecer um link/botão no card para visualizar o relatório completo em uma página dedicada.
- Garantir integração fluida com os cards existentes (`ProblemCard`, `DataSourceCard`, `SurveyCard`, `EmpathMapCard`, `AffinityMapCard`, `InsightsCard`).
- Persistir os relatórios gerados no Supabase.

## 2. Requisitos Funcionais

### 2.1. Interface do Usuário (`ReportCard.vue`)

- **Estado Inicial (Sem Entradas Conectadas):**
  - Mensagem: "Conecte um ou mais cards de dados ou análise para gerar o relatório."
  - Ícone representativo (ex: ícone de documento/relatório).
- **Estado Conectado (Antes da Análise):**
  - Mensagem: "Dados conectados. Pronto para gerar o relatório."
  - Botão: "Gerar Relatório com IA".
- **Estado de Carregamento (Durante Análise da IA):**
  - Indicador de carregamento (spinner).
  - Texto: "Gerando relatório..."
- **Estado Analisado (Relatório Gerado):**
  - Exibição do **Título do Relatório** (gerado pela IA).
  - Exibição do **Sumário Executivo** do relatório (gerado pela IA, ~1-2 parágrafos).
  - Botão: "Visualizar Relatório Completo" (navega para `/reports/[reportId]`).
- **Estado de Erro (Falha na Análise):**
  - Exibição da mensagem de erro (`props.data.processInputError`).
  - Sugestão para tentar novamente ou verificar os dados de entrada.
- **NodeToolbar (Padrão VueFlow):**
  - Visível quando `props.selected` for `true`. Posição `Position.Left`.
  - Botão "Atualizar Relatório" (`ArrowPathIcon`): Visível se `hasPotentiallyProcessableInput` for `true`. Chama `taskFlowStore.requestNodeReprocessing(props.id)`.
  - Botão "Excluir Nó" (`TrashIcon`): Chama `taskFlowStore.removeNode(props.id)`.
- **Botão "+" (Adicionar Nó Filho):** Visível se `!props.hasOutgoingConnection`, funcionalidade padrão.
- **Handles (VueFlow):** `target` (Top) e `source` (Bottom) estilizados.

### 2.2. Processamento de Dados (`reportNodeHandler.ts`)

- **Entrada (`processInput`):**
  - Aceitar `outputData` de múltiplos nós pais conectados. Tipos de pais suportados: `ProblemCard`, `DataSourceCard`, `SurveyCard`, `EmpathMapCard`, `AffinityMapCard`, `InsightsCard`.
  - O handler deve agregar os `parentOutputs` em uma estrutura JSON coesa para enviar à IA. Cada `outputData` de pai deve ser rotulado com o tipo do nó pai e seu ID para dar contexto à IA. Exemplo:
    ```json
    {
      "problem_definition_problem-1": {
        /* outputData do ProblemCard */
      },
      "survey_results_survey-123": {
        /* outputData do SurveyCard */
      },
      "empathy_map_empath-abc": {
        /* outputData do EmpathMapCard */
      }
    }
    ```
- **Análise por IA:**
  - Chamar um novo endpoint da API de IA: `/api/ai/generateReport`.
  - O prompt instruirá a IA a gerar:
    1.  `title`: Título do relatório (string).
    2.  `summary`: Sumário executivo (string, ~1-2 paráglogos).
    3.  `markdownContent`: Conteúdo completo do relatório em formato Markdown (string).
    4.  (Opcional) `recommendations`: Array de strings.
    5.  (Opcional) `nextSteps`: Array de strings.
  - A IA deve ser instruída a sintetizar as informações dos diferentes inputs em um relatório coeso.
- **Persistência:**
  - Após receber a resposta da IA, o handler deve:
    1.  Salvar o `title`, `summary` e `markdownContent` em uma nova tabela `reports` no Supabase. Esta tabela deve ter colunas como `id (pk)`, `task_id (fk)`, `node_id (fk, opcional)`, `user_id (fk)`, `title`, `summary`, `markdown_content`, `created_at`, `updated_at`.
    2.  O `id` do registro salvo na tabela `reports` (`report_id`) será armazenado.
- **Atualização do Nó:**
  - `props.data.analyzedData` deve ser populado com `{ report_id: string, title: string, summary: string }`.
  - `props.data.outputData` deve ser `{ report_id: string, report_title: string, report_summary: string }` para consumo por nós filhos.
  - `props.data.processInputError` deve ser preenchido em caso de falha.

### 2.3. Página do Relatório (`pages/reports/[reportId].vue`)

- Rota dinâmica: `/reports/[reportId]`.
- Layout: `blank.vue` ou um novo `report.vue` (sem SideNav, etc.).
- Busca os dados do relatório (`title`, `markdownContent`) da tabela `reports` no Supabase usando o `reportId` da URL.
- Renderiza o `markdownContent` (usar um componente/lib para renderizar Markdown para HTML).
- **Funcionalidades:**
  - Botão "Voltar para o Fluxo da Tarefa" (navega para `/task/[slug]` do `task_id` associado ao relatório).
  - (Futuro) Botões "Imprimir", "Baixar como PDF", "Baixar como Markdown".

### 2.4. Backend API (`/api/ai/generateReport.post.ts`)

- Endpoint: `POST /api/ai/generateReport`.
- Entrada: `{ prompt: string }` (o prompt conterá os dados agregados pelo handler).
- Lógica:
  - Chama o serviço Gemini (Google Generative AI).
  - Instrui a IA a retornar um objeto JSON com a estrutura:
    ```json
    {
      "report": {
        "title": "Título Gerado pela IA",
        "summary": "Sumário executivo gerado pela IA...",
        "markdownContent": "# Título\n\n## Seção 1\n\nConteúdo...",
        "recommendations": ["Recomendação 1", "..."],
        "nextSteps": ["Próximo Passo 1", "..."]
      }
    }
    ```
  - Retorna este objeto JSON.

## 3. Design Técnico

### 3.1. Componente (`components/cards/ReportCard.vue`)

- Similar aos outros cards analíticos (`EmpathMapCard`, `AffinityMapCard`).
- Props: `id`, `data`, `selected`, `hasOutgoingConnection`, `directParentIds`.
- Computed properties: `displayError`, `showReportPreviewLayout`, `hasPotentiallyProcessableInput`, `canManuallyAnalyze`.
- Métodos: `triggerInitialAnalysis`, `forceRefreshAnalysis`, `requestNodeDeletion`, `viewFullReport` (navega para `/reports/[reportId]`), `startConnection`, etc.
- Watcher em `props.data.inputData` para habilitar `canManuallyAnalyze` ou limpar análise se inputs forem removidos (similar ao `AffinityMapCard`).
- Watcher em `props.data.analyzedData` e `props.data.processInputError` para controlar o estado `isAnalyzing`.

### 3.2. Node Handler (`lib/nodeHandlers/reportCardNodeHandler.ts`)

- Implementa `INodeHandler`.
- `initializeData(initialConfig)`:
  - `label: "Relatório"`, `title: "Gerar Relatório"`, `description: "Sintetiza informações e análises em um relatório."`
  - `analyzedData: null`, `processInputError: null`, `outputData: {}`.
- `async processInput(currentNodeData, parentOutputs)`:
  1.  Formata `parentOutputs` em uma string JSON (ou outra estrutura clara) para o prompt da IA. Incluir `sourceNodeId` e `sourceNodeType` para cada entrada.
  2.  Constrói o prompt usando `getPromptTemplate("generateReportContent")` e `fillPromptTemplate`.
  3.  Chama `$fetch('/api/ai/generateReport', { method: 'POST', body: { prompt } })`.
  4.  Valida a resposta da IA. Se OK:
      - Extrai `title`, `summary`, `markdownContent` da resposta da IA.
      - Salva na tabela `reports` do Supabase: `(await supabase.from('reports').insert({...}).select().single())`. Obtém `report_id`.
      - Retorna `Partial<NodeData>`:
        ```typescript
        {
          analyzedData: { report_id, title, summary },
          processInputError: null,
          outputData: { report_id, report_title: title, report_summary: summary },
          updated_at: new Date().toISOString()
        }
        ```
  5.  Se erro na IA ou Supabase, retorna `{ processInputError: "mensagem de erro", analyzedData: currentNodeData.analyzedData, outputData: {}, updated_at: new Date().toISOString() }`.
- `generateOutput(currentNode)`:
  - Retorna `{ report_id: currentNode.data.analyzedData?.report_id, report_title: currentNode.data.analyzedData?.title, report_summary: currentNode.data.analyzedData?.summary }` ou `{}` se `analyzedData` for nulo.
- `getDisplayData(currentNode)`:
  - Retorna `{ title: currentNode.data.analyzedData?.title, summary: currentNode.data.analyzedData?.summary, processInputError: currentNode.data.processInputError, inputData: currentNode.data.inputData }`.

### 3.3. API Endpoint (`server/api/ai/generateReport.post.ts`)

- Recebe `{ prompt: string }`.
- Chama o Gemini com o prompt, solicitando uma resposta JSON no formato `{ report: { title, summary, markdownContent, recommendations?, nextSteps? } }`.
- Valida a estrutura da resposta do Gemini.
- Retorna o objeto `report` para o frontend.

### 3.4. Store (`stores/taskFlow.ts`)

- Adicionar `report` à lista de tipos de nós conhecidos (se houver uma).
- Adicionar estado para `reportLastProcessedInputs: ref<Record<string, string | null>>({})`.
- Implementar `getReportLastProcessedInput(nodeId: string): string | null`.
- Implementar `setReportLastProcessedInput(nodeId: string, inputString: string | null)`.
- Implementar `clearReportAnalysis(nodeId: string)`: reseta `analyzedData`, `processInputError`, `outputData` e chama `setReportLastProcessedInput(nodeId, null)`.

### 3.5. Database (Supabase)

- **Nova Tabela `reports`**:
  - `id`: `uuid`, `primary key`, `default uuid_generate_v4()`
  - `task_id`: `uuid`, `foreign key references tasks(id) on delete cascade`
  - `node_id`: `uuid`, `nullable` (ID do ReportCard que gerou o relatório)
  - `user_id`: `uuid`, `foreign key references auth.users(id) on delete cascade`
  - `title`: `text`, `not null`
  - `summary`: `text`
  - `markdown_content`: `text`, `not null`
  - `created_at`: `timestamp with time zone`, `default now()`
  - `updated_at`: `timestamp with time zone`, `default now()`
  - Habilitar RLS.

### 3.6. Regras de Conexão (`lib/connectionRules.ts`)

- Adicionar `report` como um tipo de nó válido.
- Permitir que `problem`, `dataSource`, `survey`, `empathMap`, `affinityMap`, `insights` possam se conectar a `report`.

  ```typescript
  // Em problem, dataSource, survey, empathMap, affinityMap, insights:
  problem: {
    // ... outros
    report: true,
  },
  dataSource: {
    // ... outros
    report: true,
  },
  // ... e assim por diante para os outros tipos de origem.

  // Regras de SAÍDA do ReportCard
  report: {
    dataSource: true, // Ex: se o relatório gerar dados estruturados que podem ser usados
    // outroReportCard: true, // talvez?
  }
  ```

### 3.7. Prompts (`lib/prompts.ts`)

- Adicionar novo template `generateReportContent`.

  ```typescript
  generateReportContent: `
  Você é um assistente de IA especialista em análise de UX e product management.
  Com base nos seguintes dados agregados de diferentes fontes de um projeto:
  {{aggregatedInputData}}
  
  Por favor, gere um relatório abrangente e acionável.
  O relatório deve ter as seguintes seções, formatadas em Markdown no campo "markdownContent":
  1.  Título do Relatório (também fornecido separadamente no campo "title")
  2.  Sumário Executivo (1-2 parágrafos, também fornecido separadamente no campo "summary")
  3.  Principais Descobertas e Análises (detalhado, baseado nos inputs)
  4.  Recomendações Chave (se aplicável, baseado nos inputs)
  5.  Próximos Passos Sugeridos (se aplicável, baseado nos inputs)
  
  Responda ESTRITAMENTE com o seguinte formato JSON, sem nenhum texto adicional antes ou depois:
  {
    "report": {
      "title": "Título conciso e informativo do relatório",
      "summary": "Um sumário executivo de 1 a 2 parágrafos sobre as principais conclusões do relatório.",
      "markdownContent": "# Título do Relatório\\n\\n## Sumário Executivo\\n[Sumário aqui]\\n\\n## Principais Descobertas\\n- Descoberta 1\\n- Descoberta 2\\n\\n## Recomendações\\n- Recomendação 1\\n\\n## Próximos Passos\\n- Passo 1",
      "recommendations": ["Recomendação 1 concisa", "Recomendação 2 concisa"],
      "nextSteps": ["Próximo Passo 1 conciso", "Próximo Passo 2 conciso"]
    }
  }
  Se os dados de entrada forem insuficientes para gerar uma seção (ex: recomendações), retorne um array vazio para ela.
  O título e o sumário devem ser concisos. O markdownContent pode ser mais detalhado.
  `;
  ```

## 4. Estratégia de Testes (`tests/nodes/reportCard.spec.ts`)

### 4.1. Testes do `reportCardNodeHandler.ts`

- **`initializeData()`**:
  - Verificar dados iniciais padrão.
- **`processInput(currentNodeData, parentOutputs)`**:
  - **Agregação de Dados de Entrada:**
    - Testar com `parentOutputs` de diferentes tipos de nós pais (individualmente e combinados).
    - Verificar se a estrutura enviada para a IA (`aggregatedInputData`) é montada corretamente.
    - Testar com dados de entrada vazios/irrelevantes (não deve chamar IA, deve retornar `analyzedData: null`).
  - **Interação com API de IA (`/api/ai/generateReport`)**:
    - Mock de `$fetch` para simular resposta bem-sucedida da IA (com `title`, `summary`, `markdownContent`).
    - Verificar se o `markdownContent` é salvo no Supabase (mock da chamada Supabase).
    - Verificar se `analyzedData` é populado com `{ report_id, title, summary }`.
    - Verificar se `outputData` é gerado corretamente.
    - Simular falha na chamada à API de IA -> `processInputError` deve ser preenchido.
    - Simular falha ao salvar no Supabase -> `processInputError` deve ser preenchido.
    - Simular resposta da API com estrutura JSON inválida.
- **`generateOutput(currentNode)`**:
  - Verificar retorno de `{ report_id, report_title, report_summary }`.
  - Verificar retorno de `{}` se `analyzedData` for nulo.
- **`getDisplayData(currentNode)`**:
  - Verificar retorno de `analyzedData.title`, `analyzedData.summary`, `processInputError`, `inputData`.

### 4.2. Testes do Componente `ReportCard.vue`

- **Renderização Inicial e Estados Visuais**:
  - Exibir mensagem "Conecte dados..." (estado vazio, `!hasPotentiallyProcessableInput`).
  - Exibir botão "Gerar Relatório com IA" (estado conectado, `canManuallyAnalyze`).
  - Exibir indicador de carregamento (`isAnalyzing`).
  - Exibir mensagem de erro (`displayError`).
  - Quando `props.data.analyzedData` populado:
    - Renderizar `analyzedData.title`.
    - Renderizar `analyzedData.summary`.
    - Renderizar botão "Visualizar Relatório Completo".
- **Interações**:
  - Clique em "Gerar Relatório com IA" -> chama `taskFlowStore.requestNodeReprocessing`.
  - Clique em "Visualizar Relatório Completo" -> mock de `navigateTo` para `/reports/[report_id]`.
  - Interações da NodeToolbar (Atualizar, Excluir).
  - Interação do Botão "+".
- **Reatividade**:
  - Watcher de `inputData` atualiza `canManuallyAnalyze` corretamente.
  - Watcher de `analyzedData`/`processInputError` atualiza `isAnalyzing` corretamente.

### 4.3. Testes da Página (`pages/reports/[reportId].vue`)

- Mock de `$fetch` para simular busca do relatório do Supabase (tabela `reports`).
- Verificar se o título do relatório é exibido.
- Verificar se o conteúdo Markdown é renderizado corretamente (pode precisar de um mock simples do renderizador de Markdown).
- Verificar funcionalidade do botão "Voltar para o Fluxo da Tarefa".

## 5. Passos para Implementação

1.  **Configuração Inicial:**
    - Criar arquivos: `ReportCard.vue`, `reportCardNodeHandler.ts`, `/api/ai/generateReport.post.ts`, `pages/reports/[reportId].vue`.
    - Definir prompt `generateReportContent` em `lib/prompts.ts`.
    - Criar tabela `reports` no Supabase.
2.  **Backend API (`/api/ai/generateReport.post.ts`):**
    - Implementar lógica para chamar Gemini e retornar JSON com `title`, `summary`, `markdownContent`.
3.  **Node Handler (`reportCardNodeHandler.ts`):**
    - Implementar `initializeData`, `generateOutput`, `getDisplayData`.
    - Implementar `processInput`: agregação de dados, chamada à API, salvamento no Supabase, atualização de `analyzedData` e `outputData`.
4.  **Store (`taskFlow.ts`):**
    - Registrar novo handler.
    - Adicionar estado e ações para `reportLastProcessedInputs`.
5.  **Componente (`ReportCard.vue`):**
    - Implementar layout estático com dados mocados.
    - Implementar estados visuais (vazio, carregando, erro, analisado).
    - Integrar NodeToolbar e botão "+".
    - Implementar watchers e lógica de botões.
6.  **Página do Relatório (`pages/reports/[reportId].vue`):**
    - Implementar busca de dados do Supabase.
    - Renderizar Markdown.
    - Implementar navegação de volta.
7.  **Regras de Conexão:** Atualizar `lib/connectionRules.ts`.
8.  **Testes:** Escrever testes unitários e de componente conforme especificado.
9.  **Refinamento e Documentação:** Ajustar prompts, UI, e documentar na Memory Bank.

## 6. Critérios de Aceitação

- O `ReportCard` pode ser adicionado ao fluxo.
- O `ReportCard` aceita conexões dos nós pais especificados.
- Ao clicar em "Gerar Relatório com IA", os dados dos pais são enviados para a API de IA.
- A API de IA retorna `title`, `summary`, e `markdownContent`.
- O `markdownContent` é salvo na tabela `reports` do Supabase.
- O `ReportCard` exibe o `title` e `summary` recebidos.
- O botão "Visualizar Relatório Completo" navega para `/reports/[report_id]`.
- A página `/reports/[report_id]` busca e renderiza o `markdownContent` corretamente.
- O botão "Atualizar Relatório" reprocessa os inputs.
- Estados de erro e carregamento são exibidos corretamente.
- Testes unitários e de componente atingem cobertura satisfatória.
