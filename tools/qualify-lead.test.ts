import { afterEach, describe, expect, it, vi } from "vitest";
import { qualify } from "./qualify-lead";

const lead = { name: "Sara Khan", need: "Automate invoice processing." };
const verdict = { qualified: true, score: 80, reasoning: "Clear need.", next_step: "Book a call.", red_flags: [] };
const ok = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));

afterEach(() => vi.unstubAllGlobals());

describe("qualify", () => {
  it("throws only the status code on an OpenRouter error, never the body", async () => {
    const body = "SECRET-BODY Sara Khan invoice";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 400 })));
    const err = await qualify(lead, "k").catch((e: Error) => e);
    expect((err as Error).message).toBe("OpenRouter error 400");
    expect((err as Error).message).not.toContain("SECRET-BODY");
  });

  it("falls back to the free models when the paid model is refused", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("no credit", { status: 402 }))
      .mockResolvedValueOnce(ok(verdict));
    vi.stubGlobal("fetch", fetchMock);
    expect(await qualify(lead, "k")).toEqual(verdict);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not leak the body when the free fallback also fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("echo Sara Khan", { status: 503 })));
    const err = await qualify(lead, "k").catch((e: Error) => e);
    expect((err as Error).message).toBe("OpenRouter error 503");
  });

  it("returns qualified false when the model says true with a low score", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ ...verdict, score: 30 })));
    expect((await qualify(lead, "k")).qualified).toBe(false);
  });
});
