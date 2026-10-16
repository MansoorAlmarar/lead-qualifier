import { logger, task } from "@trigger.dev/sdk";
import { leadSchema, resultSchema, type Lead, type QualificationResult } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

// Swap models here. Any OpenRouter model id works.
// The paid model is tried first. If OpenRouter refuses it (out of credit, rate limited or down),
// the task retries with the free models, which need no credit but share rate-limited pools.
const PAID_MODELS = ["openai/gpt-4o-mini"];
const FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
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

export const qualifyLead = task({
  id: "qualify-lead",
  run: async (payload: unknown): Promise<QualificationResult> => {
    const lead = leadSchema.parse(payload);

    const apiKey = process.env.OPENROUTER_API_KEY;
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

    // Some models wrap JSON in a code fence even in JSON mode.
    const json = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return resultSchema.parse(JSON.parse(json));
  },
});
