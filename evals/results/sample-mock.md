# Lead qualifier eval results

**Mode: mock.** These models are offline stand-ins, not LLMs. The numbers test the scorer and the parser. They are not AI model scores.

- Generated: 2026-10-30T06:35:17.089Z
- Leads: 40 fictional leads (`evals/dataset/leads.json`)

| Model | Qualified accuracy | Score-band hit rate | MAE (points) | Schema-valid rate | HTTP/network errors | Schema failures | Median latency |
|---|---|---|---|---|---|---|---|
| mock:keyword | 92.5% | 50.0% | 9.3 | 100.0% | 0 | 0 | 0 ms |
| mock:flaky | 50.0% | 27.5% | 10.1 | 57.5% | 0 | 17 | 0 ms |

### Qualified accuracy by category

| Model | Strong | Medium | Weak | Spam |
|---|---|---|---|---|
| mock:keyword | 12/12 | 8/10 | 9/10 | 8/8 |
| mock:flaky | 7/12 | 3/10 | 5/10 | 5/8 |

Notes:

- Accuracy and band hit rate count a failed call and an invalid reply as misses.
- HTTP/network errors: the call failed (for example a 429, a 5xx or a timeout). Schema failures: a reply came back but was not valid JSON or broke the schema.
- MAE uses valid replies only. It compares the score with the middle of the expected band.
- Median latency covers every call. Mock latencies only reflect in-memory work, so they are not comparable to live numbers.
- Each model is called on its own. The app's paid-then-free fallback chain is not exercised.
