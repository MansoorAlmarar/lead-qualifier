# AI Lead Qualifier: WAT Framework

This project lives in its own git repo inside AIS-OS (`AIS-OS/lead-qualifier/`). The parent AIS-OS CLAUDE.md (STOIC) also applies: be direct, short sentences, no em dashes, bullets over paragraphs.

## What this project is
An AI Lead Qualifier. The user submits information about a lead (name, company, role, budget, need, timeline, source, notes). An AI step scores and qualifies it and returns a structured result (qualified / not qualified, score, reasoning, suggested next step).

## Purpose: portfolio piece
This is a public portfolio project, so treat quality as part of the deliverable:
- Polished, responsive UI with clear loading, error and empty states.
- A one-click "Fill sample lead" button so visitors can try it without typing.
- A README with a live demo link, an architecture diagram, and a short explanation of the WAT approach.
- Public repo: no secrets, no real personal data. Use fictional sample leads only.
- Protect the live demo from abuse: rate limit the route and cap input length, since each run costs LLM tokens.

## The WAT framework
- **W: Workflows** (`workflows/`): Plain-language instructions (markdown SOPs). Each file describes one workflow: objective, inputs, steps, tools used, expected output, edge cases. These are the source of truth for *what* should happen.
- **A: Agent** (Claude Code, you): Reads the workflow, decides which tools to run and in what order, writes/edits tools, handles errors, and improves workflows when something is learned. You do not do deterministic work by hand when a tool can do it.
- **T: Tools** (`tools/`): Deterministic scripts/code that do the actual work (calling the LLM, validating input, formatting output). Tools are small, single-purpose, testable.

Rule of thumb: workflows say *what and why*, tools do *how*, the agent glues them together.

## Architecture
```
Frontend (Next.js on Vercel)  --server-side call-->  Trigger.dev task (backend)  -->  OpenRouter (LLM)
        ^                                                    |
        +---------------- result (poll / realtime) <---------+
```
- **Backend: Trigger.dev.** The qualifier runs as a Trigger.dev task, deployed with the Trigger.dev CLI. Task code lives in `tools/` and follows `workflows/lead-qualifier.md`.
- **LLM: OpenRouter** (not the Anthropic API directly). It uses an OpenAI-compatible API. Pick an inexpensive model and keep the model id in one config constant so it is easy to swap.
- **Frontend: Vercel**, deployed from GitHub (push to `main` = deploy). A form collects lead info, an **Analyze** button calls a server-side route, which triggers the task and returns the result to the UI.
- **Communication:** The frontend never holds the Trigger.dev secret key in the browser. Use a Next.js route handler / server action that calls `tasks.trigger(...)` with `TRIGGER_SECRET_KEY`. Then either poll the run by ID or give the browser a short-lived public access token and use Trigger.dev realtime (`@trigger.dev/react-hooks`) to show status and result.
- Always check current Trigger.dev and OpenRouter docs before writing code; the APIs change.

## Project structure
```
lead-qualifier/
├── CLAUDE.md
├── workflows/          # W: markdown instructions
│   └── lead-qualifier.md
├── tools/              # T: scripts and Trigger.dev tasks
├── frontend/           # Next.js app (added in the frontend phase)
├── .env.example        # variable names only, never real values
└── .gitignore
```

## Conventions
- TypeScript everywhere (Trigger.dev tasks and Next.js).
- Validate lead input with a schema (zod) at both the frontend and the task boundary.
- The LLM must return structured JSON matching a defined schema; validate before returning.
- Keep prompts in their own file inside `tools/`, not inline in task logic.
- Small, readable code. No premature abstraction. Match existing style.

## Secrets and safety
- Never commit `.env` or any key. Only `.env.example` with names.
- Variables: `TRIGGER_SECRET_KEY` (frontend server only), `OPENROUTER_API_KEY` (set in the Trigger.dev dashboard, not in the frontend).
- The user pastes keys into dashboards or `.env` files themselves. Never ask them to paste a key in chat.
- Never expose secret keys to client code (no `NEXT_PUBLIC_` prefix on secrets).
- Lead data can be personal data: do not log full lead details, and do not store it unless asked.

## How you (the agent) should work
1. Read the relevant file in `workflows/` before doing anything.
2. Use or write a tool in `tools/` for execution. Test it with a sample lead before wiring it into the frontend.
3. If a tool fails, read the error, fix the tool, retest, then update the workflow with what you learned.
4. Ask before anything destructive, anything costing money, or anything that deploys or publishes (including creating the public GitHub repo).
5. Keep workflows current. Do not rewrite them wholesale without asking.

## Definition of done (per phase)
1. Workflow doc written and agreed.
2. Task works locally (`npx trigger.dev dev`) with a sample lead.
3. Task deployed to Trigger.dev.
4. Frontend form -> Analyze -> result displayed, working locally.
5. Frontend pushed to its own GitHub repo, deployed on Vercel, env vars set, end-to-end test passes.
