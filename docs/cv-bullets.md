# CV bullets and project summary

Every claim below comes from the code or README. Items in [brackets] are placeholders. Fill them with real numbers or delete the clause. Do not guess.

## CV bullets (pick 4 to 6)

- Built and deployed a full-stack AI lead-qualification app (Next.js, TypeScript, Supabase, Trigger.dev, Stripe) that returns a validated verdict, score, reasoning and next step for each lead.
- Ran the LLM call as a Trigger.dev background task behind a server-side Next.js route, with the browser polling for the result, so the secret key never reaches client code.
- Added a model fallback through OpenRouter: a paid model first, then free models on credit, rate-limit or provider errors, with model ids kept in one config location.
- Validated input with zod at both the API route and the task boundary, and validated the LLM's JSON output before returning it, to keep results in a defined schema.
- Implemented Supabase Auth with row-level security on a per-user history table, plus a proxy that blocks logged-out visitors and API routes that re-check the user.
- Integrated Stripe Checkout, the customer portal and a signature-verified webhook (test mode) to power a free tier of 2 runs per day and a $29/month Pro tier; protected the demo with per-user rate limiting and input length caps.
- [Optional: add a real metric, e.g. "tested on [add real number] sample leads" or "[add real number] users in the demo". Only if true.]

## LinkedIn project summary (2 lines)

AI lead qualifier built as my first agent project: Next.js on Vercel, a Trigger.dev backend calling an LLM through OpenRouter, Supabase auth and history, and Stripe billing in test mode.
Organised with the WAT framework (workflows, agent, tools) and built with Claude Code. Live demo and source: https://github.com/MansoorAlmarar/lead-qualifier

## Interview notes

- Be upfront that Stripe is in test mode and the in-memory rate limiter is best-effort.
- No automated tests yet. Say what you would test first.
