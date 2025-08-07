# Plano de Ação: Corrigir Persistência e Deleção do ReportCard

**Objetivo Principal:** Garantir que, ao criar um relatório através de um `ReportCard`, o `node_id` correspondente seja salvo na tabela `reports` do Supabase. Além disso, assegurar que, ao deletar um `ReportCard` do fluxo, o relatório associado (se existir) seja corretamente removido da tabela `reports`.

**Data:** [Data Atual]

## Fase 1: Modificação da Interface e Handlers para Acesso ao ID do Nó

**Objetivo:** Permitir que o `processInput` dos handlers tenha acesso ao ID do nó que estão processando.

1.  **Tarefa 1.1: Atualizar a Interface `INodeHandler`**

    - **Arquivo:** `types/nodeHandler.ts`
    - **Ação:** Modificar a assinatura do método `processInput` para aceitar o objeto `TaskFlowNode` completo em vez de apenas `NodeData`.
      - De: `processInput(currentNodeData: NodeData, parentOutputs: Record<string, any>): Promise<Partial<NodeData>>;`
      - Para: `processInput(currentNode: TaskFlowNode, parentOutputs: Record<string, any>): Promise<Partial<NodeData>>;`
    - **Status:** A Fazer

2.  **Tarefa 1.2: Atualizar Implementações de `processInput` em Todos os Node Handlers**

    - **Arquivos:**
      - `lib/nodeHandlers/problemNodeHandler.ts`
      - `lib/nodeHandlers/dataSourceNodeHandler.ts`
      - `lib/nodeHandlers/surveyNodeHandler.ts`
      - `lib/nodeHandlers/empathMapNodeHandler.ts`
      - `lib/nodeHandlers/affinityMapNodeHandler.ts`
      - `lib/nodeHandlers/insightsNodeHandler.ts`
      - `lib/nodeHandlers/reportCardNodeHandler.ts`
      - `lib/nodeHandlers/defaultNodeHandler.ts`
    - **Ação:** Para cada handler, alterar a assinatura do método `processInput` para `async processInput(currentNode: TaskFlowNode, parentOutputs: Record<string, any>)`. Dentro do método, onde antes se usava `currentNodeData`, agora usar `currentNode.data`. O `currentNode.id` estará disponível.
    - **Exemplo para `reportCardNodeHandler.ts` (relevante para o `node_id`):**

      ```typescript
      // Antes
      // async processInput(
      //   currentNodeData: NodeData,
      //   parentOutputs: Record<string, any>
      // ): Promise<Partial<NodeData>> {
      //   const reportCardNodeId = ???; // Não disponível diretamente
      //   // ...
      // }

      // Depois
      async processInput(
        currentNode: TaskFlowNode, // Recebe o nó completo
        parentOutputs: Record<string, any>
      ): Promise<Partial<NodeData>> {
        const reportCardNodeId = currentNode.id; // Agora temos o ID
        const currentNodeData = currentNode.data; // Para manter a lógica interna similar
        // ... resto da lógica ...
      }
      ```

    - **Status:** A Fazer (para cada handler)

3.  **Tarefa 1.3: Atualizar Chamada a `handler.processInput` na `taskFlowStore`**
    - **Arquivo:** `stores/taskFlow.ts`
    - **Local:** Dentro da função `requestNodeReprocessing`.
    - **Ação:** Modificar a chamada para `handler.processInput` para passar o objeto `currentNode` completo.
      ```typescript
      // stores/taskFlow.ts - dentro de requestNodeReprocessing
      // ...
      if (handler?.processInput) {
        try {
          // ... (lógica para obter parentOutputs) ...
          // ANTES: handlerResult = await handler.processInput(currentNode.data, parentOutputs);
          handlerResult = await handler.processInput(
            currentNode,
            parentOutputs
          ); // DEPOIS: passa currentNode inteiro
        } catch (error) {
          /* ... */
        }
        // ...
      }
      // ...
      ```
    - **Status:** A Fazer

## Fase 2: Garantir Persistência do `node_id` no `ReportCard`

**Objetivo:** Salvar o ID do `ReportCard` na coluna `node_id` da tabela `reports` ao criar um novo relatório.

1.  **Tarefa 2.1: Confirmar Coluna `node_id` na Tabela `reports`**

    - **Ação:** Verificar no schema do Supabase se a tabela `reports` possui uma coluna `node_id` (do tipo `UUID`, `NULLABLE`).
    - Se não existir, adicionar a coluna via SQL no editor do Supabase:

      ```sql
      ALTER TABLE public.reports
      ADD COLUMN node_id UUID NULL;

      -- Opcional: Adicionar um comentário para a coluna
      COMMENT ON COLUMN public.reports.node_id IS 'ID do nó TaskFlowNode (ReportCard) que gerou este relatório.';
      ```

    - **Verificar/Atualizar `types/supabase.ts`:** Após adicionar a coluna no banco, gerar novamente os tipos do Supabase (`npx supabase gen types typescript --project-id <your-project-id> --schema public > types/supabase.ts`) ou adicionar manualmente `node_id: string | null` à interface `Row` e `Insert` da tabela `reports`.
    - **Status:** A Fazer

2.  **Tarefa 2.2: Incluir `node_id` na Inserção do Relatório**
    - **Arquivo:** `lib/nodeHandlers/reportCardNodeHandler.ts`
    - **Local:** Dentro do método `processInput`, na criação do objeto `reportToInsert`.
    - **Ação:** Adicionar a propriedade `node_id` ao objeto, utilizando `currentNode.id` (que agora está disponível graças às mudanças da Fase 1).
      ```typescript
      // lib/nodeHandlers/reportCardNodeHandler.ts - dentro de processInput
      // ...
      const reportToInsert: ReportTableInsert = {
        title: reportFromAI.title,
        summary: reportFromAI.summary,
        markdown_content: reportFromAI.markdownContent,
        task_id: actualTaskIdValue,
        user_id: currentUserId,
        node_id: currentNode.id, // <<< ADICIONADO AQUI
      };
      // ...
      ```
    - **Status:** A Fazer

## Fase 3: Verificação e Refinamento da Deleção de Relatórios

**Objetivo:** Assegurar que a lógica de deleção no `taskFlowStore` funcione corretamente e que os logs ajudem a diagnosticar problemas.

1.  **Tarefa 3.1: Adicionar Logs Detalhados na Deleção**

    - **Arquivo:** `stores/taskFlow.ts`
    - **Local:** Dentro do método `removeNode`, no bloco `if (nodeToRemove.type === "report" && ...)`
    - **Ação:** Adicionar logs para `nodeToRemove.data.analyzedData` e o `reportId` que está sendo usado para a deleção. Também logar qualquer erro retornado pelo Supabase.

      ```typescript
      // stores/taskFlow.ts - dentro de removeNode
      if (
        nodeToRemove.type === "report" &&
        nodeToRemove.data.analyzedData?.report_id
      ) {
        const reportId = nodeToRemove.data.analyzedData.report_id; // Garantir que reportId é string

        try {
          const client = useSupabaseClient();
          if (!client)
            throw new Error(
              "Supabase client not available for report deletion."
            );

          const query = client.from("reports");
          if (typeof query.delete !== "function")
            throw new Error("Supabase delete method not available.");

          const { error: deleteReportError } = await query
            .delete()
            .eq("id", reportId); // Deleta pela PK do relatório

          if (deleteReportError) {
            console.error(
              `[TaskFlowStore removeNode] Error deleting report from Supabase (ID: ${reportId}):`,
              deleteReportError.message,
              deleteReportError
            );
            // Considerar se deve impedir a remoção do nó no frontend se a deleção no banco falhar
          } else {
          }
        } catch (e: any) {
          console.error(
            `[TaskFlowStore removeNode] Exception during report deletion (ID: ${reportId}) from Supabase:`,
            e.message,
            e
          );
        }
      }
      ```

    - **Status:** A Fazer

2.  **Tarefa 3.2: Revisar Políticas RLS da Tabela `reports`**
    - **Ação:** No painel do Supabase, verificar as Row Level Security policies para a tabela `reports`.
    - Garantir que exista uma política que permita a operação `DELETE` para usuários autenticados baseada no `user_id` do registro do relatório (ou outra lógica apropriada, como `auth.uid() = user_id`). Se não houver `user_id` direto na tabela `reports` que possa ser usado para a política de deleção, a deleção pode precisar ser feita via uma função `SECURITY DEFINER` no Supabase que tenha permissões mais amplas, ou ajustar a política.
    - Se a sua tabela `reports` tem `user_id`, a política padrão como `(auth.uid() = user_id)` para `DELETE` deve ser suficiente.
    - **Status:** A Fazer

## Fase 4: Testes Manuais e Validação

**Objetivo:** Verificar se as modificações funcionam conforme o esperado em um cenário de uso real.

1.  **Tarefa 4.1: Testar Criação de `ReportCard`**

    - **Ação:**
      1.  Criar um fluxo com nós pais que forneçam dados (ex: Survey com respostas, Insights com análise).
      2.  Adicionar um `ReportCard` e conectá-lo aos nós pais.
      3.  Clicar em "Gerar Relatório com IA".
      4.  **Verificar no Supabase:** Confirmar que um novo registro foi criado na tabela `reports` e que a coluna `node_id` está populada com o ID do `ReportCard` do canvas.
      5.  **Verificar no Card:** Confirmar que `analyzedData` no `ReportCard` (no frontend) contém `report_id`, `title`, e `summary`.
    - **Status:** A Fazer

2.  **Tarefa 4.2: Testar Deleção de `ReportCard`**

    - **Ação:**
      1.  Após criar um `ReportCard` com sucesso (Tarefa 4.1), selecione o `ReportCard` no canvas.
      2.  Delete o nó (ex: usando a NodeToolbar ou tecla Delete se habilitada).
      3.  **Verificar no Supabase:** Confirmar que o registro correspondente na tabela `reports` foi deletado.
      4.  **Verificar Logs:** Analisar os logs do console (tanto frontend quanto backend/funções de servidor se aplicável) para qualquer erro durante a deleção.
    - **Status:** A Fazer

3.  **Tarefa 4.3: Testar Cenários de Falha**
    - **Ação:**
      1.  Simular uma falha na API de IA (ex: retornando um erro 500 do endpoint `/api/ai/generateReport`). Verificar se `processInputError` é definido no `ReportCard` e se nenhum registro é criado na tabela `reports`.
      2.  Simular uma falha na inserção no Supabase (ex: violando uma constraint `NOT NULL` se `node_id` fosse `NOT NULL` e não fosse passado). Verificar `processInputError`.
      3.  Tentar deletar um `ReportCard` cujo relatório não existe no banco (ex: se a criação falhou anteriormente mas o nó persistiu no fluxo). A deleção do nó no frontend deve ocorrer sem erros, e a tentativa de deletar no banco não deve causar problemas (apenas não encontrará o registro).
    - **Status:** A Fazer

## Fase 5: Revisão de Código e Testes Automatizados (Opcional para esta issue, mas recomendado)

1.  **Tarefa 5.1: Revisar Código**

    - **Ação:** Revisar todas as alterações para clareza, correção e boas práticas.
    - **Status:** A Fazer

2.  **Tarefa 5.2: Atualizar/Criar Testes Automatizados (Vitest)**
    - **Arquivo:** `tests/nodes/reportCard.spec.ts`
    - **Ação:**
      - Ajustar testes existentes para `reportCardNodeHandler.processInput` para mockar e verificar a passagem do `currentNode.id` (que se torna `node_id` na inserção).
      - Adicionar/ajustar testes para `taskFlowStore.removeNode` para mockar a chamada ao Supabase `delete` e verificar se é chamada com o `report_id` correto quando um `ReportCard` é removido.
    - **Status:** A Fazer (Pode ser feito em uma issue separada se esta ficar muito grande)

Este plano deve cobrir as modificações necessárias para resolver os problemas de persistência do `node_id` e a deleção do relatório.
