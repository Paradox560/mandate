import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {reservePortableBudget} from '../lib/portable-budget.ts';
import {NodeD1Database} from '../runtime/node-d1.ts';

const day = new Date('2026-10-17T12:00:00Z');
const used = (db: NodeD1Database, bucket: string) => db.prepare('SELECT used FROM portable_usage WHERE bucket=?').bind(bucket).first<number>('used');

test('denied session requests cannot consume the remaining shared analysis budget', async t => {
  const db = new NodeD1Database(':memory:'); t.after(() => db.close());
  for(let i=0;i<20;i++) await reservePortableBudget(db,'session:one','100',day);
  for(let i=0;i<5;i++) await assert.rejects(reservePortableBudget(db,'session:one','100',day),/daily demo analysis limit/);
  assert.equal(await used(db,'global:2026-10-17'),20);
  assert.equal(await used(db,'session:one:2026-10-17'),20);
  await reservePortableBudget(db,'session:two','100',day);
  assert.equal(await used(db,'global:2026-10-17'),21);
  assert.equal(await used(db,'session:two:2026-10-17'),1);
});

test('two connections competing for the last daily slot charge exactly one session', async t => {
  const directory = mkdtempSync(join(tmpdir(),'mandate-node-budget-'));
  const first = new NodeD1Database(join(directory,'budget.sqlite'));
  const second = new NodeD1Database(join(directory,'budget.sqlite'));
  t.after(() => {first.close(); second.close(); rmSync(directory,{recursive:true,force:true});});
  await reservePortableBudget(first,'session:seed','2',day);
  const outcomes = await Promise.allSettled([
    reservePortableBudget(first,'session:one','2',day),
    reservePortableBudget(second,'session:two','2',day),
  ]);
  assert.equal(outcomes.filter(result => result.status==='fulfilled').length,1);
  assert.equal(await used(first,'global:2026-10-17'),2);
  const totals = [await used(first,'session:one:2026-10-17'),await used(first,'session:two:2026-10-17')];
  assert.equal(totals.reduce<number>((sum,value)=>sum+(value??0),0),1);
  await assert.rejects(reservePortableBudget(first,'session:three','2',day),/daily demo analysis limit/);
  assert.equal(await used(first,'session:three:2026-10-17'),null);
});

test('analysis budgets reset on the UTC day and survive a connection restart', async t => {
  const directory = mkdtempSync(join(tmpdir(),'mandate-node-budget-reset-'));
  const path = join(directory,'budget.sqlite'); let db = new NodeD1Database(path);
  t.after(() => {db.close(); rmSync(directory,{recursive:true,force:true});});
  await reservePortableBudget(db,'session:one','1',day);
  db.close(); db = new NodeD1Database(path);
  await assert.rejects(reservePortableBudget(db,'session:one','1',day),/daily demo analysis limit/);
  await reservePortableBudget(db,'session:one','1',new Date('2026-10-18T00:00:00Z'));
  assert.equal(await used(db,'global:2026-10-17'),1);
  assert.equal(await used(db,'global:2026-10-18'),1);
});
