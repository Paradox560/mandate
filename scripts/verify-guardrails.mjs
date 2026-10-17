import assert from 'node:assert/strict';

const base = process.env.MANDATE_URL || 'http://127.0.0.1:5187';
const initial = await (await fetch(`${base}/api/desk?marketMode=replay`)).json();
assert.equal(initial.connections?.prism.enforce, true, 'Enable PRISM_ENFORCE before testing the remote block.');
const receipts = [];
for (let run = 1; run <= 3; run++) {
  const before = await (await fetch(`${base}/api/desk?marketMode=replay`)).json();
  const response = await fetch(`${base}/api/action`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: base},
    body: JSON.stringify({action: 'scenario', scenario: 'oversize', marketMode: 'replay'}),
  });
  const result = await response.json();
  assert.ok(response.ok, result.error || 'Blocked-run request failed.');
  const order = result.snapshot.state.orders[0];
  const verdict = order.checks.find(check => check.key === 'prism');
  assert.equal(order.status, 'blocked');
  assert.equal(verdict?.passed, false);
  assert.match(verdict.reason, /PRISM blocked the action/);
  assert.equal(result.snapshot.state.portfolioVersion, before.state.portfolioVersion);
  const event = result.snapshot.state.audit.find(entry => entry.orderId === order.id);
  assert.equal(event.details.executionAttempted, false);
  assert.equal(event.details.blockHonored, true);
  receipts.push({run, traceId: event.traceId, orderId: order.id, ledgerRevision: result.snapshot.state.portfolioVersion, verdict: verdict.reason});
}
console.log(JSON.stringify({verifiedAt: new Date().toISOString(), receipts}, null, 2));
console.log('Three real PRISM blocks verified; no paper fills occurred. Inspect the PRISM Guardrails block checks and Intelligence cluster separately.');
