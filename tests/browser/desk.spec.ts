import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { DeskSnapshot, Order } from '../../lib/types';

// Run against an already-started development server. No model requests are made:
// research coverage and the order workflow use the persisted, source-backed MSFT memo.
const screens = [
  ['Research', 'From evidence to conviction.'],
  ['Orders', 'Every order, accounted for.'],
  ['Mandate', 'Your rules. Enforced.'],
  ['Audit trail', 'A record of every decision.'],
  ['Connections', 'Connected, on your terms.'],
  ['Overview', 'Your investment desk.'],
] as const;

async function openDesk(page: Page) {
  await page.goto('/?marketMode=replay');
  // The page heading exists in server HTML before React hydrates. Awaiting real
  // portfolio data prevents navigation clicks from disappearing during hydration.
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
}

async function navigate(page: Page, name: string, heading: string) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

async function readSnapshot(page: Page): Promise<DeskSnapshot> {
  const response = await page.request.get('/api/desk?marketMode=replay');
  expect(response.ok()).toBeTruthy();
  return await response.json() as DeskSnapshot;
}

async function actThroughUI(page: Page, action: string, button: Locator): Promise<DeskSnapshot> {
  const waiting = page.waitForResponse(response => {
    if (!response.url().endsWith('/api/action') || response.request().method() !== 'POST') return false;
    return response.request().postDataJSON()?.action === action;
  }, { timeout: 75_000 });
  await button.click();
  const response = await waiting;
  const body = await response.json() as { snapshot?: DeskSnapshot; error?: string };
  expect(response.ok(), body.error || `Expected ${action} to succeed`).toBeTruthy();
  expect(body.error).toBeUndefined();
  expect(body.snapshot).toBeDefined();
  return body.snapshot!;
}

function assertPrismAllowed(snapshot: DeskSnapshot, order: Order) {
  if (!snapshot.connections.prism.enforce) return;
  const check = order.checks.find(item => item.key === 'prism');
  expect(check, 'Enforced PRISM verdict must be visible on the order').toBeDefined();
  expect(check?.passed).toBe(true);
  expect(check?.reason).toContain('PRISM evaluated its configured rules; no blocking rule matched.');
}

test('all desk navigation surfaces load without client errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openDesk(page);
  for (const [name, heading] of screens) await navigate(page, name, heading);
  expect(errors).toEqual([]);
});

test('chart selection and window controls update the synthetic series', async ({ page }) => {
  await openDesk(page);
  await page.getByRole('combobox', { name: 'Select chart symbol' }).selectOption('MSFT');
  await expect(page.getByRole('img', { name: /^MSFT synthetic price chart/ })).toBeVisible();
  await page.getByRole('button', { name: '15 points', exact: true }).click();
  await expect(page.getByRole('img', { name: /^MSFT synthetic price chart, 15 observations/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '15 points', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Full session', exact: true }).click();
  await expect(page.getByRole('img', { name: /^MSFT synthetic price chart, 96 observations/ })).toBeVisible();
  await page.getByRole('button', { name: /^Positions\s*\d+$/ }).click();
  await expect(page.getByRole('columnheader', { name: 'Market value', exact: true })).toBeVisible();
});

test('citations open dated issuer evidence and restore focus on close', async ({ page }) => {
  await openDesk(page);
  await navigate(page, 'Research', 'From evidence to conviction.');
  const security = page.getByRole('combobox', { name: 'Security', exact: true });
  await expect(security).toBeVisible();
  await security.selectOption('MSFT');
  const citation = page.getByRole('button', { name: /^\[\d+\]/ }).first();
  await citation.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Historical issuer disclosure', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Published', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Source excerpt', exact: true })).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Open original disclosure' })).toHaveAttribute('href', /^https:\/\//);
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(citation).toBeFocused();
});

test('audit search filters events and exports an inspectable JSON record', async ({ page }) => {
  await openDesk(page);
  await navigate(page, 'Audit trail', 'A record of every decision.');
  const search = page.getByRole('searchbox', { name: 'Search audit trail' });
  await search.fill('no-event-with-this-value-038f1b');
  await expect(page.getByRole('heading', { name: 'No matching events.' })).toBeVisible();
  await search.clear();
  await expect(page.getByRole('heading', { name: 'No matching events.' })).toHaveCount(0);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export audit', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^mandate-audit-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path!, 'utf8')) as { environment: string; audit: unknown[]; orders: unknown[] };
  expect(exported.environment).toBe('paper');
  expect(exported.audit.length).toBeGreaterThan(0);
  expect(Array.isArray(exported.orders)).toBe(true);
});

test('a source-backed proposal is approved and filled exactly once through the UI', async ({ page }) => {
  await openDesk(page);
  const before = await readSnapshot(page);
  const beforeShares = before.state.positions.find(position => position.symbol === 'MSFT')?.shares || 0;
  expect(before.state.research.some(memo => memo.symbol === 'MSFT' && memo.claims.every(claim => claim.supported))).toBe(true);
  await navigate(page, 'Research', 'From evidence to conviction.');
  await page.getByRole('combobox', { name: 'Security', exact: true }).selectOption('MSFT');
  await page.getByRole('combobox', { name: 'Side', exact: true }).selectOption('buy');
  await page.getByRole('spinbutton', { name: 'Shares', exact: true }).fill('1');
  const proposed = await actThroughUI(page, 'propose', page.getByRole('button', { name: 'Propose order', exact: true }));
  const order = proposed.state.orders.find(item => !before.state.orders.some(previous => previous.id === item.id));
  expect(order).toBeDefined();
  expect(order?.symbol).toBe('MSFT');
  expect(order?.quantity).toBe(1);
  expect(order?.checks.every(check => check.passed)).toBe(true);
  expect(proposed.state.portfolioVersion).toBe(before.state.portfolioVersion);
  assertPrismAllowed(proposed, order!);
  await expect(page.getByRole('heading', { name: 'Every order, accounted for.' })).toBeVisible();
  if (order?.status === 'review') {
    const approved = await actThroughUI(page, 'approve', page.getByRole('button', { name: 'Approve order', exact: true }));
    const approvedOrder = approved.state.orders.find(item => item.id === order.id);
    expect(approvedOrder?.status).toBe('approved');
    expect(approvedOrder?.approval?.fingerprint).toBe(approvedOrder?.fingerprint);
    expect(approved.state.portfolioVersion).toBe(before.state.portfolioVersion);
  } else {
    expect(order?.status).toBe('approved');
  }
  const executed = await actThroughUI(page, 'execute', page.getByRole('button', { name: 'Execute paper order', exact: true }));
  const filled = executed.state.orders.find(item => item.id === order!.id)!;
  expect(filled.status).toBe('executed');
  expect(filled.fill?.quantity).toBe(1);
  expect(executed.state.portfolioVersion).toBe(before.state.portfolioVersion + 1);
  expect(executed.state.positions.find(position => position.symbol === 'MSFT')?.shares).toBe(beforeShares + 1);
  expect(executed.state.cash).toBeCloseTo(before.state.cash - filled.fill!.price, 2);
  assertPrismAllowed(executed, filled);
  await expect(page.getByText(/^Paper fill: 1 shares at/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Execute paper order', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
  const persisted = await readSnapshot(page);
  expect(persisted.state.portfolioVersion).toBe(before.state.portfolioVersion + 1);
  expect(persisted.state.audit.filter(event => event.orderId === order!.id && event.tool === 'orders.execute' && event.decision === 'allowed')).toHaveLength(1);
});

test('failure demo blocks an oversized order without changing the ledger', async ({ page }) => {
  await openDesk(page);
  const before = await readSnapshot(page);
  await page.getByRole('button', { name: 'Run failure demo' }).click();
  const after = await actThroughUI(page, 'scenario', page.getByRole('button', { name: /^Oversized order/ }));
  const order = after.state.orders.find(item => !before.state.orders.some(previous => previous.id === item.id));
  expect(order?.status).toBe('blocked');
  expect(order?.checks.find(check => check.key === 'notional')?.passed).toBe(false);
  expect(after.state.portfolioVersion).toBe(before.state.portfolioVersion);
  expect(after.state.cash).toBe(before.state.cash);
  expect(after.state.positions).toEqual(before.state.positions);
  if (after.connections.prism.enforce) {
    expect(order?.checks.find(check => check.key === 'prism')?.passed).toBe(false);
  }
  await expect(page.getByRole('heading', { name: 'Every order, accounted for.' })).toBeVisible();
  await expect(page.getByText('Resolve failed checks with a new proposal.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve order', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Execute paper order', exact: true })).toHaveCount(0);
});

test.describe('mobile workspace', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('all screens fit the viewport and closed navigation is inaccessible', async ({ page }) => {
    await openDesk(page);
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toHaveAttribute('inert', '');
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
    for (const [name, heading] of screens) {
      await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
      await expect(sidebar).not.toHaveAttribute('inert', '');
      await navigate(page, name, heading);
      await expect(sidebar).toHaveAttribute('inert', '');
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
      const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(width.content, `${name} must not cause horizontal page overflow`).toBeLessThanOrEqual(width.viewport);
    }
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('aside.sidebar'))).toBe(false);
  });
});
