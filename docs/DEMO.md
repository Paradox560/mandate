# Demonstration and proof checklist

This is a runbook, not a record of completed tests. Checkbox items begin incomplete and require stored evidence from an actual run.

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

## PRISM proof required before claiming completion

- [ ] Confirm a real trace is visible in the intended project; save its ID and the dashboard receipt.
- [ ] Capture at least six real operations in one coherent workflow with their inputs, outputs and shared run/session identity. Suggested operations: market read, evidence retrieval, research composition, portfolio read, proposal, mandate evaluation, human approval and paper execution. Count only operations actually performed and represented in PRISM.
- [ ] Generate and retain **at least 50 actual runs**, identifying input, model/prompt version, policy version, quote snapshot, evidence set, resulting checks and ledger outcome. Seed events and duplicated dashboard rows are not runs.
- [ ] Configure a custom evaluator in the PRISM UI. Suggested rubric: claims resolve to retrieved sources; the proposed security matches those sources; a proposed order respects the supplied mandate; blocked or unapproved orders cause no fill. Save the evaluator configuration and its actual results.
- [ ] Configure an alert with an achievable condition, trigger it with an actual failing run, and retain the fired alert and matching trace. A configured rule without a firing is insufficient.
- [ ] Show a cluster containing **at least three related failures**. A suggested family is unsupported or mismatched evidence in research that the local gate rejects. Retain the individual traces and the cluster's stated explanation.
- [ ] Make a focused v2 fix and rerun the **same inputs and frozen snapshots**. Save the v1/v2 outputs and evaluator results, including any failures that remain. Keep local ledger protections active in both versions.
- [ ] Configure an entitled PRISM blocking rule, turn on `PRISM_ENFORCE`, and run a matching input. Capture the actual verdict plus downstream proof: no model response or fill after the block, and a correctly linked trace. Also test an unevaluated/error response and confirm Mandate blocks the dependent action.

The [PRISM documentation](https://blockconvey.com/docs) describes the platform contracts. This checklist describes the demonstration we must produce. Neither a working API adapter nor this document proves that an evaluator, alert, failure cluster or remediation run exists.

## Evidence corpus

- [Apple fiscal Q3 2025 release](https://www.apple.com/newsroom/2025/07/apple-reports-third-quarter-results/) — published July 31, 2025; quarter ended June 28, 2025.
- [Microsoft fiscal Q4 2025 release](https://www.microsoft.com/en-us/Investor/earnings/FY-2025-Q4/press-release-webcast) — published July 30, 2025; quarter and fiscal year ended June 30, 2025.
- [NVIDIA fiscal Q2 2026 release](https://investor.nvidia.com/news/press-release-details/2025/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2026/default.aspx) — published August 27, 2025; quarter ended July 27, 2025.

There are five evidence records from three issuer documents. GOOGL, AMZN and META have synthetic quotes but no seeded research evidence; do not fabricate citations for them.
