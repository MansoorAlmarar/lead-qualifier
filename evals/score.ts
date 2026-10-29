import type { Category, Expected } from "./dataset";

export type Prediction =
  | { ok: true; qualified: boolean; score: number; latencyMs: number }
  | { ok: false; reason: string; latencyMs: number };

export type Case = { category: Category; expected: Expected; prediction: Prediction };

export type ModelScore = {
  model: string;
  total: number;
  valid: number;
  qualifiedAccuracy: number;
  bandHitRate: number;
  /** Mean absolute error against the middle of the expected band, over valid replies only. */
  maeScore: number | null;
  schemaValidRate: number;
  medianLatencyMs: number | null;
  byCategory: Record<Category, { correct: number; total: number }>;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Invalid replies count as misses for accuracy and band hits. MAE skips them. */
export function scoreModel(model: string, cases: Case[]): ModelScore {
  const byCategory: ModelScore["byCategory"] = {
    strong: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    weak: { correct: 0, total: 0 },
    spam: { correct: 0, total: 0 },
  };

  let correct = 0;
  let bandHits = 0;
  let valid = 0;
  let absoluteError = 0;

  for (const { category, expected, prediction } of cases) {
    byCategory[category].total += 1;
    if (!prediction.ok) continue;

    valid += 1;
    if (prediction.qualified === expected.qualified) {
      correct += 1;
      byCategory[category].correct += 1;
    }
    if (prediction.score >= expected.score_min && prediction.score <= expected.score_max) {
      bandHits += 1;
    }
    absoluteError += Math.abs(prediction.score - (expected.score_min + expected.score_max) / 2);
  }

  const total = cases.length;
  return {
    model,
    total,
    valid,
    qualifiedAccuracy: total === 0 ? 0 : correct / total,
    bandHitRate: total === 0 ? 0 : bandHits / total,
    maeScore: valid === 0 ? null : absoluteError / valid,
    schemaValidRate: total === 0 ? 0 : valid / total,
    medianLatencyMs: median(cases.map((c) => c.prediction.latencyMs)),
    byCategory,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const ms = (x: number | null) => (x === null ? "n/a" : `${Math.round(x)} ms`);

export function renderMarkdown(report: {
  mode: "mock" | "live";
  generatedAt: string;
  datasetSize: number;
  scores: ModelScore[];
}): string {
  const { mode, generatedAt, datasetSize, scores } = report;
  const lines: string[] = [
    "# Lead qualifier eval results",
    "",
    mode === "mock"
      ? "**Mode: mock.** These models are offline stand-ins, not LLMs. The numbers test the scorer and the parser. They are not AI model scores."
      : "**Mode: live.** Replies came from OpenRouter using the app's prompt and schema.",
    "",
    `- Generated: ${generatedAt}`,
    `- Leads: ${datasetSize} fictional leads (\`evals/dataset/leads.json\`)`,
    "",
    "| Model | Qualified accuracy | Score-band hit rate | MAE (points) | Schema-valid rate | Median latency |",
    "|---|---|---|---|---|---|",
    ...scores.map(
      (s) =>
        `| ${s.model} | ${pct(s.qualifiedAccuracy)} | ${pct(s.bandHitRate)} | ${s.maeScore === null ? "n/a" : s.maeScore.toFixed(1)} | ${pct(s.schemaValidRate)} | ${ms(s.medianLatencyMs)} |`,
    ),
    "",
    "### Qualified accuracy by category",
    "",
    "| Model | Strong | Medium | Weak | Spam |",
    "|---|---|---|---|---|",
    ...scores.map((s) => {
      const cell = (c: Category) => `${s.byCategory[c].correct}/${s.byCategory[c].total}`;
      return `| ${s.model} | ${cell("strong")} | ${cell("medium")} | ${cell("weak")} | ${cell("spam")} |`;
    }),
    "",
    "Notes:",
    "",
    "- Accuracy and band hit rate count an invalid reply as a miss.",
    "- MAE uses valid replies only. It compares the score with the middle of the expected band.",
    "- Median latency covers every call. Mock latencies only reflect in-memory work, so they are not comparable to live numbers.",
    "- Each model is called on its own. The app's paid-then-free fallback chain is not exercised.",
    "",
  ];
  return lines.join("\n");
}
