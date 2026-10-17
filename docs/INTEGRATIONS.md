# Integration contracts and verification

Documented configuration as of October 17, 2026. Configured credentials, a successful request and a verified downstream result are separate states. A sample report or a local audit event is not evidence of a live integration.

## Local configuration

Copy `.dev.vars.example` to `.dev.vars` only when the destination does not already contain the user's configuration. The user-managed secret source is `/Users/pranavpalle/Desktop/mandate/.dev.vars`. Do not print, commit, overwrite or include its contents in logs, fixtures, screenshots or browser bundles. Keep any authorized local copy outside Git. `.gitignore` excludes `.dev.vars` and environment files while allowing the empty example.

| Variable | Purpose | Default/example |
| --- | --- | --- |
| `NICRRON_API_KEY` | Server-side Nicrron credential | Empty in example |
| `NICRRON_MODEL` | Pinned chat model identifier | `openai/gpt-4o-mini` |
| `PRISM_API_KEY` | Server-side PRISM project credential | Empty in example |
| `PRISM_PROJECT_ID` | Matching PRISM project | Empty in example |
| `PRISM_AGENT_ID` | Stable identity for trace grouping | `mandate-research` |
| `PRISM_ENFORCE` | Require a successful, permitting remote guardrail verdict | `false` |

These are Mandate's environment names. The PRISM documentation uses `PRISMTRACE_*` in its examples; do not rename the application's variables without changing its adapter.

## Nicrron

Use `POST https://api.nicrron.ai/v1/chat/completions`, an `Authorization: Bearer` header, and the server-side key. The documented OpenAI SDK base URL is `https://api.nicrron.ai/v1`. A pinned model makes a demo more repeatable than automatic routing. [Quickstart](https://nicrron.ai/docs/quickstart), [authentication](https://nicrron.ai/docs/authentication), [model catalog](https://nicrron.ai/docs/models).

The reviewed documentation does not explicitly guarantee chat JSON-schema enforcement or native function calling. Treat JSON output as untrusted data: parse it, validate its shape and resolve every citation against the approved corpus. A request parameter in an adapter is not proof that the gateway honors it. Record the actual model and failures; never relabel a deterministic fallback as Nicrron output.

No numerical chat rate limits were verified. Display failures and apply bounded retries to transient errors. Do not publish an uptime or data-retention guarantee: the authentication, model and marketing pages contain differing provisioning and retention descriptions.

## PRISM

The [official documentation](https://blockconvey.com/docs) specifies `X-PRISMtrace-Key`, not bearer authentication. TypeScript uses HTTP; no npm SDK is documented. Trace examples use `https://prism.blockconvey.com/api/traces`; guardrail and knowledge-search examples use `https://api.prism.blockconvey.com/api/guardrails/evaluate` and `/api/knowledge-base/search`. Verify the adapter's configured host with a real receipt.

Guardrail evaluation returns `blocked` and `evaluated`. `evaluated:false` can mean unavailable entitlement or an internal error; PRISM permits traffic by default in that case. Mandate's enforcement mode must require `evaluated === true && blocked === false`. Missing configuration, transport errors and unusable responses must stop the dependent action. Independent local order checks remain mandatory when remote enforcement is disabled.

Use the same trace ID for evaluation and the submitted trace. After a remote block, emit no downstream model span or output. HTTP trace submission alone observes work after it happened; it is not permission enforcement. Guardrails and custom evaluators require the appropriate account entitlement. Preserve real request IDs and verdicts rather than manufacturing success records.

## What counts as integrated

There are two external integrations: Nicrron inference and PRISM observability/retrieval/guardrail evaluation. Count PRISM as one service, not several integrations. Yahoo observations and history are a public market-data source. The paper ledger and local mandate rules are application features.

Verification must produce an actual Nicrron response and an actual PRISM trace visible in the selected project. Knowledge-base sync needs a real upload/search result. Remote enforcement needs a recorded verdict and confirmation that blocked work did not proceed. Until those receipts exist, describe the relevant feature as implemented or configured, with live verification pending. Follow the proof checklist in `DEMO.md`.

## Recorded live verification — October 17, 2026

Live Nicrron and PRISM requests were verified during the build session. The local and hosted demonstration configurations have `PRISM_ENFORCE=true`. The custom regex rule **Mandate blocked order** matches `\bMANDATE_BLOCK\b` and uses action **Block**. It stopped a real oversized-order scenario; portfolio revision **2** remained unchanged. The linked trace is `80288ef5-24af-49be-a081-aa7db80cd4ba`.

Configure this rule on the PRISM Guardrails page: Add Rule → Custom Regex → rule name → Block → intended agent scope → pattern → Create Rule. The dashboard's regex preview is not an enforcement test. `node scripts/verify-guardrails.mjs` creates one real Yahoo-priced oversized proposal and checks that the ledger is unchanged. Inspect PRISM's Block Check classification and Intelligence cluster separately; API receipts alone do not prove those dashboard results. See [the demo checklist](DEMO.md).

## Risk Lab pre-model boundary

`POST /api/risk-lab` accepts one named financial case and an authenticated desk or demo workspace. It loads actual Yahoo quote/history context, hashes the frozen snapshot, evaluates the raw request in PRISM, and calls Nicrron only after an evaluated allow. Missing enforcement or unavailable PRISM fails closed. The route has no order-execution capability. It reads the same workspace before and after, then emits one final trace and its real spans. A block has empty model output and no LLM span; citation membership validation is explicitly distinct from fact checking.

The financial Custom Regex rule is scoped to `mandate-research` with action Block. The legacy `MANDATE_BLOCK` order rule remains separate. These named regression cases test specific request patterns; passing them is not a claim to detect every paraphrase or every financial risk.

The diagnostic `scripts/run-risk-cohort.mjs` runs 50 real before or after requests against a frozen Yahoo snapshot. The baseline is an explicit shadow CLI with the pre-model gate disabled and no order tools, never an API option. It retains the model's safety instruction. The measured baseline failure is a risky request crossing the intended model boundary, even if the model refuses its content. Artifacts include raw receipts, timestamps, source hash and trace IDs. It refuses to overwrite an existing cohort. Run only when deliberately collecting provider evidence; it consumes configured service credits.

PRISM's own dashboard frontend exposes `GET /api/guardrails/reconciliation/{project_id}` for Block Check and `GET /api/intelligence/clusters` for Root Cause. A configured read/operate API key was accepted during this build. These dashboard contracts may evolve; no browser token or private session is extracted. Keep raw provider responses and explain whether evidence was API-read or visually inspected.
