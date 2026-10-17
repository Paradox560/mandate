# Deploy Mandate on Ninoo

Target project: <https://app.ninoo.ai/p/prj-87b15826d47d>.

The portable Node runtime removes Mandate's dependency on ChatGPT sign-in and Cloudflare D1. The existing Sites deployment and its default npm commands remain unchanged. The target Ninoo project's full-stack preview has been verified through an external browser and API checks: six Yahoo quotes were available, PRISM blocked the guaranteed-returns request before a model call, and benign Nicrron research completed with an acknowledged trace.

**Ninoo Native Publish serves `dist/` as static files; it does not run Mandate's Node backend.** The explicit publish profile below produces a small public entry page that opens the verified [Ninoo workspace preview](https://p-0ddc1537ea56a25c.preview.ninoo.app/), preserving the URL query and hash. The full application continues to run in that workspace. This depends on the workspace staying awake and offers no production uptime or durable backend guarantee. The [public judge entry](https://mandate-4489.ninoo.app/?judge=1) was verified on October 17, 2026: its redirect, code login and loaded Risk Lab passed in a clean external browser. Old server bundles and private file URLs returned 404. See the [publication check](proofs/ninoo/public-entry-check.json).

## Build and run

Use Node.js **22.13 or newer**. Install all dependencies, including build dependencies:

```sh
npm ci
npm run dev:ninoo
```

For production:

```sh
npm run build:ninoo
npm run start:ninoo
```

Both servers listen on `0.0.0.0` and the platform's `PORT` (default `3000`). `npm run build:ninoo` emits a Node server and static client into `dist/`, including `dist/standalone/server.js`. Do not run the Node and Sites builds simultaneously in the same checkout; both use `dist/`. The `:ninoo` commands select `MANDATE_RUNTIME=node` automatically. If a host starts `dist/standalone/server.js` directly, set `MANDATE_RUNTIME=node` in that host's server environment too.

### Ninoo hosts with fixed Node 20

Native Ninoo Publish was observed running `pnpm build` under Node 20.20.2. Enable this explicit host profile **only in the Ninoo checkout**:

```sh
node scripts/prepare-ninoo.mjs --preview-url https://p-0ddc1537ea56a25c.preview.ninoo.app
pnpm install --no-frozen-lockfile
pnpm build
pnpm start
```

Preparation is idempotent. It adds the exact production dependency `node@22.23.3` and adds `node` to `pnpm.onlyBuiltDependencies` so pnpm 10 permits its runtime installer. Existing pnpm settings are retained; an explicit `node` entry in `ignoredBuiltDependencies` is removed. Keep the updated lockfile with the deployment. Source checkouts that have not run preparation retain their original Sites commands. The host wrapper runs the installed Node binary, preserving `PORT` and forwarding stop signals, and loads `.env.ninoo.local` only if present. It never prints environment values or downloads Node at startup. If the pinned binary is unavailable, an already compatible native Node can run; Node 20 receives a setup error requiring dependency installation.

With `--preview-url`, preparation records the validated preview origin in ignored `.ninoo/publish.json` and sets the default build to `scripts/ninoo-publish.mjs`. That script builds the full Node app, copies only its complete standalone runtime into private `.ninoo/server`, and then replaces `dist/` with only `index.html` and the favicon. The static page has a fixed-origin redirect and an obvious fallback link. Server bundles, dependencies, environment files and SQLite state must never be part of public `dist/`. The default start command uses `.ninoo/server/server.js` once staged; restart the preview after staging so it serves from that private location. Native Republish performs another build, so restart the production preview again **after each successful Republish**, without rebuilding, to load the matching server and client asset manifest. A running process from the prior build can otherwise render HTML that never hydrates.

Without a preview URL, preparation selects the ordinary Node host build; that output is **not suitable for Native Publish's static upload**. The unchanged `build:ninoo` command also remains a full Node build intended for a real Node host. Before pressing Native Publish, check that `dist/` contains only the public entry and favicon. After republishing, verify that earlier `/standalone/server.js` and `/server/index.js` URLs return 404 or access denied; an uploader that retains stale objects needs those old objects removed as well.

Private `.env.ninoo.local` files must remain outside Git and public downloads. Prefer server environment controls when the host provides them. Do not rely on a manually installed `/tmp/node22` binary: it may disappear between preview, publish and container restarts. Native Publish must install production dependencies with package install scripts enabled for the pinned binary to be available.

## Ninoo project setup

Sign in to the existing project using the Nicrron/Ninoo account. Use its code upload or repository import controls to install this source. For this project's Native Publish button, activate the explicit `--preview-url` profile above and run the production workspace with `PORT=5173 pnpm start`. Ordinary Node hosts can use the separate `:ninoo` commands. Do not paste the private Sites URL into an iframe: it retains the ChatGPT authentication boundary that caused the reported error.

Ninoo's [official import guide](https://ninoo.ai/switch/) documents ZIP and GitHub imports, one-time access tokens for private repositories, and publishing to a `ninoo.app` address. It describes Vite + React as its primary stack and other frameworks as best effort. The Builder workspace was verified to run the Node server with server-side configuration, outbound HTTPS and writable SQLite storage. Storage across container replacement, unattended uptime and scheduling remain unverified. A static-only deployment cannot operate its API routes.

## Server configuration

Store secrets in the project's server environment controls, never in browser code or the uploaded ZIP. Configure `NICRRON_API_KEY`, `NICRRON_MODEL`, `PRISM_API_KEY`, `PRISM_PROJECT_ID`, `PRISM_AGENT_ID`, and `PRISM_ENFORCE`. Use `PRISM_AGENT_ID=mandate-research` and enable enforcement only with the matching PRISM Block rules configured. `TWELVE_DATA_API_KEY` is optional for the company-logo download script; Yahoo supplies market data.

Configure portable authentication with `MANDATE_SESSION_SECRET` (a random secret of at least 32 characters) and `MANDATE_ACCESS_CODE` (exactly four ASCII digits, or 12–128 characters, shared only with intended demo viewers). Four-digit codes preserve leading zeros and must match exactly. The default `MANDATE_ACCESS_MODE=code` requires that code. `MANDATE_ACCESS_MODE=open` explicitly permits anyone who can open the URL to start a separate demo workspace and consume configured provider credits; choose it only when that access is intended. Sessions expire after 12 hours and each visitor receives an independent workspace, not the Sites owner's records.

Set `MANDATE_DAILY_RUN_LIMIT` to an integer from `1` to `1000` for the shared daily analysis-attempt cap; it defaults to `100`. Each session also has a fixed cap of `20` attempts. Both reset at midnight UTC and survive server restarts on persistent storage. Research, Risk Lab, connection tests and source sync reserve an attempt before execution, including attempts that subsequently fail. A request refused by either cap consumes neither counter. This is a request cap, not a dollar budget: paper-order PRISM checks and traces are separate. Use provider-side spending controls to bound all charges, and keep code-gated access for a limited audience.

Set `MANDATE_DATABASE_PATH` to a SQLite file on a persistent volume, such as `/data/mandate.sqlite`; its default is `./data/mandate.sqlite`. The containing directory is created automatically. Use one application instance per persistent volume. A fresh deployment initializes its own schema; existing Sites D1 records and the Sites queue automation do not transfer through a source ZIP. Ephemeral storage loses workspaces when the container is replaced.

For production behind Ninoo's HTTPS reverse proxy, set `VINEXT_TRUSTED_HOSTS` to the exact published hostname (no scheme or path). This enables the server to accept the proxy's matching forwarded hostname and HTTPS protocol so same-origin API requests work. Add a preview hostname only if it is also served by the trusted platform proxy. Do not disable the application's origin checks to work around proxy configuration.

## Closed-market queue on the new host

The browser can process its own explicitly authorized queue while the desk is open. To process pending orders when browsers are closed, configure a scheduler on the new host and a separate random `MANDATE_QUEUE_SECRET` of at least 32 characters. The scheduler sends `POST /api/queue/process` with an empty body and `Authorization: Bearer <secret>`; use the same header for `GET /api/queue/status`. Put the credential in the scheduler's secret store, never a URL, source file or client request. Without this setup, the background endpoints return an unavailable response and the previous Sites automation continues to target only the Sites database.

The scheduler must reach the running Node instance and persistent SQLite volume. It can recheck the queue after the U.S. market opens; closed, stale or unavailable Yahoo quotes continue waiting. Every fill still requires the original queue authorization, an open-session fresh Yahoo quote, permitted price drift, current mandate and portfolio checks, and PRISM approval. Only paper orders are supported. Hosting that suspends the server or offers no scheduler cannot guarantee processing while browsers are closed.

The portable session is for demonstrations, not durable user accounts. Expiring or deleting the browser's session cookie creates a new workspace on the next sign-in, even if old records remain in SQLite. Do not leave long-lived queue grants in a disposable demo session: cancel pending orders before ending the demonstration, or implement durable account recovery before using this for ongoing team workflows. Source import does not migrate existing orders or create new queue grants.

## Verification before sharing

Open the published address in a fresh browser session. Confirm that the workspace opens without ChatGPT authentication; research and Risk Lab keep API keys server-side; paper orders use Yahoo data; and an explicitly queued order persists after restarting the server. Recheck provider configuration and PRISM receipts in the new deployment rather than assuming they migrated with source code.

Ninoo Builder access was established through a fresh browser and the owner's manual login. Source and private environment configuration were applied through the project's native controls. Native Publish first failed under Node 20; pnpm 10 initially skipped the pinned Node package's installer. Once the build ran, the public output proved to be static hosting, which cannot execute this application's APIs. The publish profile therefore provides an honest public entry to the independently running preview and keeps the Node runtime private. A separate persistent Node hosting service is needed for a production deployment independent of the Builder workspace.

## Recorded deployment checks · October 17, 2026

- 151 unit tests passed; the seven host and publication tests cover private runtime staging and the public-file whitelist. TypeScript checking passed.
- External API checks verified access-code enforcement, forged identity rejection, cross-origin rejection, independent signed browser sessions, scheduler bearer protection and separate empty Risk Lab records.
- Clean-browser checks verified the public entry, preserved judge route, access-code login and fully loaded Risk Lab after the final publish and production restart. Six old/private URL checks returned 404.
- [Live integration receipts](proofs/ninoo/live-integration-checks.json) record a guaranteed-return request blocked before any model call and a permitted sourced analysis with one Nicrron call. Both retained an unchanged ledger and acknowledged PRISM traces and spans. Yahoo quotes and history reflected the latest closed session, October 16.
- No real order, new queue authorization, background scheduler migration or persistent-volume guarantee was part of this deployment check.
