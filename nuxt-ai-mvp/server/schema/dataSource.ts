import { z } from "zod";

export const DataSourceSchema = z.object({
  title: z.string().min(1).max(200).default("Dados do projeto").optional(),
  description: z.string().max(5000).default("").optional(),
  // IDs das fontes selecionadas (ex.: arquivos importados, links, etc.)
  sources: z.array(z.string()).default([]).optional(),
  // ISO string opcional; será preenchida no backend quando salvar
  updated_at: z.string().optional(),
});

export type DataSourceData = z.infer<typeof DataSourceSchema>;
