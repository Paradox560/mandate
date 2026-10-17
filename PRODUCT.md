# Mandate

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Implementation choice under the user's delegated build: React, TypeScript, Vinext, Cloudflare Workers and D1. Source is mirrored to the requested Desktop folder and a private GitHub repository.

## Users
Proposed initial customer, pending user steering: small public-equity investment teams reviewing AI-generated orders. The user requested a proprietary investment trading application inspired by Hudson Labs research and Alter tool-call permissions.

## Product Purpose
Turn cited equity research into reviewable paper orders. Bind every proposed order to source evidence, portfolio state, a mandate version and recorded authorization.

## Operating Context
An explicitly synthetic market replay with historical issuer disclosures. Analyst research, proposal, permission checks, human approval, paper fill and audit history form one workflow. No broker or real-money execution.

## Capabilities and Constraints
Use Nicrron's API for live model inference when configured. Use PRISM for traces, knowledge retrieval and enforcement telemetry. Own deterministic, fail-closed permission checks enforce every paper-order mutation. Keys remain server-side and outside Git. Mock fallbacks must be explicitly labelled and must never impersonate live model responses or PRISM receipts.

## Evidence on Hand
Verified historical Apple, Microsoft and NVIDIA earnings disclosures from July–August 2025. Synthetic prices and portfolio. No customers, performance claims or traction. YC strategy and pilot targets are hypotheses, not facts.

## Product Principles
Evidence travels with the order. A model cannot grant itself permission. A changed order invalidates approval. A block is verified against downstream ledger state. Errors are visible.
