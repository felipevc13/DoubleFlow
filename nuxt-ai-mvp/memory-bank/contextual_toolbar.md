# Plano de Ação: Pop-up Contextual para Adicionar Nós (Usando NodeToolbar)

**Objetivo Principal:** Implementar um pop-up/menu contextual que aparece ao clicar no botão "+" de um nó no `TaskFlow.vue`. Este pop-up utilizará o componente `NodeToolbar` do Vue Flow para exibir apenas os tipos de nós válidos para conexão com o nó de origem, baseando-se nas `lib/connectionRules.ts`, e permitirá a criação rápida de nós conectados.

**Data da Última Revisão:** 2024-07-27

---

## 1. Visão Geral da Mudança

- **Interação Principal:** Ao clicar no Handle "+" (botão com ícone de mais) de um nó existente (nó de origem):
  - Uma instância do componente `NodeToolbar` do Vue Flow será exibida.
  - Esta `NodeToolbar` será posicionada de forma adjacente ao nó de origem (provavelmente abaixo).
  - O conteúdo renderizado dentro desta `NodeToolbar` será um novo componente customizado: `ContextualAddNodePopup.vue`.
- **Funcionalidade do Pop-up:**
  - `ContextualAddNodePopup.vue` listará os tipos de nós que podem ser validamente conectados _a partir_ do tipo do nó de origem. Esta filtragem será baseada nas regras definidas em `lib/connectionRules.ts`.
  - Cada item na lista do pop-up exibirá um ícone representativo e o nome do tipo de nó.
  - Ao selecionar um tipo de nó no pop-up, um novo nó desse tipo será criado no canvas.
  - Uma aresta (conexão) será automaticamente estabelecida entre o nó de origem e o nó recém-criado.
  - O novo nó será posicionado de forma inteligente no canvas (geralmente abaixo do nó de origem, com um espaçamento padrão).
- **Comportamento das Toolbars:**
  - Os cards no `TaskFlow.vue` poderão ter múltiplas instâncias de `NodeToolbar`.
  - Uma `NodeToolbar` existente pode ser usada para ações como "Editar" ou "Excluir" (tipicamente visível quando o nó está selecionado).
  - Uma nova `NodeToolbar` será dedicada para a funcionalidade de "Adicionar Nó Conectado", e sua visibilidade será controlada pelo clique no Handle "+".
- **Adição Global de Nós:** A funcionalidade de adicionar nós ao canvas sem um nó de origem específico (ex: através de um botão global na interface do `TaskFlow.vue`) continuará utilizando a `AddNodeSidebar.vue` completa.

---

## 2. Componentes e Lógica a Serem Criados/Modificados

### 2.1. Novo Componente: `ContextualAddNodePopup.vue`

- **Localização:** `components/popups/ContextualAddNodePopup.vue` (será necessário criar a pasta `popups` se ela ainda não existir).
- **Responsabilidade Primária:** Renderizar a interface do usuário para o menu de seleção de tipos de nós, destinado a ser embutido dentro de uma `NodeToolbar`.
- **Props:**
  - `sourceNodeId: String | null` (ID do nó que originou a ação de adicionar).
  - `sourceNodeType: String | null` (Tipo do nó que originou a ação, ex: 'problem', 'dataSource').
- **Conteúdo e Lógica Interna:**
  - **Título (Opcional):** Um cabeçalho como "Conectar a..." ou "Adicionar nó..." pode ser incluído.
  - **Botão de Fechar (X):** Um ícone ou botão para fechar o pop-up, que emitirá o evento `@close`.
  - **Lista de Nós Disponíveis:**
    - Deverá importar `AVAILABLE_NODE_TYPES_INFO` de `lib/nodeDisplayInfo.ts` (ver Seção 2.5).
    - Filtrará a lista `AVAILABLE_NODE_TYPES_INFO` com base em:
      - `props.sourceNodeType`
      - As regras de conexão definidas em `lib/connectionRules.ts`. Apenas os tipos de nó que são destinos válidos para o `sourceNodeType` serão exibidos.
    - Para cada tipo de nó permitido, renderizará um item clicável (pode ser um `ActionListItem.vue` adaptado ou um novo componente mais simples e específico para este pop-up). Cada item deve exibir:
      - O ícone associado ao tipo de nó (de `AVAILABLE_NODE_TYPES_INFO`).
      - O nome/label amigável do tipo de nó (de `AVAILABLE_NODE_TYPES_INFO`).
    - Ao clicar em um item da lista, o componente deverá emitir o evento `@select-node-type` com o `type` (string) do nó selecionado como payload.
  - **Gerenciamento de Clique Fora:** Idealmente, o controle de fechar ao clicar fora pode ser gerenciado pelo `NodeToolbar` ou pelo composable que controla a visibilidade da toolbar. Se necessário, uma diretiva Vue customizada (`v-click-outside`) pode ser adicionada a este componente.
- **Eventos Emitidos:**
  - `@select-node-type="(nodeType: string) => void"`: Emitido quando um usuário seleciona um tipo de nó da lista.
  - `@close="() => void"`: Emitido quando o usuário solicita o fechamento do pop-up (ex: clicando no botão "X").
- **Estilo:**
  - Projetado para se encaixar bem dentro de um `NodeToolbar`.
  - Utilizará classes Tailwind CSS para manter a consistência visual com o restante da aplicação (cores de fundo, bordas, tipografia, etc., conforme `tailwind.config.js` e estilos existentes em `assets/css/`).
  - Os itens da lista devem ter um estado visual claro para `hover` e `focus`.

### 2.2. Adaptação do Composable: `usePlusButtonLogic.ts`

- **Novos Estados Reativos (Refs):**
  - `isAddNodePopupVisible = ref(false)`: Controlará a prop `isVisible` da `NodeToolbar` que hospeda o `ContextualAddNodePopup.vue`.
  - `popupSourceNodeId = ref<string | null>(null)`: Armazenará o ID do nó de origem quando o pop-up for aberto.
  - `popupSourceNodeType = ref<string | null>(null)`: Armazenará o tipo do nó de origem.
- **Modificações na Lógica de Eventos do Handle "+":**
  - **`handleWindowMouseUp` (ou a lógica que determina um "clique simples"):**
    - Quando um clique simples no Handle "+" for detectado (ou seja, `hasDraggedEnough.value === false`):
      - Obter o `nodeId` (já é uma prop do composable).
      - Obter o `nodeType` do nó de origem (usar `findNode(nodeId).type` do `useVueFlow`).
      - Atualizar os refs: `popupSourceNodeId.value = nodeId`, `popupSourceNodeType.value = nodeType`.
      - **Alternar a visibilidade do pop-up:** `isAddNodePopupVisible.value = !isAddNodePopupVisible.value`. Se já estiver aberto para este nó, fecha; senão, abre.
      - A lógica que anteriormente chamava `sidebarStore.openSidebar(SidebarType.ADD_NODE, ...)` para o clique simples será removida.
  - **`handlePlusClick(event: MouseEvent)`:**
    - Manter a chamada `event.stopPropagation()` para evitar que o clique no Handle "+" seja interpretado como um clique no nó (que poderia fechar outras toolbars ou deselecionar o nó).
- **Nova Função Exportada: `handleNodeTypeSelectedFromPopup(selectedNodeType: string)`:**
  - Esta função será chamada pelo componente card quando o `ContextualAddNodePopup.vue` emitir o evento `@select-node-type`.
  - Acessará `popupSourceNodeId.value` para obter o ID do nó de origem.
  - Obterá o nó de origem completo: `const sourceNode = findNode(popupSourceNodeId.value)`.
  - Verificará se `sourceNode` existe e possui `position` e `dimensions`.
  - Chamará a ação da store para adicionar o novo nó e a conexão: `taskFlowStore.requestAddNode(selectedNodeType, popupSourceNodeId.value, sourceNode.position, sourceNode.dimensions?.height)`.
  - Após a chamada à store, fechará o pop-up: `isAddNodePopupVisible.value = false`.
- **Nova Função Exportada: `closeAddNodePopup()`:**
  - Simplesmente define `isAddNodePopupVisible.value = false`.
  - Será usada quando o `ContextualAddNodePopup.vue` emitir `@close` ou quando um clique fora for detectado (se essa lógica for gerenciada pelo composable).
- **Retorno do Composable:**
  - Além dos refs e funções existentes, deverá retornar: `isAddNodePopupVisible`, `popupSourceNodeId`, `popupSourceNodeType`, `handleNodeTypeSelectedFromPopup`, `closeAddNodePopup`.

### 2.3. Modificações na Store: `stores/taskFlow.ts`

- **Ação `requestAddNode`:**
  - **Posicionamento:** Revisar e garantir que, quando um `sourceNodeId`, `sourceNodePosition`, e `sourceHeight` são fornecidos, o novo nó seja posicionado de forma consistente abaixo do nó de origem (ex: `y: sourceNodePosition.y + sourceHeight + VERTICAL_SPACING`). O `VERTICAL_SPACING` deve ser uma constante definida.
  - **Criação de Aresta:** Confirmar que se `sourceNodeId` for válido, uma aresta (edge) seja automaticamente criada e adicionada à store, conectando o `sourceNodeId` ao `newNodeId`. A lógica de `addEdge` (que chama `propagateOutput`) deve ser acionada.
- **Ação `addEdge(edgeData, sourceId, targetId)`:**
  - Verificar se a chamada `propagateOutput(sourceId)` é realizada corretamente após a adição da aresta para garantir que o `inputData` e `cumulativeContext` do nó de destino sejam atualizados.

### 2.4. Modificações nos Componentes Card (e.g., `ProblemCard.vue`, `DataSourceCard.vue`, `SurveyCard.vue`, etc.)

- **Template:**
  - O `Handle` do tipo `source` (com o ícone "+") continuará utilizando os handlers `@mousedown.left="handlePlusMouseDown"` e `@click.left.stop="handlePlusClick"` do `usePlusButtonLogic.ts`.
  - Uma nova instância de `<NodeToolbar>` será adicionada. Esta toolbar será específica para exibir o `ContextualAddNodePopup.vue`.
    - **Props da `NodeToolbar`:**
      - `:is-visible="isAddNodePopupVisible"` (controlado pelo composable).
      - `:node-id="props.id"` (essencial para que a toolbar se associe corretamente ao nó).
      - `:position="Position.Bottom"` (ou outra `Position` desejada, ex: `Position.Right`).
      - `align="center"` (ou conforme o design).
      - `:offset="X"` (um valor numérico, ex: `20`, para ajustar a distância da toolbar em relação ao nó).
    - **Conteúdo do Slot da `NodeToolbar`:**
      ```vue
      <ContextualAddNodePopup
        :source-node-id="popupSourceNodeId"
        :source-node-type="popupSourceNodeType"
        @select-node-type="handleNodeTypeSelectedFromPopup"
        @close="closeAddNodePopup"
      />
      ```
- **Script Setup:**
  - Importar `Position` de `@vue-flow/core`.
  - Desestruturar os novos refs e funções retornados pelo `usePlusButtonLogic.ts` (ex: `isAddNodePopupVisible`, `popupSourceNodeId`, `popupSourceNodeType`, `handleNodeTypeSelectedFromPopup`, `closeAddNodePopup`).

### 2.5. Centralização das Informações de Exibição dos Nós (`lib/nodeDisplayInfo.ts`)

- Criar um novo arquivo (ou adaptar um existente) para armazenar um array ou objeto com as informações de exibição para cada tipo de nó que pode ser adicionado.
- **Estrutura de Dados:**

  ```typescript
  // Exemplo em lib/nodeDisplayInfo.ts
  import ProblemIcon from "~/components/icon/ProblemIcon.vue";
  import DataSourceIcon from "~/components/icon/DataIcon.vue";
  // ... importar todos os ícones necessários ...
  import ReportIcon from "~/components/icon/ReportIcon.vue";

  export interface NodeDisplayInfo {
    type: string; // Identificador único do tipo de nó (ex: 'problem', 'dataSource')
    label: string; // Nome amigável para exibição no pop-up (ex: 'Problema Inicial', 'Fonte de Dados')
    icon: any; // O componente Vue do ícone (ex: ProblemIcon, DataSourceIcon)
    description?: string; // Descrição curta (opcional, pode não ser usada no pop-up, mas útil para a sidebar)
  }

  export const AVAILABLE_NODE_TYPES_INFO: NodeDisplayInfo[] = [
    {
      type: "problem",
      label: "Problema Inicial",
      icon: ProblemIcon,
      description: "Defina o problema ou desafio central a ser trabalhado.",
    },
    {
      type: "dataSource",
      label: "Fonte de Dados",
      icon: DataSourceIcon,
      description:
        "Adicione arquivos (Excel, Word, TXT, MD) ou crie notas rápidas como base de informação.",
    },
    {
      type: "survey",
      label: "Survey",
      icon: SurveyIcon,
      description:
        "Crie pesquisas com diferentes tipos de perguntas para coletar feedback e dados.",
    },
    {
      type: "empathMap",
      label: "Mapa de Empatia",
      icon: EmpathIcon,
      description:
        "Analise dados qualitativos para entender o que usuários dizem, pensam, sentem e fazem.",
    },
    {
      type: "affinityMap",
      label: "Mapa de Afinidade",
      icon: AffinityIcon,
      description:
        "Agrupe visualmente ideias, insights e dados qualitativos em temas relacionados.",
    },
    {
      type: "insights",
      label: "Insights",
      icon: InsightIcon,
      description:
        "Extraia e sumarize automaticamente os principais aprendizados e métricas dos dados conectados.",
    },
    {
      type: "report",
      label: "Relatório",
      icon: ReportIcon,
      description:
        "Gere um relatório consolidado e acionável a partir das análises e dados do fluxo.",
    },
    // Adicionar outros tipos de nós conforme são desenvolvidos
  ];
  ```

- O componente `ContextualAddNodePopup.vue` importará `AVAILABLE_NODE_TYPES_INFO` para obter a lista completa de nós e seus metadados de exibição, antes de aplicar a filtragem baseada nas `connectionRules`.

---

## 3. Fluxo de Interação Detalhado (Revisado com NodeToolbar)

1.  **Clique no Handle "+":** Usuário clica no Handle "+" de um `ProblemCard` (nó de origem).
2.  **Acionamento do Composable:** O `handlePlusMouseDown` (no `usePlusButtonLogic` associado ao `ProblemCard`) é chamado.
3.  **Detecção de Clique Simples:** O `handleWindowMouseUp` (também no composable) confirma que foi um clique simples (sem arrastar).
4.  **Atualização de Estado no Composable:**
    - `popupSourceNodeId.value` é definido como o ID do `ProblemCard` (ex: `'problem-1'`).
    - `popupSourceNodeType.value` é definido como `'problem'`.
    - `isAddNodePopupVisible.value` é alternado para `true`.
5.  **Visibilidade da `NodeToolbar`:** A `NodeToolbar` (que está no template do `ProblemCard` e tem sua prop `:is-visible` atrelada a `isAddNodePopupVisible`) torna-se visível. Ela se posiciona automaticamente abaixo do `ProblemCard` (conforme `position` e `offset`).
6.  **Renderização do `ContextualAddNodePopup`:**
    - O `ContextualAddNodePopup.vue` (que está dentro do slot da `NodeToolbar`) é renderizado.
    - Ele recebe as props `sourceNodeId='problem-1'` e `sourceNodeType='problem'`.
7.  **Filtragem e Exibição no Pop-up:**
    - `ContextualAddNodePopup.vue` consulta `connectionRules['problem']` (ex: `{ dataSource: true, survey: true, report: true }`).
    - Ele filtra `AVAILABLE_NODE_TYPES_INFO` para exibir apenas os itens correspondentes (Fonte de Dados, Survey, Relatório), cada um com seu ícone e label.
8.  **Seleção de Tipo de Nó:** Usuário clica no item "Fonte de Dados" dentro do `ContextualAddNodePopup`.
9.  **Emissão de Evento:** `ContextualAddNodePopup` emite o evento `@select-node-type="('dataSource')"`.
10. **Manipulação do Evento no Card (via Composable):**
    - O `ProblemCard` (ou mais precisamente, o `usePlusButtonLogic` instanciado por ele) recebe este evento.
    - A função `handleNodeTypeSelectedFromPopup('dataSource')` é executada.
11. **Criação do Nó e Aresta na Store:**
    - `handleNodeTypeSelectedFromPopup` chama `taskFlowStore.requestAddNode('dataSource', 'problem-1', /* Posição e altura do ProblemCard */)`.
    - A `taskFlowStore`:
      - Cria um novo nó do tipo `dataSource` com um ID único.
      - Calcula a posição para este novo nó (abaixo do `ProblemCard`).
      - Adiciona o novo nó ao array `nodes.value`.
      - Cria uma nova aresta conectando `'problem-1'` ao ID do novo `dataSourceNode`.
      - Adiciona a nova aresta ao array `edges.value`.
      - Chama `propagateOutput('problem-1')` para que o `dataSourceNode` receba o `problem_definition` como input.
      - O watcher na store (que observa `nodes` e `edges`) aciona `debouncedSaveTaskFlow()` para persistir as mudanças.
12. **Fechamento do Pop-up:**
    - `handleNodeTypeSelectedFromPopup` define `isAddNodePopupVisible.value = false`.
13. **Atualização da UI:**
    - A `NodeToolbar` contendo o pop-up desaparece.
    - O VueFlow renderiza o novo nó `dataSource` e a nova aresta de conexão no canvas.

---

## 4. Considerações Adicionais e Refinamentos

- **Estilo do `NodeToolbar` e do `ContextualAddNodePopup`:**
  - A `NodeToolbar` pode ter um estilo padrão. Pode ser necessário adicionar uma classe CSS customizada à `NodeToolbar` (ex: `class="add-node-toolbar-styling"`) para controlar seu `width`, `padding`, `background-color`, `border-radius`, etc., para que se pareça mais com um menu pop-up.
  - O `ContextualAddNodePopup` deve ser estilizado para se apresentar como uma lista clara e clicável dentro da toolbar.
- **Offset e Posição da `NodeToolbar`:** A prop `offset` da `NodeToolbar` precisará ser ajustada para garantir que o pop-up apareça em uma posição visualmente agradável em relação ao Handle "+". A `position` (ex: `Position.Bottom`) também será crucial.
- **Fechamento do Pop-up (Revisão):**
  - O fechamento via botão "X" no `ContextualAddNodePopup` é claro (emite `@close`, que chama `closeAddNodePopup` no composable).
  - O fechamento ao selecionar um item também é claro ( `handleNodeTypeSelectedFromPopup` define `isAddNodePopupVisible.value = false`).
  - **Clique Fora:** O `NodeToolbar` do Vue Flow _geralmente não fecha automaticamente_ ao clicar fora dele, a menos que a seleção do nó mude ou outra interação específica ocorra. Poderíamos:
    - Depender do `onPaneClick` no `TaskFlow.vue` para chamar `closeAddNodePopup()` se `isAddNodePopupVisible.value` for `true`.
    - Ou adicionar uma diretiva `v-click-outside` ao `ContextualAddNodePopup` (ou ao `NodeToolbar` que o envolve) para chamar `closeAddNodePopup()`.
- **Acessibilidade (A11y):** Garantir que os itens no `ContextualAddNodePopup` sejam focáveis e selecionáveis via teclado. O `NodeToolbar` já pode oferecer alguma base para isso.
- **Consistência com o Handle "+" dos Cards:** O Handle "+" nos cards (`ProblemCard`, `DataSourceCard`, etc.) já usa o `usePlusButtonLogic`. A integração principal será garantir que este composable agora controle a `isAddNodePopupVisible` e chame `handleNodeTypeSelectedFromPopup` em vez de abrir a `AddNodeSidebar`.

---

## 5. Estratégia de Testes (Adaptada para NodeToolbar)

- **Componente `ContextualAddNodePopup.vue`:**
  - Testar se renderiza corretamente os itens filtrados com base nas `props` (`sourceNodeType`) e nas `connectionRules` (mockadas).
  - Verificar se os ícones e labels corretos (de `AVAILABLE_NODE_TYPES_INFO`) são exibidos para cada item.
  - Testar se emite `@select-node-type` com o `type` (string) correto do nó ao clicar em um item da lista.
  - Testar se emite `@close` ao clicar no seu botão de fechar (X).
- **Composable `usePlusButtonLogic.ts`:**
  - Testar se o estado `isAddNodePopupVisible` é alternado corretamente ao simular cliques simples no Handle "+".
  - Verificar se `popupSourceNodeId` e `popupSourceNodeType` são definidos corretamente.
  - Testar se a função `handleNodeTypeSelectedFromPopup` chama `taskFlowStore.requestAddNode` com os argumentos corretos (tipo de nó, ID do nó de origem, posição e altura do nó de origem).
  - Verificar se `isAddNodePopupVisible` é definido como `false` após a seleção de um tipo de nó ou ao chamar `closeAddNodePopup`.
- **Componentes Card (e.g., `ProblemCard.vue`):**
  - Verificar se a instância da `NodeToolbar` dedicada à adição de nós é montada corretamente.
  - Testar se a prop `isVisible` desta `NodeToolbar` é corretamente controlada pelo estado `isAddNodePopupVisible` do `usePlusButtonLogic`.
  - Verificar se o `ContextualAddNodePopup.vue` é renderizado como conteúdo da `NodeToolbar` quando ela está visível.
  - Confirmar que as props `sourceNodeId` e `sourceNodeType` são passadas corretamente para o `ContextualAddNodePopup`.
- **Store `taskFlowStore.ts`:**
  - Reconfirmar (se já não estiver coberto) que `requestAddNode`, quando chamado com um `sourceNodeId`, `sourceNodePosition`, e `sourceHeight`, cria o novo nó na posição correta (abaixo do nó de origem) e adiciona automaticamente uma aresta entre o nó de origem e o novo nó.
  - Garantir que `propagateOutput` é chamado para o nó de origem após a adição da aresta.
- **Testes de Integração (End-to-End Simulado para o Fluxo):**
  - Montar um `TaskFlow.vue` simplificado (ou o card individual com seus mocks de store e Vue Flow).
  - Simular um clique no Handle "+" de um nó específico.
  - Verificar se a `NodeToolbar` apropriada aparece e contém o `ContextualAddNodePopup`.
  - Verificar se o `ContextualAddNodePopup` exibe a lista correta de tipos de nós filtrados.
  - Simular um clique em um dos tipos de nó listados.
  - Verificar se a `NodeToolbar` desaparece.
  - Verificar (através do estado da `taskFlowStore` mockada) se um novo nó do tipo selecionado foi adicionado.
  - Verificar se uma nova aresta foi adicionada, conectando o nó de origem ao novo nó.
  - Verificar se `propagateOutput` foi chamado para o nó de origem.

---

Este plano revisado aproveita melhor os componentes existentes do Vue Flow, potencialmente simplificando a implementação e mantendo a consistência da interface.
