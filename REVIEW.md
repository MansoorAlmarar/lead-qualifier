# Review pass

Scope: the whole repo (frontend, tools, Trigger.dev config, Supabase SQL, Stripe billing, the eval set, CI and docs).
Branch: `chore/review-pass`. Base: `main` at `ad95f57`.

Severity: **High** (exploitable or wrong money/data), **Medium** (wrong behaviour under real use), **Low** (robustness, cost or tidiness), **Info** (note only).

Status: **Fixed** (changed in this PR, with a test) or **Left** (needs a decision or a schema/product change; not changed here).

---

## Fixed in this PR

| # | Sev | Where | Finding | Fix and test |
|---|---|---|---|---|
| F1 | Medium | `frontend/app/api/runs/[id]/route.ts:47-53` | A completed run's output was saved as `done` without checking it against the result schema. A malformed reply could reach the UI and history. | The output is checked with `resultSchema`. Invalid output marks the run `failed`. Test: `frontend/app/api/__tests__/runs.test.ts`. |
| F2 | Low | `frontend/components/LeadQualifier.tsx` (analyze and poll) | `res.json()` throws on a non-JSON reply, such as an HTML error page from a proxy. The raw parser message was shown to the user. | New `frontend/lib/api.ts` `readJson` returns `{}` for a non-JSON body, so the UI shows its own message. Test: `frontend/lib/__tests__/api.test.ts`. |
| F3 | Low | `tools/qualify-lead.ts:63` and `evals/model.ts` | The code-fence regex was duplicated, so the task and the eval could drift apart. | Moved into `tools/parse-reply.ts` and used by both. Parity test: `evals/parity.test.ts` runs the real task and the eval parser on five reply shapes (plain, fenced, not JSON, score above 100, missing field) and checks they agree. |
| F4 | Low | `evals/score.ts`, `evals/runner.ts`, `evals/cli.ts` | Network and HTTP failures were counted with schema failures. | Failures are tagged `network` or `schema`. The report has separate columns. Tests: `evals/score.test.ts`, `evals/runner.test.ts`. |
| F5 | Low | `frontend/lib/schema.ts` | The frontend's result type was hand-written, so it could drift from the task's schema. | Replaced by a zod `resultSchema` that mirrors `tools/schema.ts`, with the type inferred from it. Test: `frontend/lib/__tests__/schema.test.ts`. |
| F6 | Low | `docs/cv-bullets.md` | The interview notes said "No automated tests yet". That is stale. | Now lists what is and is not tested, matching the README. |
| F7 | Info | `tools/.gitkeep` | Dead file. The folder has real files. | Removed. |

---

## Left: needs a decision (not changed here)

| # | Sev | Where | Finding | Why not changed |
|---|---|---|---|---|
| L1 | Medium | `tools/qualify-lead.ts:11` (also `evals/models.json`) | `minimax/minimax-m3.1-flash:free` is **not on OpenRouter's public model list** (checked against 456 listed ids on 2026-10-29). That slot of the free fallback can never succeed. The other three ids exist: `openai/gpt-4o-mini`, `poolside/laguna-s-2.1:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`. | Choosing a replacement is a model choice, and the eval should decide it. Suggested: run `npm run eval` with a key, then pick the best free model that is on the list. |
| L2 | Medium | `frontend/app/api/analyze/route.ts:18-27` | The free daily limit is a read followed later by an insert. Two requests sent at once can both pass, so a user can go over 2 per day. | A real fix needs one atomic step in the database (a function or a locked count). That is a schema change. |
| L3 | Medium | `frontend/lib/billing.ts:24-29` | A run that stays `pending` (for example, the user closed the tab before polling finished) still counts against the free limit. Nothing marks it expired. | Needs a product rule for how long a run may stay pending. |
| L4 | Medium | `tools/schema.ts:14-20`, `tools/prompt.ts:15` | The rule "qualified only when score is 60 or higher" is only in the prompt. The code accepts `qualified: true` with a score of 30. | Enforcing it changes verdicts users see. Decide the policy first. The eval's band checks would show how often models break the rule. |
| L5 | Medium | `frontend/app/api/stripe/webhook/route.ts:39-43` | If no row matches the Stripe customer, the route returns 500, so Stripe retries for days. A subscription created outside the app would retry for a long time. | Returning 200 and logging is a policy choice about Stripe retries. Test mode only today. |
| L6 | Low | `frontend/app/api/billing/checkout/route.ts:23-35` | Two checkouts at the same moment can each create a Stripe customer. The second database insert fails (`user_id` is the primary key), which leaves an unused customer. | Needs an upsert or an on-conflict rule. Low impact in test mode. |
| L7 | Low | `trigger.config.ts:8-14` | `maxAttempts: 2` makes Trigger rerun the task after a failure. Each rerun is another paid OpenRouter call. | Cost trade-off. Decide whether a retry is worth the cost. |
| L8 | Low | `frontend/app/api/analyze/route.ts:39-43` | The task is started before the history row is written. If the insert fails, the LLM still runs and the user sees an error. | Changing the order changes which failures are visible. |
| L9 | Low | `frontend/app/api/analyze/route.ts:29` | The whole request body is read before the length limits apply. Field lengths are capped only after parsing. | A body size limit is a small infra decision (Next.js or the host setting). |
| L10 | Low | `frontend/lib/rate-limit.ts:5` | The limiter is in memory, per server instance, and only covers `/api/analyze`. Billing routes have no limit. README already says the limiter is best effort. | A shared store (Redis, Supabase table) is a real change. |
| L11 | Low | `frontend/app/api/runs/[id]/route.ts:50,53` | The run route writes status and result with the user's own client. RLS allows it, so a user could change the stored result of their own run. The impact is their own data only. | Moving the write to the admin client is a design choice. |
| L12 | Low | `tools/qualify-lead.ts:52` | On an OpenRouter error, the response body is put into the thrown error, which Trigger logs. Bodies are unlikely to echo the lead, but this is a leak path. | Logging only the status (as the eval does) is a small change, but it removes debug detail. Decide. |
| L13 | Low | `frontend/lib/schema.ts` and `tools/schema.ts` | Two copies of the lead and result schemas. F5 reduced the drift risk, but the copies are still separate. | Sharing a file needs an import path that both the Next.js build and the Trigger bundle accept. Not tried here. |
| L14 | Info | `package.json:5` | `"main": "index.js"` points at a file that does not exist. Harmless. | Left to keep the diff small. |

---

## Checked and fine (no change)

- **Secrets.** A scan of every tracked file found only placeholders: `frontend/app/api/__tests__/stripe-webhook.test.ts:6` (`sk_test_placeholder`) and a comment in `frontend/.env.example:6`. No keys are committed. `.gitignore` covers `.env` and `.env.local`.
- **Secrets on the server only.** `TRIGGER_SECRET_KEY`, the service-role key, the Stripe keys and the OpenRouter key are read only in server code. `NEXT_PUBLIC_` is used only for the Supabase URL and the publishable key.
- **Row-level security.** `lead_history` allows select, insert, update and delete only on the user's own rows (`supabase/schema.sql:19-29`). `subscriptions` allows select on the user's own row, with no write policies, so only the service role writes it (`supabase/billing.sql:12-16`).
- **Authentication.** Every user route checks `getUser()`: analyze (`route.ts:9-12`), runs (`route.ts:26`), checkout, portal and status. The proxy sends logged-out visitors to `/login` and returns 401 for API routes (`frontend/lib/supabase/proxy.ts`).
- **Stripe webhook.** A missing signature gets 400. Signature verification runs over the raw body before any database write (`route.ts:11-17`).
- **Dubai day boundary.** `frontend/lib/billing.ts:9-12` is correct. Dubai is UTC+4 with no daylight saving.
- **XSS.** No `dangerouslySetInnerHTML`. Model output is rendered as text by React.
- **Prompt injection.** `tools/prompt.ts:12` tells the model to treat the lead as data. The reply is checked against the schema before it is used. The eval set includes injection cases (`spam-03`, `spam-04`). Whether a model obeys the rule varies, and the eval measures that. It is not a hard guarantee.
- **Lead-data logging.** The app logs error messages only, not lead content. The eval logs status only.

---

## Verification

- Frontend: `npm run lint` (clean), `npm test` (59 passed, was 47), `npm run build` (passes).
- Root: `npm run typecheck` (clean), `npm test` (55 passed), `npm run eval -- --mock` (runs).
- The OpenRouter model check used OpenRouter's public `/api/v1/models` list, fetched through a web-fetch tool. The sandbox's own network policy blocks `openrouter.ai`, so the check was not made from this sandbox directly.
