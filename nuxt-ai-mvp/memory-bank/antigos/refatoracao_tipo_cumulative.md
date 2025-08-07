# Plano de Refatoração: Enriquecer `cumulativeContext` com Tipo do Nó Ancestral

## 1. Objetivo Principal

Modificar o sistema de fluxo de tarefas para que o `cumulativeContext` de cada nó armazene não apenas o `output` e a `version` de seus ancestrais, mas também o `type` de cada nó ancestral. Isso permitirá que os handlers dos cards analíticos (EmpathMap, AffinityMap, Insights, Report) acessem o tipo dos ancestrais diretamente do contexto, eliminando a necessidade de consultar `taskFlowStore.nodes.value` durante o `processInput` e, assim, prevenindo erros como "Cannot read properties of undefined (reading 'find')".

## 2. Justificativa

- **Robustez:** Evita erros de timing onde `taskFlowStore.nodes.value` pode não ser um array acessível durante operações assíncronas dentro dos handlers.
- **Autocontenção dos Handlers:** Os handlers recebem toda a informação contextual necessária (incluindo tipos de ancestrais) como parte dos dados do nó ou argumentos de função, reduzindo o acoplamento com o estado global da store.
- **Clareza:** Simplifica a lógica dentro dos handlers para identificar e processar dados de diferentes tipos de ancestrais.
- **Consistência:** Padroniza a forma como a informação contextual é armazenada e acessada.

## 3. Arquivos Chave a Serem Modificados

- `stores/taskFlow.ts` (Principalmente a função `processNodeInputs` ou a lógica equivalente que constrói/atualiza `cumulativeContext`).
- `lib/nodeHandlers/reportCardNodeHandler.ts`
- `lib/nodeHandlers/insightsNodeHandler.ts`
- `lib/nodeHandlers/empathMapNodeHandler.ts`
- `lib/nodeHandlers/affinityMapNodeHandler.ts`
- `utils/nodeContext.ts` (Verificar `mergeByVersion` e outras helpers, embora provavelmente não precisem de grandes mudanças).
- Respectivos arquivos de teste (`*.spec.ts`) para os handlers e para `taskFlow.ts`.

## 4. Passos Detalhados da Implementação

### Passo 1: Modificar `stores/taskFlow.ts` para Enriquecer o `cumulativeContext`

**Localização da Mudança Principal:** Função `processNodeInputs` (ou a função que calcula o `cumulativeContext` para um nó baseado em seus pais).

**Lógica a ser Alterada:**
Quando o `aggregatedParentContextBlob` (que se tornará o `cumulativeContext.blob` do nó alvo) estiver sendo construído:

1.  Ao mesclar o `cumulativeContext` de um nó pai (`parentOwnCumulativeContext`), este já terá o formato enriquecido se a propagação ocorrer em cascata.
2.  Ao adicionar a entrada para o **pai direto** (`parentNode`) no `aggregatedParentContextBlob` do nó alvo, a entrada deve ser:
    ```typescript
    const parentDirectEntry = {
      type: parentNode.type, // <<< NOVO: Incluir o tipo do nó pai
      output: parentNode.data?.outputData ?? null,
      version: parentNode.data.updated_at
        ? Date.parse(parentNode.data.updated_at)
        : Date.now(), // Usar timestamp do updated_at como versão
    };
    // E então mesclar isso:
    aggregatedParentContextBlob = mergeByVersion(aggregatedParentContextBlob, {
      [edge.source]: parentDirectEntry, // edge.source é o ID do parentNode
    });
    ```

**Exemplo de Modificação em `processNodeInputs` (dentro do loop `for (const edge of incomingEdges)`):**

```typescript
// stores/taskFlow.ts - dentro de processNodeInputs

// ...
for (const edge of incomingEdges) {
  const parentNode = nodes.value.find((n) => n.id === edge.source);
  if (parentNode) {
    // Para parentOutputsForHandler (usado pelo processInput do handler do targetNode) - permanece como está
    parentOutputsForHandler[edge.source] = {
      type: parentNode.type,
      output: parentNode.data?.outputData ?? {
        warning: "Parent output data missing",
      },
    };

    // Para o aggregatedParentContextBlob (que se tornará o cumulativeContext do targetNode)
    // 1. Mesclar o contexto cumulativo do próprio pai
    const parentOwnCumulativeContext = getAggregatedContext(parentNode);
    aggregatedParentContextBlob = mergeByVersion(
      aggregatedParentContextBlob,
      parentOwnCumulativeContext
    );

    // 2. Adicionar/Sobrescrever a entrada para o pai direto, AGORA COM O TIPO
    const parentVersion = parentNode.data.updated_at
      ? Date.parse(parentNode.data.updated_at)
      : Date.now();
    const parentDirectEntry = {
      type: parentNode.type, // <<< MUDANÇA PRINCIPAL AQUI
      output: parentNode.data?.outputData ?? null,
      version: isNaN(parentVersion) ? Date.now() : parentVersion,
    };
    aggregatedParentContextBlob = mergeByVersion(aggregatedParentContextBlob, {
      [edge.source]: parentDirectEntry,
    });
  }
}
const newCumulativeContextToSave = compressIfNeeded(
  aggregatedParentContextBlob
);
// ... o restante da função continua, atualizando targetNode.data.cumulativeContext com newCumulativeContextToSave ...
```
