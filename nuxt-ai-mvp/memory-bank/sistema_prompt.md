Excelente. Fico feliz que tenhamos chegado a um consenso sobre a arquitetura ideal. A sua avaliação e os pontos de polimento que você sugeriu são extremamente pertinentes e elevam o plano a um nível de produto profissional.

Aqui está o plano de implementação completo e final, que integra todas as nossas conclusões, incluindo sua proposta de "plugins de extração" e "composição de prompts". Este é o guia definitivo que um desenvolvedor pode seguir para construir um sistema de análise de IA verdadeiramente escalável e de fácil manutenção.

Plano de Implementação Final: Arquitetura de Análise Escalável e Componível

Última Atualização: 2024-07-12

1. Objetivo Principal

Implementar uma arquitetura de análise de IA modular e componível. O sistema será capaz de processar um número arbitrário de tipos de fontes de dados (ex: pesquisa_usuario, transcricao_entrevista, customer_feedback) e suas combinações, escolhendo e montando dinamicamente o prompt de IA mais apropriado, sem a necessidade de modificar o código dos handlers dos cards analíticos a cada nova adição.

2. Visão Geral da Arquitetura Proposta

Adotamos uma arquitetura de 3 camadas, plugável e componível, que desacopla a extração de dados, a construção do prompt e a execução da análise.

<!-- Você pode gerar um diagrama Mermaid e colocar o link aqui -->

Camada de Extração (Plugins): Um registro de "extratores" (dataExtractors) que carrega dinamicamente plugins para cada category de dado. Adicionar suporte a um novo tipo de dado (ex: PDF) se resume a criar um novo arquivo de extrator.

Camada de Composição de Prompt (Templates + Partials): Um único "template master" por card analítico (ex: master_insights.md) que compõe o prompt final injetando "partials" (blocos de texto reutilizáveis) com base nos tipos de dados presentes na entrada.

Camada de Execução e Garantia de Formato (Function Calling): A chamada à API da IA utiliza function calling (ou tools), fornecendo o schema de saída desejado e forçando a IA a retornar um JSON estruturado e válido, eliminando a necessidade de parsing de texto.

3. Passos Detalhados da Implementação
   Fase 1: Implementar o Padrão de Extratores (Plugins)

Esta é a fundação da nova arquitetura.

Criar a Estrutura de Diretórios e a Interface do Plugin:

Crie o diretório: server/utils/extractors/

Dentro dele, crie a interface: server/utils/extractors/types.ts

Generated typescript
// Em server/utils/extractors/types.ts
export interface ExtractedContent {
sourceType: string; // ex: 'survey_response', 'interview_transcript'
content: string; // O texto limpo e processado para a IA
preview: string; // Um trecho curto para ser usado no prompt master
}

export interface Extractor {
// A categoria do arquivo no DataSourceCard que este plugin processa
category: 'pesquisa_usuario' | 'transcricao_entrevista' | 'customer_feedback' | string;
// O tipo de fonte que será informado à IA no prompt
sourceType: string;
// A função que extrai o conteúdo relevante
extract: (ancestorOutput: any) => ExtractedContent[];
}

Criar Extratores Individuais (Plugins):

Arquivo: server/utils/extractors/surveyExtractor.ts

Generated typescript
// Em server/utils/extractors/surveyExtractor.ts
import type { Extractor, ExtractedContent } from './types';

const surveyExtractor: Extractor = {
category: 'pesquisa_usuario',
sourceType: 'survey_response',
extract: (ancestorOutput): ExtractedContent[] => {
const texts: ExtractedContent[] = [];
const files = ancestorOutput?.uploaded_files || [];
// Lógica para iterar sobre colunas inferidas de arquivos excel
files.forEach((file: any) => {
if (file.inferred_survey_columns) {
file.inferred_survey_columns.forEach((col: any) => {
if (col.questionType === 'openText' && col.openTextResponses) {
const content = `Pergunta: "${col.questionText}"\nRespostas:\n- ${col.openTextResponses.join('\n- ')}`;
texts.push({
sourceType: 'survey_response',
content: content,
preview: `Respostas para "${col.questionText}"`
});
}
});
}
});
return texts;
}
};
export default surveyExtractor;
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END

Arquivo: server/utils/extractors/transcriptExtractor.ts

Arquivo: server/utils/extractors/feedbackExtractor.ts
(Crie arquivos análogos para transcricao_entrevista e customer_feedback, cada um exportando um objeto Extractor padrão).

Implementar o Registro com Auto-Discovery:

Arquivo: server/utils/dataExtractors.ts (O "index" dos extratores)

Ação: Usar import.meta.glob para carregar dinamicamente todos os extratores.

Generated typescript
// Em server/utils/dataExtractors.ts
import type { Extractor } from './extractors/types';

export const dataExtractors: Record<string, Extractor> = {};

// Carrega dinamicamente todos os arquivos .ts dentro da pasta /extractors
const modules = import.meta.glob('./extractors/\*.ts', { eager: true });

for (const path in modules) {
const mod = modules[path] as { default: Extractor };
if (mod.default && mod.default.category) {
dataExtractors[mod.default.category] = mod.default;
}
}

// Extrator de fallback para categorias desconhecidas
export const defaultExtractor: Extractor = {
category: 'default',
sourceType: 'generic_text',
extract: (ancestorOutput) => {
const content = JSON.stringify(ancestorOutput);
console.warn(`Usando extrator de fallback para dados: ${content.substring(0, 200)}...`);
return [{
sourceType: 'generic_text',
content: content,
preview: `Dados genéricos: ${content.substring(0, 100)}...`
}];
}
};
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Fase 2: Implementar a Composição de Prompts com Partials

Criar o Diretório de Partials:

lib/prompts/partials/persona_ux_researcher.md

lib/prompts/partials/output_format_json_with_function_call.md

lib/prompts/partials/input_source_definitions.md

Criar os Templates Master (Um por Card):

Arquivo: lib/prompts/base/master_insights.md (Exemplo)

Generated handlebars
{{> partials/persona_ux_researcher.md }}

Sua tarefa é sintetizar dados brutos de múltiplas fontes para gerar um relatório de insights. Identifique temas, dores e oportunidades, e destaque padrões que se conectam entre os diferentes tipos de fontes de dados.

Você recebeu dados dos seguintes tipos: {{sourceTypes}}.
{{> partials/input_source_definitions.md }}

**Dados Agregados para Análise (em formato de preview):**
{{aggregatedData}}

{{> partials/output_format_json_with_function_call.md }}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Handlebars
IGNORE_WHEN_COPYING_END

Atualizar o promptEngine.ts:

Ação: Ensinar generateFinalPrompt a entender e processar a sintaxe {{> path/to/partial.md }}.

Fase 3: Adotar a Estratégia Declarativa no analysis.yml

Arquivo: lib/prompts/analysis.yml

Ação: Simplificar drasticamente o arquivo para ter uma única entrada por tipo de análise, removendo a necessidade de inputSignature.

Generated yaml

# Em lib/prompts/analysis.yml (NOVO FORMATO)

insightsAnalysis:
description: "Gera insights a partir de quaisquer fontes de dados conectadas."
promptTemplate: "master_insights" # Aponta para o template master de insights
output:
saveTo: "analyzedData"
schema: # Schema para o function calling
type: "object"
properties:
qualitativeInsights: { type: "array", items: { type: "object", properties: { theme: { type: "string" }, summary: { type: "string" }, supportingQuotes: { type: "array", items: { type: "string" } } } } }
actionableRecommendations: { type: "array", items: { type: "object", properties: { priority: { type: "string", enum: ["high", "medium", "low"] }, text: { type: "string" } } } }
postProcess:
createOutputFrom: "analyzedData"
renameTo: "insights_results"

# (Padrão similar para empathyMapAnalysis e affinityMapAnalysis)

IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Yaml
IGNORE_WHEN_COPYING_END
Fase 4: Refatorar o Orquestrador runAnalysis.ts

Arquivo: server/utils/runAnalysis.ts

Ação: Implementar a nova lógica de orquestração que usa os extratores e o function_calling.

Generated typescript
// Em server/utils/runAnalysis.ts
import { dataExtractors, defaultExtractor } from './dataExtractors';
// ... outros imports ...

export async function runAnalysis(analysisPrefix: string, nodeData: any): Promise<any> {
// 1. Encontra a configuração para o prefixo (ex: "insightsAnalysis")
const config = analysisConfigCache![analysisPrefix];
if (!config) {
throw new Error(`Configuração de análise não encontrada para: ${analysisPrefix}`);
}

// 2. Extrai e Agrega Conteúdo usando os Plugins
const context = decompressContextBlob(nodeData.cumulativeContext);
const allExtractedContents: ExtractedContent[] = [];
const sourceTypesPresent = new Set<string>();

for (const ancestorId in context) {
const ancestor = context[ancestorId];
if (!ancestor || !ancestor.output) continue;

    // Determina a categoria do ancestral
    const category = determineCategoryFromAncestor(ancestor); // Função helper a ser criada

    // Seleciona o extrator correto ou o padrão
    const extractor = dataExtractors[category] || defaultExtractor;

    const extracted = extractor.extract(ancestor.output);
    allExtractedContents.push(...extracted);
    sourceTypesPresent.add(extractor.sourceType);

}

if (allExtractedContents.length === 0) {
return { processInputError: "Nenhum dado válido encontrado para análise.", ... };
}

// 3. Monta o Prompt com Partials (lógica a ser implementada no promptEngine)
const finalPrompt = await generateFinalPrompt(config.promptTemplate, {
sourceTypes: Array.from(sourceTypesPresent).join(', '),
aggregatedData: allExtractedContents.map(item => item.preview).join('\n---\n'), // Usa os previews para o prompt
// O 'content' completo pode ser usado se o prompt precisar, mas preview é mais eficiente
});

// 4. Chama a IA com Function Calling
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const saveResultsFunction = {
name: "save_analysis_results",
parameters: config.output.schema,
};
const model = genAI.getGenerativeModel({ tools: [{ functionDeclarations: [saveResultsFunction] }] });

const result = await model.generateContent(finalPrompt);
const functionCall = result.response.functionCalls()?.[0];

if (functionCall?.name === 'save_analysis_results') {
const analysisResult = functionCall.args;
// ... (resto da lógica de salvar e retornar o resultado)
} else {
throw new Error("A IA falhou em retornar uma chamada de função válida.");
}
}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END
Passo 5: Simplificar os Handlers Analíticos

Arquivo: lib/nodeHandlers/insightsNodeHandler.ts (e os outros)

Ação: A lógica em processInput se torna mínima.

Generated typescript
// Em lib/nodeHandlers/insightsNodeHandler.ts (Exemplo)

async processInput(currentNodeData, parentOutputs, fetchInstance) {
try {
const requestBody = {
analysisPrefix: "insightsAnalysis", // Apenas o prefixo
nodeData: currentNodeData,
};
return await (fetchInstance || globalThis.$fetch)('/api/ai/runAnalysis', {
method: 'POST',
body: requestBody,
});
} catch (error: any) {
// ... tratamento de erro ...
}
},
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
TypeScript
IGNORE_WHEN_COPYING_END

Este plano unificado é, sem dúvida, a melhor direção a seguir. Ele não só resolve os problemas atuais, mas cria uma fundação sólida e profissional para o futuro do DoubleFlow.
