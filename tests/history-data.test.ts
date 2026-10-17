import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHistoryDataService, parseYahooHistory, validHistoryDate} from '../lib/history-data.ts';

const NOW = Date.parse('2026-10-16T21:00:00Z');
const MINUTE = 60_000;
const seconds = (value: string | number) => Math.floor((typeof value === 'string' ? Date.parse(value) : value) / 1000);
function payload() {
  return {chart: {error: null, result: [{
    meta: {symbol: 'MSFT', currency: 'USD', dataGranularity: '1d', currentTradingPeriod: {regular: {start: seconds('2026-10-16T13:30:00Z'), end: seconds('2026-10-16T20:00:00Z')}}},
    timestamp: ['2026-10-14T13:30:00Z', '2026-10-15T13:30:00Z', '2026-10-16T13:30:00Z'].map(seconds),
    indicators: {quote: [{open: [100, 101, 102], high: [103, 104, 105], low: [99, 100, 101], close: [102, 103, 104], volume: [1000, 2000, 3000]}], adjclose: [{adjclose: [101.5, 102.5, 103.5]}]},
  }]}};
}

test('daily parser preserves provider raw and adjusted prices with exact observed dates', () => {
  const parsed = parseYahooHistory(payload(), 'MSFT', NOW);
  assert.equal(parsed.bars.length, 3);
  assert.deepEqual(parsed.bars[2], {date: '2026-10-16', timestamp: '2026-10-16T13:30:00.000Z', open: 102, high: 105, low: 101, close: 104, adjustedClose: 103.5, volume: 3000});
  assert.equal(parsed.sourceUrl, 'https://finance.yahoo.com/quote/MSFT/history/');
  assert.equal(parsed.fetchedAt, new Date(NOW).toISOString());
});

test('today daily bar is excluded until the provider regular session ends, including early close', () => {
  const body = payload();
  const during = parseYahooHistory(body, 'MSFT', Date.parse('2026-10-16T15:00:00Z'));
  assert.equal(during.bars.at(-1)!.date, '2026-10-15');
  body.chart.result[0].meta.currentTradingPeriod.regular.end = seconds('2026-10-16T17:00:00Z');
  assert.equal(parseYahooHistory(body, 'MSFT', Date.parse('2026-10-16T17:00:00Z')).bars.at(-1)!.date, '2026-10-16');
  body.chart.result[0].meta.currentTradingPeriod.regular.end = 0;
  assert.equal(parseYahooHistory(body, 'MSFT', NOW).bars.at(-1)!.date, '2026-10-15');
  assert.equal(parseYahooHistory(body, 'MSFT', NOW + 24 * 60 * MINUTE).bars.at(-1)!.date, '2026-10-16', 'Past sessions do not need a guessed holiday calendar.');
});

test('missing daily prices stay missing and duplicate sessions never create extra observations', () => {
  const body = payload();
  (body.chart.result[0].indicators.quote[0].close as (number | null)[])[1] = null;
  assert.deepEqual(parseYahooHistory(body, 'MSFT', NOW).bars.map(bar => bar.date), ['2026-10-14', '2026-10-16']);
  body.chart.result[0].timestamp[1] = body.chart.result[0].timestamp[0];
  assert.throws(() => parseYahooHistory(body, 'MSFT', NOW), /duplicate/);
});

test('history parser rejects wrong symbols, currencies, intervals, invalid OHLC, and future or weekend sessions', () => {
  for (const mutate of [
    (body: ReturnType<typeof payload>) => {body.chart.result[0].meta.symbol = 'AAPL';},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].meta.currency = 'EUR';},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].meta.dataGranularity = '5m';},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].indicators.quote[0].low[0] = 110;},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].indicators.adjclose[0].adjclose[0] = Infinity;},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].timestamp[2] = seconds(NOW + 2 * MINUTE);},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].timestamp[0] = seconds('2026-10-10T13:30:00Z');},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].indicators.adjclose[0].adjclose.pop();},
    (body: ReturnType<typeof payload>) => {body.chart.result[0].indicators.quote[0].volume[0] = -1;},
  ]) {
    const body = payload(); mutate(body);
    assert.throws(() => parseYahooHistory(body, 'MSFT', NOW), /Yahoo/);
  }
});

test('historical date validation rejects rollover and date-like garbage', () => {
  assert.ok(validHistoryDate('2024-02-29'));
  for (const value of ['2026-02-29', '2026-13-01', '26-10-01', '2026-10-16T00:00:00Z', 'yesterday']) assert.equal(validHistoryDate(value), false);
});

test('daily requests are allowlisted, deduplicated, cached, and callers cannot poison cache', async () => {
  let clock = NOW; let calls = 0; let release!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  const service = createHistoryDataService({now: () => clock, fetch: async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://query1.finance.yahoo.com');
    assert.equal(url.searchParams.get('range'), '2y');
    assert.equal(url.searchParams.get('interval'), '1d');
    assert.equal(init?.redirect, 'manual');
    await pending; return Response.json(payload());
  }});
  const first = service.getHistoricalData('MSFT');
  const second = service.getHistoricalData('MSFT');
  assert.equal(calls, 1); release();
  const one = await first; await second;
  one.bars[0].close = -1;
  assert.equal((await service.getHistoricalData('MSFT')).bars[0].close, 102);
  clock += 5 * MINUTE;
  await service.getHistoricalData('MSFT');
  assert.equal(calls, 2);
});

test('expired history does not masquerade as fresh evidence after failure; rate limits back off', async () => {
  let clock = NOW; let failing = false; let calls = 0;
  const service = createHistoryDataService({now: () => clock, fetch: async () => {calls++; return failing ? new Response('private', {status: 429}) : Response.json(payload());}});
  await service.getHistoricalData('MSFT');
  failing = true; clock += 5 * MINUTE;
  await assert.rejects(service.getHistoricalData('MSFT'), /rate limit/);
  await assert.rejects(service.getHistoricalData('MSFT'), /cooldown/);
  assert.equal(calls, 2);
  failing = false; clock += 5 * MINUTE;
  await service.getHistoricalData('MSFT');
  assert.equal(calls, 3);
});

test('history transport fails closed on redirects, malformed JSON, oversized responses, and timeout', async () => {
  for (const response of [new Response('', {status: 302}), new Response('private garbage'), new Response('{}', {headers: {'content-length': '2000001'}})]) {
    const service = createHistoryDataService({now: () => NOW, fetch: async () => response});
    await assert.rejects(service.getHistoricalData('MSFT'), error => error instanceof Error && !error.message.includes('private'));
  }
  let aborted = false;
  const service = createHistoryDataService({now: () => NOW, timeoutMs: 5, fetch: async (_input, init) => {init?.signal?.addEventListener('abort', () => {aborted = true;}); return new Promise<Response>(() => {});}});
  await assert.rejects(service.getHistoricalData('MSFT'), /timed out/);
  assert.equal(aborted, true);
});
