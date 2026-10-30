import { afterEach, describe, expect, it, vi } from "vitest";
import { qualify } from "../tools/qualify-lead";
import { leadSchema } from "../tools/schema";
import { parseModelOutput } from "./model";

// Runs the real Trigger.dev task with OpenRouter stubbed, so the test covers the task's own parsing.
const lead = leadSchema.parse({ name: "Sara Khan", need: "Automate invoice processing." });
const verdict = { qualified: true, score: 80, reasoning: "Clear need.", next_step: "Book a call.", red_flags: [] };

const replies: Record<string, string> = {
  plain: JSON.stringify(verdict),
  fenced: "```json\n" + JSON.stringify(verdict) + "\n```",
  notJson: "Sorry, I cannot help.",
  scoreAbove100: JSON.stringify({ ...verdict, score: 150 }),
  missingField: JSON.stringify({ qualified: true, score: 80 }),
};

async function runTask(content: string): Promise<{ ok: true; result: unknown } | { ok: false }> {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }))));
  return qualify(lead, "test-key").then(
    (result) => ({ ok: true as const, result }),
    () => ({ ok: false as const }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("eval parser and the Trigger.dev task", () => {
  for (const [name, reply] of Object.entries(replies)) {
    it(`agree on a ${name} reply`, async () => {
      const eval_ = parseModelOutput(reply);
      const task = await runTask(reply);
      expect(task.ok).toBe(eval_.ok);
      if (eval_.ok && task.ok) expect(task.result).toEqual(eval_.result);
    });
  }
});
