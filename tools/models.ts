// The one place to swap models. Any OpenRouter model id works.
// Keep evals/models.json in step with this list (tools/models.test.ts checks it).
//
// The paid model is tried first. If OpenRouter refuses it (out of credit, rate limited or down),
// the task retries with the free models, which need no credit but share rate-limited pools.
export const PAID_MODELS = ["openai/gpt-4o-mini"];

// OpenRouter accepts at most 3 models per request.
// "minimax/minimax-m3.1-flash:free" is not on OpenRouter's public list (REVIEW.md, L1).
// It is left in place until the free eval picks a replacement.
export const FREE_MODELS = [
  "minimax/minimax-m3.1-flash:free",
  "poolside/laguna-s-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];
