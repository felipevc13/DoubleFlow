# Plano de Ação para MVP/Beta do Projeto "DoubleFlow"

Este plano detalha as tarefas necessárias para alcançar um MVP (Minimum Viable Product) / Beta funcional, priorizando o valor para o usuário e a coleta de feedback.

## Fase 0: Fundação e Estabilização Inicial (Prioridade Altíssima)

**Objetivo:** Garantir que a base técnica esteja sólida e os fluxos mais críticos não tenham bugs impeditivos.

- **Tarefa 0.1: Padronizar Modelo de IA nos Backends**

  - **Descrição:** Confirmar que todos os endpoints em `server/api/ai/` estão utilizando o modelo `gemini-1.5-flash-latest`.
  - **Arquivos Chave:** `affinityMapAnalysis.post.ts`, `empathMapAnalysis.post.ts`, `generateReport.post.ts`, `insightsAnalysis.post.ts`, `problemRefinement.post.ts`, `surveyGeneration.post.ts`.
  - **Status:** A Fazer.

- **Tarefa 0.2: Correção de Bugs Críticos nos Fluxos Principais**

  - **Descrição:** Realizar testes manuais nos fluxos de trabalho chave (ex: Survey -> Insights -> Report; DataSource -> EmpathMap -> Report). Identificar e corrigir quaisquer bugs que impeçam a conclusão desses fluxos ou causem perda de dados.
  - **Arquivos Chave:** Cards relevantes, Node Handlers correspondentes, `stores/taskFlow.ts`.
  - **Status:** A Fazer.

- **Tarefa 0.3: Revisão e Refinamento dos Prompts de IA Iniciais**
  - **Descrição:** Com base nos testes da Tarefa 0.2, revisar e refinar os prompts em `lib/prompts.ts` para melhorar a precisão e o formato (JSON) das respostas da IA, especialmente para os cards dos fluxos principais.
  - **Arquivos Chave:** `lib/prompts.ts`, endpoints em `server/api/ai/`.
  - **Status:** A Fazer.

## Fase 1: MVP Funcional – Polimento dos Cards e Fluxo Essencial (Prioridade Alta)

**Objetivo:** Ter um conjunto central de funcionalidades estáveis e com boa UX para os beta testers.

- **Tarefa 1.1: Melhorias e Testes no `SurveyCard` e `SurveyModal`**

  - **Sub-tarefa 1.1.1:** Implementar Tag de Status (Ativo/Inativo) visualmente no `SurveyCard.vue`. Garantir que `node.data.is_active` seja populado corretamente pelo `surveyNodeHandler`.
  - **Sub-tarefa 1.1.2:** Implementar Contagem de Respostas no `SurveyCard.vue`. Garantir que `node.data.responseCount` (ou similar) seja populado e atualizado.
  - **Sub-tarefa 1.1.3:** Testar exaustivamente a criação/edição de todos os tipos de perguntas no `SurveyBuilder.vue` e seus respectivos `config/*.vue` (lógica de "salvar no blur", `isEditingLocally`).
  - **Sub-tarefa 1.1.4:** Testar a geração de survey por IA (`handleCreateWithAI` no `SurveyBuilder.vue`).
  - **Sub-tarefa 1.1.5:** Validar reordenação e deleção de perguntas no `SurveyBuilder.vue` e a sincronização com o backend.
  - **Sub-tarefa 1.1.6:** Testar a aba "Compartilhar" no `SurveyModal.vue` (geração de link, toggle Ativo/Inativo e persistência).
  - **Sub-tarefa 1.1.7:** Testar a aba "Resultados" no `SurveyModal.vue`.
  - **Sub-tarefa 1.1.8:** Testar a página de preview pública (`/preview/[surveyId].vue`) – renderização e salvamento de respostas.
  - **Arquivos Chave:** `components/cards/SurveyCard.vue`, `components/modals/SurveyModal/**`, `lib/nodeHandlers/surveyNodeHandler.ts`, `server/api/surveys/**`, `pages/preview/[surveyId].vue`.
  - **Status:** A Fazer.

- **Tarefa 1.2: Melhorias e Testes no `DataSourceCard` e `DataSourceModal`**

  - **Descrição:** Testar upload de todos os tipos de arquivo, extração de conteúdo, criação/edição de Notas Rápidas, seleção de categorias e deleção de fontes.
  - **Arquivos Chave:** `components/cards/DataSourceCard.vue`, `components/modals/DataSourceModal/**`, `lib/nodeHandlers/dataSourceNodeHandler.ts`, `server/api/files/**`.
  - **Status:** A Fazer.

- **Tarefa 1.3: Polimento e Testes dos Cards Analíticos Principais**

  - **Cards:** `EmpathMapCard`, `AffinityMapCard`, `InsightsCard`, `ReportCard`.
  - **Sub-tarefa 1.3.1:** Implementar a "Data da Última Análise" em cada card analítico (usando `props.data.updated_at`).
  - **Sub-tarefa 1.3.2:** Testar o fluxo completo: Conectar fontes -> Botão "Analisar com IA" -> Estado `isAnalyzing` -> Exibição de `analyzedData` -> Exibição de `processInputError`.
  - **Sub-tarefa 1.3.3:** Validar a clareza e utilidade dos dados exibidos (mapas, clusters, métricas, relatórios).
  - **Arquivos Chave:** `components/cards/*.vue` (analíticos), `lib/nodeHandlers/*NodeHandler.ts` (analíticos).
  - **Status:** A Fazer.

- **Tarefa 1.4: Teste de Conexões e Propagação de Dados no `TaskFlow`**
  - **Descrição:** Validar se `inputData` e `cumulativeContext` são atualizados corretamente nos nós filhos. Testar a lógica de `[NodeType]LastProcessedInputs` e `clear[NodeType]Analysis` para evitar reanálises desnecessárias.
  - **Arquivos Chave:** `stores/taskFlow.ts`, todos os cards e handlers.
  - **Status:** A Fazer.

## Fase 2: Melhorias de Usabilidade do Fluxo (Prioridade Média-Alta)

**Objetivo:** Tornar a construção e interação com o fluxo mais intuitiva.

- **Tarefa 2.1: Ajustar Posicionamento de Nós Adicionados pelo `AddNodeSidebar` Global**

  - **Descrição:** Modificar `taskFlowStore.requestAddNode` para que nós adicionados pelo sidebar global apareçam centralizados no viewport atual do canvas, sem conexões automáticas.
  - **Arquivos Chave:** `stores/taskFlow.ts` (ação `requestAddNode`), `components/sidebars/AddNodeSidebar.vue`.
  - **Status:** A Fazer.

- **Tarefa 2.2: Implementar Adição Contextual de Nós (Toolbar Pop-up)**
  - **Descrição:**
    - Exibir um botão "+" abaixo de nós que podem ter saídas (ou no handle de saída ao passar o mouse).
    - Ao clicar neste "+", abrir uma toolbar/menu pop-up flutuante com os tipos de nós válidos para conexão (baseado em `lib/connectionRules.ts`).
    - Selecionar um nó na toolbar deve criá-lo e conectá-lo automaticamente abaixo do nó de origem.
  - **Arquivos Chave:** `components/TaskFlow.vue`, `stores/taskFlow.ts`, `lib/connectionRules.ts`, criar novo componente para a toolbar contextual.
  - **Status:** A Fazer.

## Fase 3: Interface do Usuário e Experiência Geral (Prioridade Média)

**Objetivo:** Preparar a ferramenta para ser apresentável e funcional em diferentes contextos.

- **Tarefa 3.1: Responsividade Mobile Mínima Viável**

  - **Descrição:** Garantir que layouts globais (`SideNav`, `Header`, `app.vue`) se ajustem. Priorizar usabilidade mobile para: login/cadastro, lista de tarefas, visualização de relatórios e _responder_ a surveys. Para o canvas do `TaskFlow` e modais complexos, aceitar limitações com mensagens informativas.
  - **Arquivos Chave:** `app.vue`, `layouts/default.vue`, `components/SideNav.vue`, `pages/login.vue`, `pages/preview/[surveyId].vue`, `pages/reports/[reportId].vue`, `components/MarkdownRenderer.vue`.
  - **Status:** A Fazer.

- **Tarefa 3.2: Landing Page e Fluxo de Cadastro/Login**

  - **Sub-tarefa 3.2.1:** Criar `pages/index.vue` (ou similar) como landing page com hero, explicação do produto, carrossel de features e CTA para cadastro/login.
  - **Sub-tarefa 3.2.2:** Implementar `pages/register.vue` para cadastro de novos usuários via Supabase Auth.
  - **Sub-tarefa 3.2.3:** Ajustar `pages/login.vue` com link para cadastro.
  - **Sub-tarefa 3.2.4:** Implementar/Revisar middleware de proteção de rotas e redirecionamentos pós-login/cadastro.
  - **Arquivos Chave:** `pages/index.vue`, `pages/login.vue`, criar `pages/register.vue`, `middleware/auth.global.ts` (ou similar), `middleware/redirect-to-first-task.js`.
  - **Status:** A Fazer.

- **Tarefa 3.3: Revisão da Navegação e Feedback Geral ao Usuário**

  - **Descrição:** Assegurar navegação intuitiva. Implementar feedback visual consistente (loading spinners, toasts para sucesso/erro) para todas as ações principais.
  - **Arquivos Chave:** Todos os componentes interativos, `plugins/toast.js`.
  - **Status:** A Fazer.

- **Tarefa 3.4: Melhorias nos Cards Analíticos (Contexto Adicional)**
  - **Sub-tarefa 3.4.1 (Opcional para MVP inicial, mas bom):** Implementar a indicação visual das "Fontes de Dados da Análise" nos cards analíticos. Requer lógica nos handlers para coletar e salvar `analysisSources` no `node.data`.
  - **Arquivos Chave:** `components/cards/*Card.vue` (analíticos), `lib/nodeHandlers/*NodeHandler.ts` (analíticos).
  - **Status:** A Fazer (Opcional).

## Fase 4: Preparação e Lançamento do Beta Fechado (Prioridade Média)

**Objetivo:** Colocar a ferramenta nas mãos dos primeiros usuários e coletar feedback.

- **Tarefa 4.1: Preparar Materiais de Onboarding e Coleta de Feedback**

  - **Descrição:** Criar um guia rápido ou vídeo. Preparar formulário de feedback.
  - **Status:** A Fazer.

- **Tarefa 4.2: Deploy da Aplicação (Vercel)**

  - **Descrição:** Configurar projeto no Vercel, adicionar variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`). Testar o deploy.
  - **Status:** A Fazer.

- **Tarefa 4.3: Recrutar e Convidar Beta Testers**

  - **Descrição:** Selecionar e convidar usuários para o beta fechado.
  - **Status:** A Fazer.

- **Tarefa 4.4: Iniciar Coleta Ativa de Feedback e Monitoramento**
  - **Descrição:** Acompanhar uso, responder dúvidas, analisar feedback.
  - **Status:** A Fazer.

## Fase 5: Pós-MVP e Próximos Passos (Prioridade Baixa para o _primeiro_ Beta)

**Objetivo:** Melhorias contínuas e adição de novas funcionalidades com base no feedback.

- **Tarefa 5.1: Iterar com Base no Feedback do Beta**

  - **Descrição:** Analisar o feedback e priorizar correções e melhorias.
  - **Status:** Pendente (Pós-Beta).

- **Tarefa 5.2: Aprimorar Integração da `KnowledgeBase` Global**

  - **Descrição:** Explorar formas de tornar o uso da KB global mais explícito e útil nos cards analíticos (ex: "KBQueryCard", seletores de contexto da KB).
  - **Arquivos Chave:** `pages/knowledgebase.vue`, `stores/knowledgeBase.ts`, cards analíticos, handlers.
  - **Status:** Pendente.

- **Tarefa 5.3: Implementar Testes Automatizados**

  - **Descrição:** Escrever testes unitários (Vitest) para handlers, stores e componentes críticos.
  - **Arquivos Chave:** `tests/**`.
  - **Status:** Pendente.

- **Tarefa 5.4: Internacionalização (Inglês)**

  - **Descrição:** Traduzir UI, prompts de IA, e materiais.
  - **Status:** Pendente.

- **Tarefa 5.5: Explorar Modelo de Monetização e Planos**
  - **Descrição:** Definir e implementar a lógica de planos e pagamentos.
  - **Status:** Pendente.

---

**Notas:**

- Este plano assume que as tarefas de "Fundação" e "MVP Funcional" são as mais críticas para ter algo testável.
- A "Prioridade" é relativa ao lançamento do primeiro Beta. Itens de "Prioridade Baixa" são importantes, mas podem vir após a validação inicial.
- Mantenha a `memory-bank` atualizada à medida que avança!

Este plano deve te dar um bom roteiro. Lembre-se de que ele é flexível e pode ser ajustado conforme você avança e recebe feedback.
