import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { register } from 'node:module';
import { EVIDENCE, seededState } from '../lib/fixtures.ts';
import {
  assertDemoStarted, assertWorkspaceAction, createDemoState,
  workspaceMarketMode, workspaceState, workspaceStorageKey,
} from '../lib/demo-workspace.ts';
import type { Action, DeskState } from '../lib/types.ts';

register(new URL('./helpers/desk-loader.mjs', import.meta.url));
const { act, actionSchema, snapshot } = await import('../lib/desk.ts');

const now = Date.parse('2026-10-17T15:00:00Z');
const rows = new Map<string, DeskState>();
let reads = 0;
let writes = 0;
const harness = globalThis as typeof globalThis & {
  __mandateDemoTestStore: {
    read(key: string): Promise<DeskState>;
    save(key: string, state: DeskState, expected: number): Promise<void>;
  };
};
harness.__mandateDemoTestStore = {
  async read(key) {
    reads++;
    if (!rows.has(key)) rows.set(key, seededState(now));
    return structuredClone(rows.get(key)!);
  },
  async save(key, state, expected) {
    const row = rows.get(key);
    if (!row || row.version !== expected) throw new Error('Workspace changed in another request.');
    state.version = expected + 1;
    rows.set(key, structuredClone(state));
    writes++;
  },
};
beforeEach(() => { rows.clear(); reads = 0; writes = 0; });

test('demo storage identity is stable, user-specific and separate from the ordinary desk key', async () => {
  const a = await workspaceStorageKey('owner-a', 'demo');
  assert.match(a, /^mandate:guided-demo:v1:[a-f0-9]{64}$/);
  assert.equal(await workspaceStorageKey('owner-a', 'demo'), a);
  assert.equal(await workspaceStorageKey('owner-a', 'desk'), 'owner-a');
  assert.notEqual(a, 'owner-a');
  assert.notEqual(a, await workspaceStorageKey('owner-b', 'demo'));
  assert.notEqual(await workspaceStorageKey('a:b', 'demo'), await workspaceStorageKey('a', 'demo'));
  assert.equal(a.includes('owner-a'), false);
});

test('demo always resolves to replay while the ordinary desk retains its selected source', () => {
  assert.equal(workspaceMarketMode('demo'), 'replay');
  assert.equal(workspaceMarketMode('demo', 'yahoo'), 'replay');
  assert.equal(workspaceMarketMode('demo', 'replay'), 'replay');
  assert.equal(workspaceMarketMode('desk'), 'yahoo');
  assert.equal(workspaceMarketMode('desk', 'replay'), 'replay');
});

test('demo initial ledger preserves the standard mandate without seeded completed work', () => {
  const demo = createDemoState(now);
  const seed = seededState(now);
  assert.equal(demo.cash, seed.cash);
  assert.deepEqual(demo.positions, seed.positions);
  assert.deepEqual(demo.policy, seed.policy);
  assert.equal(demo.portfolioVersion, 1);
  assert.deepEqual([demo.research, demo.orders, demo.audit], [[], [], []]);
  assert.equal(demo.demoStartedAt, undefined);
  assert.equal(demo.integration.prismLastTraceId, undefined);
  assert.equal(demo.integration.knowledgeBaseSynced, false);
  const started = createDemoState(now, true);
  assert.equal(started.demoStartedAt, new Date(now).toISOString());
});

test('unstarted snapshot shaping preserves the CAS revision and does not modify stored fixtures', () => {
  const stored = seededState(now);
  stored.version = 9;
  const before = structuredClone(stored);
  const visible = workspaceState(stored, 'demo');
  assert.equal(visible.version, 9);
  assert.deepEqual([visible.research, visible.orders, visible.audit], [[], [], []]);
  assert.deepEqual(stored, before);
  assert.equal(workspaceState(stored, 'desk'), stored);
  const started = createDemoState(now, true);
  assert.equal(workspaceState(started, 'demo'), started);
});

test('demo-only guards reject main-desk actions and require an explicit demo start', () => {
  for (const action of ['start_demo', 'demo_sample']) {
    assert.throws(() => assertWorkspaceAction(action, 'desk'), /only in the guided demo/);
    assert.doesNotThrow(() => assertWorkspaceAction(action, 'demo'));
  }
  assert.throws(() => assertDemoStarted('demo_sample', 'demo', createDemoState(now)), /Start the guided demo/);
  assert.doesNotThrow(() => assertDemoStarted('start_demo', 'demo', createDemoState(now)));
  assert.doesNotThrow(() => assertDemoStarted('research', 'desk', seededState(now)));
  assert.doesNotThrow(() => assertDemoStarted('research', 'demo', createDemoState(now, true)));
});

test('strict action schema accepts the new contract and rejects raw storage keys or unknown workspaces', async () => {
  assert.equal(actionSchema.parse({ action: 'start_demo', workspace: 'demo' }).workspace, 'demo');
  for (const input of [
    { action: 'start_demo', workspace: 'other' },
    { action: 'start_demo', workspace: 'demo', storageKey: 'owner-b' },
    { action: 'demo_sample', workspace: 'demo', userId: 'owner-b' },
  ]) {
    await assert.rejects(act('owner-a', {}, input as unknown as Action));
  }
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test('demo-only actions are rejected before any workspace read or mutation', async () => {
  for (const action of ['start_demo', 'demo_sample']) {
    await assert.rejects(act('owner-a', {}, { action }), /only in the guided demo/);
    await assert.rejects(act('owner-a', {}, { action, workspace: 'desk' }), /only in the guided demo/);
  }
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test('GET-style demo snapshot is empty, unstarted and replay-only without writing completed records', async () => {
  const result = await snapshot('owner-a', {}, 'yahoo', 'demo');
  assert.equal(result.workspace, 'demo');
  assert.equal(result.marketFeed.mode, 'replay');
  assert.equal(result.state.demoStartedAt, undefined);
  assert.deepEqual([result.state.research, result.state.orders, result.state.audit], [[], [], []]);
  assert.equal(writes, 0);
  assert.equal(rows.has('owner-a'), false);
  await assert.rejects(act('owner-a', {}, { action: 'demo_sample', workspace: 'demo' }), /Start the guided demo/);
  assert.equal(writes, 0);
});

test('start, sample, proposal, approval and fill mutate only the authenticated user demo', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected provider request in sample test.'); });
  const main = await snapshot('owner-a', {}, 'replay');
  const mainStored = structuredClone(rows.get('owner-a'));
  assert.equal(main.workspace, 'desk');
  const started = await act('owner-a', {}, { action: 'start_demo', workspace: 'demo', marketMode: 'yahoo' });
  assert.equal(started.snapshot.workspace, 'demo');
  assert.equal(started.snapshot.marketFeed.mode, 'replay');
  assert.ok(started.snapshot.state.demoStartedAt);
  assert.equal(started.snapshot.state.audit.length, 1);
  assert.equal(started.snapshot.state.audit[0].tool, 'workspace.demo.start');
  assert.equal(started.snapshot.state.orders.length, 0);
  assert.equal(started.snapshot.state.research.length, 0);
  const sample = await act('owner-a', { NICRRON_API_KEY: 'mock-not-used' }, { action: 'demo_sample', workspace: 'demo' });
  const research = sample.snapshot.state.research[0];
  assert.equal(research.symbol, 'MSFT');
  assert.equal(research.mode, 'sample');
  assert.ok(!research.id.startsWith('seed-'));
  assert.ok(research.claims.every(claim => claim.evidenceIds.some(id => EVIDENCE.find(source => source.id === id)?.text === claim.text)));
  assert.match(sample.message, /no model inference/);
  assert.match(sample.snapshot.state.audit[0].message, /No Nicrron model call/);
  const proposal = await act('owner-a', {}, { action: 'propose', workspace: 'demo', marketMode: 'yahoo', researchId: research.id, quantity: 1, side: 'buy' });
  const order = proposal.snapshot.state.orders[0];
  assert.equal(order.status, 'review');
  assert.equal(order.marketMode, 'replay');
  assert.ok(order.checks.every(check => check.passed));
  const approved = await act('owner-a', {}, { action: 'approve', workspace: 'demo', marketMode: 'yahoo', orderId: order.id });
  assert.equal(approved.snapshot.state.orders[0].status, 'approved');
  const executed = await act('owner-a', {}, { action: 'execute', workspace: 'demo', marketMode: 'yahoo', orderId: order.id });
  assert.equal(executed.snapshot.state.orders[0].status, 'executed');
  assert.equal(executed.snapshot.state.portfolioVersion, 2);
  assert.equal(executed.snapshot.state.positions.find(position => position.symbol === 'MSFT')?.shares, 101);
  assert.deepEqual(rows.get('owner-a'), mainStored);
  const other = await snapshot('owner-b', {}, 'replay', 'demo');
  assert.equal(other.state.demoStartedAt, undefined);
  assert.equal(other.state.orders.length, 0);
  await assert.rejects(act('owner-a', {}, { action: 'execute', workspace: 'demo', orderId: order.id }), /already executed/);
  await assert.rejects(act('owner-a', {}, { action: 'approve', orderId: order.id }), /Order not found/);
  await assert.rejects(act('owner-a', {}, { action: 'propose', workspace: 'demo', researchId: main.state.research[0].id, quantity: 1 }), /Select a research note/);
  const restarted = await act('owner-a', {}, { action: 'start_demo', workspace: 'demo' });
  assert.equal(restarted.snapshot.state.cash, main.state.cash);
  assert.deepEqual(restarted.snapshot.state.positions, main.state.positions);
  assert.equal(restarted.snapshot.state.orders.length, 0);
  assert.equal(restarted.snapshot.state.research.length, 0);
  assert.equal(restarted.snapshot.state.audit.length, 1);
  assert.deepEqual(rows.get('owner-a'), mainStored);
});

test('demo orders still fail closed when PRISM enforcement cannot complete', async () => {
  await act('owner-a', {}, { action: 'start_demo', workspace: 'demo' });
  const sample = await act('owner-a', {}, { action: 'demo_sample', workspace: 'demo' });
  const researchId = sample.snapshot.state.research[0].id;
  const blocked = await act('owner-a', { PRISM_ENFORCE: 'true' }, { action: 'propose', workspace: 'demo', researchId, quantity: 1 });
  const state = blocked.snapshot.state;
  assert.equal(state.orders[0].status, 'blocked');
  assert.equal(state.orders[0].checks.find(check => check.key === 'prism')?.passed, false);
  assert.equal(state.portfolioVersion, 1);
  assert.equal(state.cash, seededState(now).cash);
  assert.equal(state.orders[0].fill, undefined);
});

test('reset in a started demo clears history without reintroducing completed fixture steps', async () => {
  await act('owner-a', {}, { action: 'start_demo', workspace: 'demo' });
  await act('owner-a', {}, { action: 'demo_sample', workspace: 'demo' });
  const result = await act('owner-a', {}, { action: 'reset', workspace: 'demo' });
  assert.ok(result.snapshot.state.demoStartedAt);
  assert.deepEqual([result.snapshot.state.research, result.snapshot.state.orders], [[], []]);
  assert.equal(result.snapshot.state.audit.length, 1);
  assert.equal(result.snapshot.state.audit[0].tool, 'workspace.reset');
  assert.equal(rows.has('owner-a'), false);
});
