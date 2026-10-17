# Mandate

Evidence-linked approvals for AI-generated equity orders, built for small public-equity funds. Mandate carries a research note's sources into a proposed order, checks the investment mandate, records approval of the exact proposal and writes an auditable paper fill.

**Paper trading only.** Yahoo Finance is the only price source for orders and quotes. The desk refreshes once a minute and displays provider timestamps. A new account has $250,000 in paper cash and no seeded holdings or orders. Historical Yahoo strategies support cited research; approval and explicit queue authorization allow pending paper orders to wait for the next eligible regular-market quote. No brokerage is connected. See [Yahoo orders, queues, and historical strategies](docs/YAHOO-QUEUE.md).

For MONEY TALKS 2, Mandate's primary track is **Trust & Risk**, with **Money Intelligence** as a secondary fit. See the [three-track YC startup shortlist](docs/YC-STARTUPS.md).

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

The guardrail script requires enforcement and an existing current strategy memo in the demo. It creates one actual Yahoo-priced oversized proposal and checks the remote block against an unchanged ledger. Dashboard Block Check and Intelligence clustering still require inspection. Browser checks use Playwright; install its Chromium browser with `npx playwright install chromium` if needed. Check [the demo record](docs/DEMO.md) for completed and outstanding verification; a command's presence is not a passing result.

## Current verification

Yahoo-only orders and strategies passed **110 unit tests**, **18 browser cases**, and TypeScript checking. A live Yahoo → strategy memo → review → approval → closed-market queue → cancellation rehearsal kept the main desk unchanged; PRISM blocked a real Yahoo-priced oversized proposal. Reopening execution is covered by controlled provider tests. See [the current verification record](docs/YAHOO-QUEUE.md).

## Earlier recorded integration verification

The records below describe earlier revisions, including the retired synthetic demo. They are historical verification receipts, not the current Yahoo-only workflow. See [current queue behavior](docs/YAHOO-QUEUE.md).

The guided-demo update passed **79 unit tests**, **20 distinct browser cases**, and TypeScript checking. Its real Nicrron → proposal → human approval → paper fill → PRISM block rehearsal preserved the main desk. See [the presenter script and recorded rehearsal](docs/PRESENTATION.md).

The market-data update passed **68 unit tests**, **16 Playwright tests** (44.2 seconds), and TypeScript checking. Browser coverage includes source selection, dated bars, all six logo assets, missing-price valuation and late-response handling, plus the existing chart, mobile navigation and evidence drawer interactions. Workflow coverage includes a live, PRISM-enforced replay MSFT buy-one proposal → approval → execution with exactly one fill and an oversized order denied with an unchanged ledger. See the [market-data record](docs/MARKET-DATA.md) and earlier [UI refinement record](docs/UI-REFINEMENT.md). These are build-session results, not ongoing monitoring.

On **October 17, 2026**, the build session verified live Nicrron and PRISM provider requests. A real PRISM custom rule, **Mandate blocked order**, blocked an oversized-order scenario with enforcement enabled. The portfolio revision remained **2**, with trace ID `80288ef5-24af-49be-a081-aa7db80cd4ba`. This is one recorded blocking check, not proof of every hackathon requirement.

The permission layer checks quantity and side, symbol allowlist, quote freshness, price drift, order value, cash/inventory, concentration and source validity. Approval is bound to order parameters, mandate and portfolio versions, and expires. A database compare-and-swap prevents concurrent requests from recording two fills. Sample records do not stand in for successful provider calls or tests.

## Project notes

- [Product and confirmed initial customer](PRODUCT.md)
- [YC startup shortlist for all three tracks](docs/YC-STARTUPS.md)
- [YC thesis: Hudson Labs research + Alter permissions](docs/YC-THESIS.md)
- [Integration setup and remote enforcement semantics](docs/INTEGRATIONS.md)
- [Market data sources, timestamps and permissions](docs/MARKET-DATA.md)
- [Company logo provenance and refresh](docs/LOGOS.md)
- [Demo, source links and proof checklist](docs/DEMO.md)
- [Design tokens and interface guidance](DESIGN.md)

This prototype has no asserted customers, revenue, investment performance or production authorization guarantees.
