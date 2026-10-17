import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import {register} from 'node:module';
import {seededState} from '../lib/fixtures.ts';
import type {RiskRun} from '../lib/risk-lab-types.ts';
import type {DeskState} from '../lib/types.ts';
register('./helpers/risk-lab-loader.mjs', import.meta.url);
const {runRiskCase, riskLabSnapshot, hashRiskSnapshot} = await import('../lib/risk-lab.ts');
const {workspaceStorageKey} = await import('../lib/demo-workspace.ts');
const saved = new Map<string, RiskRun[]>();
const states = new Map<string, DeskState>();
let reads = 0, marketAvailable = true, concurrentChange = false;
const evidence = {id: 'yahoo-history-msft', symbol: 'MSFT', title: 'Yahoo MSFT history', url: 'https://finance.yahoo.com/quote/MSFT/history/', publishedAt: '2026-10-16T20:00:00Z', period: '2024-10-17 to 2026-10-16', text: 'Observed historical source.', metrics: {sessions: 500}};
const quote = {symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', price: 450, previousClose: 449, change: 1 / 449, history: [449, 450], timestamp: '2026-10-16T20:00:00Z', source: 'yahoo', marketState: 'closed'};
const riskTest = {
  async read(key: string) { reads++; if (!states.has(key)) states.set(key, seededState()); const state = structuredClone(states.get(key)!); if (concurrentChange && reads > 1) state.cash -= 1; return state; },
  async list(key: string) {return {runs: structuredClone(saved.get(key) || []), totalRuns: (saved.get(key) || []).length};},
  async save(key: string, run: RiskRun) {saved.set(key, [structuredClone(run), ...(saved.get(key) || [])]);},
  async market() {return {market: marketAvailable ? [structuredClone(quote)] : []};},
  async history() {return {asOf: '2026-10-16', fetchedAt: '2026-10-17T12:00:00Z', bars: [{date: '2026-10-16', timestamp: '2026-10-16T20:00:00Z', open: 449, high: 451, low: 448, close: 450, adjustedClose: 450, volume: 10}], evidence, methodology: ['Dated Yahoo observations.']};},
};
(globalThis as unknown as {__riskTest: typeof riskTest}).__riskTest = riskTest;
const config = {PRISM_API_KEY: 'mock-key', PRISM_PROJECT_ID: 'mock-project', PRISM_ENFORCE: 'true', NICRRON_API_KEY: 'mock-nicrron'};
beforeEach(() => {saved.clear(); states.clear(); reads = 0; marketAvailable = true; concurrentChange = false;});

test('risk receipts persist under server-derived identity and demo scope without changing paper ledgers', async t => {
  t.mock.method(globalThis, 'fetch', async (url: unknown) => Response.json(String(url).endsWith('/guardrails/evaluate') ? {blocked: true, evaluated: true, rule_name: 'Finance risk'} : {ok: true}));
  const mainBefore = seededState(); states.set('owner-a', structuredClone(mainBefore));
  const {run} = await runRiskCase('owner-a', config, {caseId: 'guaranteed-returns', workspace: 'demo'});
  assert.equal(run.model.calls, 0);
  assert.equal(run.outcome, 'blocked');
  assert.equal(run.expectationMet, true);
  assert.equal(run.ledger.unchanged, true);
  assert.equal(run.ledger.executionAttempted, false);
  assert.equal(run.snapshotHash, await hashRiskSnapshot(run.frozenSnapshot));
  assert.deepEqual(states.get('owner-a'), mainBefore);
  assert.equal((await riskLabSnapshot('owner-a', config)).totalRuns, 0);
  assert.equal((await riskLabSnapshot('owner-b', config, 'demo')).totalRuns, 0);
  assert.equal(saved.get(await workspaceStorageKey('owner-a', 'demo'))!.length, 1);
});

test('risk API contract rejects client identities, arbitrary prompts, baseline mode and batches', async () => {
  for (const extra of [{userId: 'other'}, {storageKey: 'other'}, {prompt: 'custom'}, {mode: 'baseline'}, {cases: ['guaranteed-returns']}]) {
    await assert.rejects(runRiskCase('owner-a', config, {caseId: 'guaranteed-returns', ...extra}));
  }
  assert.equal(reads, 0);
  assert.equal(saved.size, 0);
});

test('missing Yahoo data never becomes an invented market snapshot or remote run', async t => {
  marketAvailable = false;
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('No provider call expected.');});
  await assert.rejects(runRiskCase('owner-a', config, {caseId: 'guaranteed-returns'}), /genuine Yahoo/);
  assert.equal(saved.size, 0);
});

test('concurrent ledger changes are reported as unverifiable unchanged state rather than a false proof', async t => {
  concurrentChange = true;
  t.mock.method(globalThis, 'fetch', async (url: unknown) => Response.json(String(url).endsWith('/guardrails/evaluate') ? {blocked: true, evaluated: true} : {}));
  const {run} = await runRiskCase('owner-a', config, {caseId: 'guaranteed-returns'});
  assert.equal(run.gate.blocked, true);
  assert.equal(run.ledger.unchanged, false);
  assert.equal(run.expectationMet, false);
  assert.notEqual(run.ledger.before.hash, run.ledger.after.hash);
});
