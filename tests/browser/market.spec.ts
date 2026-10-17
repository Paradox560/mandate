import { expect, test } from '@playwright/test';
import { fixture, historyFixture } from './fixtures';

test('Yahoo quotes expose dates and logos while usable closed-market proposals remain enabled', async ({ page }) => {
  await page.route('**/api/desk?*', route => route.fulfill({ json: fixture() }));
  await page.goto('/?marketMode=replay'); // Obsolete links cannot re-enable replay.
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Market data source' })).toHaveCount(0);
  await expect(page.locator('.market-provider')).toHaveText('Yahoo Finance');
  await expect(page.locator('.quote-dateline')).toContainText('Oct 16, 2026, 4:00 PM ET');
  await expect(page.locator('.quote-dateline')).toContainText('Market closed');
  await expect(page.locator('.market-source-note')).toContainText('real-time delivery is not guaranteed');
  await expect(page.locator('.market-table .ticker-avatar img')).toHaveCount(6);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('combobox', { name: 'Security', exact: true }).selectOption('MSFT');
  await expect(page.getByRole('button', { name: 'Propose order', exact: true })).toBeEnabled();
  await expect(page.locator('.proposal-form')).toContainText('Market closed');
  await expect(page.locator('body')).not.toContainText('Synthetic');
});

test('partial Yahoo prices never invent portfolio totals', async ({ page }) => {
  const data = fixture();
  data.state.positions = [{ symbol: 'NVDA', shares: 10, costBasis: 100 }, { symbol: 'MSFT', shares: 10, costBasis: 100 }];
  data.market = data.market.filter(quote => quote.symbol === 'MSFT');
  data.marketFeed.status = 'partial'; data.marketFeed.message = 'Some Yahoo quotes are unavailable.';
  await page.route('**/api/desk?*', route => route.fulfill({ json: data }));
  await page.goto('/');
  const portfolio = page.getByRole('region', { name: 'Portfolio summary' });
  await expect(portfolio.locator('.nav-metric > strong')).toHaveText('Unavailable');
  await expect(portfolio).toContainText('Incomplete valuation · missing NVDA quotes');
  await expect(portfolio).toContainText('1 of 2 positions priced');
  await expect(page.locator('.market-table tbody tr')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Quote unavailable.', exact: true })).toBeVisible();
  data.market = []; data.marketFeed.status = 'unavailable'; data.marketFeed.message = 'Yahoo Finance is unavailable.';
  await page.getByRole('button', { name: 'Refresh desk' }).click();
  await expect(portfolio).toContainText('0 of 2 positions priced');
  await expect(portfolio.locator('.nav-metric > strong')).toHaveText('Unavailable');
});

test('previous sessions are inspectable but cannot authorize current-order research', async ({ page }) => {
  const calls: unknown[] = [];
  await page.route('**/api/desk?*', route => route.fulfill({ json: fixture() }));
  await page.route('**/api/history?*', route => { const url = new URL(route.request().url()); return route.fulfill({ json: historyFixture(url.searchParams.get('asOf') || undefined, url.searchParams.get('strategy') || undefined) }); });
  await page.route('**/api/action', route => { calls.push(route.request().postDataJSON()); return route.abort(); });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Strategies', exact: true }).click();
  await page.getByRole('combobox', { name: 'Historical security' }).selectOption('MSFT');
  const create = page.getByRole('button', { name: 'Create strategy memo', exact: true });
  await expect(create).toBeEnabled();
  await page.getByRole('button', { name: 'Previous session', exact: true }).click();
  await expect(page.getByLabel('Historical as-of date')).toHaveValue('2026-10-15');
  await expect(create).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'You are viewing an earlier date.' })).toBeVisible();
  await expect(page.getByRole('img', { name: /historical Yahoo closing prices through 2026-10-15/ })).toBeVisible();
  await page.getByRole('button', { name: 'Return to latest session' }).click();
  await expect(create).toBeEnabled();
  await page.getByRole('button', { name: 'Strategy comparison', exact: true }).click();
  await expect(page.getByRole('img', { name: /historical strategy and buy-and-hold performance/ })).toBeVisible();
  expect(calls).toEqual([]);
});
