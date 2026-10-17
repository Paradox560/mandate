import {MARKET_SYMBOLS} from './market-data.ts';
import type {SymbolCode} from './types.ts';

export type HistoricalBar = {
  date: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number | null;
};
export type HistoricalData = {
  symbol: SymbolCode;
  provider: 'yahoo';
  currency: 'USD';
  fetchedAt: string;
  sourceUrl: string;
  bars: HistoricalBar[];
};
type Options = {fetch?: typeof globalThis.fetch; now?: () => number; timeoutMs?: number};
type ObjectValue = Record<string, unknown>;
const MINUTE = 60_000;
const MAX_BYTES = 2_000_000;
const nyDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'});
const nyWeekday = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', weekday: 'short'});

export class HistoryDataError extends Error {
  readonly rateLimited: boolean;
  constructor(message: string, rateLimited = false) {super(message); this.name = 'HistoryDataError'; this.rateLimited = rateLimited;}
}
function fail(message: string): never {throw new HistoryDataError(message);}
function object(value: unknown): ObjectValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null;
}
function positive(value: unknown): value is number {return typeof value === 'number' && Number.isFinite(value) && value > 0;}
function epoch(value: unknown): number | null {
  return positive(value) && Number.isInteger(value) && value < 8_640_000_000_000 ? value * 1000 : null;
}
export function isMarketSymbol(value: string): value is SymbolCode {return MARKET_SYMBOLS.includes(value as SymbolCode);}
export function validHistoryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

/** Only completed, observed daily sessions survive. Missing rows are never filled in. */
export function parseYahooHistory(body: unknown, symbol: SymbolCode, now = Date.now()): HistoricalData {
  if (!isMarketSymbol(symbol)) fail('Unsupported history symbol.');
  const chart = object(object(body)?.chart);
  if (!chart || chart.error != null || !Array.isArray(chart.result) || chart.result.length !== 1) fail('Yahoo did not return usable daily history.');
  const result = object(chart.result[0]);
  const meta = object(result?.meta);
  if (!result || !meta || meta.symbol !== symbol) fail('Yahoo returned a mismatched history symbol.');
  if (meta.currency !== 'USD') fail('Yahoo returned non-USD history.');
  if (meta.dataGranularity !== '1d') fail('Yahoo returned an unexpected history interval.');
  const indicators = object(result.indicators);
  const quote = Array.isArray(indicators?.quote) && indicators.quote.length === 1 ? object(indicators.quote[0]) : null;
  const adjusted = Array.isArray(indicators?.adjclose) && indicators.adjclose.length === 1 ? object(indicators.adjclose[0])?.adjclose : null;
  const timestamps = result.timestamp;
  if (!Array.isArray(timestamps) || !timestamps.length || timestamps.length > 1000 || !quote) fail('Yahoo returned incomplete daily history.');
  const columns = [quote.open, quote.high, quote.low, quote.close, adjusted];
  if (columns.some(column => !Array.isArray(column) || column.length !== timestamps.length)) fail('Yahoo returned incomplete daily price columns.');
  const [opens, highs, lows, closes, adjustedCloses] = columns as unknown[][];
  const volumes = quote.volume;
  if (volumes !== undefined && (!Array.isArray(volumes) || volumes.length !== timestamps.length)) fail('Yahoo returned incomplete daily volume.');
  const regular = object(object(meta.currentTradingPeriod)?.regular);
  const sessionStart = epoch(regular?.start);
  const sessionEnd = epoch(regular?.end);
  const today = nyDate.format(now);
  const todayComplete = sessionStart !== null && sessionEnd !== null && sessionEnd > sessionStart &&
    sessionEnd - sessionStart <= 12 * 60 * MINUTE && nyDate.format(sessionStart) === today && now >= sessionEnd;
  const seenDates = new Set<string>();
  const bars: HistoricalBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const time = epoch(timestamps[i]);
    if (time === null || time > now + MINUTE) fail('Yahoo returned an invalid or future daily timestamp.');
    const date = nyDate.format(time);
    if (seenDates.has(date)) fail('Yahoo returned duplicate daily sessions.');
    seenDates.add(date);
    if (['Sat', 'Sun'].includes(nyWeekday.format(time))) fail('Yahoo returned a weekend daily session.');
    // The daily bar is stamped at the opening bell, so its timestamp alone is not proof of completion.
    if (date > today || (date === today && !todayComplete)) continue;
    const values = [opens[i], highs[i], lows[i], closes[i], adjustedCloses[i]];
    if (values.some(value => value === null)) continue;
    if (!values.every(positive)) fail('Yahoo returned an invalid daily price.');
    const [open, high, low, close, adjustedClose] = values as number[];
    if (high < Math.max(open, low, close) || low > Math.min(open, high, close)) fail('Yahoo returned inconsistent daily prices.');
    const volume = Array.isArray(volumes) ? volumes[i] : null;
    if (volume !== null && (typeof volume !== 'number' || !Number.isSafeInteger(volume) || volume < 0)) fail('Yahoo returned invalid daily volume.');
    bars.push({date, timestamp: new Date(time).toISOString(), open, high, low, close, adjustedClose, volume});
  }
  bars.sort((a, b) => a.date.localeCompare(b.date));
  if (!bars.length) fail('Yahoo returned no completed daily sessions.');
  return {symbol, provider: 'yahoo', currency: 'USD', fetchedAt: new Date(now).toISOString(), sourceUrl: `https://finance.yahoo.com/quote/${symbol}/history/`, bars};
}

export function createHistoryDataService(options: Options = {}) {
  const request = options.fetch ?? ((...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args));
  const now = options.now ?? Date.now;
  const cache = new Map<SymbolCode, {expiresAt: number; data: HistoricalData}>();
  const inFlight = new Map<SymbolCode, Promise<HistoricalData>>();
  let backoffUntil = 0;
  async function fetchHistory(symbol: SymbolCode): Promise<HistoricalData> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {controller.abort(); reject(new HistoryDataError('Yahoo history request timed out.'));}, options.timeoutMs ?? 10_000);
    });
    try {
      return await Promise.race([timedOut, (async () => {
        const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
        url.searchParams.set('range', '2y');
        url.searchParams.set('interval', '1d');
        url.searchParams.set('includePrePost', 'false');
        url.searchParams.set('events', 'div,splits');
        const response = await request(url.toString(), {method: 'GET', redirect: 'manual', signal: controller.signal,
          headers: {accept: 'application/json', 'user-agent': 'Mandate/0.1 (private paper research prototype)'}});
        if (response.status === 429) {backoffUntil = now() + 5 * MINUTE; throw new HistoryDataError('Yahoo history rate limit reached; retry in five minutes.', true);}
        if (response.redirected || (response.status >= 300 && response.status < 400)) fail('Yahoo history redirects are not allowed.');
        if (!response.ok) fail(`Yahoo history request failed (HTTP ${response.status}).`);
        if (Number(response.headers.get('content-length')) > MAX_BYTES) fail('Yahoo returned oversized daily history.');
        const text = await response.text();
        if (text.length > MAX_BYTES) fail('Yahoo returned oversized daily history.');
        let body: unknown;
        try {body = JSON.parse(text);} catch {fail('Yahoo returned invalid history JSON.');}
        return parseYahooHistory(body, symbol, now());
      })()]);
    } catch (error) {
      if (error instanceof HistoryDataError) throw error;
      throw new HistoryDataError('Yahoo history request could not be completed.');
    } finally {if (timeout !== undefined) clearTimeout(timeout);}
  }
  async function getHistoricalData(symbol: SymbolCode): Promise<HistoricalData> {
    if (!isMarketSymbol(symbol)) fail('Unsupported history symbol.');
    const saved = cache.get(symbol);
    if (saved && saved.expiresAt > now()) return structuredClone(saved.data);
    if (backoffUntil > now()) throw new HistoryDataError('Yahoo history rate limit cooldown is active.', true);
    let pending = inFlight.get(symbol);
    if (!pending) {
      pending = fetchHistory(symbol).then(data => {cache.set(symbol, {data, expiresAt: now() + 5 * MINUTE}); return data;});
      inFlight.set(symbol, pending);
    }
    try {return structuredClone(await pending);} finally {if (inFlight.get(symbol) === pending) inFlight.delete(symbol);}
  }
  return {getHistoricalData};
}
export const getHistoricalData = createHistoryDataService().getHistoricalData;
