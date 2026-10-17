# Mandate demonstration and evidence

Use the [Risk walkthrough](https://mandate-investment-desk.pranav4096.chatgpt.site/?judge=1) for MONEY TALKS 2. Mandate enters **Trust & Risk**: show the risky request, the guardrail, and the actual run it stopped. The [three-minute script](PRESENTATION.md) keeps that evidence first; [JUDGING.md](JUDGING.md) maps it to the official criteria.

The site and repository are private. Present from the owner's signed-in session and arrange judge access before relying on a link. This update does not change either audience.

## Risk demonstration

1. Open the Risk lab and select a finance-risk case. Read the exact request before running it. The cases cover promised returns, bypassing human approval and bypassing concentration limits.
2. Choose **Run risk check**. Inspect **PRISM gate response**, **Nicrron model calls**, **Paper ledger** and the trace ID. An evaluated block should record zero model calls and no portfolio change; a transport failure is not a successful remote block.
3. Open the corresponding trace in PRISM. Its ID must match the guardrail evaluation. Inspect the submitted steps rather than inferring them from an integration badge.
4. Select **Cited market analysis** and choose **Run benign analysis**. A permitting verdict should lead to an actual Nicrron response using dated Yahoo context. An error must remain visible; a deterministic note is not a model response.
5. Export the evidence bundle. Preserve inputs, timestamps, verdicts and ledger observations. Exporting local receipts does not establish dashboard classifications.
6. On PRISM's Guardrails page, show **Block Check**, compare its classification with actual downstream behavior, and explain whether it is correct.
7. On PRISM's Root Cause page, show a cluster containing at least three failed or blocked runs, its cause, and an explanation of the repeated failure.

Keep risky inputs fictional and free of personal financial details. The Risk lab does not submit orders, alter holdings or call a broker. Its benign control tests useful analysis through the same gate; it does not bypass enforcement to manufacture a success.

## Yahoo portfolio demonstration

The [guided desk](https://mandate-investment-desk.pranav4096.chatgpt.site/?demo=1) provides a separate paper account for the longer product demonstration. Its quotes and history are actual Yahoo observations.

1. Start a session with $250,000 paper cash and no holdings. Read the market state and provider timestamp.
2. Generate Microsoft research from the buy-and-hold historical strategy. Inspect the date range and Yahoo citation. This is a labeled deterministic calculation, separate from Nicrron inference.
3. Open **Strategies** to compare buy-and-hold, the 20/50-day moving-average rule and 20-day momentum. Earlier dates support historical inspection; a past quote cannot authorize a current fill.
4. Propose one MSFT share and inspect its exact Yahoo reference, evidence and mandate checks. Approve the proposal separately.
5. If the market is closed, choose **Queue for market open**. Show the queued authorization, unchanged cash and no fill. If the market is eligible and all checks pass, execute a paper order and inspect its actual fill receipt.
6. Show the audit record and export it. A queued request can be canceled before execution. Restarting the isolated session cancels its pending demo orders.

Queue authorization expires after seven days and permits at most 1% drift from the approved reference. The processor rechecks the quote, mandate, evidence and ledger. Periodic processing does not promise the exchange's opening price or execution at exactly 9:30 a.m. Missing observations never become invented prices. See [the queue contract](YAHOO-QUEUE.md).

## Recorded judging evidence — October 17, 2026

A controlled baseline completed 50 actual Nicrron calls from **18:38:57 to 18:40:00 UTC**. The new PRISM rule, **Mandate financial authority boundary**, was then created at **18:40:19 UTC**. A second 50-run cohort repeated the same inputs and frozen Yahoo context with that rule active, completing at **18:41:33 UTC**. [Comparison and chronology](../public/proofs/cohort-comparison.json)

| Observed result | Baseline | Protected |
| --- | ---: | ---: |
| Actual runs | 50 | 50 |
| Risky requests reaching Nicrron | 38 | 0 |
| Risky requests blocked before Nicrron | 0 | 38 |
| Benign analyses completed | 12 | 12 |
| Trace submissions acknowledged | 50 | 50 |
| Span submissions acknowledged | 50 | 50 |
| Paper ledger changed | No | No |

These are **four fixed requests repeated across each cohort**, not 50 unique scenarios or a broad safety benchmark. The baseline used a read-only shadow harness that skipped only the pre-model gate and exposed no order tools. Its model safety prompt remained in place. A risky request reaching the model demonstrates the missing application boundary; it does not establish that the model produced harmful advice. Both cohorts used the same [frozen Yahoo observations](../public/proofs/yahoo-cohort-snapshot.json), identified by their recorded snapshot hash. Raw [baseline](../public/proofs/baseline-cohort.jsonl) and [protected](../public/proofs/protected-cohort.jsonl) receipts retain the inputs, outcomes and trace IDs.

PRISM's reconciliation API independently classifies **all 38 protected blocks as honoured**, with reason `no_downstream_execution`. That agrees with the actual zero model calls and absence of downstream model spans. Retrieval and ledger-read spans did not execute an order. This is verified API readback, not a captured PRISM dashboard presentation. [Block Check evidence](../public/proofs/block-check.json)

PRISM's completed Root Cause job produced two clusters. The relevant cluster, `e2e3b648-f936-4afd-92fd-71789e54d6f9`, contains **53 members** and reports cause `prompt`, evidence tier `needs_review`, and judge status `credential_error`. Its heuristics combine failed-tool, termination and unsupported-answer signals; intentional guardrail stops can also trigger these signals. Treat the cause as a tentative classification requiring review, not a confirmed prompt defect or remediation diagnosis. [Cluster details](evidence/root-cause-e2e3b648-f936-4afd-92fd-71789e54d6f9.json), [completed job](evidence/cluster-status.json)

Six current protected-cohort blocks were independently matched to that cluster through PRISM trajectory details, exact caller trace IDs and session IDs. The matches cover all three risky request types. Examples are `d0583824-1964-49c9-a41c-f1e40050da5f` (approval bypass), `22bc5240-6ffc-4465-bcd4-5e32159696ad` (guaranteed returns) and `cbfecd6f-523c-45e5-bde1-b6609b16d2e8` (concentration override). The matched runs share disallowed financial requests; the gate stopped them before Nicrron, while PRISM represents the denied gate as a failed tool step. [Verified membership and receipts](evidence/root-cause-current-members.json)

The ten selected deep analyses finished with zero successes and ten failures. PRISM's trace detail reports an upstream Anthropic `401` with `invalid x-api-key`, separate from functioning Nicrron inference and PRISM guardrails. A cluster was nevertheless generated from trajectory evidence. This does not repair the upstream analysis or establish an AI-confirmed cause. The actual PRISM dashboard presentation remains to be captured. [Analysis outcome](evidence/analysis-status.json), [provider error](../public/proofs/analysis-provider-error.json)

The actual app was also exercised for all three blocked cases and a benign Nicrron analysis. Captured screens show the [final Risk lab](evidence/risk-lab-final-desktop.png), [approval-bypass block](evidence/risk-lab-bypass-approval.png), [concentration block](evidence/risk-lab-concentration-breach.png), [benign analysis](evidence/risk-lab-sourced-analysis.png), [cohort comparison](evidence/cohort-comparison.png) and [PRISM API proof readback](evidence/prism-proof-readback.png). These are Mandate screens, not PRISM dashboard screenshots. The [portable Root Cause artifact](../public/proofs/root-cause.json) contains the actual cluster and six member joins. A recorded benign run is `6fa7759b-39f7-4dff-a42e-a5489a16add2`.

Current checks passed **130 unit tests**, **23 browser cases**, TypeScript checking and a production build. The earlier Yahoo-only revision covered a live strategy → proposal → approval → closed-market queue → cancellation rehearsal. Reopening used controlled provider fixtures; Saturday verification did not observe an actual market reopening. [Earlier queue verification](YAHOO-QUEUE.md)

Earlier development receipts include PRISM block `80288ef5-24af-49be-a081-aa7db80cd4ba` and three further blocks: `0d83e43e-b403-45e8-a1a4-6ebb70eafbf2`, `8df6c6aa-da8b-4997-b9ed-94766828549e`, and `694c615b-4f66-4845-b9fc-19bd2e81cd94`. These belong to the retired synthetic-price revision. They establish historical integration behavior, not current Yahoo fills, pre-model Risk lab behavior, dashboard Block Check or a Root Cause cluster.

## Remaining submission evidence

| Required artifact | Recorded status |
| --- | --- |
| Current finance-risk guardrail blocking before a model call, with matching trace | Verified: 38 actual cohort blocks and live app receipts |
| PRISM Block Check classification and correctness assessment | API verified: all 38 honoured; dashboard screenshot or presentation still needed |
| Root Cause cluster containing at least three failed or blocked runs | Actual 53-member cluster with six verified current blocked members; cause needs review and dashboard presentation remains outstanding |
| At least 50 actual runs before remediation | Verified controlled baseline before new rule creation; four repeated inputs, not production traffic |
| Current benign Nicrron control | Verified: 12 protected cohort completions and actual app analysis |
| Current complete browser rerun and production build | All 23 browser cases and production build passed |
| Team names, roles and judge access | Human details and access arrangements remain outstanding |

Record the commit, run IDs, timestamps and dashboard artifacts when updating this table. Seeded records, copied rows and browser mocks do not count as provider runs. A successful trace upload does not establish a block, a dashboard verification or a cluster.
