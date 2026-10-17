# Mandate

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
React, TypeScript, Vinext, Cloudflare Workers and D1. The workspace is the implementation source; deployment and repository locations are operational details, not product capabilities.

## Users
Confirmed initial customer segment: small public-equity funds whose analysts, portfolio managers and operations staff review AI-generated research and orders. Family offices are an adjacent segment to investigate. The product combines source-linked equity research inspired by Hudson Labs with parameter-level tool permissions inspired by Alter. Customer demand and willingness to pay remain unvalidated.

## Product Purpose
Turn cited equity research into reviewable paper orders. Bind every proposed order to source evidence, portfolio state, a mandate version and recorded authorization.

## Operating Context
An explicitly synthetic market replay with historical issuer disclosures. Analyst research, proposal, permission checks, human approval, paper fill and audit history form one workflow. No broker or real-money execution.

## Capabilities and Constraints
Use Nicrron's API for model inference and PRISM for traces, knowledge retrieval and guardrail evaluation. Live provider requests and one PRISM blocking scenario were verified on October 17, 2026; the broader proof checklist remains in docs/DEMO.md. Deterministic local permission checks enforce paper-order mutations. When remote enforcement is enabled, unavailable or unevaluated PRISM responses also deny dependent work. Keys remain server-side and outside Git. Samples remain explicitly labeled and never impersonate live model responses or PRISM receipts. Analyst/reviewer capabilities demonstrate workflow boundaries; they are not a production identity or separation-of-duties system.

## Evidence on Hand
Verified historical Apple, Microsoft and NVIDIA earnings disclosures from July–August 2025. Synthetic prices and portfolio. No customers, performance claims or traction. YC strategy and pilot targets are hypotheses, not facts.

## Product Principles
Evidence travels with the order. A model cannot grant itself permission. A changed order invalidates approval. A block is verified against downstream ledger state. Errors are visible.
