import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { RISK_CASES, type RiskCaseId, type RiskLabSnapshot, type RiskRun } from '../../lib/risk-lab-types';
import { checkedTime, fixture, quoteTime, source } from './fixtures';

function labFixture(): RiskLabSnapshot {
  return { cases: RISK_CASES, runs: [], totalRuns: 0, workspace: 'desk', integration: { nicrronConfigured: true, prismConfigured: true, enforce: true }, providerProof: { blockCheck: { status: 'unverified' }, rootCause: { status: 'unverified' } } };
}
function runFixture(caseId: RiskCaseId): RiskRun {
  const spec = RISK_CASES.find(item => item.id === caseId)!;
  const blocked = spec.expectedOutcome === 'blocked';
  const ledger = { revision: 2, cash: 100000, positions: [], orderCount: 0, fillCount: 0, hash: 'recorded-ledger-hash' };
  const quote = fixture().market[1];
  return { id: `run-${caseId}`, caseId, caseLabel: spec.label, createdAt: checkedTime, completedAt: checkedTime, traceId: `trace-${caseId}`, sessionId: `session-${caseId}`, appVersion: 'risk-lab-v1', workspace: 'desk', input: spec.input, snapshotHash: 'frozen-yahoo-snapshot-hash', frozenSnapshot: { provider: 'yahoo', capturedAt: checkedTime, quote, history: { asOf: '2026-10-16', fetchedAt: checkedTime, sourceUrl: source.url, bars: [] }, evidence: source }, market: { symbol: 'MSFT', price: 201, quoteTimestamp: quoteTime, marketState: 'closed', historyAsOf: '2026-10-16', sourceUrl: source.url, evidence: source }, gate: { status: blocked ? 'blocked' : 'allowed', evaluated: true, blocked, allowed: !blocked, checkedAt: checkedTime, ...(blocked ? { ruleName: 'Recorded finance rule' } : {}), reason: blocked ? 'The financial risk rule blocked this request before inference.' : 'No blocking rule matched the sourced research request.' }, model: blocked ? { attempted: false, calls: 0, status: 'not_called' } : { attempted: true, calls: 1, status: 'succeeded', name: 'Configured Nicrron model', summary: 'MSFT historical observations describe a completed market session. They cannot guarantee a future return.', evidenceIds: [source.id], limitations: ['Historical performance is not a forecast.'] }, ledger: { before: ledger, after: ledger, unchanged: true, executionAttempted: false }, telemetry: { traceAcknowledged: true, spansAcknowledged: true, status: 'acknowledged' }, outcome: blocked ? 'blocked' : 'completed', expectedOutcome: spec.expectedOutcome, expectationMet: true };
}
async function mockLab(page: Page, options: { failRun?: boolean; failDesk?: boolean; proofs?: boolean } = {}) {
  const data = labFixture();
  if (options.proofs) { data.providerProof.blockCheck = { status: 'verified', checkedAt: checkedTime, evidenceUrl: 'https://prism.blockconvey.com/guardrails', summary: 'The blocked trace has a recorded false-positive check.', traceIds: ['trace-guaranteed-returns'] }; data.providerProof.rootCause = { status: 'verified', checkedAt: checkedTime, evidenceUrl: 'https://prism.blockconvey.com/root-cause', summary: 'Three recorded traces share the financial boundary failure.', traceIds: ['trace-1', 'trace-2', 'trace-3'] }; }
  const requests: unknown[] = [];
  await page.route('**/api/desk?*', route => options.failDesk ? route.fulfill({ status: 503, json: { error: 'Desk unavailable in this test.' } }) : route.fulfill({ json: fixture() }));
  await page.route('**/api/risk-lab*', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: data });
    const action = route.request().postDataJSON(); requests.push(action);
    if (options.failRun) return route.fulfill({ status: 503, json: { error: 'Yahoo history could not be frozen. No model call was made.' } });
    const run = runFixture(action.caseId); data.runs.unshift(run); data.totalRuns += 1;
    return route.fulfill({ json: { run, snapshot: data } });
  });
  return { data, requests };
}

test('judge entry works independently of desk loading and distinguishes local receipts from PRISM proof', async ({ page }) => {
  const { requests } = await mockLab(page, { failDesk: true });
  await page.goto('/?judge=1');
  await expect(page.getByRole('heading', { name: 'A cited answer is not permission to trade.' })).toBeVisible();
  const lab = page.getByTestId('risk-lab');
  await expect(lab.getByRole('button', { name: 'Run risk check', exact: true })).toBeEnabled();
  await expect(lab.getByText('Verification pending', { exact: true })).toHaveCount(2);
  await lab.getByRole('button', { name: 'Run risk check', exact: true }).click();
  const receipt = page.getByTestId('risk-receipt');
  await expect(receipt).toHaveAttribute('data-outcome', 'blocked');
  await expect(receipt).toContainText('Request stopped before model invocation');
  await expect(receipt).toContainText('Unchanged');
  await expect(receipt).toContainText('No execution attempted');
  await expect(receipt).toContainText('trace-guaranteed-returns');
  await expect(lab.getByText('Verification pending', { exact: true })).toHaveCount(2);
  expect(requests).toEqual([{ caseId: 'guaranteed-returns', workspace: 'desk' }]);
  const downloadReady = page.waitForEvent('download');
  await lab.getByRole('button', { name: 'Export evidence bundle', exact: true }).click();
  const download = await downloadReady;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.runs[0].traceId).toBe('trace-guaranteed-returns');
  expect(exported.runs[0].model.calls).toBe(0);
  expect(exported.runs[0].ledger.before).toEqual(exported.runs[0].ledger.after);
  expect(exported.providerProof.rootCause.status).toBe('unverified');
  expect(exported.runs[0].frozenSnapshot.provider).toBe('yahoo');
  await page.screenshot({ path: '/private/tmp/mandate-risk-lab-desktop.png', fullPage: true });
});

test('benign request displays real response fields and independently recorded provider proofs', async ({ page }) => {
  const { requests } = await mockLab(page, { proofs: true });
  await page.goto('/?judge=1');
  const lab = page.getByTestId('risk-lab');
  await lab.getByRole('button', { name: 'Cited market analysis Expected: sourced analysis' }).click();
  await lab.getByRole('button', { name: 'Run benign analysis', exact: true }).click();
  const receipt = page.getByTestId('risk-receipt');
  await expect(receipt).toHaveAttribute('data-outcome', 'completed');
  await expect(receipt).toContainText('Model response recorded');
  await expect(receipt).toContainText('MSFT historical observations');
  await expect(receipt).toContainText(source.id);
  await expect(lab.getByText('Evidence recorded', { exact: true })).toHaveCount(2);
  await expect(lab.getByRole('link', { name: 'Open recorded proof', exact: true }).last()).toHaveAttribute('href', 'https://prism.blockconvey.com/root-cause');
  expect(requests).toEqual([{ caseId: 'sourced-analysis', workspace: 'desk' }]);
});

test('a provider failure leaves no successful receipt and does not assume a blocked outcome', async ({ page }) => {
  await mockLab(page, { failRun: true });
  await page.goto('/?judge=1');
  const lab = page.getByTestId('risk-lab');
  await lab.getByRole('button', { name: 'Run risk check', exact: true }).click();
  await expect(lab.getByRole('alert')).toContainText('Yahoo history could not be frozen');
  await expect(page.getByTestId('risk-receipt')).toHaveCount(0);
  await expect(lab).toContainText('0 recorded runs');
  await expect(lab.getByRole('button', { name: 'Run risk check', exact: true })).toBeEnabled();
});

test('mobile risk walkthrough fits and keeps Yahoo desk and original demo reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLab(page);
  await page.goto('/?judge=1');
  const lab = page.getByTestId('risk-lab');
  await lab.getByRole('button', { name: 'Bypass human approval Expected: block before inference' }).click();
  await lab.getByRole('button', { name: 'Run risk check', exact: true }).click();
  await expect(page.getByTestId('risk-receipt')).toHaveAttribute('data-outcome', 'blocked');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByRole('link', { name: 'Guided demo', exact: true })).toHaveAttribute('href', '/?demo=1');
  await page.screenshot({ path: '/private/tmp/mandate-risk-lab-mobile.png', fullPage: true });
  await lab.getByRole('button', { name: 'Open investment desk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your investment desk.' })).toBeVisible();
  await expect(page.locator('.market-provider')).toHaveText('Yahoo Finance');
});

test('controlled evaluation uses recorded cohort numbers separately from workspace history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { data } = await mockLab(page);
  data.cohortProof = { capturedAt: checkedTime, snapshotHash: 'shared-yahoo-history-hash', evidenceUrl: '/proofs/recorded-evaluation.json', caseCount: 4, methodology: 'Four fixed requests repeated using the same Yahoo snapshot and model.', baseline: { runs: 8, riskyModelCalls: 6, blocked: 0, benignCompleted: 2 }, protected: { runs: 8, riskyModelCalls: 0, blocked: 6, benignCompleted: 2 } };
  await page.goto('/?judge=1');
  const cohort = page.getByTestId('risk-cohort');
  await expect(cohort).toContainText('Recorded controlled evaluation');
  await expect(cohort.getByRole('row', { name: 'Recorded runs 8 8', exact: true })).toBeVisible();
  await expect(cohort.getByRole('row', { name: 'Risky requests reaching the model 6 0', exact: true })).toBeVisible();
  await expect(cohort.getByRole('row', { name: 'Requests blocked before generation 0 6', exact: true })).toBeVisible();
  await expect(cohort.getByRole('link', { name: 'Open evaluation evidence' })).toHaveAttribute('href', '/proofs/recorded-evaluation.json');
  await expect(page.getByTestId('risk-lab')).toContainText('0 recorded runs in this desk workspace');
  await expect(cohort).toContainText('isolated CLI shadow evaluation with no order tool');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await cohort.screenshot({ path: '/private/tmp/mandate-risk-cohort-mobile.png' });
});
