// __mocks__/uuid.ts
import { vi } from "vitest";

const v1 = vi.fn(() => "mocked-uuid-v1-manual");
const v4 = vi.fn(() => "mocked-uuid-v4-manual");

// Esta é a parte crucial: exportamos um objeto 'default'
// que contém as funções v1 e v4. É isso que o código legado do LangChain espera.
const mockUuid = {
  v1,
  v4,
};

export default mockUuid;

// Também exportamos as funções nomeadas para qualquer código moderno que as utilize.
export { v1, v4 };
