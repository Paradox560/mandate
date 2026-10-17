import {expect, test} from '@playwright/test';
import {RISK_CASES, type RiskLabSnapshot} from '../../lib/risk-lab-types';
import {fixture} from './fixtures';

const sitesAuth = {error: 'Authentication required. Sign in with ChatGPT to open your workspace.', authRequired: true, signInUrl: '/signin-with-chatgpt?return_to=%2F'};
const nodeAuth = {error: 'Open a demo session to use your paper workspace.', authRequired: true, signInUrl: '/access?returnTo=%2F'};

test('Sites desk authentication failure offers a top-level sign-in link with the actual return route', async ({page}) => {
  await page.route('**/api/desk?*', route => route.fulfill({status: 401, json: sitesAuth}));
  await page.goto('/?marketMode=yahoo&demo=1');
  const signIn = page.getByRole('link', {name: 'Sign in with ChatGPT', exact: true});
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute('target', '_top');
  await expect(signIn).toHaveAttribute('href', '/signin-with-chatgpt?return_to=%2F%3FmarketMode%3Dyahoo%26demo%3D1');
  await expect(page.getByRole('button', {name: 'Retry', exact: true})).toHaveCount(0);
});

test('portable Risk Lab session recovery preserves the judge route and fragment', async ({page}) => {
  await page.route('**/api/desk?*', route => route.fulfill({json: fixture()}));
  await page.route('**/api/risk-lab?*', route => route.fulfill({status: 401, json: nodeAuth}));
  await page.route('**/access?*', route => route.fulfill({contentType: 'text/html', body: '<main><h1>Session access</h1></main>'}));
  await page.goto('/?judge=1&marketMode=yahoo#proof');
  await expect(page).toHaveURL(/\/access\?returnTo=%2F%3Fjudge%3D1%26marketMode%3Dyahoo%23proof$/);
  await expect(page.getByRole('heading', {name: 'Session access'})).toBeVisible();
});

test('expired Risk Lab mutation offers Sites sign-in without assuming a run succeeded', async ({page}) => {
  const lab: RiskLabSnapshot = {cases: RISK_CASES, runs: [], totalRuns: 0, workspace: 'desk', integration: {nicrronConfigured: true, prismConfigured: true, enforce: true}, providerProof: {blockCheck: {status: 'unverified'}, rootCause: {status: 'unverified'}}};
  await page.route('**/api/desk?*', route => route.fulfill({json: fixture()}));
  await page.route('**/api/risk-lab*', route => route.request().method() === 'GET' ? route.fulfill({json: lab}) : route.fulfill({status: 401, json: sitesAuth}));
  await page.goto('/?judge=1');
  await page.getByRole('button', {name: 'Run risk check', exact: true}).click();
  const signIn = page.getByTestId('risk-lab').getByRole('link', {name: 'Sign in with ChatGPT', exact: true});
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveAttribute('href', '/signin-with-chatgpt?return_to=%2F%3Fjudge%3D1');
  await expect(page.getByTestId('risk-receipt')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Run risk check', exact: true})).toHaveCount(0);
});

test('expired desk action redirects to portable access without trusting a server return target', async ({page}) => {
  await page.route('**/api/desk?*', route => route.fulfill({json: fixture()}));
  await page.route('**/api/action', route => route.fulfill({status: 401, json: {...nodeAuth, signInUrl: '/access?returnTo=https://untrusted.example'}}));
  await page.route('**/access?*', route => route.fulfill({contentType: 'text/html', body: '<main><h1>Session access</h1></main>'}));
  await page.goto('/?marketMode=yahoo');
  await expect(page.getByRole('region', {name: 'Portfolio summary'})).toBeVisible();
  await page.getByRole('navigation', {name: 'Main navigation'}).getByRole('button', {name: 'Connections', exact: true}).click();
  await page.getByRole('button', {name: 'Test connections', exact: true}).click();
  await expect(page).toHaveURL(/\/access\?returnTo=%2F%3FmarketMode%3Dyahoo$/);
});

test('access page can recover from a failed initial session request', async ({page}) => {
  let requests = 0;
  await page.route('**/api/session', route => ++requests === 1
    ? route.fulfill({status: 503, json: {error: 'Session service is temporarily unavailable.'}})
    : route.fulfill({json: {mode: 'code', authenticated: false}}));
  await page.goto('/access?returnTo=%2F%3Fjudge%3D1');
  await expect(page.getByRole('button', {name: 'Open workspace', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Retry connection', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Open workspace', exact: true})).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('embedded access opens a full-page sign-in without submitting codes in the frame', async ({page}) => {
  const sessionRequests: string[] = [];
  await page.context().route('**/api/session', route => {
    sessionRequests.push(route.request().method());
    return route.fulfill({json: {mode: 'code', authenticated: false}});
  });
  await page.route('**/test-auth-frame', route => route.fulfill({contentType: 'text/html', body: '<iframe title="Embedded workspace" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" src="/access?returnTo=%2F%3Fjudge%3D1%26marketMode%3Dyahoo%23proof"></iframe>'}));
  await page.goto('/test-auth-frame');
  const frame = page.frameLocator('iframe[title="Embedded workspace"]');
  const link = frame.getByRole('link', {name: 'Open workspace in a new tab', exact: true});
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('href', '/access?returnTo=%2F%3Fjudge%3D1%26marketMode%3Dyahoo%23proof');
  await expect(frame.getByLabel('Demo access code')).toHaveCount(0);
  await expect(frame.locator('form')).toHaveCount(0);
  expect(sessionRequests).toEqual([]);
  const popupReady = page.waitForEvent('popup');
  await link.click();
  const popup = await popupReady;
  await expect(popup.getByLabel('Demo access code')).toBeVisible();
  await expect(popup.getByRole('button', {name: 'Open workspace', exact: true})).toBeEnabled();
  expect(sessionRequests).not.toContain('POST');
  await popup.close();
});
