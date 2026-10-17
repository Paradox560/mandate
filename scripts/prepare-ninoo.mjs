import {readFileSync, writeFileSync, renameSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
manifest.scripts ??= {};
for (const command of ['dev', 'build', 'start']) {
  manifest.scripts[command] = `node scripts/ninoo-host.mjs ${command}`;
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
console.log('Ninoo host profile enabled in this checkout. Install dependencies and update its lockfile before publishing.');
