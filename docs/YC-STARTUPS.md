# YC startups relevant to MONEY TALKS 2

Research checked October 17, 2026 against the [event's three-track brief](https://docs.google.com/document/d/1rm5ev9mj_leu2w7OVlFVmKaCT-OvZZ9tSibbC4lzd08/edit?tab=t.0) and official YC company profiles. Company links below substantiate YC membership, batch and product description. Track placement and narrow build suggestions are our assessment, not official YC categories or organizer endorsements. The suggestions are prototype scopes, not claims that a full company can be reproduced in a day.

## Money Intelligence

Investing, research, analysis, portfolio intelligence and personal finance.

| Startup | YC batch | Relevant product and track fit | Narrow build inspired by it |
| --- | --- | --- | --- |
| [Hudson Labs](https://www.ycombinator.com/companies/hudson-labs), formerly Bedrock AI | Summer 2021 | Finance-specific AI equity research that synthesizes company documents and connects commentary with reported figures. Strong fit for a source-backed investment memo. | Compare two earnings releases for one company; attach a citation to each factual claim and refuse unsupported numbers. |
| [Finbar](https://www.ycombinator.com/companies/finbar) | Winter 2025 | Financial intelligence drawn from filings, presentations and transcripts, with analysis/modeling tools and spreadsheet/API access. | Extract five cited financial metrics and update one company model with a visible change log. |
| [Cohesion](https://www.ycombinator.com/companies/cohesion) | Spring 2026 | Public-equity agents follow companies, earnings, news and other sources to generate analyst insights. | A three-company watchlist digest explaining what changed since the last source snapshot. |
| [Astor](https://www.ycombinator.com/companies/astor) | Summer 2025 | An AI investment advisor for retail investors, providing tailored analysis of opportunities and trends. | A personal-portfolio briefing using sample holdings and cited issuer documents, with explicit uncertainty. |

**Best starting point:** Hudson Labs for the clearest evidence-to-memo workflow; Finbar if structured extraction and model updates are more interesting than narrative research.

**Required PRISM proof:** a Knowledge Base retrieval run; an Intelligence cluster of at least three failed runs with a cause; a custom evaluator scoring v1 and v2 on the same inputs. A citation toggle by itself is not the retrieval or evaluation proof.

## Money Operations

Payments, expenses, invoices, budgeting, CFO workflows and automation.

| Startup | YC batch | Relevant product and track fit | Narrow build inspired by it |
| --- | --- | --- | --- |
| [FullSeam](https://www.ycombinator.com/companies/fullseam) | Winter 2026 | Agents handle accounting tasks across AP, AR and reconciliation, connecting existing accounting tools and records. | Match a sample bank-payment export against invoices; route missing references and partial payments to an exception queue. |
| [Concourse](https://www.ycombinator.com/companies/concourse) | Winter 2023 | Finance agents connect core data, apply business logic, calculate in code and trace outputs to sources. Direct fit for the brief's scattered-finance-data problem. | Consolidate three sample CSVs into a cash/runway report, with every figure linked to its input rows and calculation. |
| [Truewind](https://www.ycombinator.com/companies/truewind) | Winter 2023 | AI accounting automates transaction categorization, supporting-document collection and follow-up work around the close. | Categorize 30 sample transactions, match receipts and produce a missing-evidence close checklist for review. |
| [Clerked](https://www.ycombinator.com/companies/clerked), formerly Mod AI | Fall 2025 | AI clerks automate accounts payable, invoice processing and spend questions. | Ingest ten sample invoices, match purchase orders, detect a duplicate and require approval before a simulated payment. |

**Best starting point:** Concourse for a CFO consolidation workflow; FullSeam for reconciliation; Clerked for a concrete invoice-to-approval demonstration.

**Required PRISM proof:** one session's Steps tab containing at least six actual tool calls; an alert firing on a real run; an Intelligence cluster of at least three failures followed by v2 succeeding on the same inputs. A useful invoice sequence is ingest → extract → look up vendor → match PO → check duplicate → evaluate policy → request approval. Only count calls actually performed and traced.

## Trust & Risk

Fraud, compliance, risk, security and safer financial AI.

| Startup | YC batch | Relevant product and track fit | Narrow build inspired by it |
| --- | --- | --- | --- |
| [Alter](https://www.ycombinator.com/companies/alter) | Summer 2025 | Identity and access controls for agents, including policy checks on tool parameters and payment limits. Closest match to Mandate's order-permission boundary. | Intercept a paper-order tool call, validate symbol/amount/evidence/approval and demonstrate that a denied call cannot mutate the ledger. |
| [Galini](https://www.ycombinator.com/companies/galini) | Fall 2024 | Custom runtime guardrails for AI inputs and outputs, including sensitive data, misleading advice and unauthorized actions. | Block synthetic account-number leakage and unsupported guaranteed-return claims before a finance response leaves the app. |
| [Socratix AI](https://www.ycombinator.com/companies/socratix-ai) | Summer 2025 | AI coworkers investigate fraud alerts using account, device, behavior and historical context, escalating high-risk cases with reasons. | Triage a sample transaction queue, gather supporting signals and explain each escalation without moving money. |
| [Kobalt Labs](https://www.ycombinator.com/companies/kobalt-labs) | Summer 2023 | Reviews third-party documents against bank policy and earlier compliance assessments to identify vendor risk. | Compare one sample vendor contract with a policy checklist, citing the clause behind every risk flag. |

**Best starting point:** Alter for enforceable action permissions; Galini for the most direct custom-guardrail demonstration; Socratix AI for transaction investigation.

**Required PRISM proof:** a custom finance guardrail in enforce mode blocking an actual run; the Guardrails page's Block Check classification with an explanation of whether PRISM got it right; an Intelligence cluster containing at least three failed or blocked runs and its cause. A local block or three separate receipts does not by itself prove the dashboard classification or cluster.

## Selected direction: Mandate

Mandate combines **Hudson Labs-inspired cited equity research** with **Alter-inspired parameter-level authorization** for small public-equity funds. The useful scope is the handoff from a source-backed finding to a paper order: the evidence, order parameters, portfolio version, mandate version and approval stay linked.

Its primary track is **Trust & Risk** because the decisive demonstration is an order that is denied and never reaches the paper ledger. **Money Intelligence** is a secondary fit through source retrieval and cited research. See [the YC thesis](YC-THESIS.md) and [actual proof status](DEMO.md). These inspirations are not integrations, partnerships or claims of feature parity.

Every track requires PRISM and NicrronNinoo, and the brief asks for 50+ real agent runs before remediation. All prototype ideas should use sample or synthetic financial data. No company performance, revenue or customer claim is needed to justify the track fit.
