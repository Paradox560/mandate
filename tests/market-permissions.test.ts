import { marketSnapshot } from './helpers/market-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE, seededState } from '../lib/fixtures.ts';
import { canonicalSample, evaluateOrder, fingerprintOrder } from '../lib/permissions.ts';
import type { Order, Quote } from '../lib/types.ts';

const now = Date.parse('2026-10-16T18:00:00Z');
function setup() {
  const state = seededState(now);
  state.positions=[{symbol:'MSFT',shares:10,costBasis:480},{symbol:'AAPL',shares:10,costBasis:218}];
  const evidence = EVIDENCE.map(source => ({ ...source, publishedAt: '2026-10-15' }));
  const research = canonicalSample('NVDA', evidence, 'market-test', now);
  state.research.unshift(research);
  const market: Quote[] = marketSnapshot(now).map(quote => ({ ...quote, source: 'yahoo', marketState: 'open', stale: false, fetchedAt: new Date(now).toISOString() }));
  const price = market[0].price;
  const order: Order = { id: 'yahoo-order', researchId: research.id, symbol: 'NVDA', side: 'buy', quantity: 1, price, notional: price, status: 'review', checks: [], evidenceIds: research.evidenceIds, createdAt: new Date(now).toISOString(), traceId: 'market-test', fingerprint: '', marketMode: 'yahoo' };
  return { state, evidence, market, order };
}
test('fresh Yahoo quotes and current evidence can pass the paper mandate', () => {
  const s = setup();
  assert.ok(evaluateOrder(s.order, s.state, s.market, s.evidence, now).every(check => check.passed));
});
test('current Yahoo orders do not reuse the historical evidence clock', () => {
  const s = setup();
  assert.equal(evaluateOrder(s.order, s.state, s.market, EVIDENCE, now).find(check => check.key === 'source_age')?.passed, false);
});
test('Yahoo orders cannot silently execute with a synthetic replacement quote', () => {
  const s = setup();
  assert.equal(evaluateOrder(s.order, s.state, marketSnapshot(now), s.evidence, now).find(check => check.key === 'market_source')?.passed, false);
});
test('a closed regular session blocks Yahoo-priced paper execution', () => {
  const s = setup(); s.market[0].marketState = 'closed';
  assert.equal(evaluateOrder(s.order, s.state, s.market, s.evidence, now).find(check => check.key === 'market_session')?.passed, false);
});
test('a provider failure remains stale even when its cached timestamp is recent', () => {
  const s = setup(); s.market[0].stale = true;
  assert.equal(evaluateOrder(s.order, s.state, s.market, s.evidence, now).find(check => check.key === 'freshness')?.passed, false);
});
test('an unpriced holding prevents Yahoo portfolio-limit authorization', () => {
  const s = setup(); s.market = s.market.filter(quote => quote.symbol !== 'AAPL');
  assert.equal(evaluateOrder(s.order, s.state, s.market, s.evidence, now).find(check => check.key === 'portfolio_quotes')?.passed, false);
});
test('market data source is bound into order approval fingerprints', async () => {
  const s = setup();
  assert.notEqual(await fingerprintOrder(s.order, s.state), await fingerprintOrder({ ...s.order, marketMode: 'replay' }, s.state));
});
test('old or future holding marks cannot authorize concentration even when the provider says non-stale', () => {
  for (const offsetSeconds of [-600, 60]) {
    const s = setup();
    const holding = s.market.find(quote => quote.symbol === 'MSFT')!;
    holding.timestamp = new Date(now + offsetSeconds * 1000).toISOString();
    holding.stale = false;
    assert.equal(evaluateOrder(s.order, s.state, s.market, s.evidence, now).find(check => check.key === 'portfolio_quotes')?.passed, false);
    assert.equal(evaluateOrder(s.order, s.state, s.market, s.evidence, now).find(check => check.key === 'freshness')?.passed, true);
  }
});
