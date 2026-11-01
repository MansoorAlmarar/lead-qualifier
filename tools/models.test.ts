import { describe, expect, it } from "vitest";
import config from "../evals/models.json";
import { FREE_MODELS, PAID_MODELS } from "./models";

describe("model lists", () => {
  it("evals/models.json lists the same models the task uses", () => {
    expect(config.models).toEqual([...PAID_MODELS, ...FREE_MODELS]);
  });

  it("respects OpenRouter's limit of 3 models per request", () => {
    expect(FREE_MODELS.length).toBeLessThanOrEqual(3);
    expect(PAID_MODELS.length).toBeLessThanOrEqual(3);
  });
});
