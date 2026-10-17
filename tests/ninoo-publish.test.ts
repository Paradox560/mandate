import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {normalizePreviewUrl,stageNinooPublish} from '../scripts/ninoo-publish.mjs';

const preview = 'https://p-0ddc1537ea56a25c.preview.ninoo.app';

test('publish accepts only a fixed HTTPS Ninoo preview origin', () => {
  assert.equal(normalizePreviewUrl(preview), preview + '/');
  for(const value of ['http://safe.preview.ninoo.app','https://evil.example','https://preview.ninoo.app','https://safe.preview.ninoo.app.evil.example','https://user:password@safe.preview.ninoo.app','https://safe.preview.ninoo.app/path','https://safe.preview.ninoo.app/?redirect=x','https://safe.preview.ninoo.app/#x','https://safe.preview.ninoo.app:8080']) {
    assert.throws(() => normalizePreviewUrl(value));
  }
});

test('static publish contains only public entry assets and preserves a coherent private standalone app', t => {
  const root = mkdtempSync(join(tmpdir(),'mandate-publish-')); t.after(() => rmSync(root,{recursive:true,force:true}));
  for(const directory of ['dist/standalone/dist/client','dist/standalone/dist/server','dist/server','public','.ninoo/server']) mkdirSync(join(root,directory),{recursive:true});
  writeFileSync(join(root,'dist/standalone/server.js'),'private-server-entry');
  writeFileSync(join(root,'dist/standalone/dist/client/client.js'),'client-bundle');
  writeFileSync(join(root,'dist/standalone/dist/server/index.js'),'private-server-source');
  writeFileSync(join(root,'dist/server/outside-standalone.js'),'must-not-publish-or-stage');
  writeFileSync(join(root,'dist/secret.sqlite'),'must-not-publish');
  writeFileSync(join(root,'.env.ninoo.local'),'PRIVATE_SENTINEL=must-stay-private');
  writeFileSync(join(root,'public/favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(join(root,'.ninoo/server/old-build.js'),'stale');
  stageNinooPublish(root,preview);
  assert.deepEqual(readdirSync(join(root,'dist')).sort(),['favicon.svg','index.html']);
  const html = readFileSync(join(root,'dist/index.html'),'utf8');
  assert.match(html,/target.search=window.location.search;target.hash=window.location.hash/);
  assert.match(html,/Open Mandate workspace/);
  for(const text of ['private-server','must-stay-private','secret.sqlite']) assert.equal(html.includes(text),false);
  assert.equal(readFileSync(join(root,'.ninoo/server/server.js'),'utf8'),'private-server-entry');
  assert.equal(readFileSync(join(root,'.ninoo/server/dist/client/client.js'),'utf8'),'client-bundle');
  assert.equal(readFileSync(join(root,'.ninoo/server/dist/server/index.js'),'utf8'),'private-server-source');
  assert.equal(existsSync(join(root,'.ninoo/server/old-build.js')),false);
  assert.equal(existsSync(join(root,'.ninoo/server/outside-standalone.js')),false);
  assert.equal(readFileSync(join(root,'.env.ninoo.local'),'utf8'),'PRIVATE_SENTINEL=must-stay-private');
});
