import { describe, expect, it } from "vitest";
import { readJson } from "../api";

describe("readJson", () => {
  it("returns the parsed body", async () => {
    const res = new Response(JSON.stringify({ runId: "run_1" }));
    expect(await readJson<{ runId: string }>(res)).toEqual({ runId: "run_1" });
  });

  it("returns an empty object for a body that is not JSON", async () => {
    const res = new Response("<html>502 Bad Gateway</html>", { status: 502 });
    expect(await readJson(res)).toEqual({});
  });

  it("returns an empty object for a JSON value that is not an object", async () => {
    expect(await readJson(new Response("null"))).toEqual({});
    expect(await readJson(new Response('"text"'))).toEqual({});
  });
});
