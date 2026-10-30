import { logger, task } from "@trigger.dev/sdk";
import { leadSchema, resultSchema, type Lead, type QualificationResult } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { stripCodeFence } from "./parse-reply";

// Swap models here. Any OpenRouter model id works.
// The paid model is tried first. If OpenRouter refuses it (out of credit, rate limited or down),
// the task retries with the free models, which need no credit but share rate-limited pools.
const PAID_MODELS = ["openai/gpt-4o-mini"];
// OpenRouter accepts at most 3 models per request.
const FREE_MODELS = [
  "minimax/minimax-m3.1-flash:free",
  "poolside/laguna-s-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

// 402 = out of credit, 429 = rate limited, 5xx = provider trouble.
const shouldFallBack = (status: number) => status === 402 || status === 429 || status >= 500;

async function callOpenRouter(apiKey: string, models: string[], lead: Lead): Promise<Response> {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      models,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(lead) },
      ],
    }),
  });
}

// Exported so the eval parity test can run the task's own code with OpenRouter stubbed.
export async function qualify(payload: unknown, apiKey: string | undefined): Promise<QualificationResult> {
  const lead = leadSchema.parse(payload);

  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  let res = await callOpenRouter(apiKey, PAID_MODELS, lead);
  if (!res.ok && shouldFallBack(res.status)) {
    logger.warn(`Paid model failed with ${res.status}, falling back to free models`);
    res = await callOpenRouter(apiKey, FREE_MODELS, lead);
  }

  if (!res.ok) {
    throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");

  return resultSchema.parse(JSON.parse(stripCodeFence(content)));
}

export const qualifyLead = task({
  id: "qualify-lead",
  run: (payload: unknown): Promise<QualificationResult> => qualify(payload, process.env.OPENROUTER_API_KEY),
});
