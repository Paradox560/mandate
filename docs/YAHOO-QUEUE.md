# Yahoo paper orders and historical strategies

Mandate uses Yahoo Finance observations for every new order. There is no synthetic price mode or broker connection. Cash is a paper balance; quotes and history are provider observations.

## Closed markets

1. Review the latest completed Yahoo history in **Strategies** and create a source-linked research note.
2. Propose a whole-share order. Outside regular hours, the latest valid close is a reference price, not a fill.
3. Approve the exact order, then explicitly choose **Queue for market open**. Approval alone does not schedule an execution.
4. The queue waits until Yahoo reports an open regular session and provides a sufficiently fresh quote. The first eligible processor check can record a paper fill.

Queue authorization lasts seven calendar days and permits at most 1% price drift from the approved reference. It binds the symbol, side, quantity, source, reference price, evidence, mandate version, and expiration. Changing these terms requires another review. Each fill rechecks cash, inventory, position limits, current source evidence, and configured PRISM enforcement. Several queued orders cannot independently spend the same cash: successful fills advance the portfolio revision and subsequent orders check the updated ledger.

Closed markets, missing prices, or stale observations do not cause fabricated fills. Price gaps beyond the approved tolerance and changed mandates require review. Expired or canceled requests cannot execute. A database compare-and-swap protects against concurrent or repeated processors recording the same fill twice.

The open application checks its queue periodically. The linked Sites schedule invokes the same bounded processor while the browser is closed. This is periodic paper processing, not a broker market-on-open order or a promise to obtain the exchange's opening price. The recorded Yahoo quote timestamp and actual processing time are retained separately.

## Historical analysis

The Strategies view requests two years of daily Yahoo history. Buy-and-hold, a 20/50-day moving-average rule, and 20-day momentum are deterministic comparison rules. Signals use available completed observations and take effect in a later session. No future observation is used to decide an earlier trade. Missing bars are not filled with invented prices.

The view states its price-adjustment method, transaction-cost assumption, evaluation period, and signal. Historical results are hypothetical strategy calculations on actual past observations. They are neither the paper account's realized performance nor predictions. Selecting an earlier date lets you inspect an earlier analysis; it does not authorize a current order using a past quote. Current proposals require an analysis generated from the latest available completed session, followed by current Yahoo execution checks.

The earlier issuer disclosures remain dated research sources. Their dates are not advanced to make them pass current evidence policy. Yahoo history produces its own dated citation and provenance; Nicrron interpretation cannot replace the server's canonical evidence.

## Existing accounts

A versioned migration removes synthetic orders and seeded holdings. It rebuilds the paper account from its $250,000 starting cash and verifiable Yahoo fills, preserving Yahoo order records. An audit receipt records what was removed or excluded. A legacy Yahoo sell that depends on synthetic starting inventory cannot manufacture new inventory during this rebuild; any excluded fill remains identified for inspection.

## Unattended processor contract

The published Site remains owner-private. Sites dispatch authenticates service access before requests reach the Worker. The shared processor has no user-ID, order-ID, approval, policy, or price parameters. It can only consider orders whose authenticated owner explicitly granted bounded queue authorization. It cannot propose or approve new orders.

- Discover: `GET /api/queue/process` returns the safe operating contract.
- Execute: `POST /api/queue/process` with an empty body.
- Read back: `GET /api/queue/status` returns the last persisted aggregate outcome and timestamps, without private positions or order IDs.

A runner lease limits overlapping background batches; per-workspace compare-and-swap remains the ledger authority. Failed runs are recorded and do not loosen order checks. Future cloud tasks obtain the current Site service credential from `get_site` and send it only to this Site in `OAI-Sites-Authorization`. Tokens are never stored in source, browser bundles, or schedule prompts. Do not expose this service endpoint by changing the Site's audience without reassessing its authorization boundary.

## Provider timing

The app polls Yahoo rather than subscribing to a licensed execution feed. Provider timestamps determine quote age. Yahoo describes real-time availability by exchange and session in its [data-provider list](https://help.yahoo.com/kb/finance/article-exchanges-data-delays-sln2310.html). Refreshing every minute is not a guarantee of tick-by-tick delivery. Normal US equity core hours are 9:30 a.m.–4:00 p.m. Eastern, with exchange holidays and early closes; execution uses Yahoo's supplied session interval, not a weekday-only timer. See the [NYSE calendar](https://www.nyse.com/markets/hours-calendars).

## Verification — October 17, 2026

The update passed 110 unit tests, 18 browser cases, TypeScript checking, and a production build. Actual Yahoo requests returned 501 completed daily sessions per symbol through October 16, 2026. Desktop and mobile screens were inspected without horizontal overflow or client errors.

The live local workflow generated MSFT history research, proposed and approved one share, explicitly queued it during the closed session, verified unchanged cash/positions, canceled the queue, and obtained a real PRISM block for an oversized Yahoo-priced proposal. Main-desk state remained unchanged. The unattended endpoint rejected cross-origin requests and injected parameters, handled overlapping calls, and persisted its aggregate readback. Reopening fills, price gaps, concurrent fills, expiry, and queue fairness were verified with controlled provider fixtures; no actual market reopening was claimed during Saturday verification.
