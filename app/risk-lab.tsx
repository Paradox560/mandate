'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronDown, Clock3, Copy, Download, ExternalLink, FileCheck2, Fingerprint, Loader2, LockKeyhole, Play, RefreshCw, ShieldCheck, ShieldX, Sparkles, XCircle } from 'lucide-react';
import { RISK_CASES, type ExternalRiskProof, type RiskCaseId, type RiskLabSnapshot, type RiskRun, type RiskCohortProof } from '../lib/risk-lab-types';
import type { WorkspaceMode } from '../lib/types';
import './risk-lab.css';

const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const when = (value: string) => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'Time unavailable' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }); };
const safeUrl = (value?: string) => { if (value && /^\/proofs\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) && !value.split('/').includes('..')) return value; try { const url = new URL(value || ''); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } };
const outcomeLabel = (run: RiskRun) => run.outcome === 'blocked' ? 'Stopped before generation' : run.outcome === 'completed' ? 'Cited analysis returned' : 'Run needs attention';

function ProviderProof({ title, proof, pending }: { title: string; proof: ExternalRiskProof; pending: string }) {
  const evidenceUrl = safeUrl(proof.evidenceUrl);
  const verified = proof.status === 'verified' && !!proof.checkedAt && !!evidenceUrl;
  return <article><div className="risk-proof-title"><h3>{title}</h3><span className={`risk-proof-status ${verified ? 'verified' : ''}`}>{verified ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{verified ? 'Evidence recorded' : 'Verification pending'}</span></div><p>{verified ? proof.summary || 'External evidence has been recorded for this requirement.' : proof.summary || pending}</p>{evidenceUrl && <><a href={evidenceUrl} className="text-button" target="_blank" rel="noreferrer">{verified ? 'Open recorded proof' : 'Inspect provider response'}<ExternalLink size={12} /></a><small>{proof.checkedAt ? `Checked ${when(proof.checkedAt)}` : 'Recorded provider evidence'}{proof.traceIds?.length ? ` · ${proof.traceIds.length} referenced traces` : ''}</small></>}</article>;
}

function CohortComparison({ proof }: { proof: RiskCohortProof }) {
  const evidenceUrl = safeUrl(proof.evidenceUrl);
  const rows = [
    { key: 'runs', label: 'Recorded runs' },
    { key: 'riskyModelCalls', label: 'Risky requests reaching the model' },
    { key: 'blocked', label: 'Requests blocked before generation' },
    { key: 'benignCompleted', label: 'Benign analyses completed' },
  ] as const;
  return <section className="risk-cohort" data-testid="risk-cohort" aria-labelledby="risk-cohort-title"><div className="risk-cohort-heading"><div><span className="risk-section-label">Recorded controlled evaluation</span><h3 id="risk-cohort-title">One market snapshot. Two gate settings.</h3><p>{proof.caseCount} fixed requests repeated across the cohorts. Captured {when(proof.capturedAt)}.</p></div>{evidenceUrl && <a className="text-button" href={evidenceUrl} target="_blank" rel="noreferrer">Open evaluation evidence<ExternalLink size={13} /></a>}</div><div className="table-scroll"><table className="risk-cohort-table"><thead><tr><th>Observed measure</th><th>Baseline · shadow</th><th>Protected · enforced</th></tr></thead><tbody>{rows.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{proof.baseline[row.key]}</td><td>{proof.protected[row.key]}</td></tr>)}</tbody></table></div><div className="risk-cohort-note"><p>{proof.methodology}</p><p>The baseline is an isolated CLI shadow evaluation with no order tool. These are repeated test cases, not unique market decisions. This cohort is separate from your workspace run history.</p><details><summary>Inspect shared market snapshot hash<ChevronDown size={12} /></summary><code>{proof.snapshotHash}</code></details></div></section>;
}

function RunReceipt({ run, copyTrace }: { run: RiskRun; copyTrace: (traceId: string) => void }) {
  const before = run.ledger.before, after = run.ledger.after;
  const modelStopped = run.gate.blocked && run.model.calls === 0 && !run.model.attempted;
  const gateLabel = run.gate.status === 'blocked' ? 'Blocked' : run.gate.status === 'allowed' ? 'Allowed' : run.gate.status === 'disabled' ? 'Disabled' : 'Unavailable';
  const marketUrl = safeUrl(run.market.sourceUrl);
  return <section className="risk-result" data-testid="risk-receipt" data-outcome={run.outcome} aria-labelledby="risk-result-title">
    <div className="risk-result-heading"><div><span className="risk-section-label"><Fingerprint size={14} />Recorded result · {when(run.completedAt)}</span><h2 id="risk-result-title">{outcomeLabel(run)}</h2><p>{run.caseLabel} · {run.expectedOutcome === 'blocked' ? 'Adversarial request' : 'Permitted research request'}</p></div><button className="button secondary compact" type="button" onClick={() => copyTrace(run.traceId)}><Copy size={13} />Copy trace ID</button></div>
    <div className="risk-receipt-metrics" aria-label="Measured run outcomes"><div><span><ShieldCheck size={14} />PRISM gate response</span><strong className={run.gate.blocked ? 'positive' : run.gate.status === 'allowed' ? '' : 'negative'}>{gateLabel}</strong><small>{run.gate.evaluated ? `Evaluated ${when(run.gate.checkedAt)}` : 'No successful gate evaluation'}</small></div><div><span><Sparkles size={14} />Nicrron model calls</span><strong className={modelStopped ? 'positive' : ''}>{run.model.calls}</strong><small>{modelStopped ? 'Request stopped before model invocation' : run.model.status === 'succeeded' ? 'Model response recorded' : run.model.status === 'failed' ? 'Model request failed' : 'Model was not invoked'}</small></div><div><span><LockKeyhole size={14} />Paper ledger</span><strong className={run.ledger.unchanged ? 'positive' : 'negative'}>{run.ledger.unchanged ? 'Unchanged' : 'Changed'}</strong><small>{run.ledger.executionAttempted ? 'Execution attempt recorded' : 'No execution attempted'}</small></div></div>
    <div className="risk-result-detail"><div><h3>Why the gate decided</h3><p>{run.gate.reason}</p><dl><div><dt>Matched rule</dt><dd>{run.gate.ruleName || 'No rule reported'}</dd></div><div><dt>Trace delivery</dt><dd>{run.telemetry.traceAcknowledged ? 'Acknowledged by PRISM' : 'Not acknowledged'}</dd></div><div><dt>Span delivery</dt><dd>{run.telemetry.spansAcknowledged ? 'Acknowledged by PRISM' : 'Not acknowledged'}</dd></div><div><dt>Trace ID</dt><dd>{run.traceId}</dd></div></dl></div><div><h3>Before → after</h3><dl><div><dt>Paper cash</dt><dd>{usd(before.cash)} → {usd(after.cash)}</dd></div><div><dt>Open positions</dt><dd>{before.positions.length} → {after.positions.length}</dd></div><div><dt>Paper fills</dt><dd>{before.fillCount} → {after.fillCount}</dd></div><div><dt>Ledger revision</dt><dd>{before.revision} → {after.revision}</dd></div><div><dt>MSFT quote</dt><dd>{usd(run.market.price)} · {run.market.marketState || 'unknown'}</dd></div><div><dt>Quote observed</dt><dd>{when(run.market.quoteTimestamp)}</dd></div><div><dt>History through</dt><dd>{run.market.historyAsOf}</dd></div></dl>{marketUrl && <a href={marketUrl} className="text-button" target="_blank" rel="noreferrer">Inspect Yahoo source<ExternalLink size={12} /></a>}</div></div>
    {run.model.summary && <div className="risk-research-output"><h3>Nicrron analysis · dated Yahoo evidence</h3><p>{run.model.summary}</p>{!!run.model.limitations?.length && <ul>{run.model.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>}<p className="small">Source: {run.market.evidence.title} · {run.market.evidence.period}</p>{run.model.evidenceIds?.length ? <p className="small">Cited evidence IDs: {run.model.evidenceIds.join(', ')}</p> : <p className="small">No evidence IDs returned. Inspect the source before using this response.</p>}</div>}
    {run.model.error && <div className="risk-research-output"><h3>Model request did not complete</h3><p>{run.model.error}</p></div>}
  </section>;
}

export function RiskLab({ workspace, onOpenDesk }: { workspace: WorkspaceMode; onOpenDesk: () => void }) {
  const [snapshot, setSnapshot] = useState<RiskLabSnapshot | null>(null);
  const [caseId, setCaseId] = useState<RiskCaseId>('guaranteed-returns');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const requestId = useRef(0), busy = useRef(false);
  useEffect(() => {
    const id = ++requestId.current, controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(''); setSnapshot(null); setSelectedRunId('');
      try {
        const response = await fetch(`/api/risk-lab?workspace=${workspace}`, { cache: 'no-store', signal: controller.signal });
        const next = await response.json() as RiskLabSnapshot & { error?: string };
        if (!response.ok) throw new Error(next.error || 'The risk run records could not be loaded.');
        if (id === requestId.current) { setSnapshot(next); setSelectedRunId(next.runs[0]?.id || ''); }
      } catch (error) { if (!controller.signal.aborted && id === requestId.current) setError(error instanceof Error ? error.message : 'The risk run records could not be loaded.'); }
      finally { if (!controller.signal.aborted && id === requestId.current) setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); requestId.current += 1; };
  }, [workspace, revision]);
  const activeCase = (snapshot?.cases || RISK_CASES).find(item => item.id === caseId) || RISK_CASES[0];
  const selectedRun = snapshot?.runs.find(item => item.id === selectedRunId);
  const runs = snapshot?.runs || [];
  const visibleRuns = showAllRuns ? runs : runs.slice(0, 8);
  const runCase = async () => {
    if (busy.current || !snapshot) return;
    busy.current = true; setRunning(true); setError(''); setNotice('');
    const id = ++requestId.current;
    try {
      const response = await fetch('/api/risk-lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId, workspace }) });
      const result = await response.json() as { run?: RiskRun; snapshot?: RiskLabSnapshot; error?: string };
      if (id !== requestId.current) return;
      if (result.snapshot) setSnapshot(result.snapshot);
      if (result.run) { setSelectedRunId(result.run.id); setNotice(`Run recorded. ${outcomeLabel(result.run)}.`); }
      if (!response.ok || result.error) throw new Error(result.error || 'The check could not complete. Inspect any recorded receipt before retrying.');
      if (!result.run || !result.snapshot) throw new Error('The server returned no complete run receipt. No outcome has been assumed.');
    } catch (error) { if (id === requestId.current) setError(error instanceof Error ? error.message : 'The check could not complete.'); }
    finally { busy.current = false; if (id === requestId.current) setRunning(false); }
  };
  const copyTrace = async (traceId: string) => { try { await navigator.clipboard.writeText(traceId); setNotice('Trace ID copied. Paste it into the PRISM dashboard to inspect the same run.'); } catch { setNotice(`Trace ID: ${traceId}`); } };
  const exportEvidence = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), product: 'Mandate', environment: 'paper', source: 'Recorded Risk lab API receipts', ...snapshot }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `mandate-risk-evidence-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); setNotice('Evidence bundle exported with actual runs and separate external-proof status.');
  };
  return <div className="risk-lab" data-testid="risk-lab" aria-busy={running}>
    <div className="risk-lab-intro"><div><span className="risk-lab-eyebrow"><ShieldCheck size={15} />Trust & Risk</span><p>Small investment teams need to know when an agent should stop. Send a risky research request through PRISM, inspect whether a model was called, and compare the ledger before and after.</p></div><button className="button secondary" type="button" onClick={onOpenDesk}>Open investment desk<ArrowUpRight size={14} /></button></div>
    <ol className="risk-boundaries" aria-label="Permission boundaries"><li><div className="risk-boundary-title"><span>01</span><strong>Risk gate</strong></div><p>PRISM checks the request before model generation.</p><small>Block or permit inference</small></li><li><div className="risk-boundary-title"><span>02</span><strong>Research agent</strong></div><p>Nicrron reasons over dated Yahoo observations.</p><small>Read + cite sources</small></li><li><div className="risk-boundary-title"><span>03</span><strong>Human reviewer</strong></div><p>A reviewer authorizes the exact proposed order.</p><small>Approve within the mandate</small></li><li><div className="risk-boundary-title"><span>04</span><strong>Execution gateway</strong></div><p>Fresh quotes and permissions precede a paper fill.</p><small>Recheck + record</small></li></ol>
    {error && <div className="risk-error" role="alert"><XCircle size={17} /><p>{error}</p>{!snapshot && <button className="text-button" type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} />Retry</button>}</div>}
    {loading ? <div className="risk-lab-loading" role="status"><Loader2 size={21} className="spin" />Loading recorded risk checks…</div> : snapshot && <>
      <section className="risk-workbench" aria-labelledby="risk-case-title"><aside className="risk-cases"><span className="risk-section-label">1. Choose a request</span>{snapshot.cases.map(item => <button className="risk-case" type="button" key={item.id} aria-pressed={caseId === item.id} disabled={running} onClick={() => { setCaseId(item.id); setError(''); setNotice(''); }}><span>{item.expectedOutcome === 'blocked' ? <ShieldX size={16} /> : <BookOpen size={16} />}{item.label}</span><small>{item.expectedOutcome === 'blocked' ? 'Expected: block before inference' : 'Expected: sourced analysis'}</small></button>)}<p className="risk-case-note">These are predefined evaluation requests. Every run records its actual outcome; the expected outcome is not a result.</p></aside><div className="risk-case-body"><div className="risk-case-heading"><span className="risk-section-label">2. Run the gate</span><span className="risk-section-label"><LockKeyhole size={12} />No order execution</span></div><h2 id="risk-case-title">{activeCase.label}</h2><p className="risk-case-description">{activeCase.description}</p><blockquote className="risk-input"><span>Exact request sent to the gate</span><p>{activeCase.input}</p></blockquote><div className="risk-run-actions"><button className="button primary" type="button" disabled={running} onClick={() => void runCase()}>{running ? <Loader2 size={15} className="spin" /> : <Play size={15} />}{running ? 'Running the check…' : activeCase.expectedOutcome === 'allowed' ? 'Run benign analysis' : 'Run risk check'}</button><span>{running ? 'Waiting for actual provider responses and the ledger receipt.' : 'Uses a frozen snapshot of real Yahoo data. Prices may be delayed; no synthetic prices are substituted.'}</span></div><div className="risk-readiness"><span className={!snapshot.integration.prismConfigured ? 'risk-not-ready' : ''}>{snapshot.integration.prismConfigured ? <Check size={12} /> : <Clock3 size={12} />}PRISM {snapshot.integration.prismConfigured ? 'configured' : 'not configured'}</span><span className={!snapshot.integration.enforce ? 'risk-not-ready' : ''}>{snapshot.integration.enforce ? <Check size={12} /> : <Clock3 size={12} />}Enforcement {snapshot.integration.enforce ? 'enabled' : 'disabled'}</span><span className={!snapshot.integration.nicrronConfigured ? 'risk-not-ready' : ''}>{snapshot.integration.nicrronConfigured ? <Check size={12} /> : <Clock3 size={12} />}Nicrron {snapshot.integration.nicrronConfigured ? 'configured' : 'not configured'}</span></div></div></section>
      <p className="risk-lab-announcement" role="status">{notice || `${snapshot.totalRuns} recorded ${snapshot.totalRuns === 1 ? 'run' : 'runs'} in this ${workspace === 'demo' ? 'demo' : 'desk'} workspace. Select a request to capture a new receipt.`}</p>
      {selectedRun ? <RunReceipt run={selectedRun} copyTrace={traceId => void copyTrace(traceId)} /> : <div className="risk-empty"><Fingerprint size={23} /><p>No result is assumed. Run a request to see the gate decision, model calls, and ledger comparison.</p></div>}
      <section className="risk-proof-area" aria-labelledby="risk-proof-title"><div className="risk-proof-header"><div><h2 id="risk-proof-title">3. Verify the same trace in PRISM</h2><p>A gate response and trace delivery are separate from dashboard classification and root-cause evidence.</p></div><div className="risk-proof-links"><a href="https://prism.blockconvey.com/guardrails" target="_blank" rel="noreferrer">PRISM Guardrails<ExternalLink size={12} /></a><a href="https://prism.blockconvey.com/root-cause" target="_blank" rel="noreferrer">PRISM Root Cause<ExternalLink size={12} /></a></div></div><div className="risk-proof-checks"><ProviderProof title="Block & Check classification" proof={snapshot.providerProof.blockCheck} pending="Pending a recorded PRISM classification for the blocked trace. Local receipts above do not establish a dashboard classification." /><ProviderProof title="Root Cause cluster" proof={snapshot.providerProof.rootCause} pending="Pending recorded PRISM evidence linking at least three relevant runs to one root-cause cluster. A local group of blocked runs is not that proof." /></div></section>
      {snapshot.cohortProof && <CohortComparison proof={snapshot.cohortProof} />}
      <section className="risk-run-log" aria-labelledby="risk-run-log-title"><div className="risk-run-log-heading"><div><h2 id="risk-run-log-title">4. Take the evidence with you</h2><span>{snapshot.totalRuns} stored runs · {runs.length} included in this bundle</span></div><button className="button secondary compact" type="button" onClick={exportEvidence}><Download size={14} />Export evidence bundle</button></div>{runs.length ? <><div className="table-scroll"><table className="risk-run-table"><thead><tr><th>Request</th><th>Observed result</th><th>Model calls</th><th>Ledger</th><th>Trace ID</th></tr></thead><tbody>{visibleRuns.map(run => <tr key={run.id} className={run.id === selectedRunId ? 'selected' : ''}><td><button className="risk-log-open" type="button" aria-label={`Inspect ${run.caseLabel} run ${run.id}`} aria-pressed={run.id === selectedRunId} onClick={() => setSelectedRunId(run.id)}>{run.caseLabel}</button><small>{when(run.createdAt)}</small></td><td>{run.outcome === 'blocked' ? 'Blocked' : run.outcome === 'completed' ? 'Completed' : 'Error'}</td><td>{run.model.calls}</td><td>{run.ledger.unchanged ? 'Unchanged' : 'Changed'}</td><td><button className="risk-trace-copy" type="button" onClick={() => void copyTrace(run.traceId)} aria-label={`Copy trace ${run.traceId}`}><code>{run.traceId}</code><Copy size={12} /></button></td></tr>)}</tbody></table></div>{runs.length > 8 && <div className="risk-empty"><button className="text-button" type="button" onClick={() => setShowAllRuns(value => !value)}>{showAllRuns ? 'Show latest 8 runs' : `Show all ${runs.length} loaded runs`}<ChevronDown size={13} /></button></div>}</> : <p className="risk-empty">No run receipts yet. The export will report an empty run list.</p>}</section>
    </>}
    <details className="risk-evaluation"><summary><FileCheck2 size={15} />How this workflow maps to the judging criteria<ChevronDown size={15} /></summary><ul><li><strong>PRISM Proofs · 5 points.</strong> Inspect gate responses, join the same trace ID to PRISM, then verify Block & Check and Root Cause separately.</li><li><strong>Technical Execution · 5 points.</strong> Pre-model gating, immutable market inputs, measured model calls, and before/after ledger receipts.</li><li><strong>Uniqueness of Idea · 5 points.</strong> Small funds can distinguish cited research from the authority to move capital, with bounded human approvals.</li><li><strong>Design · 5 points.</strong> A visible reason for every stop, dated Yahoo sources, and a portable evidence bundle.</li></ul><a href="https://money-talks-2-nyc.devpost.com/" target="_blank" rel="noreferrer">Money Talks II · official requirements</a></details>
  </div>;
}
