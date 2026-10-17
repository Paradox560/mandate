# MONEY TALKS 2 judging alignment

Mandate enters **Trust & Risk** with a focused claim: an investment team can inspect both an agent's proposed financial action and evidence that a dangerous request stopped before downstream work. Yahoo-backed research and controlled paper orders demonstrate the surrounding product.

Requirements were checked against the official [overview](https://money-talks-2-nyc.devpost.com/), [rules](https://money-talks-2-nyc.devpost.com/rules) and [resources](https://money-talks-2-nyc.devpost.com/resources) on October 17, 2026.

## Four criteria, five points each

The official rubric has four categories, each scored out of five, for a maximum of 20. No percentage weighting is published. PRISM evidence is described as central to the event.

| Criterion | Mandate's demonstration | Evidence to inspect |
| --- | --- | --- |
| PRISM Proofs | A finance-risk request stopped before the model, independently checked in PRISM, with recurring failures grouped by cause | Current guardrail receipt and matching trace; Block Check; cluster containing at least three failed or blocked runs |
| Technical Execution | A permitted Nicrron control, failure handling, actual Yahoo observations and controlled queue processing | Provider receipts and timestamps; unavailable states; validation results; unchanged ledger for a block |
| Uniqueness of Idea | A review workflow for small funds that binds cited analysis to exact authorization and observable outcomes | A research-to-order example, its approval terms and evidence of a denied action |
| Design | A short walkthrough separating request, decision and consequence | Clear market state, dates, actionable status, human approval and exportable evidence |

These are demonstration targets, not awarded scores or a declaration that all evidence is complete.

## Evidence achieved and outstanding

The current controlled comparison contains **50 actual baseline runs followed by 50 protected runs**. All baseline calls completed before the new finance rule was created. With the rule enabled, 38 risky requests were blocked before inference while 12 benign analyses completed; the ledger stayed unchanged. PRISM acknowledged all 100 traces and their span submissions. The four fixed requests and Yahoo snapshot were held constant across cohorts. This is a narrow application-boundary test, not a broad safety benchmark. [Comparison](../public/proofs/cohort-comparison.json)

PRISM's reconciliation API independently reports **all 38 blocks honoured**, agreeing with zero downstream model calls and model spans. The [API artifact](../public/proofs/block-check.json) establishes the returned classification; it does not claim that the required Guardrails-page presentation has been captured.

Root Cause generated two real clusters despite ten failed deep analyses. The relevant [53-member cluster](evidence/root-cause-e2e3b648-f936-4afd-92fd-71789e54d6f9.json) contains [six independently verified current blocks](evidence/root-cause-current-members.json), covering all three risky cases. Their trajectory details match exact caller trace IDs and cohort sessions. These requests share disallowed financial intent; the gate stopped them before Nicrron, and PRISM records the denied gate as a failed tool step.

The cluster is classified as `prompt` with evidence tier `needs_review` and judge status `credential_error`. PRISM reports an upstream Anthropic `401`/`invalid x-api-key`, separate from working Nicrron inference and PRISM guardrails. Competing detector signals were not resolved by the AI judge, so this is an observed classification rather than a confirmed defect. Present the actual grouping, matched blocks and [diagnosis limitation](../public/proofs/analysis-provider-error.json) together; no confirmed cause or remediation is claimed.

Actual app screenshots and current receipts are indexed in [DEMO.md](DEMO.md). Team information, authorized judge access, PRISM dashboard captures and review of the tentative Root Cause classification remain outstanding; this is not a complete submission claim.

## Required Trust & Risk proofs

1. **Guardrail.** Create a finance-risk rule in Block mode and evaluate it before the model, using `POST /api/guardrails/evaluate` with a `trace_id`, or the PRISM proxy. Show an actual blocked run. An unavailable evaluation is not an evaluated block.
2. **Block check.** Submit the run trace with the same `trace_id`. On PRISM's Guardrails page, show whether downstream behavior was classified as honoured, not honoured or unverifiable. Explain whether that assessment matches the evidence.
3. **Root Cause.** Run analysis on the Root Cause page and show a cluster of at least three failed or blocked runs with its cause. The stated analysis cost is five credits. If no cluster appears, analyse five to ten risky traces first, at one credit each, then rerun Root Cause.

Current Devpost instructions explicitly require the pre-model boundary and shared trace ID. The earlier order-risk marker rule and a local no-fill assertion alone do not satisfy all three proofs. Dashboard captures should retain enough run identity and context to match the exported receipt.

## Baseline and improvement evidence

The resources page instructs teams to send **50 or more actual agent runs to PRISM before remediation**. Preserve requests, versions, timestamps, context, verdicts and trace IDs, plus the cohort's start and end times. Do not backdate a baseline, duplicate rows or treat a configured script as completed evidence.

The recorded baseline ran from 18:38:57 to 18:40:00 UTC on October 17, 2026; the new finance rule was created at 18:40:19, and the protected replay completed at 18:41:33. The baseline deliberately skipped the pre-model gate in a shadow harness with no order tools while preserving the model safety prompt. The observed failure was the risky request reaching the model; this does not establish that harmful text or an unauthorized trade resulted. Both cohorts used the same four repeated inputs and frozen Yahoo context. [Raw baseline](../public/proofs/baseline-cohort.jsonl), [raw protected replay](../public/proofs/protected-cohort.jsonl)

## Other tracks

Money Intelligence additionally requires an actual PRISM Knowledge Base retrieval from assigned documents, a failure cluster and a custom evaluator comparing versions on the same inputs. Historical charts and citation badges do not replace those proofs.

Money Operations instead requires a session with at least six actual tool calls, a workflow alert triggered by a real run, and a failure cluster followed by a corrected version on the same inputs. These are not extra Trust & Risk requirements; Mandate should keep a focused primary submission.

## Submission and eligibility

The rules specify teams of two to five, work built during the event, PRISM and NicrronNinoo usage, and a live demonstration. AI coding assistants are permitted. Build starts October 17, 2026 at 11 a.m. Eastern; submission is due at 4 p.m., with live judging from 4 to 5:30 p.m. The overview additionally lists US eligibility and the legal age of majority. Team details and build chronology must be accurate.

The project page needs a name and one-line description, track, problem and implementation, three recorded PRISM proofs, tools including NicrronNinoo usage, team names and roles, and links to the live demo, prototype and repository. Proof screenshots or short recordings should also appear in the demo video. A video alone does not replace the live presentation. See [SUBMISSION.md](SUBMISSION.md).

The overview asks for made-up or sample data and excludes personal financial credentials and details. Mandate uses a paper account and fictional risk requests with public Yahoo prices; it must not claim the organizer has specifically approved that interpretation. Preserve the Yahoo-only product requirement and clarify that distinction with the organizer if eligibility is questioned. Never use real account numbers, card details or bank logins in a risk test.

The site and GitHub repository are private. Arrange judge access before submitting links; this update does not publish either one or submit to Devpost. The current proof ledger is in [DEMO.md](DEMO.md).
