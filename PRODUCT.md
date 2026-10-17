# Mandate

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
React, TypeScript, Vinext, Cloudflare Workers and D1.

## Users
Small public-equity funds whose analysts, portfolio managers and operations staff review AI research before it becomes an order. Customer demand and willingness to pay remain hypotheses to test with pilot teams.

## Product Purpose
Make an AI-generated financial decision reviewable from its source to its permitted action. Research carries dated citations; an order carries exact terms and human authorization; a denied request carries evidence that downstream work did not proceed.

For MONEY TALKS 2, the primary track is **Trust & Risk**. The central demonstration is a risky request, a PRISM guardrail, and the real run it stops. Historical strategies and paper orders establish the financial context without replacing the required risk proofs.

## Operating Context
Paper trading with actual Yahoo Finance quotes and historical observations. A new account starts with $250,000 paper cash and no holdings. There is no synthetic price mode, brokerage connection or real-money execution. Provider timestamps determine freshness; a refresh is not a guarantee of real-time exchange delivery.

During a closed market, a reviewer can explicitly authorize a queued order. It waits for a fresh eligible Yahoo quote and repeats the risk checks before a paper fill. Authorization lasts seven days and limits price movement to 1% from the approved reference. Historical strategies use completed Yahoo observations and disclose their assumptions; past results are not account profit or a forecast.

## Capabilities and Constraints
The Risk lab evaluates a finance-risk request with PRISM before any Nicrron model call. A receipt distinguishes the remote verdict, recorded model-call count, trace submission and unchanged ledger. A benign control uses Nicrron with dated Yahoo context. The lab cannot submit orders or change holdings.

The paper-order workflow separately checks quantity, symbol, value, cash or inventory, concentration, evidence, quote timing and exact approval terms. Configured remote enforcement fails closed when PRISM cannot supply a usable verdict. Database compare-and-swap prevents duplicate fills. Keys remain server-side and outside Git.

Analyst and reviewer capabilities illustrate workflow boundaries; they do not establish production identity management or separation of duties. PRISM's dashboard Block Check and Root Cause classifications must be inspected independently of application receipts. See [judging evidence](docs/JUDGING.md).

## Evidence on Hand
Yahoo prices and two years of daily history support current strategy analysis. Historical Apple, Microsoft and NVIDIA issuer disclosures retain their original July–August 2025 dates. No source date is advanced to authorize a present-day order. The product asserts no customers, revenue, investment performance or completed dashboard proof without a recorded artifact.

## Product Principles
Evidence travels with the order. A model cannot grant itself permission. Changed order terms invalidate approval. A block is checked against downstream behavior. Unavailable evidence stays unavailable. A clear waiting state is a valid financial outcome.
