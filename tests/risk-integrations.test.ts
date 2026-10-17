import assert from 'node:assert/strict';
import {test, type TestContext} from 'node:test';
import {finishProtectedAnalysis, runProtectedAnalysis, runUnprotectedBaselineAnalysis, type IntegrationConfig, type ProtectedAnalysisInput} from '../lib/integrations.ts';
import {RISK_CASES} from '../lib/risk-lab-types.ts';
import type {RiskRun} from '../lib/risk-lab-types.ts';

const config: IntegrationConfig = {PRISM_API_KEY: 'test-prism-key', PRISM_PROJECT_ID: 'test-project', PRISM_AGENT_ID: 'mandate-research', PRISM_ENFORCE: 'true', NICRRON_API_KEY: 'test-model-key'};
const evidence = {id: 'yahoo-msft-history', symbol: 'MSFT', title: 'Dated historical observations', url: 'https://finance.yahoo.com/quote/MSFT/history/', publishedAt: '2026-10-16T20:00:00Z', period: '2024-10-17 to 2026-10-16', text: 'The historical source has 500 completed sessions.', metrics: {sessions: 500}};
const input = (caseIndex = 0): ProtectedAnalysisInput => ({traceId: 'risk-trace', prompt: RISK_CASES[caseIndex].input, evidence, snapshotHash: 'frozen-hash', sourceSteps: [{name: 'risk.yahoo.history_analysis', startedAt: 100, completedAt: 200, input: 'Yahoo history', output: evidence}]});
const balance = {revision: 1, cash: 250000, positions: [], orderCount: 0, fillCount: 0, hash: 'ledger-hash'};
const ledger: RiskRun['ledger'] = {before: balance, after: balance, unchanged: true, executionAttempted: false};
type Call = {url: string; body: Record<string, unknown>};
function stub(t: TestContext, verdict: unknown = {blocked: true, evaluated: true, rule_name: 'Finance risk', rule_type: 'regex'}, options: {modelEvidenceId?: string; traceFail?: boolean} = {}) {
  const calls: Call[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit = {}) => {
    const call = {url: String(url), body: JSON.parse(String(init.body || '{}')) as Record<string, unknown>};
    calls.push(call);
    if (call.url.endsWith('/guardrails/evaluate')) return Response.json(verdict);
    if (call.url.includes('nicrron.ai')) return Response.json({model: 'actual-returned-model', choices: [{message: {content: JSON.stringify({summary: 'The dated history supports a cautious interpretation.', evidenceIds: [options.modelEvidenceId || evidence.id], limitations: ['Historical observations do not predict future returns.']})}}], usage: {prompt_tokens: 45, completion_tokens: 21}});
    if (call.url.endsWith('/api/traces') && options.traceFail) return Response.json({}, {status: 503});
    return Response.json({id: 'acknowledged'});
  });
  return calls;
}

test('a real remote block produces zero model calls and one trace with empty output', async t => {
  const calls = stub(t);
  const result = await runProtectedAnalysis(config, input());
  assert.equal(result.gate.status, 'blocked');
  assert.equal(result.gate.ruleName, 'Finance risk');
  assert.deepEqual(result.model, {attempted: false, calls: 0, status: 'not_called'});
  assert.equal(calls.length, 1, 'The gate is awaited before any model request or trace ingestion.');
  assert.equal((calls[0].body.messages as {content: string}[])[0].content, RISK_CASES[0].input);
  assert.doesNotMatch(JSON.stringify(calls), /MANDATE_BLOCK/);
  const delivery = await finishProtectedAnalysis(config, {traceId: 'risk-trace', sessionId: 'one-workflow', snapshotHash: 'frozen-hash', caseId: 'guaranteed-returns', ledger, ledgerReadStartedAt: Date.now()}, result);
  assert.equal(delivery.traceAcknowledged, true);
  assert.equal(delivery.spansAcknowledged, true);
  const traces = calls.filter(call => call.url.endsWith('/api/traces'));
  assert.equal(traces.length, 1);
  assert.equal(traces[0].body.trace_id, calls[0].body.trace_id);
  assert.equal(traces[0].body.session_id, 'one-workflow');
  assert.equal(traces[0].body.output_message, '');
  const spans = calls.find(call => call.url.endsWith('/spans/ingest'))!.body.spans as {name: string; span_type: string}[];
  assert.equal(spans.some(span => span.span_type === 'llm'), false);
  assert.equal(spans.at(-1)!.name, 'risk.ledger.verify_unchanged');
});

test('a permitted request calls Nicrron once after the evaluated gate and records the real model', async t => {
  const calls = stub(t, {blocked: false, evaluated: true});
  const result = await runProtectedAnalysis(config, input(3));
  assert.equal(result.gate.allowed, true);
  assert.equal(result.model.status, 'succeeded');
  assert.equal(result.model.calls, 1);
  assert.equal(result.model.name, 'actual-returned-model');
  assert.equal(result.model.inputTokens, 45);
  assert.deepEqual(result.model.evidenceIds, [evidence.id]);
  assert.ok(calls[0].url.endsWith('/guardrails/evaluate'));
  assert.ok(calls[1].url.includes('nicrron.ai'));
  assert.equal(result.spans.filter(span => span.span_type === 'llm').length, 1);
});

for (const verdict of [{blocked: false, evaluated: false, reason: 'internal_error'}, {blocked: false}, {blocked: 'false', evaluated: true}]) {
  test(`unusable guardrail verdict never reaches Nicrron: ${JSON.stringify(verdict)}`, async t => {
    const calls = stub(t, verdict);
    const result = await runProtectedAnalysis(config, input(3));
    assert.equal(result.gate.allowed, false);
    assert.equal(result.model.calls, 0);
    assert.equal(calls.length, 1);
  });
}

test('disabled enforcement cannot silently become an unprotected public risk run', async t => {
  const calls = stub(t);
  const result = await runProtectedAnalysis({...config, PRISM_ENFORCE: 'false'}, input());
  assert.equal(result.gate.status, 'disabled');
  assert.equal(result.model.attempted, false);
  assert.equal(calls.length, 0);
});

test('the separate shadow-baseline function records its omitted gate honestly and has no order tools', async t => {
  const calls = stub(t);
  const result = await runUnprotectedBaselineAnalysis(config, input());
  assert.equal(result.gate.status, 'disabled');
  assert.equal(result.gate.evaluated, false);
  assert.equal(result.gate.allowed, false);
  assert.equal(result.model.calls, 1);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('nicrron.ai'));
  assert.equal('tools' in calls[0].body, false);
  assert.equal(result.spans.some(span => span.name.includes('permission_gate')), false);
});

test('a model response citing a nonexistent source fails without becoming a sample success', async t => {
  stub(t, {blocked: false, evaluated: true}, {modelEvidenceId: 'invented-source'});
  const result = await runProtectedAnalysis(config, input(3));
  assert.equal(result.model.status, 'failed');
  assert.equal(result.model.calls, 1);
  assert.match(result.model.error!, /source contract/);
  assert.equal(result.outputText, '');
});

test('trace delivery failures remain separate from the actual remote block result', async t => {
  const calls = stub(t, undefined, {traceFail: true});
  const result = await runProtectedAnalysis(config, input());
  const delivery = await finishProtectedAnalysis(config, {traceId: 'risk-trace', sessionId: 'one-workflow', snapshotHash: 'frozen-hash', caseId: 'guaranteed-returns', ledger, ledgerReadStartedAt: Date.now()}, result);
  assert.equal(result.gate.blocked, true);
  assert.equal(delivery.traceAcknowledged, false);
  assert.equal(delivery.spansAcknowledged, false);
  assert.equal(calls.some(call => call.url.endsWith('/spans/ingest')), false);
});
