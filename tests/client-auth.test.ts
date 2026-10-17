import assert from 'node:assert/strict';
import {test} from 'node:test';
import {authenticationRecovery} from '../lib/client-auth.ts';

test('authentication recovery preserves the actual judge route instead of trusting server return targets', () => {
  assert.deepEqual(authenticationRecovery(401, {authRequired: true, signInUrl: '/access?returnTo=https://untrusted.example'}, '/?judge=1&marketMode=yahoo#proof'), {
    href: '/access?returnTo=%2F%3Fjudge%3D1%26marketMode%3Dyahoo%23proof', portable: true, label: 'Open workspace',
  });
  assert.deepEqual(authenticationRecovery(401, {authRequired: true, signInUrl: '/signin-with-chatgpt?return_to=%2F'}, '/?demo=1'), {
    href: '/signin-with-chatgpt?return_to=%2F%3Fdemo%3D1', portable: false, label: 'Sign in with ChatGPT',
  });
});

test('authentication recovery rejects external URLs, path lookalikes, and non-auth failures', () => {
  for (const signInUrl of ['https://untrusted.example/access', '//untrusted.example/access', '/\\untrusted.example/access', '/access-untrusted', '/access/elsewhere', '/api/session', 'javascript:alert(1)']) {
    assert.equal(authenticationRecovery(401, {authRequired: true, signInUrl}, '/?judge=1'), null);
  }
  assert.equal(authenticationRecovery(503, {authRequired: true, signInUrl: '/access'}, '/'), null);
  assert.equal(authenticationRecovery(401, {error: 'Missing session', signInUrl: '/access'}, '/'), null);
  assert.equal(authenticationRecovery(401, {authRequired: true, signInUrl: '/access'}, '//untrusted.example')?.href, '/access?returnTo=%2F');
  assert.equal(authenticationRecovery(401, {authRequired: true, signInUrl: '/access'}, '/access')?.href, '/access?returnTo=%2F');
});
