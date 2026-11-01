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

// The prompt says "qualified only when score is 60 or higher". Enforce it here too.
export const QUALIFY_THRESHOLD = 60;

export const resultSchema = z
  .object({
    qualified: z.boolean(),
    score: z.number().min(0).max(100),
    reasoning: z.string(),
    next_step: z.string(),
    red_flags: z.array(z.string()),
  })
  // A reply with qualified true and a low score is fixed to qualified false, not rejected.
  // Fixing keeps the run useful. The score is the model's real signal, so it wins.
  .transform((r) => (r.qualified && r.score < QUALIFY_THRESHOLD ? { ...r, qualified: false } : r));

export type Lead = z.infer<typeof leadSchema>;
export type QualificationResult = z.infer<typeof resultSchema>;
