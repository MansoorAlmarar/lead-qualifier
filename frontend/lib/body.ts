// A lead is at most about 3 KB of text. 16 KB leaves room for JSON and multi-byte characters.
export const MAX_BODY_BYTES = 16 * 1024;

export class BodyTooLargeError extends Error {}

// Reads the body as text and stops as soon as it passes the limit, so a huge or
// chunked body is never fully loaded into memory.
export async function readLimitedText(request: Request, maxBytes = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();

  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
