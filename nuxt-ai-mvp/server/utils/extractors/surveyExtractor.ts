// server/utils/extractors/surveyExtractor.ts (VERSÃO FINAL E CORRETA)
import type { Extractor, ExtractedContent } from "./types";

const surveyExtractor: Extractor = {
  // Este extrator é específico para a categoria 'pesquisa_usuario'.
  category: "pesquisa_usuario",
  sourceType: "survey_response",
  extract: (ancestorOutput): ExtractedContent[] => {
    const texts: ExtractedContent[] = [];

    // --- CENÁRIO 1: O pai é um DataSourceCard com ARQUIVOS EXCEL. ---
    // A lógica agora só se importa com colunas inferidas de planilhas.
    if (
      ancestorOutput?.uploaded_files &&
      Array.isArray(ancestorOutput.uploaded_files)
    ) {
      const files = ancestorOutput.uploaded_files;

      files.forEach((file: any) => {
        if (
          file.inferred_survey_columns &&
          file.inferred_survey_columns.length > 0
        ) {
          file.inferred_survey_columns.forEach((col: any) => {
            if (col.questionType === "openText" && col.openTextResponses) {
              const content = `Pergunta da Planilha: "${
                col.questionText
              }"\nRespostas:\n- ${col.openTextResponses.join("\n- ")}`;
              texts.push({
                sourceType: "survey_response",
                content,
                preview: `Respostas de planilha para "${col.questionText}"`,
              });
            }
          });
        }
        // Arquivos de texto ou outros formatos nesta categoria são ignorados por este extrator.
      });
    }

    // --- CENÁRIO 2: O pai é um SurveyCard com resultados nativos JSON. ---
    else if (
      ancestorOutput?.survey_results &&
      Array.isArray(ancestorOutput.survey_results.submissions)
    ) {
      const submissions = ancestorOutput.survey_results.submissions;
      const structure = ancestorOutput.survey_structure || [];

      // Mapeia IDs para textos de pergunta de texto aberto para fácil acesso
      const openTextQuestionMap = structure
        .filter(
          (q: any) => q.type === "openText" || q.questionType === "openText"
        )
        .reduce((acc: any, q: any) => {
          acc[q.id] = q.questionText;
          return acc;
        }, {});

      // Itera sobre as submissões para extrair as respostas relevantes
      submissions.forEach((submission: any) => {
        if (submission.answers) {
          for (const questionId in submission.answers) {
            if (openTextQuestionMap[questionId]) {
              // Se a pergunta for de texto aberto
              const answer = submission.answers[questionId];
              const questionText = openTextQuestionMap[questionId];

              if (typeof answer === "string" && answer.trim()) {
                const content = `Pergunta do Survey: "${questionText}"\nResposta: ${answer}`;
                texts.push({
                  sourceType: "survey_response",
                  content: content,
                  preview: `Resposta para "${questionText}"`,
                });
              }
            }
          }
        }
      });
    }

    return texts;
  },
};

export default surveyExtractor;
