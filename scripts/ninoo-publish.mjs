import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, renameSync, rmSync, realpathSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

export function normalizePreviewUrl(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.preview\.ninoo\.app$/.test(url.hostname)) {
    throw new Error('Preview URL must be an HTTPS Ninoo preview origin, without credentials, custom port, path, query or hash.');
  }
  return url.origin + '/';
}

function replaceDirectory(staged, target) {
  const previous = `${target}.previous-${randomUUID()}`;
  const hadPrevious = existsSync(target);
  if (hadPrevious) renameSync(target, previous);
  try { renameSync(staged, target); }
  catch (error) {
    if (hadPrevious) renameSync(previous, target);
    throw error;
  }
  if (hadPrevious) rmSync(previous, {recursive: true, force: true});
}

export function stageNinooPublish(root, input) {
  const previewUrl = normalizePreviewUrl(input);
  const dist = join(root, 'dist');
  const standalone = join(dist, 'standalone');
  if (!existsSync(join(standalone, 'server.js')) || !existsSync(join(standalone, 'dist/client')) || !existsSync(join(standalone, 'dist/server'))) {
    throw new Error('A complete standalone Node build is required before staging the static public entry.');
  }
  const privateRoot = join(root, '.ninoo');
  mkdirSync(privateRoot, {recursive: true, mode: 0o700});
  const stagedServer = mkdtempSync(join(privateRoot, 'server-stage-'));
  const stagedPublic = mkdtempSync(join(privateRoot, 'public-stage-'));
  try {
    cpSync(standalone, stagedServer, {recursive: true, dereference: true});
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open Mandate</title><link rel="icon" href="/favicon.svg"><style>body{margin:0;background:#f6f7f8;color:#17252b;font:17px/1.6 system-ui,sans-serif}main{max-width:540px;margin:16vh auto;padding:32px}small{color:#63747b;letter-spacing:.12em}h1{font-size:36px;line-height:1.2;font-weight:560}a{display:inline-block;margin:12px 0;padding:12px 20px;border-radius:8px;background:#136e66;color:white;text-decoration:none}p{color:#52656b}a:focus-visible{outline:3px solid #136e66;outline-offset:4px}</style></head>
<body><main><small>MANDATE</small><h1>Opening your secure workspace.</h1><p>The full application runs in its Ninoo workspace. This public page opens that workspace.</p><a id="open-workspace" href="${previewUrl}">Open Mandate workspace</a><p>If the workspace is sleeping, ask its owner to restart it in Ninoo.</p></main><script>const target=new URL(${JSON.stringify(previewUrl)});target.search=window.location.search;target.hash=window.location.hash;document.getElementById('open-workspace').href=target.href;window.location.replace(target.href);</script></body></html>\n`;
    writeFileSync(join(stagedPublic, 'index.html'), html);
    const favicon = join(root, 'public/favicon.svg');
    if (existsSync(favicon)) cpSync(favicon, join(stagedPublic, 'favicon.svg'));
    replaceDirectory(stagedServer, join(privateRoot, 'server'));
    replaceDirectory(stagedPublic, dist);
  } finally {
    rmSync(stagedServer, {recursive: true, force: true});
    rmSync(stagedPublic, {recursive: true, force: true});
  }
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const config = JSON.parse(readFileSync(join(root, '.ninoo/publish.json'), 'utf8'));
  const previewUrl = normalizePreviewUrl(config.previewUrl);
  const build = spawnSync(process.execPath, [join(root, 'scripts/ninoo-host.mjs'), 'build'], {cwd: root, env: process.env, stdio: 'inherit'});
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
  stageNinooPublish(root, previewUrl);
  console.log('Static public entry prepared. The full Node application remains in the private .ninoo/server directory.');
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  main();
}
