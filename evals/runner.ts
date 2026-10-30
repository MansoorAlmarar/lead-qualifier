import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { leadSchema } from "../tools/schema";
import type { EvalLead } from "./dataset";
import { parseModelOutput, type Completion } from "./model";
import type { Case, Prediction } from "./score";

export const MODELS_CONFIG_PATH = path.join(__dirname, "models.json");

/** EVAL_MODELS (comma-separated) wins over evals/models.json. */
export function resolveModels(env: NodeJS.ProcessEnv, configFile = MODELS_CONFIG_PATH): string[] {
  const fromEnv = (env.EVAL_MODELS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  if (!existsSync(configFile)) {
    throw new Error("No models configured. Set EVAL_MODELS or add evals/models.json.");
  }
  const config = JSON.parse(readFileSync(configFile, "utf8")) as { models?: unknown };
  if (
    !Array.isArray(config.models) ||
    config.models.length === 0 ||
    !config.models.every((id) => typeof id === "string" && id.length > 0)
  ) {
    throw new Error(`${configFile} must contain a non-empty "models" array of strings.`);
  }
  return config.models as string[];
}

/** Sends each lead one at a time, so latencies are comparable and rate limits are not hit. */
export async function runModel(
  model: string,
  leads: EvalLead[],
  completion: Completion,
  onLead?: () => void,
): Promise<Case[]> {
  const cases: Case[] = [];
  for (const item of leads) {
    // Same parse as the task, so the prompt gets the same lead the app would send.
    const lead = leadSchema.parse(item.lead);
    const started = performance.now();

    let prediction: Prediction;
    try {
      const raw = await completion({ model, lead, leadId: item.id });
      const latencyMs = performance.now() - started;
      const outcome = parseModelOutput(raw);
      prediction = outcome.ok
        ? { ok: true, qualified: outcome.result.qualified, score: outcome.result.score, latencyMs }
        : { ok: false, failure: "schema", reason: outcome.reason, latencyMs };
    } catch (error) {
      prediction = {
        ok: false,
        failure: "network",
        reason: error instanceof Error ? error.message : "unknown error",
        latencyMs: performance.now() - started,
      };
    }

    cases.push({ category: item.category, expected: item.expected, prediction });
    onLead?.();
  }
  return cases;
}
