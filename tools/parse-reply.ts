// Shared by the Trigger.dev task and the eval runner, so both read a model reply the same way.
export function stripCodeFence(content: string): string {
  // Some models wrap JSON in a code fence even in JSON mode.
  return content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
}
