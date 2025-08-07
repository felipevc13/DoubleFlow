export interface ExtractedContent {
  sourceType: string; // ex: 'survey_response', 'interview_transcript'
  content: string; // Texto limpo para a IA (detalhado)
  preview: string; // Resumo/trecho curto para aparecer no prompt master
}

export interface Extractor {
  // Categoria de dado que esse plugin processa (ex: 'pesquisa_usuario', 'transcricao_entrevista')
  category: string;
  // Tipo a ser informado à IA (ex: 'survey_response')
  sourceType: string;
  // Função que extrai o conteúdo relevante desse ancestor.output
  extract: (ancestorOutput: any) => ExtractedContent[];
}
