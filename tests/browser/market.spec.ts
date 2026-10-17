import { expect, test, type Page } from '@playwright/test';
import type { DeskSnapshot, MarketMode, Quote } from '../../lib/types';

// Fixtures isolate missing/late provider responses without requesting inference,
// updating the ledger, or relying on the actual market being open.
const actions = new WeakMap<Page, string[]>();
const quoteTime = '2026-10-16T20:00:00.000Z';
const checkedTime = '2026-10-17T14:30:00.000Z';
function fixture(mode: MarketMode = 'yahoo'): DeskSnapshot {
  const symbols = ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META'] as const;
  const market: Quote[] = symbols.map((symbol, index) => ({ symbol, name: symbol === 'MSFT' ? 'Microsoft' : symbol, sector: 'Technology', price: 200 + index, previousClose: 190 + index, change: 10, history: [190 + index, 195 + index, 200 + index], timestamp: quoteTime, source: mode === 'yahoo' ? 'yahoo' : 'synthetic', fetchedAt: checkedTime, marketState: 'closed', stale: true, historyTimestamps: ['2026-10-16T19:50:00.000Z', '2026-10-16T19:55:00.000Z', quoteTime], currency: 'USD' }));
  return {
    market, marketFeed: { mode, provider: mode === 'yahoo' ? 'Yahoo Finance' : 'Synthetic replay', fetchedAt: checkedTime, status: 'ok', message: 'Latest available quotes; market closed.', refreshSeconds: mode === 'yahoo' ? 60 : 5, errors: [] },
    connections: { mode: 'paper', replayDate: '2025-08-29', nicrron: { configured: false, model: 'sample' }, prism: { configured: false, enforce: false, projectId: null } },
    evidence: [{ id: 'msft-2025', symbol: 'MSFT', title: 'Microsoft 2025 disclosure', url: 'https://www.microsoft.com/en-us/Investor/', publishedAt: '2025-07-30', period: 'FY2025', text: 'Historical Microsoft disclosure.', metrics: {} }],
    state: { version: 1, portfolioVersion: 1, cash: 10000, positions: [{ symbol: 'NVDA', shares: 10, costBasis: 100 }, { symbol: 'MSFT', shares: 10, costBasis: 100 }], research: [{ id: 'memo-msft', symbol: 'MSFT', title: 'Historical Microsoft research', summary: 'Interpretation of historical evidence.', claims: [{ text: 'Historical Microsoft disclosure.', evidenceIds: ['msft-2025'], supported: true }], risks: ['Historical sources.'], evidenceIds: ['msft-2025'], score: 100, createdAt: checkedTime, mode: 'sample', model: 'sample', recommendation: { side: 'buy', quantity: 1, rationale: 'Review the source before proposing.' }, traceId: 'research-fixture' }], orders: [{ id: 'legacy-order', researchId: 'memo-msft', symbol: 'MSFT', side: 'buy', quantity: 1, price: 201, notional: 201, status: 'blocked', checks: [{ key: 'source', label: 'Source freshness', passed: false, reason: 'Historical demonstration.' }], evidenceIds: ['msft-2025'], createdAt: quoteTime, traceId: 'order-fixture', fingerprint: 'fixture' }], audit: [], policy: { version: 1, maxOrderValue: 10000, maxPositionWeight: 0.4, approvalAbove: 0, allowedSymbols: [...symbols], maxQuoteAgeSeconds: 60, maxEvidenceAgeDays: 365, requireApproval: true }, createdAt: checkedTime, integration: { prismLastStatus: 'Not configured', knowledgeBaseSynced: false } },
  };
}

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  actions.set(page, requests);
  await page.route('**/api/action', async route => { requests.push(route.request().postData() || 'action'); await route.abort(); });
});
test.afterEach(async ({ page }) => { expect(actions.get(page), 'Market display tests must not make model or order requests').toEqual([]); });

async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
}

test('Yahoo quotes expose their timestamp, delayed status, dated bars, and closed-market proposal limit', async ({ page }) => {
  await page.route('**/api/desk?*', route => route.fulfill({ json: fixture() }));
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Market data source' })).toHaveValue('yahoo');
  await expect(page.locator('.quote-dateline')).toContainText('Oct 16, 2026, 4:00 PM ET');
  await expect(page.locator('.quote-dateline')).toContainText('Market closed');
  await expect(page.locator('.market-feed-status')).toContainText('Last checked Oct 17, 2026, 10:30 AM ET');
  await expect(page.locator('.market-source-note')).toContainText('real-time delivery is not guaranteed');
  const chart = page.getByRole('group', { name: 'Inspect Yahoo Finance chart values' });
  await chart.press('Home');
  await expect(chart.getByRole('status')).toContainText('Oct 16, 2026, 3:50 PM ET');
  await expect(page.locator('.chart-observation')).toContainText('Selected bar');
  await expect.poll(() => page.locator('.market-table .ticker-avatar img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('.market-table .ticker-avatar img')).toHaveCount(6);
  await navigate(page, 'Research');
  await page.getByRole('combobox', { name: 'Security', exact: true }).selectOption('MSFT');
  await expect(page.getByRole('button', { name: 'Propose order', exact: true })).toBeDisabled();
  await expect(page.locator('.proposal-form')).toContainText('market is closed');
  await expect(page.locator('.historical-notice')).toContainText('Source dates remain in 2025');
  await navigate(page, 'Orders');
  await expect(page.locator('.order-provenance')).toContainText('Synthetic replay');
  await expect(page.locator('.order-provenance')).toContainText('historical demo order');
});

test('partial and missing Yahoo prices keep six securities visible without inventing portfolio totals', async ({ page }) => {
  let data = fixture();
  data.market = data.market.filter(quote => quote.symbol === 'MSFT');
  data.marketFeed.status = 'partial';
  data.marketFeed.message = 'Some Yahoo quotes are unavailable.';
  await page.route('**/api/desk?*', route => route.fulfill({ json: data }));
  await page.goto('/');
  const portfolio = page.getByRole('region', { name: 'Portfolio summary' });
  await expect(portfolio.locator('.nav-metric > strong')).toHaveText('Unavailable');
  await expect(portfolio).toContainText('Incomplete valuation · missing NVDA quotes');
  await expect(portfolio).toContainText('1 of 2 positions priced');
  await expect(page.locator('.market-table tbody tr')).toHaveCount(6);
  // The missing company uses the fixed universe name, not a fabricated quote.
  await expect(page.locator('.market-table tbody tr').first().locator('td').nth(1)).toHaveText('Unavailable');
  await expect(page.getByRole('heading', { name: 'Quote unavailable.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Positions\s*2$/ }).click();
  await expect(page.locator('.market-table tbody tr').first().locator('td').nth(4)).toHaveText('Unavailable');
  await expect(page.locator('.market-table tbody tr').first().locator('td').nth(5)).toHaveText('—');
  data = { ...data, market: [], marketFeed: { ...data.marketFeed, status: 'unavailable', message: 'Yahoo Finance is unavailable.' } };
  await page.getByRole('button', { name: 'Refresh desk' }).click();
  await expect(portfolio).toContainText('0 of 2 positions priced');
  await expect(portfolio.locator('.nav-metric > strong')).toHaveText('Unavailable');
  await expect(page.locator('.market-feed-status')).toContainText('Yahoo Finance is unavailable');
});

test('late Yahoo responses cannot overwrite the selected replay feed', async ({ page }) => {
  let releaseYahoo!: () => void;
  const heldYahoo = new Promise<void>(resolve => { releaseYahoo = resolve; });
  let yahooStarted!: () => void;
  const started = new Promise<void>(resolve => { yahooStarted = resolve; });
  await page.route('**/api/desk?*', async route => {
    const mode = new URL(route.request().url()).searchParams.get('marketMode') as MarketMode;
    if (mode === 'yahoo') { yahooStarted(); await heldYahoo; }
    await route.fulfill({ json: fixture(mode) });
  });
  await page.goto('/');
  await started;
  await page.getByRole('combobox', { name: 'Market data source' }).selectOption('replay');
  await expect(page.getByRole('group', { name: 'Inspect synthetic chart values' })).toBeVisible();
  const yahooResponse = page.waitForResponse(response => response.url().includes('marketMode=yahoo'));
  releaseYahoo();
  await yahooResponse;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('combobox', { name: 'Market data source' })).toHaveValue('replay');
  await expect(page.getByRole('group', { name: 'Inspect synthetic chart values' })).toBeVisible();
  await expect(page.locator('.market-source-note')).toContainText('prices are simulated');
  await expect(page.locator('.market-feed-status')).toContainText('Synthetic replay');
});
