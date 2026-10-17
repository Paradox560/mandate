# Mandate

Evidence-linked approvals for AI-generated equity orders, built for small public-equity funds. Mandate carries a research note's sources into a proposed order, checks the investment mandate, records approval of the exact proposal and writes an auditable paper fill.

**Paper trading only.** All prices, chart history and portfolio balances are simulated. Five evidence records come from three historical issuer releases and use an explicit **August 29, 2025** research date. Current timestamps describe application activity and quote generation; they do not make the market or disclosures live. There is no broker connection or real-money execution.

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

After changes, `npm run build` produces the Worker build. `npm start` serves that build through local Wrangler; it does not publish a deployment. The stack is React, TypeScript, Vinext, Cloudflare Workers and D1.

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
npm run test:workflow -- --live
npm run test:browser
node scripts/verify-guardrails.mjs
```

The workflow check makes real application requests, creates paper orders and retains their audit history. It checks denied execution without approval, one fill under concurrent execution attempts, blocked adversarial scenarios and cross-origin rejection. `--live` also uploads the source corpus and requests Nicrron research. Both workflow variants probe configured connections and can contact providers. Use a disposable demo workspace: this is not a read-only test. `MANDATE_URL` can select another reachable instance.

The guardrail script requires enforcement, creates three actual oversized-order runs and checks remote blocks against an unchanged ledger. Dashboard Block Check and Intelligence clustering still require inspection. Browser checks use Playwright; install its Chromium browser with `npx playwright install chromium` if needed. Check [the demo record](docs/DEMO.md) for completed and outstanding verification; a command's presence is not a passing result.

## Recorded integration verification

The latest interface verification passed **47 unit tests**, **12 Playwright tests** (38.8 seconds), ESLint and TypeScript checking. The browser suite includes the seven research/order/blocked-workflow checks plus five interaction checks for keyboard charts, selected states, mobile focus and drawer motion. Workflow coverage includes a live, PRISM-enforced MSFT buy-one proposal → approval → execution with exactly one fill and an oversized order denied with an unchanged ledger. See the [UI refinement record](docs/UI-REFINEMENT.md) for screenshot coverage, final targeted polish verification and diagnostic limits. These are build-session results, not ongoing monitoring.

On **October 17, 2026**, the build session verified live Nicrron and PRISM provider requests. A real PRISM custom rule, **Mandate blocked order**, blocked an oversized-order scenario with enforcement enabled. The portfolio revision remained **2**, with trace ID `80288ef5-24af-49be-a081-aa7db80cd4ba`. This is one recorded blocking check, not proof of every hackathon requirement.

The permission layer checks quantity and side, symbol allowlist, quote freshness, price drift, order value, cash/inventory, concentration and source validity. Approval is bound to order parameters, mandate and portfolio versions, and expires. A database compare-and-swap prevents concurrent requests from recording two fills. Sample records do not stand in for successful provider calls or tests.

## Project notes

- [Product and confirmed initial customer](PRODUCT.md)
- [YC startup shortlist for all three tracks](docs/YC-STARTUPS.md)
- [YC thesis: Hudson Labs research + Alter permissions](docs/YC-THESIS.md)
- [Integration setup and remote enforcement semantics](docs/INTEGRATIONS.md)
- [Demo, source links and proof checklist](docs/DEMO.md)
- [Design tokens and interface guidance](DESIGN.md)

This prototype has no asserted customers, revenue, investment performance or production authorization guarantees.
