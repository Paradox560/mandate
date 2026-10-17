# Market data and company logos

Mandate defaults to Yahoo Finance prices. Select **Synthetic replay** in the header to run the historical permission demonstration. All orders remain paper orders.

## Yahoo market feed

The server requests the public Yahoo Finance chart endpoint used by tools such as yfinance. The hosted application runs in a JavaScript Worker, so it uses a TypeScript HTTP adapter rather than installing the Python yfinance package or requiring a separate Python server. No Yahoo API key or paid subscription is used.

The workspace refreshes every 60 seconds. Charts use real five-minute bars from the latest available regular session. The displayed quote timestamp is Yahoo's market timestamp; the separate fetched/checked time is when Mandate received it. Polling does not make the underlying data newer. Market-closed prices remain the last available session prices. There is no guaranteed real-time latency or uptime.

Requests are cached and deduplicated server-side. A failed refresh retains an available last-known quote with a stale marker. Missing symbols remain unavailable: Yahoo mode never substitutes synthetic prices. Rate limits trigger a cooldown. Requests reject redirects and unexpected response shapes. There is no scraping proxy, CAPTCHA bypass or rotating identity.

The Worker identifies requests as `Mandate/0.1 (private paper research prototype)`. It uses manual redirect handling and rejects redirect responses; Cloudflare Workers do not accept the Fetch `redirect: 'error'` option.

The UI identifies the provider, session state and actual quote time. Incomplete portfolio pricing cannot produce a complete NAV or position-weight authorization. The initial paper holdings and cost bases are demonstration fixtures; their marked value is not a verified investment performance record.

## Permissions and evidence

Each new proposal stores its market source and original quote timestamp. Approval and execution fetch the source stored on that order, regardless of the current display selection. The source is included in the approval fingerprint. Quotes must still pass the mandate's configured maximum age, and Yahoo-priced paper execution additionally requires an open regular session and complete portfolio pricing. Older approvals from before this fingerprint change require a fresh review.

The research catalog still contains the explicitly dated 2025 issuer disclosures. Yahoo-mode orders check those source dates against the current date, so old evidence cannot authorize a current-date order. Synthetic replay uses its stated August 29, 2025 evidence clock. New current research sources are a separate future integration; current prices do not make old research current.

## Logos and cost

`scripts/sync-company-logos.mjs` uses `TWELVE_DATA_API_KEY` from the local `.dev.vars` file to fetch each company logo once, then stores the image and provenance in `public/logos`. The application serves these assets without a runtime logo lookup or exposing the API key. Run `npm run logos:sync` to populate missing assets; consult [LOGOS.md](LOGOS.md) for refresh behavior and provenance. Do not commit `.dev.vars`.

No paid plan or purchase is enabled. Yahoo access is unofficial; the yfinance project describes research/personal-use constraints. Free endpoint access is not a commercial redistribution license. Provider terms and customer-facing data rights need review before expanding this private prototype into a commercial product.

## Sources

## Recorded verification — October 17, 2026

The local Worker returned all six Yahoo quotes with status `ok`, real October 16 closing timestamps and 79 observations from that regular session. The actual feed was rendered and inspected at 1440px and 390px: all six logo images loaded, source switching worked, and neither viewport had page overflow or client errors. The unit suite passed 68 tests, the full browser suite passed 16 tests, and targeted market/browser checks passed again after the final request-header and order-source-label fixes. TypeScript and the production build passed.

One request configuration produced a provider rate limit during development. The five-minute cooldown was honored; a single subsequent Worker probe with the identifying header succeeded before the complete feed was checked. This recorded success does not guarantee Yahoo uptime, future limits, or real-time delivery.

## References

- [yfinance project and usage notes](https://github.com/ranaroussi/yfinance)
- [Twelve Data logo endpoint](https://twelvedata.com/docs#logo)
- [Twelve Data Basic logo access](https://twelvedata.com/fundamentals)
