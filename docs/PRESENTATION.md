# Mandate — three-minute presentation

Show one complete decision: a cited research memo becomes a reviewed paper order; a second, oversized action is stopped before it changes the ledger. Aim for three minutes of presentation time, allowing extra time for provider responses. Proceed only when the expected proof is visible.

**Before sharing your screen**

- Sign in as the owner and open the app with `?demo=1` appended to its base URL. Present from this signed-in session by screen sharing. The private app URL is not a public audience link.
- Confirm the isolated demo indicator is visible. Start or restart through the guide's explicit demo control. This demo portfolio is separate from the main paper portfolio; do not use the main workspace reset for rehearsal.
- Open **Connections → Test connections** and inspect the actual result. Confirm **Guardrail enforcement: Enabled**, review the latest PRISM delivery status, and check Nicrron. A **Configured** badge only confirms a key is present. A connection test is preparation; the proposal and execution still need their own successful checks.
- Keep the guided demo in **Synthetic replay**. The main desk can display Yahoo prices, but this presentation uses simulated prices and issuer evidence assessed as of **August 29, 2025**. It remains usable on weekends without presenting a previous session's quotes as live trading data.
- Rehearse the sequence once. Export anything you want to keep before restarting the isolated demo. Leave API keys and provider settings out of the screen share.

**The presentation**

1. **0:00–0:20 · Start the isolated demo.** Click **Start guided demo** and show its replay and paper-environment labels.

   **Say:** “Mandate is a permission desk for a small investment team. An agent can research and propose; a reviewer authorizes the exact order. Today we are using an isolated paper portfolio, simulated prices, and historical 2025 evidence. No real funds move.”

   **Show:** The demo indicator, synthetic price source, and initial cash and holdings. Starting the demo must not replace the main portfolio.

2. **0:20–0:55 · Generate Microsoft research.** Click **Generate demo research** in the guide; it opens **Research** with **MSFT** selected. Use the prompt: “Summarize Microsoft's FY2025 Q4 results and Azure disclosure. Cite each factual claim and separate interpretation from facts.” Wait for the returned memo.

   **Say:** “Nicrron prepares a research memo from our source corpus. The result identifies its model and the evidence supporting each factual claim.”

   **Show:** A newly returned memo with **Nicrron inference**, the model, and numbered source references. If inference fails, use the guide's explicit sample fallback only if you choose to continue. Say, “This is a prepared sample memo; the live inference request did not succeed,” and show its **Sample research** label.

3. **0:55–1:15 · Inspect a citation.** Click **Open demo source** in the guide. In the evidence drawer, point to the Microsoft release title, publication date, reporting period, and excerpt; then close it.

   **Say:** “This claim resolves to Microsoft's July 30, 2025 disclosure. The source date stays visible. Cited-claim coverage measures source support, not investment confidence or expected returns.”

   **Show:** The actual issuer link and historical excerpt, including the relevant revenue or Azure fact. A newly generated memo must not make an old source look current.

4. **1:15–1:35 · Propose one share.** After opening the source, click **Propose 1 MSFT share** in the guide. Open the resulting **Order review** if the guide has not already taken you there.

   **Say:** “A proposal is a request for permission. Before it can execute, Mandate checks the amount, portfolio exposure, evidence, and execution authority.”

   **Show:** **Buy 1 MSFT**, its synthetic price source, cited research, and actual permission-check results. Look for the current PRISM enforcement result. The order should await review; cash and share counts have not changed.

5. **1:35–1:55 · Approve and execute the paper order.** Click **Approve demo order**. Show the approval receipt, then click **Execute demo paper order** and wait for its result.

   **Say:** “My approval is bound to this order and the current portfolio and mandate versions. Execution checks permission again before recording a paper fill.”

   **Show:** The approval receipt followed by **Executed** and a **Paper fill** receipt. In **Overview → Positions**, verify MSFT increased by exactly one share and cash decreased by the recorded fill amount. Note these post-fill balances for the next step. A click or success toast alone is not the proof.

6. **1:55–2:30 · Stop an oversized action.** Click **Run oversized demo order** in the guide. Wait for the newly created order and inspect its failed checks.

   **Say:** “Now the agent requests more than the mandate permits. The request is blocked at the execution boundary. This is a new run, not the seeded blocked example.”

   **Show:** The new order's **Blocked** status, failed order-notional check, and the actual PRISM enforcement result. Return to the portfolio and confirm the cash, share counts, and fill count remain at their post-fill values. Do not use NAV movement as evidence: replay prices can move even when no order executes.

7. **2:30–2:55 · Inspect and export the record.** Open **Audit trail**. Find the recent approval, paper execution, and blocked scenario; expand their detail arrows. Click **Export demo evidence** in the guide (or **Export JSON** in the audit view).

   **Say:** “The record connects the research, decision, and outcome. We can inspect the order and trace IDs and export the evidence of what actually happened.”

   **Show:** Current-run timestamps, decision reasons, order and trace IDs, the recorded fill, and the downloaded JSON. Distinguish an actual PRISM evaluation from a local record or failed delivery. This walkthrough does not establish a PRISM dashboard failure cluster or evaluator result.

8. **2:55–3:00 · Close.** Leave the blocked decision or its audit details on screen.

   **Say:** “The useful boundary is between a plausible research answer and an authorized action. Mandate makes that decision inspectable.”

**If a provider is unavailable**

Keep the actual error visible and describe it plainly. The explicit sample memo can replace only the research portion. It cannot stand in for a successful Nicrron response or a PRISM receipt. With PRISM enforcement enabled, an unavailable enforcement service prevents completion of the live approval/execution path. Keep enforcement enabled, stop that stage, and retry when the service is available. An unavailable-service block is not proof that PRISM detected the oversized-order rule.

**Repeat for another audience**

Export the current demo record first if needed. While the isolated demo indicator is visible, use its explicit restart control and confirm the demo reset. Restart only this isolated portfolio; the main paper portfolio remains separate. Begin a fresh run and show its new receipts rather than presenting prior-run records as new activity.


**Recorded rehearsal — October 17, 2026**

The full guided browser rehearsal completed with a real Nicrron MSFT memo, separate human approval, one MSFT paper fill at the synthetic price of $510.32, and an oversized NVDA order blocked by the configured PRISM rule. The main desk state remained unchanged. Research trace: `ba18977f-2292-4d47-a8a0-0a5f2485ed51`; oversized-order trace: `2d46b23d-9895-418e-a55c-0b1a45bf4129`. These are recorded local rehearsal results using configured providers, not continuous monitoring.

Validation passed 79 unit tests and 20 distinct browser cases (19 in the full suite plus the added research-failure case). The failure case verified that an unsuccessful research call cannot advance the guide and that selecting a sample remains an explicit presenter action. Desktop and mobile layouts were inspected.
