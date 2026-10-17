'use client';

import { useId, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, ChevronDown,
  Clock3, Download, ExternalLink, FileText, Loader2, Play, RotateCcw,
  ShieldCheck, Sparkles, XCircle,
} from 'lucide-react';
import type { Action, DeskSnapshot, Evidence, Order } from '../lib/types';
import './demo-guide.css';

type GuideView = 'Overview' | 'Research' | 'Orders' | 'Mandate' | 'Audit trail' | 'Connections';
type Stage = 'intro' | 'research' | 'source' | 'approval' | 'execution' | 'block' | 'audit';
export type DemoGuideProps = {
  snapshot: DeskSnapshot;
  busy: string;
  error?: string;
  run: (action: Action, pending?: string) => Promise<void>;
  navigate: (view: GuideView, id?: string) => void;
  openEvidence: (evidence: Evidence) => void;
  exportAudit: () => void;
};

const STEPS: { key: Stage; label: string; seconds: number; title: string; detail: string; say: string }[] = [
  { key: 'intro', label: 'Start', seconds: 15, title: 'One approved trade. One blocked request.', detail: 'Walk from a cited memo to an authorized paper fill, then show an oversized order being stopped. This session has its own portfolio and audit record.', say: 'Mandate turns research into a proposal, then checks who can authorize and execute it. This walkthrough uses synthetic prices and historical 2025 disclosures.' },
  { key: 'research', label: 'Research', seconds: 35, title: 'Begin with evidence, not an order.', detail: 'Create an MSFT memo with Nicrron, or choose the clearly labeled sample. Neither action changes the paper portfolio.', say: 'The model can interpret the disclosure, but factual claims are linked to the approved source text. The sample option demonstrates the same workflow without a model call.' },
  { key: 'source', label: 'Source + propose', seconds: 25, title: 'Open the source. Propose one share.', detail: 'Inspect the historical disclosure, then propose buying one MSFT share at a synthetic price. A proposal is not a fill.', say: 'This source is dated in 2025. We are demonstrating against the historical replay, not presenting it as current-market research. The proposal still has to pass the mandate.' },
  { key: 'approval', label: 'Approve', seconds: 25, title: 'The reviewer authorizes this exact order.', detail: 'Inspect the actual checks below. Your approval binds the proposed order to the current portfolio and mandate; it does not execute it.', say: 'The research agent cannot approve its own work. This is a separate human decision, bound to this order and these rules.' },
  { key: 'execution', label: 'Execute', seconds: 25, title: 'Permission is checked again at execution.', detail: 'Execute the approved order explicitly. The recorded result determines whether the paper ledger changed.', say: 'Approval is not a blank check. The gateway checks the authorization and current conditions again before recording a paper fill.' },
  { key: 'block', label: 'Block', seconds: 30, title: 'Now request more than the mandate permits.', detail: 'Run the oversized-order scenario. Inspect its actual failed checks and the audit receipt before claiming that the boundary held.', say: 'The same execution boundary must stop an order outside the mandate. We will inspect the failed limit check and compare the recorded ledger versions.' },
  { key: 'audit', label: 'Show proof', seconds: 25, title: 'Show the fill, the block, and their receipts.', detail: 'The demo has a recorded paper fill and an oversized order with a failed notional-limit check. Open the audit trail or export the actual evidence.', say: 'These are the records produced by this session: the authorized fill, the blocked request, and the ledger result. PRISM delivery and enforcement are reported separately from the local permission checks.' },
];
const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const newest = <T extends { createdAt: string }>(items: T[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const isSuccessfulFill = (order: Order) => order.status === 'executed' && !!order.fill && Number.isFinite(order.fill.price) && order.fill.quantity > 0;

export function DemoGuide({ snapshot, busy, error, run, navigate, openEvidence, exportAudit }: DemoGuideProps) {
  const [expanded, setExpanded] = useState(true);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [openedMemoId, setOpenedMemoId] = useState<string | null>(null);
  const contentId = useId();
  const titleId = useId();
  const startedAt = snapshot.state.demoStartedAt;
  const isolated = snapshot.workspace === 'demo';
  const sessionOrders = startedAt ? newest(snapshot.state.orders.filter(order => order.createdAt >= startedAt)) : [];
  const msftOrders = sessionOrders.filter(order => order.symbol === 'MSFT' && !order.scenario && order.side === 'buy' && order.quantity === 1 && (order.marketMode ?? 'replay') === 'replay');
  const filledOrder = msftOrders.find(isSuccessfulFill);
  const activeOrder = filledOrder || msftOrders[0];
  const sessionResearch = startedAt ? newest(snapshot.state.research.filter(memo => memo.symbol === 'MSFT' && memo.createdAt >= startedAt)) : [];
  const memo = (activeOrder && sessionResearch.find(item => item.id === activeOrder.researchId)) || sessionResearch[0];
  const source = memo?.evidenceIds.map(id => snapshot.evidence.find(item => item.id === id && item.symbol === 'MSFT')).find(Boolean);
  const oversizeAttempt = sessionOrders.find(order => order.scenario === 'oversize');
  const blockedOrder = sessionOrders.find(order => order.scenario === 'oversize' && order.status === 'blocked' && !order.fill && order.checks.some(check => check.key === 'notional' && !check.passed));
  const stage: Stage = !startedAt ? 'intro' : !memo ? 'research' : filledOrder ? blockedOrder ? 'audit' : 'block' : activeOrder?.status === 'approved' && activeOrder.approval ? 'execution' : activeOrder?.status === 'review' || activeOrder?.status === 'approved' ? 'approval' : 'source';
  const stepIndex = STEPS.findIndex(step => step.key === stage);
  const step = STEPS[stepIndex];
  const completed: Record<Stage, boolean> = {
    intro: !!startedAt, research: !!memo, source: !!activeOrder,
    approval: !!activeOrder?.approval, execution: !!filledOrder,
    block: !!blockedOrder, audit: false,
  };
  const blockedReceipt = blockedOrder && snapshot.state.audit.find(event => event.orderId === blockedOrder.id && event.decision === 'blocked' && event.details?.blockHonored === true && event.details?.executionAttempted === false && typeof event.details?.ledgerBefore === 'number' && event.details.ledgerBefore === event.details.ledgerAfter);
  const fillReceipt = filledOrder && snapshot.state.audit.find(event => event.orderId === filledOrder.id && event.tool === 'orders.execute' && event.decision === 'allowed');
  const recordedPrism = blockedOrder?.checks.find(check => check.key === 'prism');
  const actualPrismBlock = recordedPrism && !recordedPrism.passed && recordedPrism.reason.startsWith('PRISM blocked the action');
  const stoppedOrder = !filledOrder && activeOrder && (activeOrder.status === 'blocked' || activeOrder.status === 'rejected') ? activeOrder : undefined;
  const failedChecks = stoppedOrder?.checks.filter(check => !check.passed) || [];
  const disabled = !!busy || !isolated;
  const sourceOpened = !!memo && openedMemoId === memo.id;
  const invoke = (action: Action, pending: string) => { if (!disabled) void run({ ...action, marketMode: 'replay' }, pending); };
  const startDemo = async () => {
    if (disabled) return;
    await run({ action: 'start_demo', marketMode: 'replay' }, 'Preparing the isolated demo workspace…');
    setRestartConfirm(false); setOpenedMemoId(null); setExpanded(true);
  };

  return <section className="demo-guide" data-testid="demo-guide" data-stage={stage} aria-labelledby={titleId}>
    <div className="demo-guide-heading">
      <div className="demo-guide-identity"><span className="demo-guide-mark"><Play size={15} /></span><div><h2 id={titleId}>The permission walkthrough</h2><p>3 minute walkthrough <span aria-hidden="true">·</span> Isolated demo</p></div></div>
      <div className="demo-guide-controls">
        {/* Full navigation reinitializes page-local workspace state when exiting the isolated demo. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="demo-guide-exit">Exit demo<ExternalLink size={12} aria-hidden="true" /></a><button type="button" className="demo-guide-toggle" aria-expanded={expanded} aria-controls={contentId} aria-label={expanded ? 'Collapse demo guide' : 'Expand demo guide'} onClick={() => setExpanded(value => !value)}><ChevronDown size={17} className={expanded ? '' : 'demo-guide-chevron-closed'} /></button></div>
    </div>
    <ol className="demo-guide-progress" aria-label="Demo progress">{STEPS.map((item, index) => <li key={item.key} aria-current={item.key === stage ? 'step' : undefined} className={item.key === stage ? 'current' : completed[item.key] ? 'complete' : ''}><span className="demo-guide-step-number" aria-hidden="true">{completed[item.key] && item.key !== stage ? <Check size={11} /> : index + 1}</span><span>{item.label}</span><span className="sr-only">{item.key === stage ? ', current step' : completed[item.key] ? ', recorded' : ', upcoming'}</span></li>)}</ol>
    <div id={contentId} hidden={!expanded}>
      <div className="demo-guide-body">
        <div className="demo-guide-instruction"><div className="demo-guide-eyebrow">Step {stepIndex + 1} of {STEPS.length}<span><Clock3 size={11} />About {step.seconds}s</span></div><h3>{step.title}</h3><p>{step.detail}</p>
          <div className="demo-guide-actions">
            {stage === 'intro' && <button type="button" className="button primary" disabled={disabled} onClick={() => void startDemo()}>{busy === 'start_demo' ? <Loader2 size={15} className="spin" /> : <Play size={14} />}Start guided demo</button>}
            {stage === 'research' && <><button type="button" className="button primary" disabled={disabled || !snapshot.connections.nicrron.configured} onClick={() => invoke({ action: 'research', symbol: 'MSFT', prompt: 'Review the approved historical MSFT earnings evidence. Separate canonical cited facts from interpretation and explain what to consider before proposing one MSFT share in the synthetic replay.' }, 'Generating the demo memo through Nicrron…')}>{busy === 'research' ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}Generate demo research</button><button type="button" className="button secondary" disabled={disabled} onClick={() => invoke({ action: 'demo_sample' }, 'Loading the explicitly labeled sample memo…')}><FileText size={15} />Use sample demo memo</button></>}
            {stage === 'source' && <><button type="button" className="button secondary" disabled={!source} onClick={() => { if (source && memo) { setOpenedMemoId(memo.id); openEvidence(source); } }}><BookOpen size={15} />Open demo source</button><button type="button" className="button primary" disabled={disabled || !memo || !source || !sourceOpened} onClick={() => { if (memo) invoke({ action: 'propose', researchId: memo.id, side: 'buy', quantity: 1 }, 'Checking the one-share demo proposal…'); }}><ArrowRight size={15} />Propose 1 MSFT share</button></>}
            {stage === 'approval' && activeOrder && <><button type="button" className="button secondary" onClick={() => navigate('Orders', activeOrder.id)}>Inspect demo order<ArrowUpRight size={14} /></button><button type="button" className="button primary" disabled={disabled} onClick={() => invoke({ action: 'approve', orderId: activeOrder.id }, 'Checking and authorizing this exact demo order…')}><Check size={15} />Approve demo order</button></>}
            {stage === 'execution' && activeOrder && <button type="button" className="button primary" disabled={disabled} onClick={() => invoke({ action: 'execute', orderId: activeOrder.id }, 'Rechecking permission before the demo paper fill…')}><ArrowRight size={15} />Execute demo paper order</button>}
            {stage === 'block' && <button type="button" className="button primary" disabled={disabled} onClick={() => invoke({ action: 'scenario', scenario: 'oversize' }, 'Testing the oversized-order boundary…')}><ShieldCheck size={15} />Run oversized demo order</button>}
            {stage === 'audit' && <><button type="button" className="button primary" onClick={() => navigate('Audit trail')}>Open demo audit trail<ArrowRight size={15} /></button><button type="button" className="button secondary" onClick={exportAudit}><Download size={15} />Export demo evidence</button></>}
          </div>
          <div className="demo-guide-step-note">
            {stage === 'intro' && 'Start creates a fresh isolated session. Your main workspace stays separate.'}
            {stage === 'research' && (snapshot.connections.nicrron.configured ? 'Nicrron is configured. Generate makes a real model request; sample uses no model call. Provider response times may vary.' : 'Nicrron is not configured. Use the sample, or open Connections to configure real inference.')}
            {stage === 'source' && (sourceOpened ? 'Source opened for review. The proposal still needs all permission checks.' : source ? 'Open the actual source before enabling the one-share proposal.' : 'The memo’s MSFT source is missing. Inspect the memo or restart the demo.')}
            {stage === 'approval' && 'Approval is a human action. It records authorization without filling the order.'}
            {stage === 'execution' && 'This button submits one explicit paper execution request. No brokerage is connected.'}
            {stage === 'block' && 'The scenario must produce a failed notional-limit check. External enforcement may also report its own result.'}
            {stage === 'audit' && 'Exports include the recorded orders and audit events; review the trace delivery status in Connections.'}
          </div>
        </div>
        <aside className="demo-guide-context" aria-label="Actual demo state">
          <span className="demo-guide-context-label">Recorded in this session</span>
          {!startedAt ? <p>No run has started. Start the walkthrough to create its evidence.</p> : <>
            <dl><div><dt>Market</dt><dd>Synthetic replay · 2025</dd></div><div><dt>Research</dt><dd>{memo ? memo.mode === 'nicrron' ? `Nicrron · ${memo.model}` : 'Explicit sample · no model call' : 'No memo yet'}</dd></div><div><dt>Paper order</dt><dd>{activeOrder ? `${activeOrder.quantity} ${activeOrder.symbol} · ${activeOrder.status}` : 'No proposal yet'}</dd></div></dl>
            {memo && <button type="button" className="demo-guide-text-action" onClick={() => navigate('Research', memo.id)}>Open recorded memo<ArrowUpRight size={12} /></button>}
            {activeOrder && (stage === 'execution' || stage === 'block' || stage === 'audit') && <button type="button" className="demo-guide-text-action" onClick={() => navigate('Orders', activeOrder.id)}>Open recorded order<ArrowUpRight size={12} /></button>}
          </>}
          <p className="demo-guide-boundary"><ShieldCheck size={13} />Synthetic prices. Historical 2025 evidence. Real permission checks.</p>
        </aside>
      </div>
      {(!isolated || error || stoppedOrder || (stage === 'block' && oversizeAttempt && !blockedOrder)) && <div className="demo-guide-outcome" role="alert"><XCircle size={17} /><div><strong>{!isolated ? 'The isolated demo workspace is not available.' : stoppedOrder ? `The proposal is ${stoppedOrder.status}.` : 'This step needs attention.'}</strong><p>{!isolated ? 'Demo actions are disabled. Exit and reopen the demo workspace.' : error || failedChecks.map(check => `${check.label}: ${check.reason}`).join(' ') || (stoppedOrder?.status === 'rejected' ? 'The proposal was rejected. Open the source and make a new proposal to continue.' : 'The oversized attempt did not record the expected notional-limit block. Inspect the actual order before retrying.')}</p>{(stoppedOrder || oversizeAttempt) && <button type="button" className="demo-guide-text-action" onClick={() => navigate('Orders', (stoppedOrder || oversizeAttempt)!.id)}>Inspect stopped attempt<ArrowUpRight size={12} /></button>}<p className="demo-guide-recovery">Use the current step to retry after resolving the issue, or restart this isolated demo.</p></div></div>}
      {(filledOrder || blockedOrder) && <div className="demo-guide-receipts" aria-label="Demo outcome receipts">
        {filledOrder?.fill && <div><CheckCircle2 size={17} /><div><strong>Paper fill recorded</strong><p>{filledOrder.fill.quantity} {filledOrder.symbol} at {usd(filledOrder.fill.price)} · {usd(filledOrder.fill.quantity * filledOrder.fill.price)} filled</p><small>{fillReceipt ? `Audit receipt · ${fillReceipt.id}` : 'Fill is recorded; an execution audit receipt was not found.'}</small></div></div>}
        {blockedOrder && <div><ShieldCheck size={17} /><div><strong>Oversized order blocked</strong><p>{blockedOrder.checks.find(check => check.key === 'notional' && !check.passed)?.reason}</p><small>{blockedReceipt ? `Ledger unchanged · v${String(blockedReceipt.details!.ledgerBefore)} → v${String(blockedReceipt.details!.ledgerAfter)} · no execution attempted` : 'An unchanged-ledger audit receipt was not found.'}</small><small>{recordedPrism ? `${actualPrismBlock ? 'PRISM block recorded' : 'PRISM check'}: ${recordedPrism.reason}` : 'No PRISM enforcement check is recorded for this order.'}</small><button type="button" className="demo-guide-text-action" onClick={() => navigate('Orders', blockedOrder.id)}>Inspect oversized order<ArrowUpRight size={12} /></button></div></div>}
      </div>}
      <div className="demo-guide-bottom"><details className="demo-guide-presenter"><summary>Say this <span>Presenter note</span><ChevronDown size={12} aria-hidden="true" /></summary><p>{step.say}</p></details>{startedAt && !restartConfirm && <button type="button" className="demo-guide-restart" disabled={!!busy} onClick={() => setRestartConfirm(true)}><RotateCcw size={12} />Restart demo</button>}</div>
      {restartConfirm && <div className="demo-guide-restart-confirm" role="group" aria-label="Confirm demo restart"><p><strong>Restart this demo?</strong> Its demo research, orders, and audit events will be cleared. Your main workspace is preserved.</p><div><button type="button" className="button secondary compact" disabled={!!busy} onClick={() => setRestartConfirm(false)}>Keep current demo</button><button type="button" className="button danger compact" disabled={disabled} onClick={() => void startDemo()}>Restart demo now</button></div></div>}
    </div>
  </section>;
}
