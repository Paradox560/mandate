# Mandate three minute judging presentation

Open [the Risk walkthrough](https://mandate-investment-desk.pranav4096.chatgpt.site/?judge=1) in the owner's signed-in session. Keep the [cohort comparison](../public/proofs/cohort-comparison.json), [PRISM reconciliation readback](../public/proofs/block-check.json), [Root Cause cluster](evidence/root-cause-e2e3b648-f936-4afd-92fd-71789e54d6f9.json) and actual PRISM pages ready. Block Check is API verified. Root Cause produced an actual cluster with a tentative cause requiring review; dashboard captures remain outstanding. Use [DEMO.md](DEMO.md) for the evidence record.

## 0:00 to 0:25 — The financial problem

> “A small investment team can get an AI answer in seconds. The harder question is whether that answer should be allowed to cause an action. Mandate joins dated research, explicit trading permissions and a record of what an agent was prevented from doing.”

Show the Risk lab. Identify the request, enforcement boundary and receipt before running anything. The account is paper; the market observations come from Yahoo.

## 0:25 to 1:10 — The risk and the guardrail

Select **Guaranteed returns** and read its request to promise a 20% MSFT return with no risk of loss. Choose **Run risk check**. Show **PRISM gate response**, **Nicrron model calls** and **Paper ledger**, then copy the trace ID.

> “This request is evaluated before Nicrron receives it. The receipt distinguishes a remote block from an outage and lets us inspect whether downstream work happened.”

For a real evaluated block, show zero downstream model calls and the unchanged ledger. If evaluation is unavailable, describe the fail-closed state accurately and retry later. Do not call that a verified PRISM block.

## 1:10 to 1:45 — Useful work still gets through

Select **Cited market analysis** and choose **Run benign analysis**. Show its permitted verdict, actual Nicrron model information, dated Yahoo context and resulting answer.

> “The same gate permits a normal research request. The result is tied to these observations and dates; it does not invent a quote or authorize an order.”

Keep provider latency visible. If the call fails, explain the failure. A previously captured genuine receipt can support the presentation if clearly identified as an earlier run; a sample cannot be described as live.

## 1:45 to 2:35 — Independent PRISM proof

Show the recorded comparison: the baseline ran before the new guardrail, using a read-only harness with no order tools and the model's safety prompt retained. Four fixed requests were repeated across each 50-run cohort; this is a narrow control test, not a broad safety benchmark.

> “Before the gate, 38 risky requests reached the model. With the gate, all 38 stopped before it; all 12 ordinary research requests still completed. PRISM's reconciliation API classifies those blocks as honoured, which matches the zero downstream model calls.”

Open the matching PRISM trace and Guardrails Block Check if the dashboard is available. Otherwise identify the captured JSON as API readback, not a dashboard screenshot. Explain the limitation directly:

> “PRISM produced a 53-member cluster, and we matched six current blocked runs to it. These requests share disallowed financial intent; our gate stopped them before Nicrron. PRISM records those stops as failed tool steps. Its prompt classification needs review because the AI judge could not run, so we do not treat that label as a confirmed defect.”

Show three of the [six verified member mappings](evidence/root-cause-current-members.json), one for each risky request type, with their exact trace IDs. The [provider error](../public/proofs/analysis-provider-error.json) explains the unavailable AI diagnosis; it is not evidence that the application guardrail failed. Keep PRISM's classification and our interpretation distinct, and do not claim its diagnosis is fixed or confirmed.

## 2:35 to 3:00 — The surrounding product

Show a previously created, genuinely queued Yahoo paper order in the guided desk, or show the order workflow without claiming an outcome that has not occurred.

> “A reviewer approves the exact terms. When the market is closed, a separate authorization lets the order wait. A fresh eligible Yahoo quote, a price within the approved tolerance and passing risk checks are required before a paper fill. The team can inspect or cancel the request while it waits.”

Close on the audit export: research source, request, decision, authorization and actual outcome. This is the evidence an investment team can review when adopting an agent.

## Preparation

- Keep the actual risky and benign receipts and the 50-run comparison ready. The [captured app screens](DEMO.md#recorded-judging-evidence--october-17-2026) provide a genuine prior-run reference if a live call fails.
- Retain the baseline chronology: it completed before rule creation. Label the four repeated inputs and read-only harness; do not claim broad model safety or historical production failures.
- Arrange judge access to the private site and repository, and verify the signed-in presentation session.
- Use the [submission draft](SUBMISSION.md) for project text, team fields and artifact links. Screenshots or recording support the live presentation; they do not replace it.

For a longer tour, use [the Yahoo guided desk](https://mandate-investment-desk.pranav4096.chatgpt.site/?demo=1): start the isolated account, create a historical strategy memo, inspect its source, propose one share, approve, then explicitly queue or execute according to the actual market state. The demo cannot open a closed market or manufacture a fill.
