import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadDataset } from "./dataset";
import { MOCK_MODELS, mockCompletion, openRouterCompletion, type Completion } from "./model";
import { resolveModels, runModel } from "./runner";
import { renderMarkdown, scoreModel, type ModelScore } from "./score";

// Usage:
//   npm run eval -- --mock                 offline, no keys, no cost
//   npm run eval                           live, needs OPENROUTER_API_KEY
//   npm run eval -- --out path/to/file.md  choose the output file
function argValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const mock = args.includes("--mock");
  const leads = loadDataset();

  let completionFor: (model: string) => Completion;
  let models: string[];
  if (mock) {
    models = MOCK_MODELS;
    completionFor = mockCompletion;
  } else {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set. Run with --mock to work offline.");
    }
    models = resolveModels(process.env);
    const live = openRouterCompletion(apiKey);
    // mock:* ids always stay offline, so a config can mix both.
    completionFor = (model) => (model.startsWith("mock:") ? mockCompletion(model) : live);
    process.stderr.write(
      `Live run: ${leads.length} fictional leads x ${models.length} model(s). This uses OpenRouter credit.\n`,
    );
  }

  const scores: ModelScore[] = [];
  for (const model of models) {
    process.stderr.write(`${model}: `);
    const cases = await runModel(model, leads, completionFor(model), () => process.stderr.write("."));
    process.stderr.write("\n");
    scores.push(scoreModel(model, cases));
  }

  const generatedAt = new Date().toISOString();
  const markdown = renderMarkdown({
    mode: mock ? "mock" : "live",
    generatedAt,
    datasetSize: leads.length,
    scores,
  });

  const stamp = generatedAt.slice(0, 19).replace(/:/g, "-");
  const outArg = argValue(args, "--out");
  const outFile = outArg
    ? path.resolve(outArg)
    : path.join(__dirname, "results", `${mock ? "mock" : "live"}-${stamp}.md`);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, markdown);

  process.stdout.write(markdown);
  process.stderr.write(`Wrote ${outFile}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
