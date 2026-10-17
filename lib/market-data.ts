import {marketSnapshot} from './fixtures.ts';
import type {MarketFeed, MarketMode, Quote, SymbolCode} from './types.ts';

export const MARKET_INSTRUMENTS: readonly {symbol: SymbolCode; name: string; sector: string}[] = [
  {symbol: 'NVDA', name: 'NVIDIA', sector: 'Information Technology'},
  {symbol: 'MSFT', name: 'Microsoft', sector: 'Information Technology'},
  {symbol: 'AAPL', name: 'Apple', sector: 'Information Technology'},
  {symbol: 'GOOGL', name: 'Alphabet', sector: 'Communication Services'},
  {symbol: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary'},
  {symbol: 'META', name: 'Meta Platforms', sector: 'Communication Services'},
];
export const MARKET_SYMBOLS = MARKET_INSTRUMENTS.map(item => item.symbol);
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const CACHE_MS = MINUTE;
const RATE_LIMIT_MS = 5 * MINUTE;
const MAX_OPEN_AGE = 20 * MINUTE;
const MAX_SESSION_AGE = 4 * DAY;
const FUTURE_TOLERANCE = MINUTE;
const MAX_RESPONSE_BYTES = 1_000_000;

type ObjectValue = Record<string, unknown>;
type Session = {start: number; end: number} | null;
type StoredQuote = {quote: Quote; session: Session};
type MarketData = {market: Quote[]; marketFeed: MarketFeed};
export type MarketDataOptions = {fetch?: typeof globalThis.fetch; now?: () => number; timeoutMs?: number};
class MarketDataError extends Error {
  readonly rateLimited: boolean;
  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = 'MarketDataError';
    this.rateLimited = rateLimited;
  }
}
function object(value: unknown): ObjectValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null;
}
function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function epoch(value: unknown): number | null {
  return finitePositive(value) && Number.isInteger(value) && value < 8_640_000_000_000 ? value * 1000 : null;
}
function fail(message: string): never { throw new MarketDataError(message); }
const sessionDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'});
const sessionTime = new Intl.DateTimeFormat('en-GB', {timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
function regularBar(timestamp: number): boolean {
  const time = sessionTime.format(timestamp);
  // Yahoo can include a final closing observation just after 16:00.
  return time >= '09:30' && time <= '16:00';
}
function sessionFrom(meta: ObjectValue): Session {
  const regular = object(object(meta.currentTradingPeriod)?.regular);
  const start = epoch(regular?.start);
  const end = epoch(regular?.end);
  return start !== null && end !== null && end > start && end - start <= 12 * 60 * MINUTE ? {start, end} : null;
}
function freshness(entry: StoredQuote, now: number): Pick<Quote, 'marketState' | 'stale'> {
  const session = entry.session;
  const quoteTime = Date.parse(entry.quote.timestamp);
  const obsolete = !session || session.end < now - MAX_SESSION_AGE || session.start > now + MAX_SESSION_AGE;
  if (obsolete) return {marketState: 'unknown', stale: true};
  const open = now >= session.start && now < session.end;
  return {marketState: open ? 'open' : 'closed', stale: now - quoteTime > (open ? MAX_OPEN_AGE : MAX_SESSION_AGE)};
}
function parseChart(body: unknown, symbol: SymbolCode, now: number): StoredQuote {
  const instrument = MARKET_INSTRUMENTS.find(item => item.symbol === symbol);
  if (!instrument) fail('Unsupported market symbol.');
  const chart = object(object(body)?.chart);
  if (!chart || chart.error != null || !Array.isArray(chart.result) || chart.result.length !== 1) fail('Yahoo did not return usable chart data.');
  const result = object(chart.result[0]);
  const meta = object(result?.meta);
  if (!result || !meta || meta.symbol !== symbol) fail('Yahoo returned a mismatched market symbol.');
  if (meta.currency !== 'USD') fail('Yahoo returned a non-USD quote.');
  if (!finitePositive(meta.regularMarketPrice) || !finitePositive(meta.previousClose)) fail('Yahoo returned an invalid price or previous close.');
  if (meta.dataGranularity !== undefined && meta.dataGranularity !== '5m') fail('Yahoo returned an unexpected chart interval.');
  const quoteTime = epoch(meta.regularMarketTime);
  if (quoteTime === null || quoteTime > now + FUTURE_TOLERANCE) fail('Yahoo returned an invalid or future quote timestamp.');
  const indicators = object(result.indicators);
  const firstQuote = Array.isArray(indicators?.quote) ? object(indicators.quote[0]) : null;
  const timestamps = result.timestamp;
  const closes = firstQuote?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes) || timestamps.length !== closes.length || timestamps.length === 0) fail('Yahoo returned incomplete chart history.');
  const bars: {time: number; close: number}[] = [];
  const seen = new Set<number>();
  for (let index = 0; index < timestamps.length; index++) {
    const time = epoch(timestamps[index]);
    if (time === null || time > now + FUTURE_TOLERANCE) fail('Yahoo returned an invalid or future chart timestamp.');
    if (seen.has(time)) fail('Yahoo returned duplicate chart timestamps.');
    seen.add(time);
    const close = closes[index];
    // Missing provider bars stay missing; no interpolation or invented observations.
    if (close === null) continue;
    if (!finitePositive(close)) fail('Yahoo returned an invalid chart price.');
    if (regularBar(time)) bars.push({time, close});
  }
  bars.sort((left, right) => left.time - right.time);
  if (!bars.length) fail('Yahoo returned no regular-session chart observations.');
  const latestDay = sessionDate.format(bars.at(-1)!.time);
  const latestBars = bars.filter(bar => sessionDate.format(bar.time) === latestDay);
  const price = meta.regularMarketPrice;
  const previousClose = meta.previousClose;
  const change = Math.round(((price - previousClose) / previousClose) * 10_000) / 100;
  if (!Number.isFinite(change)) fail('Yahoo returned an invalid daily price change.');
  const exchange = typeof meta.fullExchangeName === 'string' ? meta.fullExchangeName : meta.exchangeName;
  const quote: Quote = {
    ...instrument, price, previousClose,
    change,
    history: latestBars.map(bar => bar.close),
    historyTimestamps: latestBars.map(bar => new Date(bar.time).toISOString()),
    timestamp: new Date(quoteTime).toISOString(), fetchedAt: new Date(now).toISOString(),
    source: 'yahoo', currency: 'USD',
    ...(typeof exchange === 'string' && exchange.length <= 100 ? {exchangeName: exchange} : {}),
    // Only zero has unambiguous units; do not invent a latency promise for other values.
    ...(meta.exchangeDataDelayedBy === 0 ? {delaySeconds: 0} : {}),
  };
  const entry = {quote, session: sessionFrom(meta)};
  Object.assign(quote, freshness(entry, now));
  return entry;
}

/** Strict parser exported for deterministic provider-contract tests. */
export function parseYahooChart(body: unknown, symbol: SymbolCode, now = Date.now()): Quote {
  return parseChart(body, symbol, now).quote;
}

export function createMarketDataService(options: MarketDataOptions = {}) {
  const request = options.fetch ?? ((...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args));
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const known = new Map<SymbolCode, StoredQuote>();
  let errors: MarketFeed['errors'] = [];
  let cachedUntil = 0;
  let backoffUntil = 0;
  let inFlight: Promise<void> | null = null;

  async function fetchSymbol(symbol: SymbolCode): Promise<StoredQuote> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new MarketDataError('Yahoo request timed out.'));
      }, timeoutMs);
    });
    try {
      return await Promise.race([timedOut, (async () => {
        const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
        url.searchParams.set('range', '5d');
        url.searchParams.set('interval', '5m');
        url.searchParams.set('includePrePost', 'false');
        const response = await request(url.toString(), {
          // Workers support manual/follow; manual prevents a redirect request.
          method: 'GET', redirect: 'manual', signal: controller.signal,
          headers: {accept: 'application/json', 'user-agent': 'Mandate/0.1 (private paper research prototype)'},
        });
        if (response.status === 429) throw new MarketDataError('Yahoo rate limit reached; refresh paused for five minutes.', true);
        if (response.redirected || (response.status >= 300 && response.status < 400)) fail('Yahoo redirects are not allowed.');
        if (!response.ok) fail(`Yahoo market request failed (HTTP ${response.status}).`);
        const declaredLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) fail('Yahoo returned an oversized chart response.');
        const text = await response.text();
        if (text.length > MAX_RESPONSE_BYTES) fail('Yahoo returned an oversized chart response.');
        let body: unknown;
        try { body = JSON.parse(text); } catch { fail('Yahoo returned invalid market JSON.'); }
        return parseChart(body, symbol, now());
      })()]);
    } catch (error) {
      if (error instanceof MarketDataError) throw error;
      throw new MarketDataError('Yahoo market request could not be completed.');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }
  function render(): MarketData {
    const clock = now();
    const paused = clock >= cachedUntil && clock < backoffUntil;
    const reported = paused
      ? MARKET_SYMBOLS.map(symbol => ({symbol, message: 'Yahoo rate limit cooldown is active; retaining last-known data.'}))
      : errors.map(error => ({...error}));
    const failed = new Set(reported.map(error => error.symbol));
    const market = MARKET_SYMBOLS.flatMap(symbol => {
      const entry = known.get(symbol);
      if (!entry) return [];
      const quote = {...entry.quote, ...freshness(entry, clock), history: [...entry.quote.history], historyTimestamps: [...entry.quote.historyTimestamps!]};
      if (failed.has(symbol)) quote.stale = true;
      if (quote.stale && !failed.has(symbol)) reported.push({symbol, message: quote.marketState === 'unknown' ? 'Yahoo session timing is missing or obsolete.' : 'Yahoo quote is older than the freshness limit.'});
      return [quote];
    });
    const status = market.length === 0 ? 'unavailable' : reported.length || market.length !== MARKET_SYMBOLS.length ? 'partial' : 'ok';
    const fetched = market.map(quote => quote.fetchedAt!).sort().at(-1) ?? null;
    return {market, marketFeed: {
      mode: 'yahoo', provider: 'Yahoo Finance', fetchedAt: fetched, status,
      message: status === 'ok' ? 'Yahoo Finance observations; refreshes every 60 seconds. Provider timestamps determine freshness.'
        : status === 'partial' ? 'Some Yahoo observations are unavailable or stale. Last-known prices are labelled; no synthetic substitution.'
          : 'Yahoo market data is unavailable. No synthetic prices have been substituted.',
      refreshSeconds: clock < backoffUntil ? Math.max(60, Math.ceil((backoffUntil - clock) / 1000)) : 60,
      errors: reported,
    }};
  }
  async function getMarketData(mode: MarketMode = 'yahoo'): Promise<MarketData> {
    if (mode === 'replay') {
      const clock = now();
      const fetchedAt = new Date(clock).toISOString();
      return {market: marketSnapshot(clock).map(quote => ({
        ...quote, source: 'synthetic', fetchedAt, marketState: 'unknown', stale: false, currency: 'USD',
        historyTimestamps: quote.history.map((_, index) => new Date(clock - (quote.history.length - index - 1) * 5 * MINUTE).toISOString()),
      })), marketFeed: {mode: 'replay', provider: 'Synthetic replay', fetchedAt, status: 'ok', refreshSeconds: 5, errors: [], message: 'Generated demo prices. These are synthetic observations, not exchange data.'}};
    }
    if (mode !== 'yahoo') throw new Error('Unsupported market mode.');
    if (now() < cachedUntil || now() < backoffUntil) return render();
    if (!inFlight) {
      inFlight = (async () => {
        const failures: MarketFeed['errors'] = [];
        await Promise.all(MARKET_SYMBOLS.map(async symbol => {
          try { known.set(symbol, await fetchSymbol(symbol)); }
          catch (error) {
            const failure = error instanceof MarketDataError ? error : new MarketDataError('Yahoo market request could not be completed.');
            if (failure.rateLimited) backoffUntil = Math.max(backoffUntil, now() + RATE_LIMIT_MS);
            failures.push({symbol, message: failure.message});
          }
        }));
        errors = failures;
        cachedUntil = now() + CACHE_MS;
      })();
    }
    try { await inFlight; } finally { inFlight = null; }
    return render();
  }
  return {getMarketData};
}
const marketService = createMarketDataService();
export const getMarketData = marketService.getMarketData;
