import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SYSTEM_PROMPT, buildUserPrompt } from "../tools/prompt";
import { resultSchema, type Lead, type QualificationResult } from "../tools/schema";
import { stripCodeFence } from "../tools/parse-reply";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const REQUEST_TIMEOUT_MS = 60_000;

export type CompletionRequest = { model: string; lead: Lead; leadId: string };
/** Returns the raw model text, the same string the task receives from OpenRouter. */
export type Completion = (request: CompletionRequest) => Promise<string>;

/** Calls OpenRouter with the same messages and options as tools/qualify-lead.ts. */
export function openRouterCompletion(apiKey: string): Completion {
  return async ({ model, lead }) => {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: [model],
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(lead) },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    // Log the status only. The body and the lead are personal data.
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content");
    return content;
  };
}

export const CLI_PREFIX = "claude-cli:";
export const CLI_TIMEOUT_MS = 180_000;

/** The CLI arguments. Tools are off, so the model can only answer; the prompt goes on stdin, not in the arguments. */
export function claudeCliArgs(model: string, system: string): string[] {
  return [
    "-p", "--model", model, "--effort", "low", "--output-format", "json", "--system-prompt", system,
    "--tools", "", "--disable-slash-commands", "--no-session-persistence",
  ];
}

/**
 * Runs the local `claude` CLI on a Claude subscription (no API key, no per-call dollars, but it uses plan usage).
 * Model ids look like "claude-cli:haiku". Set CLAUDE_EXE to the full path if `claude` is not on PATH.
 * It runs from an empty temp folder so no project instructions are loaded. Same prompt as the app; the CLI has no
 * temperature or JSON-mode switch, so this is a comparison row, not the production call.
 */
export function claudeCliCompletion(exe = process.env.CLAUDE_EXE || "claude"): Completion {
  return ({ model, lead }) =>
    new Promise<string>((resolve, reject) => {
      const cliModel = model.slice(CLI_PREFIX.length) || "haiku";
      const cwd = mkdtempSync(path.join(tmpdir(), "lq-eval-"));
      const child = spawn(exe, claudeCliArgs(cliModel, SYSTEM_PROMPT), { cwd, stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      const timer = setTimeout(() => child.kill(), CLI_TIMEOUT_MS);
      const done = (fn: () => void) => {
        clearTimeout(timer);
        rmSync(cwd, { recursive: true, force: true });
        fn();
      };
      child.stdout.on("data", (chunk) => (out += chunk));
      child.on("error", (error) => done(() => reject(new Error(`claude CLI failed to start: ${error.message}`))));
      child.on("close", (code) =>
        done(() => {
          // Log the exit code only. The reply and the lead are personal data.
          let data: { result?: string; is_error?: boolean };
          try {
            data = JSON.parse(out);
          } catch {
            return reject(new Error(`claude CLI exit ${code}: no JSON output`));
          }
          if (data.is_error || code !== 0) return reject(new Error(`claude CLI error (exit ${code})`));
          if (!data.result) return reject(new Error("claude CLI returned no content"));
          resolve(data.result);
        }),
      );
      child.stdin.on("error", () => undefined);
      child.stdin.end(buildUserPrompt(lead));
    });
}

export type ParseOutcome = { ok: true; result: QualificationResult } | { ok: false; reason: string };

/** Same clean-up and validation as tools/qualify-lead.ts, but returns a reason instead of throwing. */
export function parseModelOutput(content: string): ParseOutcome {
  const json = stripCodeFence(content);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "not JSON" };
  }

  const checked = resultSchema.safeParse(parsed);
  if (!checked.success) {
    const issue = checked.error.issues[0];
    return { ok: false, reason: `schema: ${issue.path.join(".") || "root"} ${issue.message}` };
  }
  return { ok: true, result: checked.data };
}

// Offline stand-ins. They are not LLMs and their scores are not model results.
export const MOCK_MODELS = ["mock:keyword", "mock:flaky"];

const SPAM_PATTERNS = [
  /guarantee/i,
  /crypto/i,
  /loan/i,
  /prize|congratulations/i,
  /ignore .*instructions|system:/i,
  /bank details/i,
  /double your money/i,
  /backlinks|email addresses/i,
  /click/i,
  /!!!/,
];
const VAGUE = /\b(maybe|not sure|someday|eventually|who knows|not decided|no date|whenever|no rush|soon|unknown|we will see|none|free|exploring|help)\b/i;
const AUTHORITY = /\b(director|manager|owner|ceo|coo|partner|founder|principal|head|buyer)\b/i;

/** A rule-based baseline: budget, authority, need detail, timeline and company. */
export function keywordVerdict(lead: Lead): QualificationResult {
  const text = Object.values(lead).join(" ");
  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) {
    return {
      qualified: false,
      score: 2,
      reasoning: "Mock baseline (rules, not an LLM): a spam or injection pattern matched.",
      next_step: "Discard the lead.",
      red_flags: ["spam or injection pattern"],
    };
  }

  let score = 10;
  const flags: string[] = [];
  if (lead.budget) score += 15;
  else flags.push("no budget");
  if (AUTHORITY.test(lead.role ?? "")) score += 15;
  else flags.push("no clear authority");
  if (lead.need.length >= 60) score += 20;
  if (lead.timeline && !VAGUE.test(lead.timeline)) score += 10;
  else flags.push("no realistic timeline");
  if (lead.company) score += 10;
  if (VAGUE.test(lead.need)) {
    score -= 15;
    flags.push("vague need");
  }
  score = Math.max(0, Math.min(100, score));

  const qualified = score >= 60;
  return {
    qualified,
    score,
    reasoning: `Mock baseline (rules, not an LLM): scored ${score} from budget, authority, need detail, timeline and company.`,
    next_step: qualified ? "Book a discovery call." : "Ask for budget, timeline and the decision maker first.",
    red_flags: flags,
  };
}

function slotOf(leadId: string): number {
  let hash = 0;
  for (const ch of leadId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 5;
}

export function mockCompletion(model: string): Completion {
  if (model === "mock:keyword") {
    return async ({ lead }) => JSON.stringify(keywordVerdict(lead));
  }
  if (model === "mock:flaky") {
    // Deterministic faults: every fifth lead gets a non-JSON reply, a schema-invalid score,
    // or a code-fenced reply. The rest get the baseline verdict.
    return async ({ lead, leadId }) => {
      const verdict = keywordVerdict(lead);
      switch (slotOf(leadId)) {
        case 0:
          return "Sorry, I cannot help with that.";
        case 1:
          return JSON.stringify({ ...verdict, score: 150 });
        case 2:
          return "```json\n" + JSON.stringify(verdict) + "\n```";
        default:
          return JSON.stringify(verdict);
      }
    };
  }
  throw new Error(`Unknown mock model: ${model}`);
}
