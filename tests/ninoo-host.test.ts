import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, symlinkSync, rmSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';

function fixture(t: {after(callback: () => void): void}) {
  const root = mkdtempSync(join(tmpdir(), 'mandate ninoo host '));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(join(root, 'scripts'));
  for (const filename of ['prepare-ninoo.mjs', 'ninoo-host.mjs']) {
    cpSync(new URL(`../scripts/${filename}`, import.meta.url), join(root, 'scripts', filename));
  }
  const manifest = {name: 'mandate', private: true, scripts: {dev: 'original-dev', build: 'original-build', start: 'original-start', test: 'keep-test'}, dependencies: {react: 'keep-react'}, pnpm: {onlyBuiltDependencies: ['sharp'], ignoredBuiltDependencies: ['node', 'keep-ignored'], overrides: {'keep-package': '1.0.0'}}};
  writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
  return root;
}

test('Ninoo profile changes only the target scripts and pinned runtime, idempotently', t => {
  const root = fixture(t);
  const args = [join(root, 'scripts/prepare-ninoo.mjs')];
  assert.equal(spawnSync(process.execPath, args, {cwd: tmpdir()}).status, 0);
  const first = readFileSync(join(root, 'package.json'), 'utf8');
  const manifest = JSON.parse(first);
  assert.deepEqual(manifest.scripts, {
    dev: 'node scripts/ninoo-host.mjs dev', build: 'node scripts/ninoo-host.mjs build',
    start: 'node scripts/ninoo-host.mjs start', test: 'keep-test',
  });
  assert.deepEqual(manifest.dependencies, {react: 'keep-react', node: '22.23.3'});
  assert.deepEqual(manifest.pnpm, {onlyBuiltDependencies: ['sharp', 'node'], ignoredBuiltDependencies: ['keep-ignored'], overrides: {'keep-package': '1.0.0'}});
  assert.equal(spawnSync(process.execPath, args).status, 0);
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), first);
});

test('host wrapper uses pinned Node, loads private env without logging it, and forwards arguments and PORT', t => {
  const root = fixture(t);
  mkdirSync(join(root, 'node_modules/node/bin'), {recursive: true});
  symlinkSync(process.execPath, join(root, 'node_modules/node/bin/node'));
  writeFileSync(join(root, '.env.ninoo.local'), 'MANDATE_PRIVATE_TEST_SENTINEL=never-print-this-test-value\nPORT=9000\n');
  writeFileSync(join(root, 'scripts/run-ninoo.mjs'), `console.log(JSON.stringify({args:process.argv.slice(2),port:process.env.PORT,hasPrivateEnv:!!process.env.MANDATE_PRIVATE_TEST_SENTINEL,cwd:process.cwd()}));`);
  const run = spawnSync(process.execPath, [join(root, 'scripts/ninoo-host.mjs'), 'dev', '--port', '4567'], {env: {...process.env, PORT: '4567'}, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {args: ['dev', '--port', '4567'], port: '4567', hasPrivateEnv: true, cwd: realpathSync(root)});
  assert.equal((run.stdout + run.stderr).includes('never-print-this-test-value'), false);
});

test('compatible native Node works without an env file; incompatible Node gives a setup error', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'scripts/run-ninoo.mjs'), 'console.log("runner-started");');
  const native = spawnSync(process.execPath, [join(root, 'scripts/ninoo-host.mjs'), 'start'], {encoding: 'utf8'});
  assert.equal(native.status, 0, native.stderr);
  assert.equal(native.stdout.trim(), 'runner-started');
  writeFileSync(join(root, 'node20.mjs'), 'Object.defineProperty(process.versions,"node",{value:"20.20.2"});');
  const old = spawnSync(process.execPath, ['--import', join(root, 'node20.mjs'), join(root, 'scripts/ninoo-host.mjs'), 'build'], {encoding: 'utf8'});
  assert.equal(old.status, 1);
  assert.match(old.stderr, /install dependencies to provide the pinned Node runtime/);
  assert.doesNotMatch(old.stdout, /runner-started/);
});
