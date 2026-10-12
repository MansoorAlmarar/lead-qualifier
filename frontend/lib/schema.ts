import { z } from "zod";

// Mirrors tools/schema.ts. Keep the two in sync.
export const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  company: z.string().trim().max(100).optional(),
  role: z.string().trim().max(100).optional(),
  budget: z.string().trim().max(100).optional(),
  need: z.string().trim().min(1, "Describe the need").max(1000),
  timeline: z.string().trim().max(100).optional(),
  source: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type Lead = z.infer<typeof leadSchema>;

export type QualificationResult = {
  qualified: boolean;
  score: number;
  reasoning: string;
  next_step: string;
  red_flags: string[];
};

export type RunState =
  | { status: "pending" }
  | { status: "done"; result: QualificationResult }
  | { status: "failed" };
