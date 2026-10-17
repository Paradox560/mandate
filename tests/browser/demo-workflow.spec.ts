import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { DeskSnapshot, Order } from '../../lib/types';
import { checkedTime, fixture, memo } from './fixtures';

async function mockDemo(page: Page, researchFails = false) {
  const data: DeskSnapshot = fixture();
  data.workspace = 'demo'; data.state.research = []; data.state.orders = []; data.state.audit = [];
  const actions: string[] = [];
  const baseCash = data.state.cash;
  await page.route('**/api/desk?*', route => route.fulfill({ json: data }));
  await page.route('**/api/action', async route => {
    const action = route.request().postDataJSON();
    actions.push(action.action);
    expect(action.workspace).toBe('demo'); expect(action.marketMode).toBe('yahoo');
    if (action.action === 'start_demo') { data.state.demoStartedAt = checkedTime; data.state.research = []; data.state.orders = []; }
    if (action.action === 'strategy_research') {
      if (researchFails) return route.fulfill({ status: 503, json: { error: 'Yahoo history is temporarily unavailable.' } });
      data.state.research = [structuredClone(memo)];
    }
    if (action.action === 'propose') {
      const order: Order = { id: 'demo-order', researchId: memo.id, symbol: 'MSFT', side: 'buy', quantity: 1, price: 201, notional: 201, status: 'review', checks: [{ key: 'source', label: 'Dated source', passed: true, reason: 'Current historical strategy evidence.' }], evidenceIds: memo.evidenceIds, createdAt: checkedTime, traceId: 'demo-order-trace', fingerprint: 'demo-order-fingerprint', marketMode: 'yahoo', quoteTimestamp: data.market[1].timestamp };
      data.state.orders = [order];
    }
    if (action.action === 'approve') { const order = data.state.orders[0]; order.status = 'approved'; order.approval = { fingerprint: order.fingerprint, portfolioVersion: 1, policyVersion: 1, approvedAt: checkedTime }; }
    if (action.action === 'queue') { const order = data.state.orders[0]; order.status = 'queued'; order.queue = { fingerprint: order.fingerprint, policyVersion: 1, queuedAt: checkedTime, expiresAt: '2026-10-24T14:30:00Z', maxPriceDriftPercent: 1 }; data.state.audit.push({ id: 'queue-receipt', time: checkedTime, agent: 'reviewer', tool: 'orders.queue', decision: 'allowed', message: 'Order queued; no execution attempted.', traceId: order.traceId, orderId: order.id }); }
    if (action.action === 'reject') data.state.orders[0].status = 'rejected';
    expect(data.state.cash).toBe(baseCash); expect(data.state.positions).toEqual([]);
    return route.fulfill({ json: { snapshot: data, message: 'Recorded.' } });
  });
  return { data, actions };
}
async function advanceToQueued(page: Page) {
  await page.goto('/?demo=1');
  const guide = page.getByTestId('demo-guide');
  await guide.getByRole('button', { name: 'Start guided demo', exact: true }).click();
  await expect(guide).toHaveAttribute('data-stage', 'research');
  await guide.getByRole('button', { name: 'Generate demo research', exact: true }).click();
  await expect(guide).toHaveAttribute('data-stage', 'source');
  await expect(guide.getByRole('button', { name: 'Propose 1 MSFT share', exact: true })).toBeDisabled();
  await guide.getByRole('button', { name: 'Open demo source', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('MSFT Yahoo daily market history');
  await page.getByRole('button', { name: 'Close evidence', exact: true }).click();
  await guide.getByRole('button', { name: 'Propose 1 MSFT share', exact: true }).click();
  await expect(guide).toHaveAttribute('data-stage', 'approval');
  await guide.getByRole('button', { name: 'Approve demo order', exact: true }).click();
  await expect(guide).toHaveAttribute('data-stage', 'execution');
  await expect(page.getByRole('button', { name: 'Execute demo paper order', exact: true })).toHaveCount(0);
  await guide.getByRole('button', { name: 'Queue demo for market open', exact: true }).click();
  await expect(guide).toHaveAttribute('data-stage', 'waiting');
  return guide;
}

test('closed-market walkthrough records explicit queue permission and no invented fill', async ({ page }) => {
  const { data, actions } = await mockDemo(page);
  const guide = await advanceToQueued(page);
  await expect(guide).toContainText('Queue authorization recorded · no fill yet');
  await expect(page.locator('.queue-receipt')).toContainText('1%');
  await expect(page.locator('.queue-receipt')).toContainText('Expires');
  expect(actions).toEqual(['start_demo', 'strategy_research', 'propose', 'approve', 'queue']);
  expect(data.state.orders[0].fill).toBeUndefined();
  const downloadReady = page.waitForEvent('download');
  await guide.getByRole('button', { name: 'Export demo evidence', exact: true }).click();
  const download = await downloadReady;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.workspace).toBe('demo'); expect(exported.orders[0].status).toBe('queued'); expect(exported.orders[0].fill).toBeUndefined();
  await page.reload(); await expect(guide).toHaveAttribute('data-stage', 'waiting');
});

test('queued orders can be cancelled through the order review', async ({ page }) => {
  const { data } = await mockDemo(page);
  await advanceToQueued(page);
  await page.getByRole('button', { name: 'Cancel queued order', exact: true }).click();
  await expect(page.locator('.order-details .badge')).toHaveText('rejected');
  expect(data.state.orders[0].fill).toBeUndefined();
});

test('Yahoo history failure leaves the demo on research without a sample fallback', async ({ page }) => {
  const { actions } = await mockDemo(page, true);
  await page.goto('/?demo=1');
  const guide = page.getByTestId('demo-guide');
  await guide.getByRole('button', { name: 'Start guided demo', exact: true }).click();
  await guide.getByRole('button', { name: 'Generate demo research', exact: true }).click();
  await expect(guide.getByRole('alert')).toContainText('Yahoo history is temporarily unavailable');
  await expect(guide).toHaveAttribute('data-stage', 'research');
  await expect(page.getByRole('button', { name: /sample/i })).toHaveCount(0);
  expect(actions).toEqual(['start_demo', 'strategy_research']);
});

test('mobile guide fits the viewport and restart cancellation preserves the queued order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { data, actions } = await mockDemo(page);
  const guide = await advanceToQueued(page);
  await guide.locator('summary').click();
  await guide.getByRole('button', { name: 'Restart demo', exact: true }).click();
  await guide.getByRole('button', { name: 'Keep current demo', exact: true }).click();
  expect(data.state.orders[0].status).toBe('queued');
  expect(actions.filter(action => action === 'start_demo')).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(guide.getByRole('link', { name: 'Exit demo', exact: true })).toHaveAttribute('href', '/');
});
