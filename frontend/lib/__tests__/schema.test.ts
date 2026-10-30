import { describe, expect, it } from "vitest";
import { leadSchema, resultSchema } from "../schema";

const valid = { name: "Sara Khan", need: "Automate invoice processing." };

describe("leadSchema", () => {
  it("accepts a lead with only the required fields", () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing or blank name", () => {
    expect(leadSchema.safeParse({ need: valid.need }).success).toBe(false);
    const blank = leadSchema.safeParse({ ...valid, name: "   " });
    expect(blank.success).toBe(false);
    if (!blank.success) expect(blank.error.issues[0].message).toBe("Name is required");
  });

  it("rejects a missing or blank need", () => {
    expect(leadSchema.safeParse({ name: valid.name }).success).toBe(false);
    const blank = leadSchema.safeParse({ ...valid, need: "" });
    expect(blank.success).toBe(false);
    if (!blank.success) expect(blank.error.issues[0].message).toBe("Describe the need");
  });

  it("trims whitespace", () => {
    const parsed = leadSchema.parse({ ...valid, name: "  Sara  " });
    expect(parsed.name).toBe("Sara");
  });

  it("caps short fields at 100 characters", () => {
    expect(leadSchema.safeParse({ ...valid, name: "a".repeat(100) }).success).toBe(true);
    expect(leadSchema.safeParse({ ...valid, name: "a".repeat(101) }).success).toBe(false);
    expect(leadSchema.safeParse({ ...valid, company: "a".repeat(101) }).success).toBe(false);
  });

  it("caps need and notes at 1000 characters", () => {
    expect(leadSchema.safeParse({ ...valid, need: "a".repeat(1000) }).success).toBe(true);
    expect(leadSchema.safeParse({ ...valid, need: "a".repeat(1001) }).success).toBe(false);
    expect(leadSchema.safeParse({ ...valid, notes: "a".repeat(1001) }).success).toBe(false);
  });

  it("rejects non-string values and non-objects", () => {
    expect(leadSchema.safeParse({ ...valid, budget: 5000 }).success).toBe(false);
    expect(leadSchema.safeParse(null).success).toBe(false);
  });
});

describe("resultSchema", () => {
  const valid = { qualified: true, score: 80, reasoning: "Clear need.", next_step: "Book a call.", red_flags: [] };

  it("accepts a valid result", () => {
    expect(resultSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a score outside 0 to 100", () => {
    expect(resultSchema.safeParse({ ...valid, score: 150 }).success).toBe(false);
    expect(resultSchema.safeParse({ ...valid, score: -1 }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    const missing: Partial<typeof valid> = { ...valid };
    delete missing.red_flags;
    expect(resultSchema.safeParse(missing).success).toBe(false);
  });
});
