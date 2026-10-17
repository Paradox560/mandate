import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {NodeD1Database} from '../runtime/node-d1.ts';

test('Node storage stays lazy, migrates once, and persists records across restarts', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'mandate-node-db-'));
  const filename = join(directory, 'persistent', 'mandate.sqlite');
  let db = new NodeD1Database(filename);
  t.after(() => {db.close(); rmSync(directory, {recursive: true, force: true});});
  const select = db.prepare('SELECT payload FROM workspaces WHERE id = ?').bind('ninoo:one');
  assert.equal(existsSync(filename), false);
  assert.equal(await select.first(), null);
  assert.equal(existsSync(filename), true);
  await db.prepare('INSERT INTO workspaces(id,payload,revision) VALUES(?,?,?)').bind('ninoo:one', '{"cash":250000}', 1).run();
  await db.prepare('INSERT INTO risk_runs(id,workspace_id,created_at,payload) VALUES(?,?,?,?)')
    .bind('risk-one', 'ninoo:one', '2026-10-17T12:00:00Z', '{"outcome":"blocked"}').run();
  db.close();
  db = new NodeD1Database(filename);
  assert.deepEqual(await db.prepare('SELECT payload, revision FROM workspaces WHERE id = ?').bind('ninoo:one').first(), {payload: '{"cash":250000}', revision: 1});
  assert.equal(await db.prepare('SELECT COUNT(*) AS total FROM mandate_node_migrations').first('total'), 3);
  assert.equal(await db.prepare('SELECT COUNT(*) AS total FROM risk_runs WHERE workspace_id = ?').bind('ninoo:one').first('total'), 1);
  assert.equal(await db.prepare('SELECT COUNT(*) AS total FROM risk_runs WHERE workspace_id = ?').bind('ninoo:two').first('total'), 0);
});

test('independent Node connections preserve compare-and-swap and queue lease exclusivity', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'mandate-node-cas-'));
  const filename = join(directory, 'mandate.sqlite');
  const first = new NodeD1Database(filename), second = new NodeD1Database(filename);
  t.after(() => {first.close(); second.close(); rmSync(directory, {recursive: true, force: true});});
  await first.prepare('INSERT INTO workspaces(id,payload,revision) VALUES(?,?,?)').bind('ninoo:one', '{"cash":250000}', 1).run();
  const update = 'UPDATE workspaces SET payload=?, revision=? WHERE id=? AND revision=?';
  const results = await Promise.all([
    first.prepare(update).bind('{"cash":249000}', 2, 'ninoo:one', 1).run(),
    second.prepare(update).bind('{"cash":248000}', 2, 'ninoo:one', 1).run(),
  ]);
  assert.deepEqual(results.map(result => result.meta.changes).sort(), [0, 1]);
  assert.equal(await second.prepare('SELECT payload FROM workspaces WHERE id=?').bind('ninoo:one').first('payload'), '{"cash":249000}');
  await first.prepare('INSERT OR IGNORE INTO queue_runner(id) VALUES(?)').bind('yahoo-paper-queue').run();
  const lease = 'UPDATE queue_runner SET lease_token=?, lease_until=?, last_started_at=? WHERE id=? AND lease_until<=?';
  const acquired = await Promise.all([
    first.prepare(lease).bind('token-one', 200, 'first', 'yahoo-paper-queue', 100).run(),
    second.prepare(lease).bind('token-two', 200, 'second', 'yahoo-paper-queue', 100).run(),
  ]);
  assert.deepEqual(acquired.map(result => result.meta.changes).sort(), [0, 1]);
  assert.equal((await second.prepare('UPDATE queue_runner SET lease_token=NULL, lease_until=0 WHERE id=? AND lease_token=?').bind('yahoo-paper-queue', 'wrong-token').run()).meta.changes, 0);
});

test('Node SQLite JSON1 selects only explicitly authorized Yahoo queues in oldest-check order', async t => {
  const db = new NodeD1Database(':memory:');
  t.after(() => db.close());
  const rows = [
    ['ninoo:later', [{status: 'queued', marketMode: 'yahoo', createdAt: '2026-10-17', queue: {fingerprint: 'later', queuedAt: '2026-10-16', lastCheckedAt: '2026-10-17'}}]],
    ['ninoo:earlier', [{status: 'queued', marketMode: 'yahoo', createdAt: '2026-10-15', queue: {fingerprint: 'earlier', queuedAt: '2026-10-15'}}]],
    ['ninoo:unapproved', [{status: 'queued', marketMode: 'yahoo', createdAt: '2026-10-14'}]],
    ['ninoo:synthetic', [{status: 'queued', marketMode: 'replay', createdAt: '2026-10-13', queue: {fingerprint: 'synthetic'}}]],
  ];
  for (const [id, orders] of rows) await db.prepare('INSERT INTO workspaces(id,payload) VALUES(?,?)').bind(id, JSON.stringify({orders})).run();
  const result = await db.prepare(`SELECT id FROM workspaces WHERE EXISTS (
    SELECT 1 FROM json_each(workspaces.payload, '$.orders') AS orders
    WHERE json_extract(orders.value, '$.status') = 'queued'
      AND json_extract(orders.value, '$.marketMode') = 'yahoo'
      AND json_extract(orders.value, '$.queue.fingerprint') IS NOT NULL
  ) ORDER BY (SELECT MIN(COALESCE(json_extract(pending.value, '$.queue.lastCheckedAt'), json_extract(pending.value, '$.queue.queuedAt'), json_extract(pending.value, '$.createdAt')))
    FROM json_each(workspaces.payload, '$.orders') AS pending WHERE json_extract(pending.value, '$.status') = 'queued'), id LIMIT ?`).bind(5).all<{id: string}>();
  assert.equal(result.success, true);
  assert.deepEqual(result.results.map(row => row.id), ['ninoo:earlier', 'ninoo:later']);
});

test('bound identities stay data and invalid bindings do not silently become null', async t => {
  const db = new NodeD1Database(':memory:');
  t.after(() => db.close());
  const identity = "ninoo:' OR 1=1 --";
  await db.prepare('INSERT INTO workspaces(id,payload) VALUES(?,?)').bind(identity, '{}').run();
  assert.equal(await db.prepare('SELECT id FROM workspaces WHERE id=?').bind('ninoo:other').first(), null);
  assert.equal(await db.prepare('SELECT id FROM workspaces WHERE id=?').bind(identity).first('id'), identity);
  assert.throws(() => db.prepare('SELECT ?').bind(undefined), /SQLite bindings/);
  assert.throws(() => db.prepare('SELECT ?').bind(NaN), /SQLite bindings/);
});
