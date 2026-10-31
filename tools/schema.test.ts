import { describe, expect, it } from "vitest";
import { resultSchema } from "./schema";

const base = { reasoning: "Because.", next_step: "Call.", red_flags: [] };

describe("resultSchema qualify threshold", () => {
  it("turns qualified true with a score below 60 into qualified false", () => {
    expect(resultSchema.parse({ ...base, qualified: true, score: 30 })).toEqual({ ...base, qualified: false, score: 30 });
    expect(resultSchema.parse({ ...base, qualified: true, score: 59 }).qualified).toBe(false);
  });

  it("keeps qualified true at 60 and above", () => {
    expect(resultSchema.parse({ ...base, qualified: true, score: 60 }).qualified).toBe(true);
    expect(resultSchema.parse({ ...base, qualified: true, score: 95 }).qualified).toBe(true);
  });

  it("leaves qualified false alone, even with a high score", () => {
    expect(resultSchema.parse({ ...base, qualified: false, score: 90 }).qualified).toBe(false);
  });

  it("still rejects an out-of-range score", () => {
    expect(resultSchema.safeParse({ ...base, qualified: true, score: 150 }).success).toBe(false);
  });
});
