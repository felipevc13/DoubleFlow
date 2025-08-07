# Insights Card Development Plan

Este documento detalha o plano de desenvolvimento para o novo card/node "Insights", uma ferramenta analítica projetada para extrair e apresentar informações qualitativas e quantitativas a partir de dados de entrada, como pesquisas e fontes de dados textuais.

## Objetivos

- Criar um nó analítico que processe dados de entrada (de nós "Survey" e "DataSource") para gerar insights acionáveis.
- Exibir claramente insights qualitativos (temas, resumos, citações) e quantitativos (métricas, distribuições, gráficos de escala).
- Garantir consistência de UI/UX com outros cards analíticos existentes (ex: AffinityMapCard, EmpathMapCard).
- Fornecer uma base sólida para futuras melhorias e tipos de análise de insights.

## Requisitos Funcionais

### Interface e Interações (`InsightsCard.vue`)

- **Visual Base:** Conforme a imagem de referência fornecida e prompts anteriores.
  - **Cabeçalho:**
    - Ícone representativo de "Insights" (`components/icon/InsightsIcon.vue`).
    - Título do Card: "Insights" (`<span class="text-sm text-[#9A9A9C] mr-2">Insights</span>`).
    - As ações (Excluir, Rodar Novamente) estarão na NodeToolbar.
  - **Corpo Principal (Scrollável `overflow-y-auto max-h-[500px]` ou similar):**
    - **Estado Padrão/Vazio:** Mensagem "Conecte um nó de 'Fonte de Dados' ou 'Survey' para gerar insights."
    - **Estado de Erro:** Exibir `props.data.processInputError` de forma clara.
    - **Estado de Carregamento:** (Opcional) Mostrar indicador de carregamento.
    - **Exibição de Dados (`props.data.analyzedData`):**
      - **Seção "Insights Qualitativos":**
        - Título da seção: `<h3 class="text-base font-semibold text-white mb-3">Insights Qualitativos</h3>`.
        - Para cada `insight` qualitativo:
          - Container: `bg-[#3A393F] p-3 rounded-md shadow-sm mb-3 border border-[#47464B]`.
          - `theme`: `<h4 class="text-sm font-medium text-blue-300 mb-1">{{ insight.theme }}</h4>`.
          - `summary`: `<p class="text-xs text-gray-200 mb-2">{{ insight.summary }}</p>`.
          - `supportingQuotes`: Se presentes, iterar: `<blockquote class="text-xs italic text-gray-400 pl-3 border-l-2 border-gray-500 mb-1 block">{{ quote }}</blockquote>`.
      - **Seção "Métricas Principais" (Insights Quantitativos):**
        - Título da seção: `<h3 class="text-base font-semibold text-white mt-4 mb-3">Métricas Principais</h3>`.
        * Para cada `metric` quantitativa:
          - Container: `bg-[#3A393F] p-3 rounded-md border border-[#47464B] mb-2`.
          - `metric.metric` (nome): `<span class="text-sm text-gray-200 block mb-1">{{ metric.metric }}</span>`.
          - `metric.value` (valor principal): `<span class="text-xl font-bold text-green-400">{{ metric.value }}</span>`.
          - `metric.details` (contexto): `<span class="text-xs text-gray-400 block mt-1">{{ metric.details }}</span>`.
          - `metric.distribution`:
            - **Para Escalas (se `metric.startLabel` ou `metric.endLabel` estiverem presentes OU se as chaves de `distribution` forem numéricas e sequenciais):**
              Renderizar um **gráfico de barras horizontal simples**.
              Exemplo de estrutura para uma barra (repetir para cada item na distribuição):
              ```html
              <div class="flex items-center text-xs mb-1">
                <span class="w-8 text-right mr-2 text-gray-400">{{ key }}</span>
                <!-- Valor da escala (ex: "1", "2") -->
                <div class="flex-grow bg-gray-600 rounded-sm h-4">
                  <div
                    class="bg-blue-500 h-4 rounded-sm text-right pr-1 text-white text-[10px]"
                    :style="{ width: (val / totalDistributionCount * 100) + '%' }"
                  >
                    {{ val }}
                  </div>
                </div>
              </div>
              ```
              (Onde `totalDistributionCount` é a soma de todos os valores em `metric.distribution`).
              Exibir `metric.startLabel` e `metric.endLabel` abaixo do gráfico se disponíveis.
            - **Para Múltipla Escolha (outros casos):**
              ```html
              <ul v-if="metric.distribution" class="mt-1">
                <li
                  v-for="(val, key) in metric.distribution"
                  :key="key"
                  class="text-xs text-gray-300"
                >
                  <span class="text-blue-400 mr-1">•</span> {{ key }}: {{ val }}
                </li>
              </ul>
              ```
      - **Seção "Observações Chave":**
        - Título da seção: `<h3 class="text-base font-semibold text-white mt-4 mb-2">Observações Chave</h3>`.
        - Listar cada observação:
          ```html
          <ul
            v-if="data.analyzedData.keyObservations && data.analyzedData.keyObservations.length"
            class="list-disc list-inside space-y-1 mt-1"
          >
            <li
              v-for="(item, index) in data.analyzedData.keyObservations"
              :key="index"
              class="text-sm text-gray-200"
            >
              {{ item }}
            </li>
          </ul>
          ```
      - Se `analyzedData` existir mas for "vazio", mostrar "Nenhum insight relevante encontrado."
- **NodeToolbar (VueFlow):**
  - Visível quando `props.selected` for `true`. Posição `Position.Left`.
  - Botão "Atualizar Análise" (`ArrowPathIcon`): Visível se `hasPotentiallyProcessableInput` for `true`. Chama `taskFlowStore.requestNodeReprocessing(props.id)`.
  - Botão "Excluir Nó" (`TrashIcon`): Chama `taskFlowStore.removeNode(props.id)`.
- **Botão "+" (Adicionar Nó Filho):** Visível se `!props.hasOutgoingConnection`, funcionalidade padrão.
- **Handles (VueFlow):** `target` (Top) e `source` (Bottom) estilizados.

### Processamento de Dados (`insightsNodeHandler.ts`)

- **Entrada:**
  - Aceitar dados de nós pais do tipo `SurveyCard`:
    - Respostas de texto aberto.
    - Respostas de múltipla escolha (valor(es) selecionado(s)).
    - Respostas de escala (valor numérico).
    - Importante: Incluir o texto da pergunta, o tipo da pergunta, e para escalas, `startLabel` e `endLabel` originais, associados a cada resposta para dar contexto à IA.
  - Aceitar dados de nós pais do tipo `DataSourceCard`:
    - Conteúdo textual de arquivos com categoria `pesquisa_usuario`.
- **Agregação:** O handler deve consolidar todos os dados de entrada relevantes dos pais diretos em uma estrutura única e clara (ex: string JSON) para enviar à IA. Esta estrutura deve preservar os `startLabel` e `endLabel` das perguntas de escala.
- **Análise por IA:**
  - Chamar um novo endpoint da API de IA (`/api/ai/insightsAnalysis`) com os dados agregados.
  - A IA será instruída a extrair:
    - **Insights Qualitativos:** Temas, resumos desses temas, e citações de suporte.
    - **Insights Quantitativos:** Métricas relevantes.
      - Para respostas de texto aberto: frequência de palavras-chave, análise de sentimento (se aplicável).
      - Para múltipla escolha: contagem e porcentagem de cada opção, fornecendo a distribuição em `distribution`.
      - **Para escalas (opinião, satisfação, etc.):**
        - Calcular a **média** (arredondada para 1 casa decimal) e informar no campo `value`.
        - Fornecer a **distribuição completa das respostas** numéricas no campo `distribution` (ex: `{"1": 5, "2": 10, "3": 25}`).
        - Se os dados de entrada da pergunta de escala incluírem `startLabel` e `endLabel`, a IA deve passá-los para os campos `startLabel` e `endLabel` do insight quantitativo correspondente.
    - **Observações Chave:** Pontos gerais importantes que emergem da análise combinada.
- **Saída:**
  - Armazenar a resposta da IA (após validação da estrutura) em `props.data.analyzedData`. A estrutura esperada para `analyzedData` é:
    ```typescript
    interface InsightsAnalysis {
      qualitativeInsights: Array<{
        theme: string;
        summary: string;
        supportingQuotes?: string[];
      }>;
      quantitativeInsights: Array<{
        metric: string; // Ex: "Satisfação Geral (Escala 1-5)"
        value: string | number; // Ex: Média "3.8" ou Descrição "Positiva"
        details?: string; // Ex: "N=50 respostas"
        distribution?: Record<string, number>; // Ex: {"1": 2, "2": 5, "3": 10, "4": 20, "5": 13} OU {"Opção A": 10, ...}
        startLabel?: string; // Opcional, para eixos de gráfico: "Muito Insatisfeito"
        endLabel?: string; // Opcional, para eixos de gráfico: "Muito Satisfeito"
      }>;
      keyObservations?: string[];
    }
    ```
  - `outputData` do nó deve ser `{ insights_results: props.data.analyzedData }`.
- **Erros:** Tratar erros da API de IA e armazenar mensagens em `props.data.processInputError`.

### Gerenciamento de Estado (`taskFlowStore.ts`)

- Adicionar estado para `insightsLastProcessedInputs: ref<Record<string, string | null>>({})` ao estado.
- Implementar `getInsightsLastProcessedInput(nodeId: string): string | null`.
- Implementar `setInsightsLastProcessedInput(nodeId: string, inputString: string | null)`.
- Implementar `clearInsightsAnalysis(nodeId: string)` para resetar `analyzedData`, `processInputError`, `outputData` e chamar `setInsightsLastProcessedInput(nodeId, null)`.

### Integração com API (`/api/ai/insightsAnalysis`)

- Novo endpoint `POST /api/ai/insightsAnalysis`.
- Recebe um `prompt` (contendo os dados agregados pelo handler).
- Chama o serviço Gemini (Google Generative AI).
- O prompt para o Gemini deve instruí-lo a analisar os dados e retornar um JSON estritamente no formato `{ "analysis": InsightsAnalysis }` (onde `InsightsAnalysis` é a interface definida acima, incluindo os campos opcionais `startLabel` e `endLabel` para insights quantitativos de escala).

## Estrutura dos Componentes

- `components/cards/InsightsCard.vue`
- `components/icon/InsightsIcon.vue` (Criar um SVG placeholder: uma lâmpada estilizada ou um pequeno gráfico de barras/pizza).
- `lib/nodeHandlers/insightsNodeHandler.ts`
- Adicionar novo prompt `analyzeInsightsData` em `lib/prompts.ts` (ajustar para incluir a solicitação de `startLabel` e `endLabel` para escalas).

## Estratégia de Testes

Os testes seguirão o padrão dos cards analíticos existentes. Arquivo de teste: `tests/nodes/insightsCard.spec.ts`.

### 1. Testes do `insightsNodeHandler.ts`

- **`initializeData()`**:
  - Verificar dados iniciais padrão.
  - Verificar sobrescrita com `initialConfig`.
- **`processInput(currentData, parentOutputs)`**:
  - **Agregação de Dados de Entrada:**
    - Testar com `SurveyCard` (respostas de texto, múltipla escolha, escala). Verificar se texto da pergunta, tipo, e para escalas, `startLabel` e `endLabel` são incluídos nos dados enviados à IA.
    - Testar com `DataSourceCard` (arquivos `pesquisa_usuario`).
    - Testar com múltiplos pais de tipos diferentes.
    - Testar com dados de entrada vazios/irrelevantes.
  - **Interação com API de IA (`/api/ai/insightsAnalysis`)**:
    - Mock de `$fetch` para simular resposta bem-sucedida com `InsightsAnalysis` (incluindo `startLabel`/`endLabel` para escalas). Verificar `analyzedData`, `outputData`, `processInputError`.
    - Simular falha na API.
    - Simular resposta da API com estrutura JSON inválida.
- **`generateOutput(currentNode)`**:
  - Verificar retorno de `{ insights_results: currentNode.data.analyzedData }`.
- **`getDisplayData(currentNode)`**:
  - Verificar retorno de `analyzedData`, `processInputError`, `inputData`.

### 2. Testes do Componente `InsightsCard.vue`

- **Renderização Inicial e Estados Visuais**:
  - Exibir mensagem "Conecte uma fonte..." (estado vazio).
  - Exibir mensagem de erro.
  - Quando `props.data.analyzedData` populado:
    - Renderizar corretamente seção "Insights Qualitativos".
    - Renderizar corretamente seção "Métricas Principais":
      - Para métricas de escala com `distribution`, verificar renderização do gráfico de barras horizontal e dos `startLabel`/`endLabel`.
      - Para outras métricas quantitativas, verificar exibição de valor, detalhes, e distribuição textual.
    - Renderizar corretamente seção "Observações Chave".
  - Exibir "Nenhum insight relevante encontrado" se `analyzedData` for "vazio".
- **Interações da NodeToolbar**:
  - Botão "Atualizar Análise": Visibilidade e clique.
  - Botão "Excluir Nó": Visibilidade e clique.
- **Interação do Botão "+"**:
  - Clique abre `AddNodeSidebar`.
  - Oculto se `hasOutgoingConnection`.
- **Reatividade a Mudanças em `props.data.inputData` (Watcher)**:
  - Conforme definido anteriormente (foco em pais diretos e dados relevantes).

## Passos para Implementação

1.  **Configuração Inicial:**
    - Criar arquivos: `InsightsCard.vue`, `InsightsIcon.vue`, `insightsNodeHandler.ts`.
    - Adicionar prompt `analyzeInsightsData` em `lib/prompts.ts` (com instruções para `startLabel`/`endLabel`).
    - Registrar handler e tipo de nó. Adicionar regras de conexão e item no `AddNodeSidebar.vue`.
2.  **Desenvolvimento do Visual do Card (`InsightsCard.vue`):**
    - Implementar layout estático com dados mocados (incluindo dados para gráfico de barras de escala com `startLabel`/`endLabel`).
    - Focar na renderização correta de todos os tipos de insights, incluindo o gráfico de barras.
    - Implementar estados de erro/vazio. Integrar NodeToolbar e botão "+".
3.  **Desenvolvimento do Backend (`insightsAnalysis.post.ts` e Prompt):**
    - Implementar endpoint da API.
    - Refinar prompt `analyzeInsightsData` para que a IA extraia e retorne `startLabel` e `endLabel` quando aplicável a dados de escala.
4.  **Desenvolvimento do Handler (`insightsNodeHandler.ts`):**
    - Implementar `initializeData`, `generateOutput`, `getDisplayData`.
    - Implementar lógica de agregação em `processInput`, garantindo que `startLabel`/`endLabel` de perguntas de escala sejam passados para a IA.
    - Integrar chamada à API, tratamento de sucesso/erro.
5.  **Integração com `taskFlowStore.ts`:**
    - Adicionar `insightsLastProcessedInputs` e funções relacionadas.
6.  **Implementação da Reatividade no Card (`InsightsCard.vue`):**
    - Implementar `watch` em `props.data.inputData`.
    - Conectar botões da NodeToolbar.
7.  **Testes:** Conforme descrito na seção de testes.
8.  **Documentação:** Atualizar `memory-bank`.

## Critérios de Aceitação

- O `InsightsCard.vue` renderiza corretamente todos os tipos de insights, incluindo gráficos para dados de escala.
- O `insightsNodeHandler.ts` agrega dados (incluindo metadados de perguntas de escala) e interage com a API.
- O endpoint `/api/ai/insightsAnalysis` e o prompt para Gemini estão ajustados para lidar com dados de escala e seus rótulos.
- O card reage corretamente a mudanças nos dados de entrada de pais diretos.
- Testes cobrem os principais cenários.
- A UI/UX é consistente.
