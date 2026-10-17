# Demonstration and proof checklist

This document separates recorded build-session checks from the proof still needed for judging. Unchecked items require evidence from an actual run.

## Explain the clocks first

The app is a paper desk with synthetic, deterministic prices. Market timestamps identify when the simulation generated a quote, not when an exchange published it. Each chart contains 96 five-minute simulated observations. Daily change is calculated against the previous synthetic UTC-day close. It is not a backtest, portfolio return or actual price history.

Issuer disclosures are historical and assessed as of **August 29, 2025**. The date of a newly created report or order is the real current time; it does not refresh its sources. The seed portfolio starts with $126,579.40 cash, 100 MSFT shares, 220 NVDA shares and 140 AAPL shares. Its roughly $250,000 marked value moves with the simulation. Cost bases are illustrative bookkeeping inputs.

Two reports and one blocked order are clearly labeled samples. Their `seed-*` IDs identify fixtures. Their scores describe cited-claim coverage, not investment confidence or measured performance. They contain no model responses, PRISM receipts, approvals or executions.

## Product walkthrough

1. Open the desk and identify the synthetic-market and historical-evidence labels. Read the cash balance, holdings and mandate.
2. Open NVIDIA's sample research and follow both original issuer citations. Show the publication date, reporting period and supported claims.
3. Run new research with configured Nicrron credentials. Inspect the returned mode and model; if the request fails, show the error or explicitly labeled sample behavior.
4. Propose an oversized order. Show its failed notional check and confirm cash, holdings and fills did not change. The seeded order is a visual example only; create a new proposal for live proof.
5. Submit a valid small paper proposal. Review its evidence, amount, projected concentration and authorization requirements. Approve the exact order and execute its paper fill.
6. In a fresh test, approve an order and then change the mandate or portfolio revision before execution. The prior approval must be rejected. Record the reason and unchanged ledger.
7. Attempt execution with a disallowed actor and attempt a second fill of an executed order. Both must leave the ledger unchanged. Show the real audit records and associated trace IDs.

## Local safeguards to verify

`evaluateOrder` contains nine distinct checks: parameter validity, allowed symbol, quote freshness, price drift, notional, cash/inventory, concentration, source linkage and evidence age. Capability authorization, approval requirements, fingerprint/version binding and duplicate-fill prevention are additional execution controls. Do not count each UI badge or repeated check as a separate integration.

These are intended code behaviors to verify with the implementation's checks. A fixture with `status: blocked` does not prove any enforcement path ran. A local role name is not production authentication.

## Recorded checks — October 17, 2026

- **47 unit tests passed**, TypeScript checking passed, and the Desktop production build/setup passed.
- **7 Playwright tests passed in 30.2 seconds**, including a real PRISM-enforced MSFT buy-one proposal, approval and execution with exactly one fill, plus an oversized order denied without changing the ledger.
- Live Nicrron and PRISM provider calls were verified. The rule **Mandate blocked order** returned an evaluated block for an oversized-order scenario with enforcement enabled; portfolio revision **2** remained unchanged. Trace: `80288ef5-24af-49be-a081-aa7db80cd4ba`.

These are build-session results reported by the implementation and browser verification tasks. They are not continuous monitoring or proof of the remaining PRISM dashboard criteria. Repeat local checks using README.md. `node scripts/verify-guardrails.mjs` generates three real oversize scenarios with enforcement required and asserts a remote block and unchanged ledger; its presence does not establish that PRISM grouped those runs.

Three further real enforced blocks were recorded by `scripts/verify-guardrails.mjs` with an unchanged ledger: `0d83e43e-b403-45e8-a1a4-6ebb70eafbf2`, `8df6c6aa-da8b-4997-b9ed-94766828549e`, and `694c615b-4f66-4845-b9fc-19bd2e81cd94`. Local receipts are in the ignored `outputs/guardrail-proof.json.txt`. Their Block Check classifications and Intelligence grouping still need dashboard inspection.

## Required event proofs

The [MONEY TALKS 2 brief](https://docs.google.com/document/d/1rm5ev9mj_leu2w7OVlFVmKaCT-OvZZ9tSibbC4lzd08/edit?tab=t.0) requires PRISM and NicrronNinoo for every team, with **50+ actual runs before fixing** to supply analysis. Track-specific proofs differ. Mandate's primary track is **Trust & Risk**; cited research gives it a secondary **Money Intelligence** fit.

Common evidence:

- [x] Make actual provider requests through Nicrron and PRISM.
- [ ] Retain 50+ actual agent runs before remediation, including inputs, version, evidence/quote snapshot and result. Seed records and copied rows do not count.

Trust & Risk — all three required:

- [x] Configure a custom finance guardrail in enforce mode and show it blocking a real run. The verified oversized-order trace is recorded above.
- [ ] Open the Guardrails page and show **Block Check**: honoured, not honoured or unverifiable. Compare PRISM's classification with the actual downstream ledger result and explain whether it is correct. A local no-fill assertion does not replace this dashboard check.
- [ ] Show an **Intelligence cluster of at least three failed or blocked runs**, its stated cause and an explanation. Three API blocks alone do not establish a cluster.

Money Intelligence — additional proofs if entering this track:

- [ ] Upload the historical issuer corpus to the PRISM Knowledge Base, assign it to the agent and show a run whose retrieval step actually uses it.
- [ ] Show an Intelligence cluster of at least three failed runs and explain its cause.
- [ ] Create a custom evaluator and show v1 and v2 scores on the **same inputs and frozen snapshots**. A suggested rubric checks that every factual claim resolves to a retrieved source and that a proposal's symbol matches its evidence.

Money Operations — requirements for a separate operations entry, not extra Trust & Risk requirements:

- [ ] Show one session's Steps tab with six or more actual tool calls.
- [ ] Configure an alert and show it firing on a real run.
- [ ] Show a three-or-more failure cluster, explain its cause and demonstrate v2 no longer failing on the same inputs.

The [PRISM documentation](https://blockconvey.com/docs) establishes platform contracts. An adapter, test suite or this document does not establish a dashboard evaluator, alert, cluster or remediation result.

## Evidence corpus

- [Apple fiscal Q3 2025 release](https://www.apple.com/newsroom/2025/07/apple-reports-third-quarter-results/) — published July 31, 2025; quarter ended June 28, 2025.
- [Microsoft fiscal Q4 2025 release](https://www.microsoft.com/en-us/Investor/earnings/FY-2025-Q4/press-release-webcast) — published July 30, 2025; quarter and fiscal year ended June 30, 2025.
- [NVIDIA fiscal Q2 2026 release](https://investor.nvidia.com/news/press-release-details/2025/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2026/default.aspx) — published August 27, 2025; quarter ended July 27, 2025.

There are five evidence records from three issuer documents. GOOGL, AMZN and META have synthetic quotes but no seeded research evidence; do not fabricate citations for them.
