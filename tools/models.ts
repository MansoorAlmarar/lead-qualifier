// The one place to swap models. Any OpenRouter model id works.
// Keep evals/models.json in step with this list (tools/models.test.ts checks it).
//
// The paid model is tried first. If OpenRouter refuses it (out of credit, rate limited or down),
// the task retries with the free models, which need no credit but share rate-limited pools.
export const PAID_MODELS = ["openai/gpt-4o-mini"];

// OpenRouter accepts at most 3 models per request.
// Both free ids were live and scored on the 40-lead eval in Nov 2026 (REVIEW.md, L1):
// ultra 90% qualified accuracy at about 7 s, lightning 95% at about 20 s.
export const FREE_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-lightning:free",
];
