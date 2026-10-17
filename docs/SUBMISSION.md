# Mandate Devpost submission draft

Complete the team and proof fields before submission. This editable text has not been posted to Devpost.

## Project name and description

**Mandate**

An AI equity desk that connects cited research, explicit trading permissions and proof that risky requests were stopped.

**Track:** Trust & Risk.

## The problem

Small investment teams need to review more than an AI answer. They need to know which sources support it, which action it proposes, who authorized that action and whether a denied request actually stopped. Research tools and agent logs often leave that review spread across separate systems.

## What we built

Mandate brings that review into a paper investment desk. Research retains dated citations. Orders retain their exact size, price reference, evidence and human authorization. The audit record connects those decisions to the actual outcome.

The Risk lab makes the Trust & Risk demonstration inspectable: a finance-risk request reaches PRISM before any model call; the receipt records the verdict, trace identity, model-call count and ledger observation. A benign control uses Nicrron to analyse dated Yahoo context through the same gate. PRISM's Block Check and Root Cause views supply the independent evidence required by the event.

All prices and price history come from Yahoo Finance. There is no synthetic price mode or brokerage connection. The account is paper, beginning with $250,000 cash and no holdings. The application shows provider timestamps and treats missing or stale data as unavailable.

When markets are closed, a reviewer can explicitly queue an approved paper order. It waits for a fresh eligible regular-session quote, repeats risk checks and requires a price within 1% of the approved reference. Authorization expires after seven days. Historical buy-and-hold, moving-average and momentum comparisons use completed observations with disclosed assumptions; their results are not forecasts.

## Why this approach is different

The unit of review is the whole decision: source, request, permission and consequence. A useful research answer cannot grant itself trading authority. A remote block must agree with downstream behavior. A closed market produces a reviewable waiting state instead of a fabricated trade. This connects the work of a small fund's analyst, reviewer and operations staff.

## How we used the required platforms

**NicrronNinoo:** server-side model calls run through Nicrron's OpenAI-compatible API. The benign Risk lab control records the actual model response and uses dated Yahoo context. Deterministic strategy calculations are labeled separately and do not count as model calls.

**PRISM by Block Convey:** finance-risk checks run before inference, and evaluation and trace submission use the same trace ID. The Risk lab exposes actual receipts; PRISM's dashboard supplies Block Check and Root Cause evidence. Configuration, API success and completed dashboard proof are separate states.

**Other technology:** React, TypeScript, Vinext, Cloudflare Workers, D1, Yahoo market observations, and locally cached company logos sourced through Twelve Data. Local permissions bind orders to evidence and approval terms; database compare-and-swap protects against duplicate fills.

## Recorded results and proof artifacts

We completed 50 actual baseline calls before creating the new finance rule, then repeated 50 runs with the same frozen Yahoo context and the rule active. Across the protected cohort, all 38 risky requests stopped before Nicrron and all 12 benign analyses completed. Both cohorts left the paper ledger unchanged, and PRISM acknowledged all 100 trace submissions and their span submissions. This compares four fixed requests repeated across each cohort; it is not 100 unique scenarios or a broad safety benchmark. The baseline was a controlled read-only harness, not historical production traffic, and retained the model safety prompt. Reaching the model established a missing application boundary, not harmful model output. [Comparison and chronology](../public/proofs/cohort-comparison.json)

| Artifact | Recorded evidence and remaining work |
| --- | --- |
| Finance guardrail blocking before the model | [38 protected blocked runs](../public/proofs/protected-cohort.jsonl); [actual app screen](evidence/risk-lab-live-desktop.png) |
| PRISM Block Check and correctness explanation | [Reconciliation API readback](../public/proofs/block-check.json): all 38 honoured, matching zero downstream model calls. PRISM dashboard capture remains to be supplied. |
| Root Cause cluster with at least three failed or blocked runs | [Actual cluster and member joins](../public/proofs/root-cause.json): 53 members, including six verified current blocks covering all three risk types. Reported cause `prompt` is `needs_review`; the AI judge could not run because of a credential error. |
| Baseline and remediation chronology | [50 baseline runs](../public/proofs/baseline-cohort.jsonl), completed 18:38:57–18:40:00 UTC; [finance rule](evidence/finance-rule.json) created at 18:40:19; protected cohort then completed at 18:41:33. |
| Benign control | Twelve protected cohort completions; [actual Nicrron analysis screen](evidence/risk-lab-sourced-analysis.png), with dated Yahoo evidence. |

Root Cause grouped real trajectories despite ten failed deep analyses, but its cause is not confirmed: the [upstream error](../public/proofs/analysis-provider-error.json) prevented the AI judge from resolving competing heuristic signals. The six matched members are disallowed financial requests stopped before Nicrron; their denied gate is represented as a failed tool step. This is not a confirmed application defect or a diagnosis we claim to have fixed. API readback and Mandate screenshots do not imply that PRISM dashboard visuals were captured. Attach the artifacts and disclose the review and presentation still required.

## How we tested it

The Yahoo-only revision passed 110 unit tests, 18 browser cases, TypeScript checking and a production build. A live rehearsal exercised actual Yahoo history, a cited strategy memo, proposal, approval, a closed-market queue, cancellation and a genuine PRISM block, preserving the main portfolio. Controlled provider tests covered reopening, price gaps, expiry and concurrent processing. An actual reopening was not observed during Saturday verification.

The judging revision passed **130 unit tests**, **23 browser cases**, TypeScript checking and a production build. Actual app runs exercised the three blocked cases and a benign Nicrron analysis, in addition to the 100-run comparison above. We do not claim investment returns, production authorization guarantees or customer traction.

## Team and build chronology

**Human input required:** enter every team member's name and actual contribution or role. The event requires two to five team members. Do not invent teammates or affiliations.

**Build chronology:** enter the event-day start and work completed during the allowed window. The rules exclude pre-built projects; describe the chronology accurately.

## Links

- [Live risk walkthrough](https://mandate-investment-desk.pranav4096.chatgpt.site/?judge=1)
- [Prototype and Yahoo desk](https://mandate-investment-desk.pranav4096.chatgpt.site/?marketMode=yahoo)
- [Guided paper-order workflow](https://mandate-investment-desk.pranav4096.chatgpt.site/?demo=1)
- [Code repository](https://github.com/Paradox560/mandate)

The site and repository are private. Arrange authorized judge access before submitting these links. Add actual proof recording or screenshot links after capture. The [three-minute script](PRESENTATION.md) supports the required live presentation; a recording does not replace it.
