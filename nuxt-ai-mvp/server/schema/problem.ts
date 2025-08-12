import { z } from "zod";

export const ProblemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  updated_at: z.string().optional(), // ISO
});
export type ProblemData = z.infer<typeof ProblemSchema>;
