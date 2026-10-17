import {readFileSync, writeFileSync, renameSync, statSync, mkdirSync, existsSync, chmodSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {normalizePreviewUrl} from './ninoo-publish.mjs';

const options = process.argv.slice(2);
if (options.length && (options.length !== 2 || options[0] !== '--preview-url')) {
  throw new Error('Usage: node scripts/prepare-ninoo.mjs [--preview-url https://project.preview.ninoo.app]');
}
const publishConfigPath = fileURLToPath(new URL('../.ninoo/publish.json', import.meta.url));
const previewUrl = options.length ? normalizePreviewUrl(options[1])
  : existsSync(publishConfigPath) ? normalizePreviewUrl(JSON.parse(readFileSync(publishConfigPath, 'utf8')).previewUrl) : null;

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
manifest.scripts ??= {};
for (const command of ['dev', 'build', 'start']) {
  manifest.scripts[command] = `node scripts/ninoo-host.mjs ${command}`;
}
if (previewUrl) {
  manifest.scripts.dev = 'sh .ninoo/dev';
  manifest.scripts.build = 'node scripts/ninoo-publish.mjs';
}
manifest.dependencies ??= {};
manifest.dependencies.node = '22.23.3';
manifest.pnpm ??= {};
const allowedBuilds = manifest.pnpm.onlyBuiltDependencies ?? [];
if (!Array.isArray(allowedBuilds)) throw new Error('pnpm.onlyBuiltDependencies must be an array.');
manifest.pnpm.onlyBuiltDependencies = [...new Set([...allowedBuilds, 'node'])];
if (Array.isArray(manifest.pnpm.ignoredBuiltDependencies)) {
  manifest.pnpm.ignoredBuiltDependencies = manifest.pnpm.ignoredBuiltDependencies.filter(name => name !== 'node');
}
const contents = JSON.stringify(manifest, null, 2) + '\n';
if (contents !== readFileSync(packagePath, 'utf8')) {
  const temporaryPath = `${packagePath}.ninoo-${process.pid}.tmp`;
  writeFileSync(temporaryPath, contents, {mode: statSync(packagePath).mode});
  renameSync(temporaryPath, packagePath);
}
if (previewUrl) {
  mkdirSync(fileURLToPath(new URL('../.ninoo/', import.meta.url)), {recursive: true, mode: 0o700});
  writeFileSync(publishConfigPath, JSON.stringify({previewUrl}, null, 2) + '\n', {mode: 0o600});
  // Ninoo restarts from this saved launcher, independently of package scripts.
  const launcherPath = fileURLToPath(new URL('../.ninoo/dev', import.meta.url));
  const launcher = `#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd -- "$SCRIPT_DIR/.."
export PORT="\${PORT:-5173}"
exec node scripts/ninoo-host.mjs start "$@"
`;
  writeFileSync(launcherPath, launcher, {mode: 0o755});
  chmodSync(launcherPath, 0o755);
}
console.log('Ninoo host profile enabled in this checkout. Install dependencies and update its lockfile before publishing.');
