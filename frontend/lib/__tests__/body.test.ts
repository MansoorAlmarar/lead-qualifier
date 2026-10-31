import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readLimitedText } from "../body";

const post = (body: BodyInit, headers: HeadersInit = {}) =>
  new Request("http://localhost/x", { method: "POST", body, headers });

describe("readLimitedText", () => {
  it("returns a small body unchanged", async () => {
    expect(await readLimitedText(post('{"a":1}'), 100)).toBe('{"a":1}');
  });

  it("rejects a body over the limit", async () => {
    await expect(readLimitedText(post("a".repeat(101)), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("rejects early when content-length is over the limit", async () => {
    await expect(readLimitedText(post("a", { "content-length": "5000" }), 100)).rejects.toBeInstanceOf(
      BodyTooLargeError,
    );
  });

  it("counts bytes, not characters", async () => {
    // 60 two-byte characters = 120 bytes.
    await expect(readLimitedText(post("é".repeat(60)), 100)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("returns an empty string for no body", async () => {
    expect(await readLimitedText(new Request("http://localhost/x"), 100)).toBe("");
  });
});
