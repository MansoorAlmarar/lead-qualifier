import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  company: z.string().trim().max(100).optional(),
  role: z.string().trim().max(100).optional(),
  budget: z.string().trim().max(100).optional(),
  need: z.string().trim().min(1).max(1000),
  timeline: z.string().trim().max(100).optional(),
  source: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const resultSchema = z.object({
  qualified: z.boolean(),
  score: z.number().min(0).max(100),
  reasoning: z.string(),
  next_step: z.string(),
  red_flags: z.array(z.string()),
});

export type Lead = z.infer<typeof leadSchema>;
export type QualificationResult = z.infer<typeof resultSchema>;
