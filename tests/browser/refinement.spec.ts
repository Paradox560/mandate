import { expect, test, type Page } from '@playwright/test';

// Read-only interaction coverage. Use the persisted, source-backed MSFT memo;
// never generate research, propose orders, or modify the paper ledger here.
const actionRequests = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  actionRequests.set(page, requests);
  await page.route('**/api/action', async route => {
    requests.push(route.request().postData() || route.request().method());
    await route.abort('blockedbyclient');
  });
});

test.afterEach(async ({ page }) => {
  expect(actionRequests.get(page), 'Interaction refinements must not request model calls or order actions').toEqual([]);
});

async function openDesk(page: Page) {
  await page.goto('/');
  // Wait for real portfolio data, rather than clicking server-rendered controls
  // before hydration has attached their event handlers.
  await expect(page.getByRole('region', { name: 'Portfolio summary' })).toBeVisible();
}

async function openMsftResearch(page: Page) {
  await openDesk(page);
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Research', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'From evidence to conviction.', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Security', exact: true }).selectOption('MSFT');
  const citation = page.getByRole('button', { name: /^\[\d+\]/ }).first();
  await expect(citation, 'The preview needs a persisted MSFT memo; this suite will not create one').toBeVisible();
  return citation;
}

test('chart keyboard inspection announces observations and honors its boundaries', async ({ page }) => {
  await openDesk(page);
  await page.getByRole('combobox', { name: 'Select chart symbol' }).selectOption('MSFT');
  const chart = page.getByRole('group', { name: 'Inspect synthetic chart values', exact: true });
  const output = chart.getByRole('status');
  await expect(chart).toHaveAccessibleDescription(/left and right arrows.*Home or End.*Escape/i);
  await expect(output).toHaveAttribute('aria-live', 'polite');
  await expect(output).toHaveText(/^Latest price: \$[\d,.]+$/);
  await chart.focus();
  await expect(chart).toBeFocused();
  await chart.press('ArrowLeft');
  await expect(output).toHaveText(/^Observation 95 of 96: \$[\d,.]+$/);
  await chart.press('Home');
  await expect(output).toHaveText(/^Observation 1 of 96: \$[\d,.]+$/);
  await chart.press('ArrowLeft');
  await expect(output).toHaveText(/^Observation 1 of 96: \$[\d,.]+$/);
  await chart.press('End');
  await expect(output).toHaveText(/^Observation 96 of 96: \$[\d,.]+$/);
  await chart.press('ArrowRight');
  await expect(output).toHaveText(/^Observation 96 of 96: \$[\d,.]+$/);
  await chart.press('Escape');
  await expect(output).toHaveText(/^Latest price: \$[\d,.]+$/);
  await expect(chart).toBeFocused();
});

test('watchlist and positions expose their mutually exclusive selected state', async ({ page }) => {
  await openDesk(page);
  const watchlist = page.getByRole('button', { name: /^Watchlist\s*\d+$/ });
  const positions = page.getByRole('button', { name: /^Positions\s*\d+$/ });
  await expect(watchlist).toHaveAttribute('aria-pressed', 'true');
  await expect(positions).toHaveAttribute('aria-pressed', 'false');
  await positions.click();
  await expect(positions).toHaveAttribute('aria-pressed', 'true');
  await expect(watchlist).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('columnheader', { name: 'Market value', exact: true })).toBeVisible();
  await watchlist.click();
  await expect(watchlist).toHaveAttribute('aria-pressed', 'true');
  await expect(positions).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('columnheader', { name: 'Research evidence', exact: true })).toBeVisible();
});

test.describe('mobile menu focus', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('open navigation contains focus, makes the workspace inert, and restores the toggle on Escape', async ({ page }) => {
    await openDesk(page);
    const sidebar = page.locator('#workspace-navigation');
    const workspace = page.locator('#main-content').locator('..');
    // The toggle itself becomes inert while the menu is open. Locate its stable
    // controls relationship so the state remains inspectable while inaccessible.
    const toggle = page.locator('button[aria-controls="workspace-navigation"]');
    const priorOverflow = await page.evaluate(() => document.body.style.overflow);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar).not.toHaveAttribute('inert', '');
    await expect(workspace).toHaveAttribute('inert', '');
    await expect.poll(() => sidebar.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    const first = sidebar.getByRole('link', { name: 'Mandate overview', exact: true });
    const last = sidebar.getByRole('button', { name: 'Workspace setup', exact: true });
    await first.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    for (let index = 0; index < 4; index++) {
      await page.keyboard.press('Tab');
      expect(await sidebar.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar).toHaveAttribute('inert', '');
    await expect(workspace).not.toHaveAttribute('inert', '');
    await expect(toggle).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(priorOverflow);
    await page.keyboard.press('Tab');
    expect(await sidebar.evaluate(element => element.contains(document.activeElement))).toBe(false);
  });
});

test.describe('evidence drawer with normal motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('dragging right dismisses the MSFT source and reopening leaves no stale scroll lock', async ({ page }) => {
    const citation = await openMsftResearch(page);
    const priorOverflow = await page.evaluate(() => document.body.style.overflow);
    await citation.click();
    const drawer = page.getByRole('dialog');
    const workspace = page.locator('#main-content').locator('..');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('MSFT', { exact: true })).toBeVisible();
    await expect(workspace).toHaveAttribute('inert', '');
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    const handle = drawer.locator('.drawer-grab');
    // Hover waits for the entering panel to become stable before a real pointer
    // gesture. No direct calls to the motion hook or synthetic state changes.
    await handle.hover();
    const handleBounds = await handle.boundingBox();
    const initialBounds = await drawer.boundingBox();
    expect(handleBounds).not.toBeNull();
    expect(initialBounds).not.toBeNull();
    const startX = handleBounds!.x + Math.min(30, handleBounds!.width / 2);
    const startY = handleBounds!.y + handleBounds!.height / 2;
    const endX = Math.min(page.viewportSize()!.width - 4, startX + initialBounds!.width * 0.7);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 14 });
    expect((await drawer.boundingBox())!.x, 'The panel must follow the pointer before release').toBeGreaterThan(initialBounds!.x + 40);
    await page.mouse.up();
    await expect(drawer).toHaveCount(0, { timeout: 5000 });
    await expect(citation).toBeFocused();
    await expect(workspace).not.toHaveAttribute('inert', '');
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(priorOverflow);

    await citation.click();
    await expect(drawer).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await drawer.getByRole('button', { name: 'Close evidence', exact: true }).click();
    await expect(drawer).toHaveCount(0, { timeout: 5000 });
    await expect(citation).toBeFocused();
    await expect(workspace).not.toHaveAttribute('inert', '');
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(priorOverflow);
  });
});

test.describe('evidence drawer with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Escape closes immediately and restores citation focus without waiting for a spring', async ({ page }) => {
    const citation = await openMsftResearch(page);
    const priorOverflow = await page.evaluate(() => document.body.style.overflow);
    await citation.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer).toBeFocused();
    await page.keyboard.press('Escape');
    // Deliberately inspect the state immediately after the keyboard event rather
    // than retrying for seconds: reduced motion must not wait for animated exit.
    expect(await drawer.count()).toBe(0);
    expect(await citation.evaluate(element => element === document.activeElement)).toBe(true);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(priorOverflow);
    await expect(page.locator('#main-content').locator('..')).not.toHaveAttribute('inert', '');
  });
});
