import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORY_COUNTS, DATASET_PATH, loadDataset, validateDataset, type Category } from "./dataset";

const leadsFile: unknown = JSON.parse(readFileSync(DATASET_PATH, "utf8"));

type Raw = Record<string, unknown>[];
const fresh = (): Raw => structuredClone(leadsFile) as Raw;
const at = (raw: Raw, index: number) => raw[index] as Record<string, any>;

describe("eval dataset", () => {
  const leads = loadDataset();

  it("loads and passes validation", () => {
    expect(validateDataset(leadsFile)).toEqual([]);
  });

  it("has 40 leads with the agreed category mix", () => {
    expect(leads).toHaveLength(40);
    const counts: Record<Category, number> = { strong: 0, medium: 0, weak: 0, spam: 0 };
    for (const lead of leads) counts[lead.category] += 1;
    expect(counts).toEqual(CATEGORY_COUNTS);
  });

  it("is roughly balanced between qualified and not qualified", () => {
    const qualified = leads.filter((lead) => lead.expected.qualified).length;
    const share = qualified / leads.length;
    expect(qualified).toBeGreaterThan(0);
    expect(share).toBeGreaterThanOrEqual(0.35);
    expect(share).toBeLessThanOrEqual(0.6);
  });

  it("uses only fictional contact details", () => {
    const text = JSON.stringify(leadsFile);
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // no email addresses
    // Any link must point at a reserved .invalid domain.
    for (const url of text.match(/https?:\/\/[^\s"]+/g) ?? []) {
      expect(url).toMatch(/\.invalid(\/|$)/);
    }
  });
});

describe("validateDataset", () => {
  it("rejects something that is not an array", () => {
    expect(validateDataset({})).not.toEqual([]);
  });

  it("rejects a wrong lead count", () => {
    const raw = fresh().slice(1);
    expect(validateDataset(raw).join("\n")).toMatch(/expected 40 leads, found 39/);
  });

  it("rejects duplicate ids", () => {
    const raw = fresh();
    at(raw, 1).id = at(raw, 0).id;
    expect(validateDataset(raw).join("\n")).toMatch(/duplicate id/);
  });

  it("rejects a lead that fails the app's lead schema", () => {
    const raw = fresh();
    at(raw, 0).lead.need = "";
    expect(validateDataset(raw).join("\n")).toMatch(/need/);
  });

  it("rejects a qualified lead whose band starts below the threshold", () => {
    const raw = fresh();
    const strong = at(raw, 0);
    strong.expected = { qualified: true, score_min: 40, score_max: 70 };
    expect(validateDataset(raw).join("\n")).toMatch(/band starts below 60/);
  });

  it("rejects a not-qualified lead whose band reaches the threshold", () => {
    const raw = fresh();
    const weak = at(raw, 30); // first weak lead
    weak.expected = { qualified: false, score_min: 40, score_max: 65 };
    expect(validateDataset(raw).join("\n")).toMatch(/band reaches 60/);
  });

  it("rejects a strong lead that is not qualified", () => {
    const raw = fresh();
    at(raw, 0).expected = { qualified: false, score_min: 10, score_max: 20 };
    expect(validateDataset(raw).join("\n")).toMatch(/strong leads must be qualified/);
  });

  it("rejects a spam lead that is qualified", () => {
    const raw = fresh();
    const spam = at(raw, 32);
    spam.expected = { qualified: true, score_min: 60, score_max: 70 };
    expect(validateDataset(raw).join("\n")).toMatch(/spam leads must not be qualified/);
  });

  it("rejects a band where min is above max", () => {
    const raw = fresh();
    at(raw, 0).expected = { qualified: true, score_min: 90, score_max: 80 };
    expect(validateDataset(raw).join("\n")).toMatch(/score_min must be <= score_max/);
  });
});
