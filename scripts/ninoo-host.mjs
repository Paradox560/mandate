import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {constants} from 'node:os';
import {fileURLToPath} from 'node:url';

const [command, ...forwardedArgs] = process.argv.slice(2);
if (!['dev', 'build', 'start'].includes(command)) {
  console.error('Expected dev, build or start.');
  process.exit(1);
}

const root = fileURLToPath(new URL('../', import.meta.url));
const pinnedNode = fileURLToPath(new URL(`../node_modules/node/bin/node${process.platform === 'win32' ? '.exe' : ''}`, import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
const currentCompatible = major > 22 || (major === 22 && minor >= 13);
const executable = existsSync(pinnedNode) ? pinnedNode : currentCompatible ? process.execPath : null;
if (!executable) {
  console.error('Node.js 22.13+ is required. Run node scripts/prepare-ninoo.mjs, then install dependencies to provide the pinned Node runtime before publishing.');
  process.exit(1);
}

const environmentFile = fileURLToPath(new URL('../.env.ninoo.local', import.meta.url));
const runner = fileURLToPath(new URL('./run-ninoo.mjs', import.meta.url));
const args = [
  ...(existsSync(environmentFile) ? [`--env-file=${environmentFile}`] : []),
  runner, command, ...forwardedArgs,
];
const child = spawn(executable, args, {cwd: root, env: process.env, stdio: 'inherit'});
const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const handlers = new Map(signals.map(signal => [signal, () => child.kill(signal)]));
for (const [signal, handler] of handlers) process.on(signal, handler);
function cleanup() {
  for (const [signal, handler] of handlers) process.off(signal, handler);
}
child.once('error', error => {
  cleanup();
  console.error(`Unable to start the installed Node runtime (${error.code ?? 'spawn failed'}). Reinstall this checkout's dependencies for the host platform.`);
  process.exit(1);
});
child.once('exit', (code, signal) => {
  cleanup();
  process.exit(code ?? (signal ? 128 + (constants.signals[signal] ?? 1) : 1));
});
