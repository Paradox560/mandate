import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fixture, historyFixture } from './fixtures';

// Display and navigation tests use deterministic Yahoo-shaped HTTP responses.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/desk?*', route => route.fulfill({ json: fixture() }));
  await page.route('**/api/history?*', route => route.fulfill({ json: historyFixture() }));
});
const screens = [
  ['Strategies', 'Learn from the market’s history.'],
  ['Research', 'From evidence to conviction.'],
  ['Orders', 'Every order, accounted for.'],
  ['Mandate', 'Your rules. Enforced.'],
  ['Audit trail', 'A record of every decision.'],
  ['Connections', 'Connected, on your terms.'],
  ['Overview', 'Your investment desk.'],
] as const;

async function openDesk(page: Page) {
  await page.goto('/?marketMode=yahoo');
  // The page heading exists in server HTML before React hydrates. Awaiting real
  // portfolio data prevents navigation clicks from disappearing during hydration.
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
}

async function navigate(page: Page, name: string, heading: string) {
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) }).click();
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
}

test('all desk navigation surfaces load without client errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openDesk(page);
  for (const [name, heading] of screens) await navigate(page, name, heading);
  expect(errors).toEqual([]);
});

test('chart selection and window controls update the Yahoo series', async ({ page }) => {
  await openDesk(page);
  await page.getByRole('combobox', { name: 'Select chart symbol' }).selectOption('MSFT');
  await expect(page.getByRole('img', { name: /^MSFT Yahoo Finance price chart/ })).toBeVisible();
  await page.getByRole('button', { name: '15 points', exact: true }).click();
  await expect(page.getByRole('img', { name: /^MSFT Yahoo Finance price chart, 15 observations/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '15 points', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Full session', exact: true }).click();
  await expect(page.getByRole('img', { name: /^MSFT Yahoo Finance price chart, 79 observations/ })).toBeVisible();
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
  await expect(drawer.getByText('Dated source evidence', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Published', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('heading', { name: 'Source excerpt', exact: true })).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Open original source' })).toHaveAttribute('href', /^https:\/\//);
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
