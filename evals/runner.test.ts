import { describe, expect, it } from "vitest";
import { loadDataset } from "./dataset";
import { mockCompletion } from "./model";
import { resolveModels, runModel } from "./runner";
import { scoreModel } from "./score";

const valid = JSON.stringify({ qualified: true, score: 80, reasoning: "ok", next_step: "call", red_flags: [] });

describe("resolveModels", () => {
  it("prefers EVAL_MODELS and trims the list", () => {
    expect(resolveModels({ EVAL_MODELS: " a/one , b/two ,," })).toEqual(["a/one", "b/two"]);
  });

  it("falls back to evals/models.json", () => {
    expect(resolveModels({})).toContain("openai/gpt-4o-mini");
  });

  it("throws when nothing is configured", () => {
    expect(() => resolveModels({}, "/nonexistent/models.json")).toThrow(/No models configured/);
  });
});

describe("runModel", () => {
  const leads = loadDataset();

  it("records one case per lead", async () => {
    const cases = await runModel("mock:keyword", leads, mockCompletion("mock:keyword"));
    expect(cases).toHaveLength(leads.length);
    expect(cases.every((c) => c.prediction.ok)).toBe(true);
  });

  it("passes the model, the lead id and the parsed lead to the completion", async () => {
    const seen: { model: string; leadId: string; name: string }[] = [];
    await runModel("test/model", leads.slice(0, 1), async ({ model, leadId, lead }) => {
      seen.push({ model, leadId, name: lead.name });
      return valid;
    });
    expect(seen).toEqual([{ model: "test/model", leadId: leads[0].id, name: leads[0].lead.name }]);
  });

  it("records a thrown error as an invalid reply and keeps going", async () => {
    const completion = async ({ leadId }: { leadId: string }) => {
      if (leadId === leads[0].id) throw new Error("OpenRouter error 503");
      return valid;
    };
    const cases = await runModel("m", leads.slice(0, 3), completion);
    expect(cases[0].prediction).toMatchObject({ ok: false, reason: "OpenRouter error 503" });
    expect(cases[1].prediction.ok).toBe(true);
    expect(cases[2].prediction.ok).toBe(true);
  });

  it("calls onLead once per lead", async () => {
    let calls = 0;
    await runModel("m", leads.slice(0, 5), async () => valid, () => (calls += 1));
    expect(calls).toBe(5);
  });

  it("keeps the keyword baseline well above chance, so the mock stays a meaningful check", async () => {
    const score = scoreModel("mock:keyword", await runModel("mock:keyword", leads, mockCompletion("mock:keyword")));
    expect(score.qualifiedAccuracy).toBeGreaterThan(0.8);
  });
});
