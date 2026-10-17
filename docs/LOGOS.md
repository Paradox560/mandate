# Company logo assets

The six company images in `public/logos` were retrieved from Twelve Data on **October 17, 2026** and visually inspected. They are downloaded provider assets, not reconstructed icons. The application can serve them locally without a runtime API key or further logo requests.

| Symbol | Local asset | Returned source | Visual note |
| --- | --- | --- | --- |
| NVDA | [NVDA.jpg](../public/logos/NVDA.jpg) | [Twelve Data / nvidia.com](https://api.twelvedata.com/logo/nvidia.com) | NVIDIA mark and wordmark on green |
| MSFT | [MSFT.jpg](../public/logos/MSFT.jpg) | [Twelve Data / microsoft.com](https://api.twelvedata.com/logo/microsoft.com) | Microsoft four-color mark |
| AAPL | [AAPL.jpg](../public/logos/AAPL.jpg) | [Twelve Data / apple.com](https://api.twelvedata.com/logo/apple.com) | Black Apple mark |
| GOOGL | [GOOGL.jpg](../public/logos/GOOGL.jpg) | [Twelve Data / abc.xyz](https://api.twelvedata.com/logo/abc.xyz) | Alphabet issuer wordmark, as returned for GOOGL |
| AMZN | [AMZN.jpg](../public/logos/AMZN.jpg) | [Twelve Data / amazon.com](https://api.twelvedata.com/logo/amazon.com) | Amazon smile on a dark background |
| META | [META.jpg](../public/logos/META.jpg) | [Twelve Data / fb-meta.jpg](https://logo.twelvedata.com/symbols/fb-meta.jpg) | Wide Meta infinity mark and wordmark |

All six responses were JPEG. Five images are 128×128; META is 718×187. Preserve the supplied artwork and aspect ratio with `object-fit: contain`; do not crop the wide wordmark or recolor the marks. A text label alongside each image identifies the security independently of its logo. These assets identify companies and do not imply endorsement or partnership.

## UI contract

[manifest.json](../public/logos/manifest.json) is public, contains no credentials, and has this shape:

```json
{
  "schemaVersion": 1,
  "provider": "Twelve Data",
  "updatedAt": "ISO timestamp",
  "logos": {
    "NVDA": {
      "path": "/logos/NVDA.jpg",
      "providerUrl": "https://api.twelvedata.com/logo/nvidia.com",
      "status": "ready"
    }
  }
}
```

Each ready record also includes exchange, MIME type, byte count, SHA-256 hash, attempt time and fetch time. The UI maps the six verified JPEG paths directly, since Vite does not support importing JSON from `public`. If a future refresh changes an image's extension, update that map from the ready manifest record. Image-load failures show a neutral initials fallback and preserve the adjacent company label.

## Refresh

From the project root:

```sh
node scripts/sync-company-logos.mjs
```

The [sync script](../scripts/sync-company-logos.mjs) accepts `TWELVE_DATA_API_KEY` from the process environment or the gitignored `.dev.vars` file. It uses Node's dotenv parser to handle quoted values, comments and line endings. It does not print the key, include it in URLs, write it to the manifest or forward it to image requests. A populated `.dev.vars` remains private; do not commit or publish it.

The script performs sequential lookups using `/logo?symbol=SYMBOL&exchange=NASDAQ` and Twelve Data's documented `Authorization: apikey ...` header. The official docs specify **one API credit per symbol**. It then downloads each returned image without authentication. [API documentation and authentication](https://twelvedata.com/docs), [logo endpoint documentation](https://twelvedata.com/docs#logo).

Ready local assets are checked against their recorded hashes and reused. Prior failed or interrupted attempts are also retained so a repeated command does not silently spend more credits. To explicitly refresh all six symbols, including prior failures:

```sh
node scripts/sync-company-logos.mjs --force
```

`--force` makes six new lookup attempts; do not run it for every application start or build. There are no automatic retries. For a missing asset, the normal command reports the retained attempt and keeps the fallback until an intentional refresh.

## Validation and recorded run

The script permits only HTTPS image URLs on the verified Twelve Data hosts `api.twelvedata.com` and `logo.twelvedata.com`, rejects credentials/query strings/fragments in image URLs, and rejects redirects. Downloaded bodies are limited to **1 MiB**. It checks PNG/JPEG signatures or a restricted SVG body against an accepted image MIME type; SVG scripts, event handlers and external references are rejected. Response bodies, raw network errors and authenticated request details are not logged.

The initial run saved **6/6 images** using **six API lookups and six image requests**, with zero unavailable assets. Every image was visually inspected. A second run reused all six hashes and made **zero API lookups and zero image requests**. The downloaded bytes are unmodified. These are recorded sync results, not a promise that upstream artwork will remain unchanged.

Logo data is provided by [Twelve Data](https://twelvedata.com/). The provider's [brand guidance](https://twelvedata.com/brand-assets) requests attribution and prohibits implying a partnership; company marks remain their respective owners' branding.
