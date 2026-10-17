import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {HistoricalData} from '../lib/history-data.ts';
import {simulateHistoricalStrategy, STRATEGIES} from '../lib/strategies.ts';

function history(prices: number[]): HistoricalData {
  let time = Date.parse('2026-01-02T14:30:00Z');
  return {symbol: 'MSFT', provider: 'yahoo', currency: 'USD', fetchedAt: '2026-10-17T16:00:00.000Z', sourceUrl: 'https://finance.yahoo.com/quote/MSFT/history/', bars: prices.map(close => {
    while ([0, 6].includes(new Date(time).getUTCDay())) time += 86_400_000;
    const timestamp = new Date(time).toISOString(); time += 86_400_000;
    return {date: timestamp.slice(0, 10), timestamp, open: close, high: close + 1, low: close - 1, close, adjustedClose: close, volume: 1000};
  })};
}

test('flat buy and hold pays one disclosed entry cost and matches its benchmark', () => {
  const result = simulateHistoricalStrategy(history(Array(70).fill(100)), 'buy-and-hold');
  assert.equal(result.points.length, 20);
  assert.equal(result.metrics.trades, 1);
  assert.equal(result.metrics.transactionCostBps, 10);
  assert.equal(result.metrics.endingEquity, 9990.01);
  assert.equal(result.metrics.totalReturnPct, -0.1);
  assert.equal(result.metrics.benchmarkReturnPct, -0.1);
  assert.equal(result.signal.side, 'buy');
  assert.equal(result.points[0].trade, 'buy');
  assert.ok(result.points.slice(1).every(point => point.trade === null));
});

test('trend and momentum use prior close; a final-session shock changes the signal but cannot trigger that open', () => {
  const data = history([...Array(69).fill(100), 200, 210]);
  for (const id of ['sma-20-50', 'momentum-20'] as const) {
    const beforeExecution = simulateHistoricalStrategy(data, id, data.bars[69].date);
    assert.equal(beforeExecution.signal.side, 'buy');
    assert.equal(beforeExecution.metrics.trades, 0);
    assert.equal(beforeExecution.points.at(-1)!.position, 'cash');
    const nextSession = simulateHistoricalStrategy(data, id);
    assert.equal(nextSession.metrics.trades, 1);
    assert.equal(nextSession.points.at(-1)!.trade, 'buy');
    assert.equal(nextSession.metrics.endingEquity, 9990.01, 'The strategy cannot earn the price shock before its next-session entry.');
  }
});

test('inspecting an earlier date truncates all history and ignores future changes in signal and equity', () => {
  const data = history(Array.from({length: 90}, (_, index) => 100 + index));
  const asOf = data.bars[70].date;
  const original = simulateHistoricalStrategy(data, 'sma-20-50', asOf);
  const changed = structuredClone(data);
  changed.bars.slice(71).forEach(bar => {bar.close = 5; bar.adjustedClose = 5; bar.open = 5;});
  const again = simulateHistoricalStrategy(changed, 'sma-20-50', asOf);
  assert.deepEqual(again, original);
  assert.equal(original.bars.length, 71);
  assert.equal(original.points.length, 21);
  assert.equal(original.asOf, asOf);
  assert.equal(original.latestAvailableDate, data.bars.at(-1)!.date);
  assert.ok(original.points.every(point => point.date <= asOf));
});

test('adjusted close drives return model while raw provider close remains inspectable', () => {
  const data = history(Array(60).fill(100));
  data.bars.forEach(bar => {bar.adjustedClose = 50;});
  data.bars.slice(55).forEach(bar => {bar.open = 50; bar.close = 50; bar.high = 51; bar.low = 49;});
  const result = simulateHistoricalStrategy(data, 'buy-and-hold');
  assert.equal(result.metrics.totalReturnPct, -0.1, 'A split in raw prices must not fabricate a 50% loss.');
  assert.equal(result.points[0].price, 100);
  assert.equal(result.points.at(-1)!.price, 50);
  assert.ok(result.points.every(point => point.adjustedClose === 50));
});

test('drawdown includes actual marked losses and strategy exits incur a second fee', () => {
  const data = history([...Array.from({length: 70}, (_, index) => 100 + index), ...Array(25).fill(80)]);
  const result = simulateHistoricalStrategy(data, 'momentum-20');
  assert.equal(result.metrics.trades, 2);
  assert.equal(result.signal.side, 'hold');
  assert.equal(result.points.at(-1)!.position, 'cash');
  assert.ok(result.metrics.maxDrawdownPct < -50);
  assert.ok(result.metrics.endingEquity < 10000);
});

test('every strategy has canonical Yahoo evidence and full simulation assumptions', () => {
  const data = history(Array.from({length: 70}, (_, index) => 100 + index));
  for (const strategy of STRATEGIES) {
    const result = simulateHistoricalStrategy(data, strategy.id);
    assert.equal(result.evidence.id, `yahoo-history-MSFT-${result.asOf}-${strategy.id}`);
    assert.equal(result.evidence.publishedAt, data.bars.at(-1)!.timestamp);
    assert.equal(result.evidence.provenance?.retrievedAt, data.fetchedAt);
    assert.equal(result.evidence.provenance?.asOf, result.asOf);
    assert.equal(result.evidence.metrics.close, 169);
    assert.match(result.evidence.text, /not a forecast/);
    assert.match(result.methodology.join(' '), /next observed session open/);
    assert.match(result.methodology.join(' '), /not an archived point-in-time/);
  }
});

test('insufficient history, invalid dates, future dates, and unknown strategies fail explicitly', () => {
  const data = history(Array(70).fill(100));
  assert.throws(() => simulateHistoricalStrategy(history(Array(50).fill(100))), /51 complete/);
  assert.throws(() => simulateHistoricalStrategy(data, 'sma-20-50', data.bars[49].date), /50-session/);
  assert.throws(() => simulateHistoricalStrategy(data, 'sma-20-50', '2026-02-30'), /valid YYYY-MM-DD/);
  assert.throws(() => simulateHistoricalStrategy(data, 'sma-20-50', '2026-12-31'), /available through/);
  assert.throws(() => simulateHistoricalStrategy(data, 'untrusted' as 'sma-20-50'), /Unknown/);
});
