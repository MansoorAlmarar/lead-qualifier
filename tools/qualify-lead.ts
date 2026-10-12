import { task } from "@trigger.dev/sdk";
import { leadSchema, resultSchema, type QualificationResult } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

// Swap the model here. Any OpenRouter model id works.
// Free models work without credits but share rate-limited pools. OpenRouter tries them in order.
// For the live demo, a paid model like "openai/gpt-4o-mini" is more reliable.
const MODELS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-26b-a4b-it:free",
];

export const qualifyLead = task({
  id: "qualify-lead",
  run: async (payload: unknown): Promise<QualificationResult> => {
    const lead = leadSchema.parse(payload);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: MODELS,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(lead) },
        ],
      }),
    });

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
