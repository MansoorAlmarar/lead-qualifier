import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_cbiduzobywfmsnlcbktb",
  dirs: ["./tools"],
  runtime: "node",
  maxDuration: 60,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
