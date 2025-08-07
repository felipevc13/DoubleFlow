// composables/useSlug.ts
interface UseSlugReturn {
  generateSlug: (text: string) => string;
}

export const useSlug = (): UseSlugReturn => {
  const generateSlug = (text: string): string => {
    if (typeof text !== "string") {
      console.warn("[useSlug] generateSlug expects a string argument.");
      return ""; // Return empty string or throw error for non-string input
    }
    // Converter para minúsculas e remover acentos
    const normalized: string = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    // Substituir espaços por hífens e remover caracteres especiais
    return normalized
      .replace(/[^a-z0-9\s-]/g, "") // Remove caracteres que não são letras, números, espaços ou hífens
      .trim() // Remove espaços no início e fim
      .replace(/\s+/g, "-"); // Substitui múltiplos espaços por um único hífen
  };

  return { generateSlug };
};
