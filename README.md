# Mandate

Evidence-linked approvals for AI-generated equity orders, built for small public-equity funds. Mandate carries a research note's sources into a proposed order, checks the investment mandate, records approval of the exact proposal and writes an auditable paper fill.

**Paper trading only.** Yahoo Finance is the only price source for orders and quotes. The desk refreshes once a minute and displays provider timestamps. A new account has $250,000 in paper cash and no seeded holdings or orders. Historical Yahoo strategies support cited research; approval and explicit queue authorization allow pending paper orders to wait for the next eligible regular-market quote. No brokerage is connected. See [Yahoo orders, queues, and historical strategies](docs/YAHOO-QUEUE.md).

For MONEY TALKS 2, Mandate enters **Trust & Risk**: **a cited answer is not permission to trade**. The Risk Lab evaluates real financial requests in PRISM before Nicrron runs, records the same trace ID, and reads back the paper ledger. See the [official judging map](docs/JUDGING.md) and [submission draft](docs/SUBMISSION.md).

## Run locally

Requires Node **22.13 or newer** and npm. Run from this directory:

```sh
npm install
npm run setup
npm run dev -- --port 5187
```

`setup` creates `.dev.vars` from the empty example only if it is missing, builds the application and applies local D1 migrations. Fill the server-side credentials in `.dev.vars` before testing providers; preserve an existing populated file. Open [the local desk](http://127.0.0.1:5187). Local database state persists under `.wrangler/state`.

The app provides clearly labeled sample research without provider credentials. Live research requires `NICRRON_API_KEY`; PRISM requires `PRISM_API_KEY` and `PRISM_PROJECT_ID`. Set `PRISM_ENFORCE=true` with a configured, working guardrail. Enforcement denies dependent work when evaluation fails or is unavailable. The empty example defaults to `false`; the verified demonstration environment uses `true`. See [integration contracts and setup](docs/INTEGRATIONS.md).

Yahoo prices need no API key. The six company logos are already cached in `public/logos`; `npm run logos:sync` uses `TWELVE_DATA_API_KEY` from `.dev.vars` only for missing assets. Loading the application makes no logo API calls. Never commit `.dev.vars`. See [logo provenance and refresh](docs/LOGOS.md).

After changes, `npm run build` produces the Worker build. `npm start` serves that build through local Wrangler; it does not publish a deployment. The stack is React, TypeScript, Vinext, Cloudflare Workers and D1.

## Present the workflow

Start with the [judge walkthrough](https://mandate-investment-desk.pranav4096.chatgpt.site/?judge=1). Run a guaranteed-return or approval-bypass request, inspect the gate, model-call count, source snapshot and unchanged ledger, then run the permitted cited-analysis case. Risk Lab stores the actual receipts and exports JSON. PRISM Block Check and Root Cause are separate provider evidence; their recorded status never follows from a local test alone.

Open [the guided presentation](https://mandate-investment-desk.pranav4096.chatgpt.site/?demo=1) while signed in, or use **Guided demo** from the desk. The guide uses an isolated paper account and the same actual Yahoo observations as the main desk. Create a historical strategy memo, inspect its source, propose one share, approve it, then execute during an eligible open session or explicitly queue it while closed. The guide shows the actual waiting state; it cannot simulate an opening or manufacture a fill.

Starting or restarting the guide affects only the isolated account. The site remains private; present from your signed-in session. Follow the [presenter script](docs/PRESENTATION.md).

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The unit suite exercises permission boundaries and integration response handling. With the local server running:

```sh
npm run test:workflow
npm run test:browser
node scripts/verify-guardrails.mjs
```

The workflow check uses the isolated demo workspace and actual Yahoo requests. It creates strategy research, proposes and approves an order, verifies queue-and-cancel behavior when the market is closed or an actual paper fill when open, checks an oversized proposal, and proves the main desk is unchanged. It can contact configured PRISM. `MANDATE_URL` selects the local instance. This is not a read-only check.

The guardrail script requires enforcement and an existing current strategy memo in the demo. It creates one actual Yahoo-priced oversized proposal and checks the remote block against an unchanged ledger. Use Risk Lab and the recorded evidence packet for the current pre-model gate, Block Check and Root Cause proof status. Browser checks use Playwright; install its Chromium browser with `npx playwright install chromium` if needed. Check [the demo record](docs/DEMO.md) for completed and outstanding verification; a command's presence is not a passing result.

## Current verification

The judging update passed **130 unit tests**, **23 browser cases**, TypeScript checking and a production build. Actual browser runs verified two financial blocks with zero model calls and a permitted Nicrron analysis with one call, all with an unchanged paper ledger. Ordinary research and connection diagnostics also enforce PRISM before inference when enabled.

A controlled 50-run shadow baseline completed before the finance rule was created; 50 protected requests replayed the same Yahoo snapshot. Four fixed inputs were repeated: 38 risky requests and 12 benign controls per cohort. Risky requests reaching the model fell from 38 to zero; all 12 protected benign requests completed. All 100 traces and span batches were acknowledged. This measures the defined permission boundary, not general model safety or investment performance. [Raw comparison](public/proofs/cohort-comparison.json)

PRISM independently classified all 38 blocked cohort runs as **honoured**. Its deeper analysis reported an upstream AI credential error; the Root Cause evidence records the provider's actual cluster and limitations rather than treating its tentative diagnosis as confirmed. See [the evidence record](docs/DEMO.md).

The Yahoo-only trading checks remain covered: fresh observations, historical strategies, human approval, bounded closed-market queues, expiry and duplicate-fill protection. An actual reopening was not observed during Saturday testing. See [the queue verification record](docs/YAHOO-QUEUE.md).

## Earlier recorded integration verification

The records below describe earlier revisions, including the retired synthetic demo. They are historical verification receipts, not the current Yahoo-only workflow. See [current queue behavior](docs/YAHOO-QUEUE.md).

The guided-demo update passed **79 unit tests**, **20 distinct browser cases**, and TypeScript checking. Its real Nicrron → proposal → human approval → paper fill → PRISM block rehearsal preserved the main desk. See [the presenter script and recorded rehearsal](docs/PRESENTATION.md).

The market-data update passed **68 unit tests**, **16 Playwright tests** (44.2 seconds), and TypeScript checking. Browser coverage includes source selection, dated bars, all six logo assets, missing-price valuation and late-response handling, plus the existing chart, mobile navigation and evidence drawer interactions. Workflow coverage includes a live, PRISM-enforced replay MSFT buy-one proposal → approval → execution with exactly one fill and an oversized order denied with an unchanged ledger. See the [market-data record](docs/MARKET-DATA.md) and earlier [UI refinement record](docs/UI-REFINEMENT.md). These are build-session results, not ongoing monitoring.

On **October 17, 2026**, the build session verified live Nicrron and PRISM provider requests. A real PRISM custom rule, **Mandate blocked order**, blocked an oversized-order scenario with enforcement enabled. The portfolio revision remained **2**, with trace ID `80288ef5-24af-49be-a081-aa7db80cd4ba`. This is one recorded blocking check, not proof of every hackathon requirement.

The permission layer checks quantity and side, symbol allowlist, quote freshness, price drift, order value, cash/inventory, concentration and source validity. Approval is bound to order parameters, mandate and portfolio versions, and expires. A database compare-and-swap prevents concurrent requests from recording two fills. Sample records do not stand in for successful provider calls or tests.

## Project notes

- [Judging criteria and exact requirements](docs/JUDGING.md)
- [Devpost submission draft](docs/SUBMISSION.md)
- [Product and confirmed initial customer](PRODUCT.md)
- [YC startup shortlist for all three tracks](docs/YC-STARTUPS.md)
- [YC thesis: Hudson Labs research + Alter permissions](docs/YC-THESIS.md)
- [Integration setup and remote enforcement semantics](docs/INTEGRATIONS.md)
- [Market data sources, timestamps and permissions](docs/MARKET-DATA.md)
- [Company logo provenance and refresh](docs/LOGOS.md)
- [Demo, source links and proof checklist](docs/DEMO.md)
- [Design tokens and interface guidance](DESIGN.md)

This prototype has no asserted customers, revenue, investment performance or production authorization guarantees.
