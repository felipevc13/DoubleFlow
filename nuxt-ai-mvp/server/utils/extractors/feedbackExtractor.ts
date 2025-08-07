import type { Extractor, ExtractedContent } from "./types";

const feedbackExtractor: Extractor = {
  category: "customer_feedback", // ou ajuste conforme a categoria usada no seu sistema
  sourceType: "customer_feedback",
  extract: (ancestorOutput): ExtractedContent[] => {
    const texts: ExtractedContent[] = [];
    // Supondo que ancestorOutput.feedbacks seja um array de objetos com campos texto
    const feedbacks = ancestorOutput?.feedbacks || [];
    feedbacks.forEach((item: any, idx: number) => {
      if (item && item.text) {
        texts.push({
          sourceType: "customer_feedback",
          content: `Feedback #${idx + 1}: ${item.text}`,
          preview: item.text.substring(0, 100), // Primeiros 100 caracteres como preview
        });
      }
    });
    return texts;
  },
};

export default feedbackExtractor;
