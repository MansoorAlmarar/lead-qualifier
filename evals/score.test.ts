import { describe, expect, it } from "vitest";
import { median, renderMarkdown, scoreModel, type Case } from "./score";

const good = (qualified: boolean, score: number, latencyMs = 100) => ({ ok: true as const, qualified, score, latencyMs });
const bad = (latencyMs = 100) => ({ ok: false as const, failure: "schema" as const, reason: "not JSON", latencyMs });
const down = (latencyMs = 100) => ({ ok: false as const, failure: "network" as const, reason: "OpenRouter error 503", latencyMs });

const strong: Case = { category: "strong", expected: { qualified: true, score_min: 80, score_max: 90 }, prediction: good(true, 85) };

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("scoreModel", () => {
  it("scores a perfect model at 100% with zero error", () => {
    const score = scoreModel("perfect", [strong, { ...strong, category: "spam", expected: { qualified: false, score_min: 2, score_max: 2 }, prediction: good(false, 2) }]);
    expect(score.qualifiedAccuracy).toBe(1);
    expect(score.bandHitRate).toBe(1);
    expect(score.maeScore).toBe(0);
    expect(score.schemaValidRate).toBe(1);
  });

  it("counts an invalid reply as a miss for accuracy and band hits", () => {
    const score = scoreModel("m", [strong, { ...strong, prediction: bad() }]);
    expect(score.qualifiedAccuracy).toBe(0.5);
    expect(score.bandHitRate).toBe(0.5);
    expect(score.schemaValidRate).toBe(0.5);
  });

  it("counts network errors and schema failures separately", () => {
    const score = scoreModel("m", [strong, { ...strong, prediction: bad() }, { ...strong, prediction: down() }, { ...strong, prediction: down() }]);
    expect(score.networkErrors).toBe(2);
    expect(score.schemaFailures).toBe(1);
    expect(score.valid).toBe(1);
    expect(score.schemaValidRate).toBe(0.25);
  });

  it("leaves invalid replies out of the MAE", () => {
    // Band midpoint is 85. The valid reply scores 80, so its error is 5. The invalid reply adds nothing.
    const score = scoreModel("m", [{ ...strong, prediction: good(true, 80) }, { ...strong, prediction: bad() }]);
    expect(score.maeScore).toBe(5);
  });

  it("measures score error against the middle of the expected band", () => {
    const medium: Case = { category: "medium", expected: { qualified: true, score_min: 60, score_max: 70 }, prediction: good(true, 75) };
    const score = scoreModel("m", [medium]);
    expect(score.maeScore).toBe(10); // midpoint 65, prediction 75
    expect(score.bandHitRate).toBe(0);
    expect(score.qualifiedAccuracy).toBe(1);
  });

  it("counts a band hit at both edges of the band", () => {
    const edges: Case[] = [
      { ...strong, prediction: good(true, 80) },
      { ...strong, prediction: good(true, 90) },
      { ...strong, prediction: good(true, 91) },
    ];
    expect(scoreModel("m", edges).bandHitRate).toBeCloseTo(2 / 3);
  });

  it("uses every call for median latency, including invalid replies", () => {
    const cases: Case[] = [
      { ...strong, prediction: good(true, 85, 10) },
      { ...strong, prediction: bad(300) },
      { ...strong, prediction: good(true, 85, 20) },
    ];
    expect(scoreModel("m", cases).medianLatencyMs).toBe(20);
  });

  it("breaks accuracy down by category", () => {
    const score = scoreModel("m", [strong, { ...strong, prediction: good(false, 40) }]);
    expect(score.byCategory.strong).toEqual({ correct: 1, total: 2 });
    expect(score.byCategory.spam).toEqual({ correct: 0, total: 0 });
  });

  it("returns zeros and nulls for an empty run", () => {
    const score = scoreModel("m", []);
    expect(score.total).toBe(0);
    expect(score.qualifiedAccuracy).toBe(0);
    expect(score.maeScore).toBeNull();
    expect(score.medianLatencyMs).toBeNull();
  });
});

describe("renderMarkdown", () => {
  const scores = [scoreModel("mock:keyword", [strong]), scoreModel("mock:flaky", [{ ...strong, prediction: bad() }])];
  const markdown = renderMarkdown({ mode: "mock", generatedAt: "2026-01-01T00:00:00.000Z", datasetSize: 40, scores });

  it("writes one row per model in the summary table", () => {
    expect(markdown).toContain("| Model | Qualified accuracy | Score-band hit rate | MAE (points) | Schema-valid rate | HTTP/network errors | Schema failures | Median latency |");
    expect(markdown).toContain("| mock:keyword | 100.0% | 100.0% | 0.0 | 100.0% | 0 | 0 | 100 ms |");
    expect(markdown).toContain("| mock:flaky | 0.0% | 0.0% | n/a | 0.0% | 0 | 1 | 100 ms |");
  });

  it("labels mock results so they cannot be read as model scores", () => {
    expect(markdown).toContain("**Mode: mock.**");
    expect(markdown).toContain("not AI model scores");
  });
});
