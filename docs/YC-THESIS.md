# Mandate: evidence that stays attached to the order

Mandate is a proposed approval layer for investment teams using AI research. A cited finding becomes a paper-order proposal whose evidence, parameters, portfolio revision and mandate version travel together. A person approves that exact proposal; changing it requires a new decision.

## Customer and problem hypothesis

Start with small public-equity funds and family offices where a few people share research, portfolio management and operations. The hypothesis is that reviewing an agent's work across a research note, a spreadsheet and an order ticket is expensive enough to justify a dedicated workflow. This has not been established through customer interviews.

The initial job is narrow: determine what an agent proposed, which source supports each factual claim, whether the portfolio permits it, who approved it and whether the executed parameters match. The product does not need to forecast returns to make that review useful.

## YC precedents

| Company | Verified YC batch | Relevant product idea | Mandate's adaptation |
| --- | --- | --- | --- |
| [Hudson Labs](https://www.ycombinator.com/companies/hudson-labs) | Summer 2021 | Finance-specific AI for equity research, including source-linked analysis across company documents. | Keep issuer evidence visible when a research note becomes an order. |
| [Alter](https://www.ycombinator.com/companies/alter) | Summer 2025 | Parameter-level authorization and auditability for agent tool calls. | Check an investment mandate before mutating the paper ledger and bind approval to the exact order. |

These are product inspirations, not partnerships, integrations or claims of feature parity. Mandate has no asserted relationship with either company.

## Proposed advantage to test

The useful boundary is the transition from analysis to action. Research software helps a team form an opinion. Mandate's hypothesis is that teams will pay for a reviewable, enforceable record of what their agents were allowed to do with that opinion.

The prototype demonstrates source IDs on claims and orders, deterministic mandate checks, separate actor capabilities, approval fingerprints and a paper ledger. A future advantage could come from trusted workflow integrations and a permissioned history of policy exceptions and review decisions. A small demo dataset and an LLM prompt are not a defensible moat.

## Validation plan, not traction

Interview five investment teams about their last research-to-order review. Ask for the artifacts, number of handoffs, reasons for rejection and time spent reconstructing decisions. Seek three design partners willing to trial a paper-only review flow. These are targets; none is presented as a completed interview, customer or commitment.

Measure review time, source-checking effort, rejected unsupported claims and orders that change after approval. Establish baselines before promising an improvement. Test a paid team pilot only after repeated use; pricing and willingness to pay are unknown.

## Current boundary

All prices and the portfolio are synthetic. The evidence is a July–August 2025 corpus used with an explicit August 29, 2025 replay date. There are no return, alpha, assets-under-management, customer or revenue claims. The prototype does not connect to a broker, custody funds, establish production user identity or prove regulatory compliance. Those are separate requirements for any future deployment beyond this demonstration.
