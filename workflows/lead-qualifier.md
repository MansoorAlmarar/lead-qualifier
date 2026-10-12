# Workflow: AI Lead Qualifier

## Objective
Given information about a lead, decide whether it is worth pursuing and explain why.

## Inputs
- name
- company
- role / title
- budget (optional)
- need / problem they described
- timeline (optional)
- source (how they found us)
- notes (free text)

## Steps
1. Validate the input. Reject if name or need is missing.
2. Send the lead to the AI with the qualification criteria below.
3. Receive a structured result and validate it.
4. Return the result to the caller.

## Scenario
Demo business: a small agency selling AI automation services to other businesses. The qualifier decides whether an inbound lead is worth a sales call.

## Qualification criteria (edit these to fit your case)
- Clear need that we can actually solve
- Budget or authority signals
- Realistic timeline
- Fit with who we serve

## Output
```json
{
  "qualified": true,
  "score": 0,
  "reasoning": "short explanation",
  "next_step": "suggested action",
  "red_flags": []
}
```

## Tools used
- `tools/` qualify-lead task (to be created)

## Edge cases
- Very little information: lower the score and say what is missing.
- Spam or nonsense input: qualified = false, score 0.
