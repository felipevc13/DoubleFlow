import type { Extractor, ExtractedContent } from "./types";

const transcriptExtractor: Extractor = {
  category: "transcricao_entrevista",
  sourceType: "interview_transcript",
  extract: (ancestorOutput): ExtractedContent[] => {
    const texts: ExtractedContent[] = [];
    const files = ancestorOutput?.uploaded_files || [];

    files.forEach((file: any) => {
      if (
        file.category === "transcricao_entrevista" &&
        file.content &&
        typeof file.content === "string"
      ) {
        texts.push({
          sourceType: "interview_transcript",
          content: `Transcrição de Entrevista: ${file.name}\n\n${file.content}`,
          preview: `Transcrição: ${file.name.substring(0, 80)}...`,
        });
      }
    });
    return texts;
  },
};

export default transcriptExtractor;
