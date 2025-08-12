import { z } from "zod";

export const NoteSchema = z.object({
  text: z.string().max(5000).default(""),
  updated_at: z.string().optional(), // ISO
});
export type NoteData = z.infer<typeof NoteSchema>;
