# Mandate — Yahoo workflow presentation

Present from the owner’s signed-in session. Open [the guided desk](https://mandate-investment-desk.pranav4096.chatgpt.site/?demo=1). The demo has its own paper portfolio but uses actual Yahoo quotes and history. No broker or real-money account is connected.

1. **Start the guided session.** Show $250,000 of paper cash, zero holdings, and the Yahoo quote timestamp. Explain that a closed market shows the latest available close.
2. **Create Microsoft strategy research.** Use the buy-and-hold strategy for a predictable long signal. The memo cites actual daily Yahoo observations and states its date range. Deterministic strategy calculations are labeled as such; do not describe them as a Nicrron model response.
3. **Inspect the evidence.** Open the source citation and its date. Open **Strategies** to compare buy-and-hold, 20/50-day trend, and 20-day momentum. The chart supports previous-session inspection. Results are historical calculations with disclosed costs and assumptions, not forecasts or account profit.
4. **Propose one MSFT share.** Show its Yahoo reference price and actual permission checks. This creates an order request without changing cash or holdings.
5. **Approve the order.** Show the separate approval receipt. Approval is bound to the exact proposal; it is not an executed trade.
6. **Show the real market state.** During a closed session, choose **Queue for market open**. Explain the seven-day authorization and 1% price tolerance. Show **Queued**, unchanged cash, and zero fills. During an eligible open session, choose **Execute paper order** and inspect the actual Yahoo fill receipt. Do not claim a fill unless the ledger records one.
7. **Inspect the audit.** Show the proposal, approval, and queue or execution event. Export JSON if you want a portable record. A queued order may be canceled before execution.

Suggested narration:

> “Mandate connects historical research to a controlled action. The research has dated sources, the order uses a Yahoo reference, and the reviewer authorizes its size. Outside trading hours it waits. When a fresh opening-session quote arrives, it checks the price and risk again before recording a paper fill.”

The browser checks eligible queues while open. The linked background processor checks while the browser is closed; processing is periodic and does not guarantee the exchange’s exact opening price. If a price gaps beyond 1%, the mandate changes, or evidence no longer passes, the order needs review. Missing or stale data never becomes a synthetic substitute.

If Yahoo or PRISM is unavailable, leave the actual error or waiting state visible and retry later. A successful historical result does not establish that present-day execution is available. Restarting the isolated demo cancels its pending demo orders, so do not restart a session whose opening behavior you intend to show later.

Earlier synthetic-demo rehearsal receipts are historical development records. That price mode and its orders have been retired from the application.
