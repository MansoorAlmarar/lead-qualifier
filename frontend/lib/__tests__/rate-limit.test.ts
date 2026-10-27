import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit, then blocks", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("user-a")).toBe(true);
    expect(rateLimit("user-a")).toBe(false);
  });

  it("tracks each key separately", () => {
    for (let i = 0; i < 5; i++) rateLimit("user-b");
    expect(rateLimit("user-b")).toBe(false);
    expect(rateLimit("user-c")).toBe(true);
  });

  it("allows requests again once the window has passed", () => {
    for (let i = 0; i < 3; i++) rateLimit("user-d", 3, 1000);
    expect(rateLimit("user-d", 3, 1000)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("user-d", 3, 1000)).toBe(true);
  });

  it("does not count blocked attempts against the user", () => {
    for (let i = 0; i < 2; i++) rateLimit("user-e", 2, 1000);
    vi.advanceTimersByTime(500);
    expect(rateLimit("user-e", 2, 1000)).toBe(false); // blocked at t+500
    vi.advanceTimersByTime(501); // first two hits are now out of the window
    expect(rateLimit("user-e", 2, 1000)).toBe(true);
  });
});
