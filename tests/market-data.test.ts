import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMarketDataService, MARKET_SYMBOLS, parseYahooChart} from '../lib/market-data.ts';
import type {SymbolCode} from '../lib/types.ts';

const NOW = Date.parse('2026-10-16T16:00:00Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const seconds = (time: string | number) => Math.floor((typeof time === 'string' ? Date.parse(time) : time) / 1000);
function payload(symbol: SymbolCode = 'AAPL', meta: Record<string, unknown> = {}, timestamps?: number[], closes?: (number | null)[]) {
  return {chart: {error: null, result: [{
    meta: {
      symbol, currency: 'USD', regularMarketPrice: 343.46, previousClose: 342,
      chartPreviousClose: 310, regularMarketTime: seconds(NOW - MINUTE),
      dataGranularity: '5m', exchangeName: 'NMS', fullExchangeName: 'NasdaqGS',
      exchangeDataDelayedBy: 0,
      currentTradingPeriod: {regular: {start: seconds('2026-10-16T13:30:00Z'), end: seconds('2026-10-16T20:00:00Z')}},
      ...meta,
    },
    timestamp: timestamps ?? [seconds('2026-10-15T19:55:00Z'), seconds('2026-10-16T13:30:00Z'), seconds('2026-10-16T13:35:00Z'), seconds('2026-10-16T13:40:00Z')],
    indicators: {quote: [{close: closes ?? [341, 342.2, null, 343.1]}]},
  }]}};
}
function requestSymbol(input: Parameters<typeof fetch>[0]): SymbolCode {
  return new URL(String(input)).pathname.split('/').at(-1) as SymbolCode;
}
function responseFor(input: Parameters<typeof fetch>[0], now = NOW): Response {
  return Response.json(payload(requestSymbol(input), {regularMarketTime: seconds(now - MINUTE)}));
}

test('parser preserves actual quote time, prefers previousClose, and keeps only real latest-session bars', () => {
  const quote = parseYahooChart(payload(), 'AAPL', NOW);
  assert.equal(quote.symbol, 'AAPL');
  assert.equal(quote.price, 343.46);
  assert.equal(quote.previousClose, 342, 'Five-day chartPreviousClose must not drive daily change.');
  assert.equal(quote.change, 0.43);
  assert.equal(quote.timestamp, '2026-10-16T15:59:00.000Z');
  assert.equal(quote.fetchedAt, '2026-10-16T16:00:00.000Z');
  assert.deepEqual(quote.history, [342.2, 343.1], 'A missing five-minute bar must not be interpolated.');
  assert.deepEqual(quote.historyTimestamps, ['2026-10-16T13:30:00.000Z', '2026-10-16T13:40:00.000Z']);
  assert.equal(quote.source, 'yahoo');
  assert.equal(quote.marketState, 'open');
  assert.equal(quote.stale, false);
  assert.equal(quote.currency, 'USD');
  assert.equal(quote.exchangeName, 'NasdaqGS');
});

test('parser orders bars and excludes premarket and after-hours observations', () => {
  const timestamps = ['2026-10-15T19:55:00Z', '2026-10-16T13:40:00Z', '2026-10-16T13:00:00Z', '2026-10-16T13:30:00Z', '2026-10-15T21:00:00Z'].map(seconds);
  const quote = parseYahooChart(payload('MSFT', {}, timestamps, [340, 343, 339, 342, 348]), 'MSFT', NOW);
  assert.deepEqual(quote.history, [342, 343]);
  assert.deepEqual(quote.historyTimestamps, ['2026-10-16T13:30:00.000Z', '2026-10-16T13:40:00.000Z']);
});

test('parser rejects mismatched instruments, non-USD prices, poisoned prices, and future timestamps', () => {
  for (const [meta, pattern] of [
    [{symbol: 'MSFT'}, /mismatched/],
    [{currency: 'EUR'}, /non-USD/],
    [{regularMarketPrice: Infinity}, /invalid price/],
    [{regularMarketPrice: -1}, /invalid price/],
    [{previousClose: 0}, /invalid price/],
    [{previousClose: undefined}, /invalid price/],
    [{regularMarketPrice: Number.MAX_VALUE, previousClose: Number.MIN_VALUE}, /invalid daily price change/],
    [{regularMarketTime: seconds(NOW + 2 * MINUTE)}, /future quote timestamp/],
    [{regularMarketTime: '1792166340'}, /invalid or future quote/],
    [{dataGranularity: '1d'}, /unexpected chart interval/],
  ] as [Record<string, unknown>, RegExp][]) {
    assert.throws(() => parseYahooChart(payload('AAPL', meta), 'AAPL', NOW), pattern);
  }
  assert.throws(() => parseYahooChart(payload('AAPL', {}, [seconds(NOW + 2 * MINUTE)], [12]), 'AAPL', NOW), /future chart timestamp/);
  assert.throws(() => parseYahooChart(payload('AAPL', {}, [seconds(NOW), seconds(NOW)], [12, 13]), 'AAPL', NOW), /duplicate/);
  assert.throws(() => parseYahooChart(payload('AAPL', {}, [seconds(NOW)], [Number.NaN]), 'AAPL', NOW), /invalid chart price/);
  assert.throws(() => parseYahooChart(payload('AAPL', {}, [seconds(NOW)], []), 'AAPL', NOW), /incomplete chart history/);
  assert.throws(() => parseYahooChart({chart: {error: {description: 'provider private payload'}, result: null}}, 'AAPL', NOW), /usable chart data/);
  assert.throws(() => parseYahooChart(payload(), 'SPY' as SymbolCode, NOW), /Unsupported/);
});

test('quote ages independently of fetch time and stale open quotes remain stale', () => {
  const quote = parseYahooChart(payload('AAPL', {regularMarketTime: seconds(NOW - 21 * MINUTE)}), 'AAPL', NOW);
  assert.equal(quote.marketState, 'open');
  assert.equal(quote.stale, true);
  assert.equal(quote.timestamp, new Date(NOW - 21 * MINUTE).toISOString());
  assert.equal(quote.fetchedAt, new Date(NOW).toISOString());
});

test('a Friday close stays explicitly closed on Saturday; obsolete sessions become unknown and stale', () => {
  const close = Date.parse('2026-10-16T20:00:01Z');
  const saturday = Date.parse('2026-10-17T16:00:00Z');
  const quote = parseYahooChart(payload('AAPL', {regularMarketTime: seconds(close)}), 'AAPL', saturday);
  assert.equal(quote.marketState, 'closed');
  assert.equal(quote.stale, false);
  assert.equal(quote.timestamp, new Date(close).toISOString());
  const obsolete = parseYahooChart(payload('AAPL', {regularMarketTime: seconds(close)}), 'AAPL', saturday + 5 * DAY);
  assert.equal(obsolete.marketState, 'unknown');
  assert.equal(obsolete.stale, true);
  const missingSession = parseYahooChart(payload('AAPL', {currentTradingPeriod: {}}), 'AAPL', NOW);
  assert.equal(missingSession.marketState, 'unknown');
  assert.equal(missingSession.stale, true);
});

test('requests are allowlisted, cached for 60 seconds, deduplicated in flight, and returned copies cannot corrupt cache', async () => {
  let clock = NOW;
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  const service = createMarketDataService({now: () => clock, fetch: async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://query1.finance.yahoo.com');
    assert.ok(MARKET_SYMBOLS.includes(requestSymbol(input)));
    assert.equal(url.searchParams.get('range'), '5d');
    assert.equal(url.searchParams.get('interval'), '5m');
    assert.equal(url.searchParams.get('includePrePost'), 'false');
    assert.equal(init?.redirect, 'manual');
    assert.equal(new Headers(init?.headers).get('user-agent'), 'Mandate/0.1 (private paper research prototype)');
    assert.ok(init?.signal);
    await pending;
    return responseFor(input, clock);
  }});
  const first = service.getMarketData();
  const concurrent = service.getMarketData();
  assert.equal(calls, 6);
  release();
  const [one, two] = await Promise.all([first, concurrent]);
  assert.equal(one.marketFeed.status, 'ok');
  assert.equal(two.market.length, 6);
  one.market[0].history[0] = -999;
  clock += 59_000;
  const cached = await service.getMarketData();
  assert.notEqual(cached.market[0].history[0], -999);
  assert.equal(cached.market[0].fetchedAt, new Date(NOW).toISOString());
  assert.equal(calls, 6);
  clock += 1000;
  await service.getMarketData();
  assert.equal(calls, 12);
});

test('cached metadata is re-evaluated at the current clock rather than keeping market open forever', async () => {
  let clock = Date.parse('2026-10-16T19:59:50Z');
  const service = createMarketDataService({now: () => clock, fetch: async input => responseFor(input, clock)});
  const open = await service.getMarketData();
  assert.equal(open.market[0].marketState, 'open');
  clock += 20_000;
  const closed = await service.getMarketData();
  assert.equal(closed.market[0].marketState, 'closed');
  assert.equal(closed.market[0].fetchedAt, open.market[0].fetchedAt);
});

test('a symbol failure retains only its last-known observed price, marks it stale, and sanitizes errors', async () => {
  let clock = NOW;
  let failing = false;
  const service = createMarketDataService({now: () => clock, fetch: async input => {
    if (failing && requestSymbol(input) === 'AAPL') return new Response('private raw body must not escape', {status: 503});
    return responseFor(input, clock);
  }});
  const original = await service.getMarketData();
  clock += MINUTE;
  failing = true;
  const partial = await service.getMarketData();
  assert.equal(partial.marketFeed.status, 'partial');
  const apple = partial.market.find(quote => quote.symbol === 'AAPL')!;
  const oldApple = original.market.find(quote => quote.symbol === 'AAPL')!;
  assert.equal(apple.price, oldApple.price);
  assert.equal(apple.timestamp, oldApple.timestamp);
  assert.equal(apple.fetchedAt, oldApple.fetchedAt);
  assert.equal(apple.stale, true);
  assert.equal(partial.market.find(quote => quote.symbol === 'MSFT')!.stale, false);
  assert.deepEqual(partial.marketFeed.errors, [{symbol: 'AAPL', message: 'Yahoo market request failed (HTTP 503).'}]);
  assert.ok(partial.market.every(quote => quote.source === 'yahoo'));
});

test('cold failure returns no invented or synthetic prices', async () => {
  const service = createMarketDataService({now: () => NOW, fetch: async () => {throw new Error('secret upstream body');}});
  const result = await service.getMarketData();
  assert.deepEqual(result.market, []);
  assert.equal(result.marketFeed.status, 'unavailable');
  assert.equal(result.marketFeed.fetchedAt, null);
  assert.equal(result.marketFeed.errors.length, 6);
  assert.ok(result.marketFeed.errors.every(error => !error.message.includes('secret')));
});

test('429 starts a five-minute cooldown with no requests during cooldown and recovers afterwards', async () => {
  let clock = NOW;
  let limited = false;
  let calls = 0;
  const service = createMarketDataService({now: () => clock, fetch: async input => {
    calls++;
    return limited ? new Response('provider detail', {status: 429}) : responseFor(input, clock);
  }});
  await service.getMarketData();
  clock += MINUTE;
  limited = true;
  const throttled = await service.getMarketData();
  assert.equal(calls, 12);
  assert.equal(throttled.marketFeed.refreshSeconds, 300);
  assert.ok(throttled.market.every(quote => quote.stale));
  clock += 4 * MINUTE;
  const paused = await service.getMarketData();
  assert.equal(calls, 12);
  assert.ok(paused.marketFeed.errors.every(error => /cooldown/.test(error.message)));
  limited = false;
  clock += MINUTE;
  const recovered = await service.getMarketData();
  assert.equal(calls, 18);
  assert.equal(recovered.marketFeed.status, 'ok');
});

test('redirects, malformed JSON, and oversized responses fail without exposing provider content', async () => {
  for (const response of [
    () => new Response('', {status: 302, headers: {location: 'https://example.com/secret'}}),
    () => new Response('<html>private error detail</html>'),
    () => new Response('{}', {headers: {'content-length': '1000001'}}),
  ]) {
    const service = createMarketDataService({now: () => NOW, fetch: async () => response()});
    const result = await service.getMarketData();
    assert.equal(result.marketFeed.status, 'unavailable');
    assert.equal(result.market.length, 0);
    assert.ok(result.marketFeed.errors.every(error => !/secret|private/.test(error.message)));
  }
});

test('request timeout aborts hanging fetches and fails closed', async () => {
  let aborted = 0;
  const service = createMarketDataService({now: () => NOW, timeoutMs: 10, fetch: async (_input, init) => {
    init?.signal?.addEventListener('abort', () => {aborted++;});
    return new Promise<Response>(() => {});
  }});
  const result = await service.getMarketData();
  assert.equal(aborted, 6);
  assert.equal(result.marketFeed.status, 'unavailable');
  assert.ok(result.marketFeed.errors.every(error => error.message === 'Yahoo request timed out.'));
});

test('replay is explicitly synthetic and never makes an upstream request', async () => {
  const service = createMarketDataService({now: () => NOW, fetch: async () => {throw new Error('Replay must not fetch.');}});
  const result = await service.getMarketData('replay');
  assert.equal(result.marketFeed.mode, 'replay');
  assert.equal(result.marketFeed.provider, 'Synthetic replay');
  assert.equal(result.marketFeed.status, 'ok');
  assert.equal(result.market.length, 6);
  assert.ok(result.market.every(quote => quote.source === 'synthetic' && quote.stale === false && quote.history.length === quote.historyTimestamps!.length));
  assert.match(result.marketFeed.message, /synthetic/);
});
