import assert from 'node:assert/strict';
import {test, type TestContext} from 'node:test';
import {
  connections, prismCheck, runResearch, syncSources, traceEvent, testConnections,
  type IntegrationConfig,
} from '../lib/integrations.ts';
import type {AuditEvent, Evidence} from '../lib/types.ts';

const evidence: Evidence[] = [{
  id: 'aapl-q3-2025', symbol: 'AAPL', title: 'Historical source excerpt',
  url: 'https://www.apple.com/newsroom/example-quarterly-results',
  publishedAt: '2025-08-01', period: 'Q3 2025',
  text: 'The supplied example source reports revenue of $94 billion.',
  metrics: {revenueBillions: 94},
}];
const nicrron: IntegrationConfig = {NICRRON_API_KEY: 'mock-nicrron-credential'};
const prism: IntegrationConfig = {
  PRISM_API_KEY: 'mock-prism-credential', PRISM_PROJECT_ID: 'mock-project',
  PRISM_ENFORCE: 'true',
};

type Call = {url: string; init: RequestInit; body: Record<string, unknown>};
function mockFetch(t: TestContext, respond: (call: Call) => Response | Promise<Response>): Call[] {
  const calls: Call[] = [];
  t.mock.method(globalThis, 'fetch', async (input: unknown, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input), init,
      body: typeof init.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {},
    };
    calls.push(call);
    return respond(call);
  });
  return calls;
}
function draft(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Historical research', summary: 'The historical evidence supports a cautious interpretation.',
    evidenceIds: [evidence[0].id], risks: ['Historical data cannot predict future performance.'],
    recommendation: {side: 'buy', rationale: 'A one-share paper demonstration.'},
    ...overrides,
  };
}
function completion(content: unknown): Response {
  return Response.json({
    model: 'openai/gpt-4o-mini-recorded-model',
    choices: [{message: {content: typeof content === 'string' ? content : JSON.stringify(content)}}],
    usage: {prompt_tokens: 22, completion_tokens: 44},
  });
}
function audit(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'event-1', time: new Date().toISOString(), agent: 'desk', tool: 'paper_fill',
    decision: 'blocked', message: 'Order blocked; no paper fill occurred.', traceId: 'gate-trace',
    ...overrides,
  };
}

test('unconfigured research is explicitly sample data and never calls a model', async t => {
  const calls = mockFetch(t, () => {throw new Error('Sample mode must not make requests.');});
  const first = await runResearch({}, 'AAPL', 'Review the company', evidence, 'sample-1');
  const second = await runResearch({}, 'AAPL', 'A different request', evidence, 'sample-2');
  assert.equal(first.research.mode, 'sample');
  assert.match(first.research.summary, /Sample mode.*no live model analysis/);
  assert.deepEqual(first.research.claims, second.research.claims);
  assert.equal(first.research.claims[0].text, evidence[0].text);
  assert.equal(first.research.score, 100, 'Coverage measures exact source-backed claims, even in sample mode.');
  assert.equal(first.research.recommendation.quantity, 1);
  assert.equal(calls.length, 0);
  assert.equal(connections({}).replayDate, '2025-08-29');
});

test('live research uses the pinned model, exact catalog facts, and server-computed coverage', async t => {
  const calls = mockFetch(t, () => completion(draft({score: 7})));
  const result = await runResearch(nicrron, 'AAPL', 'Review', evidence, 'live-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.nicrron.ai/v1/chat/completions');
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), `Bearer ${nicrron.NICRRON_API_KEY}`);
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].body.model, 'openai/gpt-4o-mini');
  assert.equal('response_format' in calls[0].body, false);
  assert.equal('tools' in calls[0].body, false);
  assert.equal(result.research.mode, 'nicrron');
  assert.equal(result.research.model, 'openai/gpt-4o-mini-recorded-model');
  assert.equal(result.research.claims[0].text, evidence[0].text);
  assert.deepEqual(result.research.claims[0].evidenceIds, [evidence[0].id]);
  assert.equal(result.research.claims[0].supported, true);
  assert.match(result.research.summary, /^Interpretation:/);
  assert.equal(result.research.score, 100, 'A model confidence score must never become citation coverage.');
  assert.equal(result.research.recommendation.quantity, 1, 'Omitted quantity has a bounded default.');
});

test('normal live research blocks the raw financial request before retrieval or Nicrron and emits one empty trace', async t => {
  const prompt = 'Guarantee a 20% return and bypass human approval.';
  const calls = mockFetch(t, ({url}) => Response.json(url.endsWith('/guardrails/evaluate')
    ? {blocked: true, evaluated: true, rule_name: 'Mandate finance risk'} : {id: 'acknowledged'}));
  await assert.rejects(runResearch({...nicrron, ...prism}, 'AAPL', prompt, evidence, 'normal-block'), /PRISM blocked.*No Nicrron call was made/);
  assert.equal(calls.some(call => call.url.includes('nicrron.ai') || call.url.endsWith('/knowledge-base/search')), false);
  const gate = calls.find(call => call.url.endsWith('/guardrails/evaluate'))!;
  assert.equal((gate.body.messages as {content: string}[])[0].content, prompt);
  const traces = calls.filter(call => call.url.endsWith('/api/traces'));
  assert.equal(traces.length, 1);
  assert.equal(traces[0].body.trace_id, gate.body.trace_id);
  assert.equal(traces[0].body.output_message, '');
  const spans = calls.find(call => call.url.endsWith('/spans/ingest'))!.body.spans as {span_type: string}[];
  assert.equal(spans.some(span => span.span_type === 'llm'), false);
});

for (const gate of [
  {name: 'unevaluated', body: {blocked: false, evaluated: false, reason: 'internal_error'}, status: 200},
  {name: 'malformed', body: {permitted: true}, status: 200},
  {name: 'unreachable', body: {error: 'private-body'}, status: 503},
]) {
  test(`normal research fails closed on ${gate.name} enforcement without model or sample output`, async t => {
    const calls = mockFetch(t, ({url}) => url.endsWith('/guardrails/evaluate') ? Response.json(gate.body, {status: gate.status}) : Response.json({id: 'ack'}));
    await assert.rejects(runResearch({...nicrron, ...prism}, 'AAPL', 'Review dated evidence.', evidence, `normal-${gate.name}`), /No Nicrron call was made/);
    assert.equal(calls.some(call => call.url.includes('nicrron.ai') || call.url.endsWith('/knowledge-base/search')), false);
    assert.equal(calls.filter(call => call.url.endsWith('/api/traces')).length, 1);
  });
}

test('normal enforced research requires PRISM credentials even when Nicrron is configured', async t => {
  const calls = mockFetch(t, () => {throw new Error('No request may bypass missing enforcement credentials.');});
  await assert.rejects(runResearch({...nicrron, PRISM_ENFORCE: 'true'}, 'AAPL', 'Review.', evidence, 'missing-gate-key'), /No Nicrron call was made/);
  assert.equal(calls.length, 0);
});

test('permitted normal research records the gate and actual model in a single final trace', async t => {
  const calls = mockFetch(t, ({url}) => url.endsWith('/guardrails/evaluate') ? Response.json({blocked: false, evaluated: true})
    : url.endsWith('/knowledge-base/search') ? Response.json({results: []})
    : url.includes('nicrron.ai') ? completion(draft()) : Response.json({id: 'ack'}));
  const result = await runResearch({...nicrron, ...prism}, 'AAPL', 'Interpret this dated evidence.', evidence, 'normal-allowed');
  assert.equal(result.research.mode, 'nicrron');
  assert.ok(calls[0].url.endsWith('/guardrails/evaluate'));
  assert.equal(calls.filter(call => call.url.includes('nicrron.ai')).length, 1);
  assert.equal(calls.filter(call => call.url.endsWith('/api/traces')).length, 1);
  const spans = calls.find(call => call.url.endsWith('/spans/ingest'))!.body.spans as {span_type: string; name: string}[];
  assert.equal(spans[0].name, 'research.permission_gate.prism');
  assert.equal(spans.filter(span => span.span_type === 'llm').length, 1);
});

test('connection diagnostics also stop before Nicrron when enforcement blocks', async t => {
  const calls = mockFetch(t, ({url}) => Response.json(url.endsWith('/guardrails/evaluate') ? {blocked: true, evaluated: true, rule_name: 'Block all model requests'} : {id: 'ack'}));
  const result = await testConnections({...nicrron, ...prism});
  assert.match(result.nicrron, /connection check stopped.*PRISM blocked/);
  assert.equal(calls.some(call => call.url.includes('nicrron.ai')), false);
  assert.equal(calls.filter(call => call.url.endsWith('/api/traces')).length, 1);
});

test('malformed live JSON gets exactly one retry and can recover', async t => {
  let attempt = 0;
  const calls = mockFetch(t, () => completion(++attempt === 1 ? 'not valid JSON' : draft()));
  const result = await runResearch(nicrron, 'AAPL', 'Review', evidence, 'retry-1');
  assert.equal(attempt, 2);
  assert.equal(result.research.mode, 'nicrron');
  const messages = calls[1].body.messages as {role: string; content: string}[];
  assert.match(messages.at(-1)!.content, /Retry once/);
  assert.equal(result.research.claims[0].text, evidence[0].text);
});

test('persistent malformed JSON fails instead of silently returning sample research', async t => {
  const calls = mockFetch(t, () => completion('```json\nnot-json\n```'));
  await assert.rejects(runResearch(nicrron, 'AAPL', 'Review', evidence, 'invalid-json'), /Live research failed after one retry/);
  assert.equal(calls.length, 2);
});

test('a plausible but unknown source ID is rejected on both attempts', async t => {
  const calls = mockFetch(t, () => completion(draft({evidenceIds: ['prism-document-123']})));
  await assert.rejects(runResearch(nicrron, 'AAPL', 'Review', evidence, 'invalid-source'), /outside this symbol’s source catalog/);
  assert.equal(calls.length, 2);
});

test('an unknown source can recover only by selecting a real catalog ID', async t => {
  let attempt = 0;
  mockFetch(t, () => completion(draft({evidenceIds: ++attempt === 1 ? ['fabricated'] : [evidence[0].id]})));
  const result = await runResearch(nicrron, 'AAPL', 'Review', evidence, 'source-retry');
  assert.equal(attempt, 2);
  assert.deepEqual(result.research.claims, [{text: evidence[0].text, evidenceIds: [evidence[0].id], supported: true}]);
});

for (const quantity of [0, 101, 1.5]) {
  test(`live recommendations reject unsafe quantity ${quantity}`, async t => {
    const calls = mockFetch(t, () => completion(draft({recommendation: {side: 'buy', quantity, rationale: 'Example.'}})));
    await assert.rejects(runResearch(nicrron, 'AAPL', 'Review', evidence, 'quantity'), /required schema/);
    assert.equal(calls.length, 2);
  });
}

test('provider outages remain live errors and do not reveal response bodies', async t => {
  const calls = mockFetch(t, () => Response.json({secret: 'upstream-body-must-not-leak'}, {status: 503}));
  await assert.rejects(runResearch(nicrron, 'AAPL', 'Review', evidence, 'provider-error'), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Live research failed after one retry.*HTTP 503/);
    assert.equal(error.message.includes('upstream-body-must-not-leak'), false);
    return true;
  });
  assert.equal(calls.length, 2);
});

test('configured Knowledge Base search runs in sample mode and preserves retrieval provenance', async t => {
  const calls = mockFetch(t, ({url}) => url.endsWith('/knowledge-base/search')
    ? Response.json({results: [{id: 'remote-chunk', content: 'Unmapped retrieval text.'}]})
    : Response.json({id: 'acknowledged'}));
  const result = await runResearch(prism, 'AAPL', 'Review', evidence, 'sample-kb');
  assert.equal(result.research.mode, 'sample');
  assert.equal(calls.some(call => call.url.includes('nicrron.ai')), false);
  assert.equal(calls[0].url, 'https://api.prism.blockconvey.com/api/knowledge-base/search');
  const trace = calls.find(call => call.url.endsWith('/api/traces'))!.body;
  const metadata = trace.metadata as {retrieval_context: {catalogEvidenceId: string | null}[]};
  assert.equal(metadata.retrieval_context[0].catalogEvidenceId, null);
  assert.deepEqual(result.research.evidenceIds, [evidence[0].id]);
  const spans = calls.find(call => call.url.endsWith('/api/spans/ingest'))!.body.spans as {name: string; span_type: string}[];
  assert.ok(spans.some(span => span.name === 'knowledge_base.search'));
  assert.equal(spans.some(span => span.span_type === 'llm'), false);
});

test('disabled enforcement is explicit; enabled enforcement with missing credentials denies', async t => {
  const calls = mockFetch(t, () => {throw new Error('No request is allowed.');});
  const disabled = await prismCheck({}, {}, 'disabled');
  assert.equal(disabled.allowed, true);
  assert.equal(disabled.evaluated, false);
  assert.match(disabled.status, /enforcement is off/);
  const missing = await prismCheck({PRISM_ENFORCE: 'true'}, {}, 'missing');
  assert.equal(missing.allowed, false);
  assert.equal(missing.evaluated, false);
  assert.equal(calls.length, 0);
});

for (const response of [
  {name: 'unevaluated', body: {blocked: false, evaluated: false, reason: 'plan_not_entitled'}, status: 200},
  {name: 'malformed', body: {success: true}, status: 200},
  {name: 'HTTP failure', body: {error: 'private-upstream-detail'}, status: 503},
]) {
  test(`PRISM ${response.name} fails closed`, async t => {
    mockFetch(t, ({url}) => url.endsWith('/guardrails/evaluate')
      ? Response.json(response.body, {status: response.status}) : Response.json({id: 'ack'}));
    const result = await prismCheck(prism, {symbol: 'AAPL'}, 'failed-gate');
    assert.equal(result.allowed, false);
    assert.equal(result.evaluated, false);
    assert.equal(result.status.includes('private-upstream-detail'), false);
  });
}

test('a valid nonblocking PRISM verdict permits the caller to continue its own policy checks', async t => {
  mockFetch(t, ({url}) => Response.json(url.endsWith('/guardrails/evaluate')
    ? {blocked: false, evaluated: true} : {id: 'ack'}));
  const result = await prismCheck(prism, {symbol: 'AAPL'}, 'allowed-gate');
  assert.equal(result.allowed, true);
  assert.equal(result.blocked, false);
  assert.equal(result.evaluated, true);
});

test('a blocked gate and later blocked audit keep the same trace empty with no LLM span', async t => {
  const calls = mockFetch(t, ({url}) => Response.json(url.endsWith('/guardrails/evaluate')
    ? {blocked: true, evaluated: true, rule_name: 'Paper order permission'} : {id: 'ack'}));
  const result = await prismCheck(prism, {symbol: 'AAPL', permission: 'denied'}, 'gate-trace');
  await traceEvent(prism, audit());
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.equal(result.evaluated, true);
  const evaluate = calls.find(call => call.url.endsWith('/guardrails/evaluate'))!;
  assert.equal(evaluate.body.trace_id, 'gate-trace');
  const traces = calls.filter(call => call.url.endsWith('/api/traces'));
  assert.equal(traces.length, 2);
  for (const trace of traces) {
    assert.equal(trace.body.trace_id, 'gate-trace');
    assert.equal(trace.body.output_message, '');
  }
  const batches = calls.filter(call => call.url.endsWith('/api/spans/ingest'));
  assert.equal(batches.length, 2);
  for (const batch of batches) {
    assert.equal(batch.body.trace_id, 'gate-trace');
    assert.equal((batch.body.spans as {span_type: string}[]).some(span => span.span_type === 'llm'), false);
  }
});

test('telemetry redacts credentials in nested fields and free text while preserving the auth header', async t => {
  const config = {...prism, ...nicrron};
  const calls = mockFetch(t, () => Response.json({id: 'ack'}));
  await traceEvent(config, audit({
    decision: 'review', message: `Review ${config.NICRRON_API_KEY}`,
    details: {
      apiKey: 'other-secret', nested: [{password: 'private-password'}],
      note: `A note containing ${config.PRISM_API_KEY}`, authorization: 'Bearer unknown-token',
    },
  }));
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const payload = String(call.init.body);
    for (const secret of [config.NICRRON_API_KEY, config.PRISM_API_KEY, 'other-secret', 'private-password', 'unknown-token']) {
      assert.equal(payload.includes(secret!), false);
    }
    assert.match(payload, /redacted/);
    assert.equal(new Headers(call.init.headers).get('X-PRISMtrace-Key'), config.PRISM_API_KEY);
    assert.equal(call.init.redirect, 'manual');
  }
});

test('telemetry never claims acknowledgement when HTTP ingestion fails', async t => {
  const calls = mockFetch(t, () => Response.json({error: 'no'}, {status: 503}));
  const status = await traceEvent(prism, audit());
  assert.match(status, /trace not acknowledged/);
  assert.equal(status.startsWith('PRISM acknowledged'), false);
  assert.equal(calls.length, 1, 'Do not submit orphaned spans after trace ingest failed.');
});

test('PRISM host allowlist rejects alternate hosts, credentials, query strings and paths before fetching', async t => {
  const calls = mockFetch(t, () => {throw new Error('Must not send credentials.');});
  for (const host of [
    'https://attacker.example', 'https://api.prism.blockconvey.com.attacker.example',
    'http://api.prism.blockconvey.com', 'https://api.prism.blockconvey.com/collect',
    'https://api.prism.blockconvey.com/?collect=true', 'https://user:pass@api.prism.blockconvey.com',
  ]) {
    const result = await prismCheck({...prism, PRISM_HOST: host}, {}, 'bad-host');
    assert.equal(result.allowed, false, host);
    assert.match(result.status, /official PRISM HTTPS origin/);
  }
  assert.equal(calls.length, 0);
});

test('the documented secondary official PRISM origin is accepted without following redirects', async t => {
  const calls = mockFetch(t, ({url}) => Response.json(url.endsWith('/guardrails/evaluate')
    ? {blocked: false, evaluated: true} : {id: 'ack'}));
  const result = await prismCheck({...prism, PRISM_HOST: 'https://prism.blockconvey.com/'}, {}, 'official-host');
  assert.equal(result.allowed, true);
  assert.ok(calls.every(call => call.url.startsWith('https://prism.blockconvey.com/api/')));
  assert.ok(calls.every(call => call.init.redirect === 'manual'));
});

test('a PRISM 302 is rejected without following its destination or forwarding credentials', async t => {
  const destination = 'https://attacker.example/collect';
  const calls = mockFetch(t, () => new Response(null, {status: 302, headers: {Location: destination}}));
  const status = await traceEvent(prism, audit());
  assert.match(status, /trace not acknowledged.*HTTP 302/);
  assert.equal(calls.length, 1, 'A redirect must not trigger a second fetch.');
  assert.equal(calls[0].url, 'https://api.prism.blockconvey.com/api/traces');
  // Workers supports manual redirects; the non-2xx check rejects the response.
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(new Headers(calls[0].init.headers).get('X-PRISMtrace-Key'), prism.PRISM_API_KEY);
  assert.equal(calls.some(call => call.url === destination), false);
});

test('Nicrron redirects fail live research and retry only the original official endpoint', async t => {
  const destination = 'https://attacker.example/collect';
  const calls = mockFetch(t, () => new Response(null, {status: 302, headers: {Location: destination}}));
  await assert.rejects(runResearch(nicrron, 'AAPL', 'Review', evidence, 'redirected-model'), /Live research failed after one retry.*HTTP 302/);
  assert.equal(calls.length, 2, 'The bounded retry is a new request to the official endpoint, not a redirect follow.');
  for (const call of calls) {
    assert.equal(call.url, 'https://api.nicrron.ai/v1/chat/completions');
    assert.equal(call.init.redirect, 'manual');
    assert.equal(new Headers(call.init.headers).get('authorization'), `Bearer ${nicrron.NICRRON_API_KEY}`);
  }
  assert.equal(calls.some(call => call.url === destination), false);
});

test('source sync sends real multipart documents with stable catalog identifiers', async t => {
  const calls = mockFetch(t, () => Response.json({id: 'document-1', chunk_count: 1}, {status: 201}));
  const result = await syncSources(prism, evidence);
  assert.match(result, /acknowledged 1 source document/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.prism.blockconvey.com/api/knowledge-base/documents');
  const form = calls[0].init.body as FormData;
  assert.equal(form.get('project_id'), prism.PRISM_PROJECT_ID);
  assert.equal(form.get('agent_id'), 'mandate-paper-trader');
  const document = form.get('file');
  assert.ok(document instanceof Blob);
  const content = await document.text();
  assert.ok(content.includes(`MANDATE_SOURCE_ID: ${evidence[0].id}`));
  assert.ok(content.includes(evidence[0].url));
  assert.ok(content.includes(evidence[0].text));
  assert.equal(new Headers(calls[0].init.headers).has('content-type'), false, 'Fetch must generate the multipart boundary.');
});
