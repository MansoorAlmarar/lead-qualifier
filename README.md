# AI Lead Qualifier

Enter a lead, click **Analyze**, and an AI workflow scores it and suggests a next step.

**Live demo:** https://lead-qualifier-taupe.vercel.app

Built to practice an agentic workflow end to end: a Next.js frontend on Vercel that triggers a backend task on Trigger.dev, which calls an LLM through OpenRouter.

## Architecture

```
Browser form
   |  POST /api/analyze
   v
Next.js route (Vercel, server-side)  --tasks.trigger-->  Trigger.dev task "qualify-lead"
   ^                                                          |
   |  GET /api/runs/:id (polled)                              v
   +-------------------- result JSON <------------------  OpenRouter (LLM)
```

- The Trigger.dev secret key lives only in the server routes. It never reaches the browser.
- Lead input is validated with zod in the route and again inside the task.
- The LLM must return JSON. The task validates it before returning.
- The route limits requests per IP and caps input length to protect the demo.

## The WAT framework

This project is organized the way I work with Claude Code:

| Part | Folder | What it is |
|---|---|---|
| **W**orkflows | `workflows/` | Plain-language instructions for what the workflow does |
| **A**gent | Claude Code | Reads the workflow, writes and runs the tools, fixes errors |
| **T**ools | `tools/` | The Trigger.dev task, prompt and schemas that do the work |

`CLAUDE.md` holds the standing instructions for the agent.

## Project layout

```
workflows/lead-qualifier.md   what the workflow should do
tools/                        Trigger.dev task, prompt, schemas
trigger.config.ts             Trigger.dev project config
frontend/                     Next.js app (deployed to Vercel)
```

## Run locally

Requires Node 20+, a Trigger.dev account and an OpenRouter API key.

1. Install: `npm install` in the root and in `frontend/`.
2. Set `OPENROUTER_API_KEY` in your Trigger.dev project (Development environment).
3. Copy `frontend/.env.example` to `frontend/.env.local` and add your Development secret key.
4. In the root: `npx trigger.dev@latest dev`
5. In `frontend/`: `npm run dev`, then open http://localhost:3000

## Deploy

- **Backend:** `npx trigger.dev@latest deploy`. Set `OPENROUTER_API_KEY` in the Production environment.
- **Frontend:** import the repo in Vercel, set the root directory to `frontend`, and add `TRIGGER_SECRET_KEY` with the Production secret key.

## Notes

- The default model is a free OpenRouter model, which can be rate limited. Change the model in `tools/qualify-lead.ts` for more reliable results.
- Demo data is fictional. Please do not enter real personal information.
