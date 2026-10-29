import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { leadSchema, type Lead } from "../tools/schema";

// The prompt in tools/prompt.ts says: qualified is true only when score is 60 or higher.
export const QUALIFY_THRESHOLD = 60;

export const DATASET_PATH = path.join(__dirname, "dataset", "leads.json");

export const CATEGORY_COUNTS = { strong: 12, medium: 10, weak: 10, spam: 8 } as const;
export type Category = keyof typeof CATEGORY_COUNTS;

export type Expected = { qualified: boolean; score_min: number; score_max: number };
export type EvalLead = { id: string; category: Category; lead: Lead; expected: Expected };

const score = z.number().int().min(0).max(100);

const entrySchema = z.object({
  id: z.string().min(1),
  category: z.enum(["strong", "medium", "weak", "spam"]),
  lead: leadSchema,
  expected: z
    .object({ qualified: z.boolean(), score_min: score, score_max: score })
    .refine((e) => e.score_min <= e.score_max, "score_min must be <= score_max"),
});

const datasetSchema = z.array(entrySchema);

/** Returns a list of problems. An empty list means the dataset is valid. */
export function validateDataset(raw: unknown): string[] {
  const parsed = datasetSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  }

  const errors: string[] = [];
  const total = Object.values(CATEGORY_COUNTS).reduce((sum, n) => sum + n, 0);
  if (parsed.data.length !== total) {
    errors.push(`expected ${total} leads, found ${parsed.data.length}`);
  }

  const ids = new Set<string>();
  const counts: Record<Category, number> = { strong: 0, medium: 0, weak: 0, spam: 0 };
  let qualified = 0;

  for (const item of parsed.data) {
    if (ids.has(item.id)) errors.push(`${item.id}: duplicate id`);
    ids.add(item.id);
    counts[item.category] += 1;
    if (item.expected.qualified) qualified += 1;

    const { qualified: isQualified, score_min, score_max } = item.expected;
    if (isQualified && score_min < QUALIFY_THRESHOLD) {
      errors.push(`${item.id}: qualified is true but the band starts below ${QUALIFY_THRESHOLD}`);
    }
    if (!isQualified && score_max >= QUALIFY_THRESHOLD) {
      errors.push(`${item.id}: qualified is false but the band reaches ${QUALIFY_THRESHOLD} or more`);
    }
    if (item.category === "strong" && !isQualified) {
      errors.push(`${item.id}: strong leads must be qualified`);
    }
    if ((item.category === "weak" || item.category === "spam") && isQualified) {
      errors.push(`${item.id}: ${item.category} leads must not be qualified`);
    }
  }

  for (const category of Object.keys(CATEGORY_COUNTS) as Category[]) {
    if (counts[category] !== CATEGORY_COUNTS[category]) {
      errors.push(`${category}: expected ${CATEGORY_COUNTS[category]} leads, found ${counts[category]}`);
    }
  }

  const share = qualified / parsed.data.length;
  if (share < 0.35 || share > 0.6) {
    errors.push(`qualified share is ${(share * 100).toFixed(1)}%, expected between 35% and 60%`);
  }

  return errors;
}

export function loadDataset(file = DATASET_PATH): EvalLead[] {
  const raw: unknown = JSON.parse(readFileSync(file, "utf8"));
  const errors = validateDataset(raw);
  if (errors.length > 0) {
    throw new Error(`Invalid eval dataset (${file}):\n${errors.join("\n")}`);
  }
  return raw as EvalLead[];
}
