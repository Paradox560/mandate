#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { parseEnv } from 'node:util';

// Build-time assets only. No credential or authenticated URL is ever persisted.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, 'public/logos');
const manifestPath = resolve(directory, 'manifest.json');
const symbols = ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META'];
const force = process.argv.includes('--force');
const maxBytes = 1024 * 1024;
const allowedHosts = new Set(['api.twelvedata.com', 'logo.twelvedata.com']);
let apiKey;

function failure(code) { return Object.assign(new Error(code), { safeCode: code }); }

async function key() {
  if (apiKey) return apiKey;
  let value = process.env.TWELVE_DATA_API_KEY;
  if (!value?.trim()) {
    try {
      // Node's dotenv parser handles export, quotes, comments, CRLF and escapes.
      value = parseEnv(await readFile(resolve(root, '.dev.vars'), 'utf8')).TWELVE_DATA_API_KEY;
    } catch { throw failure('missing_api_key'); }
  }
  if (!value?.trim() || /[\r\n\0]/.test(value)) throw failure('invalid_api_key');
  apiKey = value.trim();
  return apiKey;
}

function providerUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw failure('invalid_logo_url'); }
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.port ||
      url.username || url.password || url.search || url.hash ||
      (url.hostname === 'api.twelvedata.com' && !url.pathname.startsWith('/logo/')) ||
      (apiKey && (url.href.includes(apiKey) || decodeURIComponent(url.href).includes(apiKey)))) {
    throw failure('unsafe_logo_url');
  }
  return url;
}

async function request(url, headers = {}) {
  let response;
  try {
    response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
  } catch { throw failure('network_request_failed'); }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw failure('redirect_rejected');
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw failure(`http_${response.status}`);
  }
  return response;
}

async function boundedBody(response, limit = maxBytes) {
  const announced = Number(response.headers.get('content-length'));
  if (Number.isFinite(announced) && announced > limit) {
    await response.body?.cancel();
    throw failure('response_too_large');
  }
  if (!response.body) throw failure('empty_response');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw failure('response_too_large'); }
      chunks.push(Buffer.from(value));
    }
  } catch (error) { throw error.safeCode ? error : failure('response_read_failed'); }
  if (!length) throw failure('empty_response');
  return Buffer.concat(chunks, length);
}

function imageExtension(bytes, type) {
  const mime = type?.split(';')[0].trim().toLowerCase();
  if (mime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (mime === 'image/svg+xml') {
    const svg = bytes.toString('utf8');
    if (!/<svg[\s>]/i.test(svg) || !/<\/svg\s*>/i.test(svg) ||
        /<(?:script|foreignObject|iframe|object|embed)\b|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?!#)|@import|url\(\s*["']?\s*(?!#)/i.test(svg)) {
      throw failure('unsafe_svg');
    }
    return 'svg';
  }
  throw failure('unsupported_image');
}

async function cached(entry, symbol) {
  if (!entry || entry.status !== 'ready' || !/^\/logos\/[A-Z]+\.(png|jpg|svg)$/.test(entry.path || '')) return false;
  if (!entry.path.startsWith(`/logos/${symbol}.`)) return false;
  try {
    providerUrl(entry.providerUrl);
    const bytes = await readFile(resolve(directory, basename(entry.path)));
    return bytes.length > 0 && bytes.length <= maxBytes && createHash('sha256').update(bytes).digest('hex') === entry.sha256;
  } catch { return false; }
}

async function main() {
  const unknown = process.argv.slice(2).filter(argument => argument !== '--force');
  if (unknown.length) throw failure('unsupported_argument');
  await mkdir(directory, { recursive: true });
  let manifest = { schemaVersion: 1, provider: 'Twelve Data', updatedAt: null, logos: {} };
  try {
    const existing = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (existing.schemaVersion !== 1 || existing.provider !== 'Twelve Data' || !existing.logos) throw failure('invalid_manifest');
    manifest = existing;
  } catch (error) { if (error.code !== 'ENOENT') throw failure('invalid_manifest'); }
  const save = async () => {
    manifest.updatedAt = new Date().toISOString();
    const output = JSON.stringify(manifest, null, 2) + '\n';
    if (apiKey && output.includes(apiKey)) throw failure('secret_in_manifest_rejected');
    await writeFile(manifestPath + '.tmp', output);
    await rename(manifestPath + '.tmp', manifestPath);
  };
  let lookups = 0, downloads = 0, available = 0, failed = 0;
  for (const symbol of symbols) {
    const previous = manifest.logos[symbol];
    if (!force && await cached(previous, symbol)) {
      available++;
      console.log(`${symbol}: cached ${previous.path}`);
      continue;
    }
    // A failed/partial attempt is retained, so reruns do not silently spend more credits.
    if (!force && previous) {
      failed++;
      console.log(`${symbol}: previous attempt retained; use --force to refresh`);
      continue;
    }
    const credential = await key();
    const entry = { path: null, providerUrl: null, exchange: 'NASDAQ', status: 'lookup_started', attemptedAt: new Date().toISOString() };
    manifest.logos[symbol] = entry;
    await save();
    try {
      const url = new URL('https://api.twelvedata.com/logo');
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('exchange', 'NASDAQ');
      lookups++;
      const result = await request(url, { Authorization: `apikey ${credential}`, Accept: 'application/json' });
      let data;
      try { data = JSON.parse((await boundedBody(result, 64 * 1024)).toString('utf8')); }
      catch (error) { throw error.safeCode ? error : failure('invalid_api_json'); }
      if (data.status === 'error') throw failure(`api_error_${Number.isInteger(data.code) ? data.code : 'unknown'}`);
      if (data.meta?.symbol && data.meta.symbol !== symbol) throw failure('symbol_mismatch');
      const logo = providerUrl(data.url);
      entry.providerUrl = logo.href;
      entry.status = 'download_started';
      await save();
      downloads++;
      // Logo requests never receive the API authentication header.
      const image = await request(logo, { Accept: 'image/png,image/jpeg,image/svg+xml' });
      const bytes = await boundedBody(image);
      if (bytes.includes(Buffer.from(credential))) throw failure('secret_in_asset_rejected');
      const extension = imageExtension(bytes, image.headers.get('content-type'));
      const filename = `${symbol}.${extension}`;
      await writeFile(resolve(directory, filename + '.tmp'), bytes);
      await rename(resolve(directory, filename + '.tmp'), resolve(directory, filename));
      Object.assign(entry, { path: `/logos/${filename}`, status: 'ready', mimeType: image.headers.get('content-type').split(';')[0], bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), fetchedAt: new Date().toISOString() });
      available++;
      console.log(`${symbol}: saved ${entry.path} (${bytes.length} bytes)`);
    } catch (error) {
      entry.status = 'unavailable';
      entry.error = error.safeCode || 'unexpected_error';
      failed++;
      console.log(`${symbol}: unavailable (${entry.error})`);
    }
    await save();
  }
  console.log(`Logo sync: ${available}/6 available; ${lookups} API lookups; ${downloads} image requests; ${failed} unavailable. No automatic retries.`);
  if (failed) process.exitCode = 1;
}

main().catch(error => { console.error(`Logo sync stopped: ${error.safeCode || 'unexpected_error'}.`); process.exitCode = 1; });
