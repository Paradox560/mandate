import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { DeskSnapshot } from '../../lib/types';
import { canonicalSample } from '../../lib/permissions';

async function desk(page: Page, workspace = 'desk') {
  const response = await page.request.get(`/api/desk?marketMode=replay&workspace=${workspace}`);
  expect(response.ok()).toBe(true);
  return await response.json() as DeskSnapshot;
}
async function act(page: Page, action: string, button: Locator) {
  const received = page.waitForResponse(response => response.url().endsWith('/api/action') && response.request().postDataJSON()?.action === action, { timeout: 100_000 });
  await button.click();
  const response = await received;
  const data = await response.json() as { snapshot: DeskSnapshot; error?: string };
  expect(response.ok(), data.error).toBe(true);
  expect(data.error).toBeUndefined();
  expect(data.snapshot.workspace).toBe('demo');
  expect(data.snapshot.marketFeed.mode).toBe('replay');
  return data.snapshot;
}

test('guided demo produces cited research, an approved fill and a blocked run without changing the main desk', async ({ page }) => {
  test.setTimeout(240_000);
  const original = await desk(page);
  await page.goto('/?demo=1');
  const guide = page.getByTestId('demo-guide');
  await expect(guide).toBeVisible();
  // Rehearsals may have already populated this isolated workspace.
  if (await guide.getAttribute('data-stage') !== 'intro') {
    await guide.getByRole('button', { name: /restart/i }).first().click();
    await act(page, 'start_demo', guide.getByRole('button', { name: 'Restart demo now', exact: true }));
  } else await act(page, 'start_demo', guide.locator('button.primary').first());
  await expect(guide).toHaveAttribute('data-stage', 'research');
  const started = await desk(page, 'demo');
  expect(started.state.orders).toHaveLength(0);
  expect(started.state.research).toHaveLength(0);
  await expect(page.getByRole('combobox', { name: 'Market data source' })).toBeDisabled();

  const researched = started.connections.nicrron.configured
    ? await act(page, 'research', guide.locator('button.primary').first())
    : await act(page, 'demo_sample', guide.getByRole('button', { name: /sample demo memo/i }));
  const memo = researched.state.research.find(item => item.symbol === 'MSFT')!;
  expect(memo).toBeDefined();
  expect(memo.mode).toBe(started.connections.nicrron.configured ? 'nicrron' : 'sample');
  expect(memo.claims.every(claim => claim.supported && claim.evidenceIds.length > 0)).toBe(true);
  await expect(guide).toHaveAttribute('data-stage', 'source');
  await guide.getByRole('button', { name: /open demo source/i }).click();
  await expect(page.getByRole('dialog')).toContainText('Jul 30, 2025');
  await page.getByRole('button', { name: 'Close evidence', exact: true }).click();
  const proposed = await act(page, 'propose', guide.locator('button.primary').first());
  const order = proposed.state.orders.find(item => item.symbol === 'MSFT')!;
  expect(order.status).toBe('review');
  expect(order.quantity).toBe(1);
  expect(order.marketMode).toBe('replay');
  expect(proposed.state.cash).toBe(started.state.cash);
  await expect(guide).toHaveAttribute('data-stage', 'approval');
  const approved = await act(page, 'approve', guide.locator('button.primary').first());
  expect(approved.state.orders.find(item => item.id === order.id)?.approval?.fingerprint).toBeTruthy();
  await expect(guide).toHaveAttribute('data-stage', 'execution');
  expect(approved.state.cash).toBe(started.state.cash);
  const filled = await act(page, 'execute', guide.locator('button.primary').first());
  const fill = filled.state.orders.find(item => item.id === order.id)!;
  expect(fill.fill?.quantity).toBe(1);
  expect(filled.state.portfolioVersion).toBe(started.state.portfolioVersion + 1);
  expect(filled.state.cash).toBeCloseTo(started.state.cash - fill.fill!.price, 2);
  expect(filled.state.positions.find(item => item.symbol === 'MSFT')?.shares).toBe((started.state.positions.find(item => item.symbol === 'MSFT')?.shares || 0) + 1);
  if (filled.connections.prism.enforce) expect(fill.checks.find(check => check.key === 'prism')?.passed).toBe(true);
  await expect(guide).toHaveAttribute('data-stage', 'block');
  const blocked = await act(page, 'scenario', guide.locator('button.primary').first());
  const denied = blocked.state.orders.find(item => item.scenario === 'oversize')!;
  expect(denied.status).toBe('blocked');
  expect(denied.checks.find(check => check.key === 'notional')?.passed).toBe(false);
  if (blocked.connections.prism.enforce) {
    const prism = denied.checks.find(check => check.key === 'prism');
    expect(prism?.passed).toBe(false);
    expect(prism?.reason).toContain('PRISM blocked the action');
  }
  expect(blocked.state.cash).toBe(filled.state.cash);
  expect(blocked.state.positions).toEqual(filled.state.positions);
  expect(blocked.state.portfolioVersion).toBe(filled.state.portfolioVersion);
  expect(blocked.state.orders.filter(item => item.fill)).toHaveLength(1);
  await expect(guide).toHaveAttribute('data-stage', 'audit');
  const downloadReady = page.waitForEvent('download');
  await guide.getByRole('button', { name: /export/i }).click();
  const download = await downloadReady;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.workspace).toBe('demo');
  expect(exported.orders.some((item: { id: string }) => item.id === denied.id)).toBe(true);
  expect((await desk(page)).state).toEqual(original.state);
  await page.reload();
  await expect(guide).toHaveAttribute('data-stage', 'audit');
});

test('demo scope rejects desk-only startup and unknown scopes, and ignores a Yahoo display request', async ({ page }) => {
  const before = await desk(page);
  for (const workspace of ['desk', 'someone-else']) {
    const response = await page.request.post('/api/action', { headers: { Origin: new URL(test.info().project.use.baseURL!).origin }, data: { action: 'start_demo', workspace } });
    expect(response.status()).toBe(400);
  }
  const invalid = await page.request.get('/api/desk?workspace=someone-else');
  expect(invalid.status()).toBe(400);
  const demo = await page.request.get('/api/desk?workspace=demo&marketMode=yahoo');
  expect((await demo.json()).marketFeed.mode).toBe('replay');
  expect((await desk(page)).state).toEqual(before.state);
});

test('mobile presenter can inspect notes and cancel restart without changing either portfolio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await desk(page, 'demo');
  await page.goto('/?demo=1');
  const guide = page.getByTestId('demo-guide');
  await expect(guide).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await guide.locator('summary').click();
  await guide.getByRole('button', { name: /restart/i }).first().click();
  await guide.getByRole('button', { name: /keep current demo/i }).click();
  expect((await desk(page, 'demo')).state).toEqual(before.state);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(guide.getByRole('link', { name: /exit|return/i })).toHaveAttribute('href', '/');
});

test('a research failure keeps the guide on the same step until the presenter explicitly chooses a sample', async ({ page }) => {
  const saved = await desk(page, 'demo');
  const memo = canonicalSample('MSFT', saved.evidence, 'explicit-sample-test');
  const startedAt = new Date().toISOString();
  const data: DeskSnapshot = structuredClone(saved);
  data.connections.nicrron.configured = true;
  data.state.demoStartedAt = startedAt;
  data.state.research = []; data.state.orders = []; data.state.audit = [];
  const actions: string[] = [];
  await page.route('**/api/desk?*', route => route.fulfill({ json: data }));
  await page.route('**/api/action', async route => {
    const request = route.request().postDataJSON();
    actions.push(request.action);
    expect(request.workspace).toBe('demo');
    if (request.action === 'research') {
      await route.fulfill({ status: 400, json: { error: 'Nicrron request timed out or could not connect.' } });
    } else if (request.action === 'demo_sample') {
      data.state.research = [{ ...memo, id: 'explicit-demo-sample-fixture', mode: 'sample', model: 'deterministic sample', createdAt: startedAt }];
      await route.fulfill({ json: { snapshot: data, message: 'Explicit sample selected. No model request was made.' } });
    } else await route.abort();
  });
  await page.goto('/?demo=1');
  const guide = page.getByTestId('demo-guide');
  await expect(guide).toHaveAttribute('data-stage', 'research');
  await guide.getByRole('button', { name: 'Generate demo research', exact: true }).click();
  await expect(guide.getByRole('alert')).toContainText('Nicrron request timed out');
  await expect(guide).toHaveAttribute('data-stage', 'research');
  expect(actions).toEqual(['research']);
  await act(page, 'demo_sample', guide.getByRole('button', { name: 'Use sample demo memo', exact: true }));
  await expect(guide).toHaveAttribute('data-stage', 'source');
  await expect(guide.getByRole('button', { name: 'Propose 1 MSFT share', exact: true })).toBeDisabled();
  expect(actions).toEqual(['research', 'demo_sample']);
});
