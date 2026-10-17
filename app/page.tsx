'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, BookOpen, Check,
  CheckCheck, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, Clock3,
  Database, Download, ExternalLink, FileText, FlaskConical, Layers3,
  LayoutDashboard, Loader2, LockKeyhole, Plug, RefreshCw, Search,
  ShieldCheck, SlidersHorizontal, Sparkles, X, XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { usePanelMotion } from './use-panel-motion';
import { DemoGuide } from './demo-guide';
import { Strategies } from './strategies';
import { RiskLab } from './risk-lab';
import { authenticationRecovery, type AuthRecovery } from '../lib/client-auth';
import './strategies.css';
import type { Action, AuditEvent, DeskSnapshot, Evidence, Order, Policy, Quote, Research, MarketMode } from '../lib/types';

type View = 'Overview' | 'Risk lab' | 'Strategies' | 'Research' | 'Orders' | 'Mandate' | 'Audit trail' | 'Connections';
const subscribeMobile = (callback: () => void) => { const query = window.matchMedia('(max-width: 600px)'); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback); };
const getMobileSnapshot = () => window.matchMedia('(max-width: 600px)').matches;
const getServerMobileSnapshot = () => false;
const NAV = [
  { name: 'Overview', icon: LayoutDashboard }, { name: 'Risk lab', icon: ShieldCheck }, { name: 'Strategies', icon: Activity }, { name: 'Research', icon: BookOpen },
  { name: 'Orders', icon: Layers3 }, { name: 'Mandate', icon: ShieldCheck },
  { name: 'Audit trail', icon: Activity }, { name: 'Connections', icon: Plug },
] as const;
const money = (value: number, decimals = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value);
const number = (value: number, decimals = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(value);
const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const date = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); };
const time = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? '—' : parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
const marketTime = (value?: string | null) => { const parsed = new Date(value || ''); return Number.isNaN(parsed.valueOf()) ? 'Unavailable' : `${parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET`; };
const hasPrice = (quote?: Quote): quote is Quote => !!quote && Number.isFinite(quote.price) && quote.price > 0;
const COMPANY_LOGOS: Record<string, string> = { NVDA: '/logos/NVDA.jpg', MSFT: '/logos/MSFT.jpg', AAPL: '/logos/AAPL.jpg', GOOGL: '/logos/GOOGL.jpg', AMZN: '/logos/AMZN.jpg', META: '/logos/META.jpg' };
const SECURITIES = [{ symbol: 'NVDA', name: 'NVIDIA' }, { symbol: 'MSFT', name: 'Microsoft' }, { symbol: 'AAPL', name: 'Apple' }, { symbol: 'GOOGL', name: 'Alphabet' }, { symbol: 'AMZN', name: 'Amazon' }, { symbol: 'META', name: 'Meta Platforms' }];
const newest = <T extends { createdAt: string }>(items: T[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const titles: Record<View, string> = { Overview: 'Your investment desk.', 'Risk lab': 'A cited answer is not permission to trade.', Strategies: 'Learn from the market’s history.', Research: 'From evidence to conviction.', Orders: 'Every order, accounted for.', Mandate: 'Your rules. Enforced.', 'Audit trail': 'A record of every decision.', Connections: 'Connected, on your terms.' };
const descriptions: Record<View, string> = { Overview: 'Research, portfolio decisions, and permissions for small investment teams.', 'Risk lab': 'Test the boundary between an agent’s request and the authority to act.', Strategies: 'Inspect earlier sessions and compare transparent historical strategies.', Research: 'Review the source before you review the trade.', Orders: 'Inspect the evidence and permission checks before capital moves.', Mandate: 'Set the boundaries your agents must operate within.', 'Audit trail': 'Follow an action from the first source to the final decision.', Connections: 'Model inference, evidence retrieval, and observability.' };

function Badge({ status, children }: { status: string; children?: React.ReactNode }) {
  return <span className={`badge badge-${status}`}><span className="status-dot" />{children || status}</span>;
}
function Ticker({ symbol, small = false }: { symbol: string; small?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const path = COMPANY_LOGOS[symbol];
  return <span className={`ticker-avatar${small ? ' small' : ''}`} aria-hidden="true">{path && failedSource !== path ? <Image src={path} alt="" width={32} height={32} unoptimized onError={() => setFailedSource(path)} /> : <span className="ticker-fallback">{symbol.slice(0, 2)}</span>}</span>;
}
function Empty({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="empty-state"><FileText size={25} strokeWidth={1.4} /><h3>{title}</h3><p>{description}</p>{children}</div>;
}
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return <span className="muted">—</span>;
  const min = Math.min(...values), range = Math.max(...values) - min || 1;
  const points = values.map((v, i) => `${i * 76 / (values.length - 1)},${27 - (v - min) / range * 22}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 78 30" aria-hidden="true"><polyline points={points} fill="none" stroke={positive ? 'var(--positive)' : 'var(--negative)'} strokeWidth="1.5" /></svg>;
}

function PriceChart({ quote }: { quote: Quote }) {
  const [windowSize, setWindowSize] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const measure = () => setCanvasWidth(Math.max(240, element.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const values = windowSize ? quote.history.slice(-windowSize) : quote.history;
  const timestamps = windowSize ? quote.historyTimestamps?.slice(-windowSize) : quote.historyTimestamps;
  const safeValues = values.length ? values : [quote.price];
  const lo = Math.min(...safeValues), hi = Math.max(...safeValues);
  const pad = Math.max((hi - lo) * 0.2, 0.1), low = lo - pad, high = hi + pad;
  const w = canvasWidth, h = w < 400 ? 190 : 236, left = 6, right = 73, top = 18, bottom = 20;
  const x = (i: number) => left + i / Math.max(safeValues.length - 1, 1) * (w - left - right);
  const y = (v: number) => top + (high - v) / (high - low) * (h - top - bottom);
  const path = safeValues.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');
  const area = `${path} L ${x(safeValues.length - 1)} ${h - bottom} L ${left} ${h - bottom} Z`;
  const idx = hovered === null ? safeValues.length - 1 : Math.min(hovered, safeValues.length - 1);
  const selectedValue = safeValues[idx];
  const inspectPoint = (clientX: number, bounds: DOMRect) => {
    const pos = ((clientX - bounds.left) / bounds.width * w - left) / (w - left - right);
    setHovered(Math.max(0, Math.min(safeValues.length - 1, Math.round(pos * (safeValues.length - 1)))));
  };
  const selectedTime = timestamps?.[idx] || (values.length ? undefined : quote.timestamp);
  return <div className="price-chart">
    <div className="chart-tools"><span className="chart-caption"><span className="chart-key" />Yahoo Finance · 5-minute bars</span><div className="segmented" aria-label="Chart window">{[{ n: 0, label: 'Full session' }, { n: 30, label: '30 points' }, { n: 15, label: '15 points' }].map(t => <button type="button" key={t.n} className={windowSize === t.n ? 'selected' : ''} aria-pressed={windowSize === t.n} onClick={() => { setWindowSize(t.n); setHovered(null); }}>{t.label}</button>)}</div></div>
    <div ref={canvas} className="chart-canvas" role="group" tabIndex={0} aria-label="Inspect Yahoo Finance chart values" aria-describedby="chart-instructions" onPointerLeave={() => setHovered(null)} onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) {
        event.preventDefault();
        setHovered(event.key === 'Escape' ? null : event.key === 'Home' ? 0 : event.key === 'End' ? safeValues.length - 1 : Math.max(0, Math.min(safeValues.length - 1, idx + (event.key === 'ArrowRight' ? 1 : -1))));
      }
    }}>
      <span className="sr-only" id="chart-instructions">Use left and right arrows to inspect prices, Home or End to jump, and Escape to return to the latest price.</span>
      <output className="sr-only" aria-live="polite">{hovered === null ? 'Latest price' : `Observation ${idx + 1} of ${safeValues.length}`}: {money(selectedValue)}{selectedTime ? ` · ${marketTime(selectedTime)}` : ''}</output>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${quote.symbol} Yahoo Finance price chart, ${safeValues.length} observations, from ${money(safeValues[0])} to ${money(safeValues[safeValues.length - 1])}`} onPointerMove={event => inspectPoint(event.clientX, event.currentTarget.getBoundingClientRect())} onPointerDown={event => inspectPoint(event.clientX, event.currentTarget.getBoundingClientRect())}>
        {[0, 1, 2, 3].map(n => { const val = high - (high - low) * (n + .2) / 3.4; return <g key={n}><line x1={left} x2={w - right + 7} y1={y(val)} y2={y(val)} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x={w - right + 18} y={y(val) + 4} className="chart-axis">{val.toFixed(2)}</text></g>; })}
        <path d={area} fill="var(--chart-fill)" /><path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />
        {hovered !== null && <line x1={x(idx)} x2={x(idx)} y1={top} y2={h - bottom} stroke="#8e9d91" strokeDasharray="3 4" />}
        <circle cx={x(idx)} cy={y(selectedValue)} r="4.5" fill="var(--accent)" stroke="white" strokeWidth="2" />
        <g transform={`translate(${Math.max(0, Math.min(x(idx) - 33, w - right - 66))}, ${Math.max(0, y(selectedValue) - 31)})`}><rect width="66" height="23" rx="4" fill="var(--rail)" /><text x="33" y="16" textAnchor="middle" fill="white" className="chart-value">{selectedValue.toFixed(2)}</text></g>
      </svg>
    </div>
    {<div className="chart-observation">{hovered === null ? 'Latest bar' : 'Selected bar'} · {marketTime(selectedTime)}</div>}
    <div className="chart-bottom"><span>5-minute bars</span><span>{safeValues.length} observations · {quote.currency || 'USD'}</span><span>Latest available</span></div>
  </div>;
}

function EvidenceDrawer({ evidence, close }: { evidence: Evidence; close: () => void }) {
  const { panel, dismiss, drag } = usePanelMotion(close);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    panel.current?.focus();
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'Tab') {
        const elements = panel.current?.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [dismiss, panel]);
  return <div className="drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) dismiss(); }}><div ref={panel} className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title" tabIndex={-1}>
    <div className="drawer-grab" aria-hidden="true" {...drag}><span /></div>
    <div className="drawer-top"><span><FileText size={17} /> Source evidence</span><button type="button" className="icon-button" onClick={dismiss} aria-label="Close evidence"><X size={19} /></button></div>
    <div className="drawer-content"><Badge status="source">Dated source evidence</Badge><h2 id="evidence-title">{evidence.title}</h2><dl className="source-meta"><div><dt>Company</dt><dd>{evidence.symbol}</dd></div><div><dt>Published</dt><dd>{date(evidence.publishedAt)}</dd></div><div><dt>Reporting period</dt><dd>{evidence.period}</dd></div></dl><h3>Source excerpt</h3><blockquote>{evidence.text}</blockquote>{Object.keys(evidence.metrics).length > 0 && <><h3>Recorded metrics</h3><dl className="metric-list">{Object.entries(evidence.metrics).map(([key, val]) => <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{number(val, 4)}</dd></div>)}</dl></>}<p className="helper">Historical evidence is dated separately from market quotes. Follow the source to inspect its full context and units.</p><a className="button primary full-width" href={evidence.url} target="_blank" rel="noreferrer">Open original source <span className="button-icon"><ExternalLink size={15} /></span></a><div className="source-id mono">{evidence.id}</div></div>
  </div></div>;
}

function SourceButtons({ ids, evidence, open }: { ids: string[]; evidence: Evidence[]; open: (evidence: Evidence) => void }) {
  return <span className="source-buttons">{ids.map(id => { const source = evidence.find(item => item.id === id); if (!source) return <span className="source-missing" key={id}>Missing source</span>; return <button className="citation" type="button" key={id} onClick={() => open(source)} title={`Read ${source.title}`}>[{evidence.indexOf(source) + 1}]<span className="sr-only"> {source.title}</span></button>; })}</span>;
}

function ResearchMemo({ research, snapshot, busy, run, openEvidence }: { research: Research; snapshot: DeskSnapshot; busy: string; run: (action: Action, message?: string) => Promise<void>; openEvidence: (e: Evidence) => void }) {
  const [quantity, setQuantity] = useState(research.recommendation.quantity);
  const [side, setSide] = useState<'buy' | 'sell'>(research.recommendation.side);
  const quote = snapshot.market.find(item => item.symbol === research.symbol);
  const unavailable = !hasPrice(quote);
  const quoteBlocked = unavailable || !!quote?.stale || quote?.marketState === 'unknown';
  const evidenceAsOf = new Date(snapshot.marketFeed?.fetchedAt || '').valueOf();
  const historicalOnly = !!research.history && research.history.asOf < research.history.latestAvailableDate;
  const sourceBlocked = historicalOnly || research.evidenceIds.some(id => { const source = snapshot.evidence.find(item => item.id === id); const published = source ? new Date(source.publishedAt).valueOf() : NaN; return !Number.isFinite(published) || !Number.isFinite(evidenceAsOf) || (evidenceAsOf - published) / 86400000 > snapshot.state.policy.maxEvidenceAgeDays; });
  const proposalNote = unavailable ? 'Quote unavailable. Refresh the market data before proposing an order.' : quote?.stale ? 'This quote is stale. Wait for Yahoo to return usable market data.' : sourceBlocked ? 'This evidence is for historical analysis. Generate a strategy memo from the latest available session for a current proposal.' : quote?.marketState === 'closed' ? 'Market closed. Propose and approve against the latest available Yahoo close, then explicitly queue for a fresh price after the market opens.' : 'Yahoo-priced paper proposal. Quotes, evidence, and permissions are checked again at execution.';
  return <article className="memo panel"><div className="panel-heading"><div className="inline"><Ticker symbol={research.symbol} small /><strong>{research.symbol} research memo</strong></div><Badge status={research.mode === 'sample' ? 'sample' : 'allowed'}>{research.mode === 'strategy' ? 'Yahoo historical strategy' : research.mode === 'sample' ? 'Sample research' : 'Nicrron inference'}</Badge></div><div className="memo-content"><div className="memo-dateline">{date(research.createdAt)} · {time(research.createdAt)}<span>{research.model}</span></div><h2>{research.title}</h2><p className="memo-summary">{research.summary}</p><h3>What the evidence says</h3><ol className="claims">{research.claims.map((claim, i) => <li key={i}><span className={`claim-indicator ${claim.supported ? 'positive' : 'negative'}`}>{claim.supported ? <Check size={13} /> : <X size={13} />}</span><div>{claim.text}<SourceButtons ids={claim.evidenceIds} evidence={snapshot.evidence} open={openEvidence} />{!claim.supported && <span className="claim-warning">Supporting evidence has not been verified</span>}</div></li>)}</ol><h3>Consider before acting</h3><ul className="risk-list">{research.risks.map((risk, i) => <li key={i}>{risk}</li>)}</ul><div className="memo-sources"><span>Underlying sources</span>{research.evidenceIds.map(id => { const evidence = snapshot.evidence.find(item => item.id === id); return evidence && <button type="button" key={id} onClick={() => openEvidence(evidence)}><FileText size={14} /><span>{evidence.title}<small>{date(evidence.publishedAt)}</small></span><ArrowUpRight size={14} /></button>; })}</div></div><form className="proposal-form" onSubmit={e => { e.preventDefault(); if (busy || quoteBlocked || sourceBlocked || quantity < 1) return; void run({ action: 'propose', researchId: research.id, quantity, side }, 'Checking your proposed order…'); }}><div><h3>{research.recommendation.signal === 'hold' ? 'This strategy currently stays in cash' : 'Turn research into a proposal'}</h3><p>{research.recommendation.rationale}</p>{research.recommendation.signal === 'hold' && <p className="helper">The rule recommends no new purchase. Entering a positive quantity is your explicit override and still requires review.</p>}</div><div className="proposal-inputs"><label>Side<select value={side} onChange={e => setSide(e.target.value as 'buy' | 'sell')}><option value="buy">Buy</option><option value="sell">Sell</option></select></label><label>Shares<input required type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label><div className="proposal-estimate"><span>Estimated notional</span><strong className="mono">{hasPrice(quote) ? money(quantity * quote.price) : 'Unavailable'}</strong></div><button type="submit" className="button primary" disabled={!!busy || quoteBlocked || sourceBlocked || quantity < 1}>{busy === 'propose' ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}Propose order</button></div><p className="small muted">{proposalNote}</p>{research.history ? <p className="historical-notice">History through {date(research.history.asOf)}. Backtested results are hypothetical, include stated costs, and do not predict future returns.</p> : <p className="historical-notice">A newly generated memo does not make the underlying disclosure current.</p>}</form></article>;
}

function OrderDetails({ order, snapshot, busy, run, openEvidence }: { order: Order; snapshot: DeskSnapshot; busy: string; run: (action: Action, message?: string) => Promise<void>; openEvidence: (e: Evidence) => void }) {
  const research = snapshot.state.research.find(item => item.id === order.researchId);
  const orderQuote = snapshot.market.find(item => item.symbol === order.symbol);
  const closed = orderQuote?.marketState === 'closed';
  return <article className="order-details panel"><div className="panel-heading"><span className="inline"><ShieldCheck size={17} /><strong>Order review</strong></span><Badge status={order.status} /></div><div className="order-summary"><div className="inline"><Ticker symbol={order.symbol} /><div><h2>{order.side === 'buy' ? 'Buy' : 'Sell'} {number(order.quantity)} {order.symbol}</h2><p className="muted">{date(order.createdAt)} · {time(order.createdAt)}</p></div></div><div className="order-value"><strong className="mono">{money(order.notional)}</strong><small>at {money(order.price)} / share · Yahoo Finance</small></div></div><div className="order-body"><p className="order-provenance">Price source: Yahoo Finance{order.quoteTimestamp ? ` · quoted ${marketTime(order.quoteTimestamp)}` : ''}. Paper execution uses a fresh Yahoo price during the regular market session.</p>{order.queue && <div className="queue-receipt"><Clock3 size={18} /><div><strong>{order.status === 'queued' ? 'Waiting for an eligible market session' : 'Queue authorization'}</strong><p>Price must remain within {order.queue.maxPriceDriftPercent}% of {money(order.price)} ({money(order.price * .99)}–{money(order.price * 1.01)}). Expires {marketTime(order.queue.expiresAt)}.</p><small>Fresh prices, current portfolio limits, mandate version, and PRISM are checked again before a paper fill.</small></div></div>}{order.reviewReason && <p className="historical-notice">{order.reviewReason}</p>}<div className="section-line"><h3>Permission checks</h3><span className="mono muted">{order.checks.filter(c => c.passed).length}/{order.checks.length} passed</span></div><ul className="check-list">{order.checks.map(check => <li key={check.key}>{check.passed ? <CheckCircle2 size={17} className="positive" /> : <XCircle size={17} className="negative" />}<div><strong>{check.label}</strong><p>{check.reason}</p></div><span className={check.passed ? 'positive' : 'negative'}>{check.passed ? 'Pass' : 'Blocked'}</span></li>)}</ul>{research && <div className="order-rationale"><h3>Research behind the order</h3><p>{research.summary}</p><SourceButtons ids={order.evidenceIds} evidence={snapshot.evidence} open={openEvidence} /></div>}<div className="order-binding"><LockKeyhole size={15} /><span>Bound to this order, portfolio state, and mandate version.<code>{order.fingerprint.slice(0, 28)}{order.fingerprint.length > 28 ? '…' : ''}</code></span></div>{order.approval && <div className="approval-receipt"><CheckCheck size={16} /><span>Approved {time(order.approval.approvedAt)} · mandate v{order.approval.policyVersion} · portfolio v{order.approval.portfolioVersion}</span></div>}{order.fill && <div className="approval-receipt"><CheckCircle2 size={16} /><span>Paper fill: {number(order.fill.quantity)} shares at {money(order.fill.price)} · {time(order.fill.time)}</span></div>}</div><div className="order-footer"><span className="small muted">{order.status === 'blocked' ? 'Resolve failed checks with a new proposal.' : order.status === 'executed' ? 'Recorded in the paper portfolio and audit trail.' : 'No real funds or brokerage connection.'}</span><div className="inline">{(order.status === 'review' || order.status === 'approved' || order.status === 'blocked' || order.status === 'queued') && <button className="button secondary" type="button" disabled={!!busy} onClick={() => void run({ action: 'reject', orderId: order.id })}>{order.status === 'queued' ? 'Cancel queued order' : 'Reject'}</button>}{order.status === 'review' && <button type="button" className="button primary" disabled={!!busy} onClick={() => void run({ action: 'approve', orderId: order.id })}><Check size={16} />Approve order</button>}{order.status === 'approved' && closed && <span className="queue-consent">Authorizes a paper fill within 1% of this price for 7 days.</span>}{order.status === 'approved' && <button type="button" className="button primary" disabled={!!busy || !orderQuote || orderQuote.marketState === 'unknown'} onClick={() => void run({ action: closed ? 'queue' : 'execute', orderId: order.id })}><ArrowRight size={16} />{closed ? 'Queue for market open' : 'Execute paper order'}</button>}</div></div></article>;
}

function MandateEditor({ policy, busy, run }: { policy: Policy; busy: string; run: (action: Action) => Promise<void> }) {
  const { version: policyVersion, ...editablePolicy } = policy;
  const [draft, setDraft] = useState<Omit<Policy, 'version'>>({ ...editablePolicy });
  const set = (key: keyof Policy, value: number | boolean | string[]) => setDraft(prev => ({ ...prev, [key]: value }));
  const fields: { key: 'maxOrderValue' | 'maxPositionWeight' | 'approvalAbove' | 'maxQuoteAgeSeconds' | 'maxEvidenceAgeDays'; label: string; hint: string; suffix: string; min: number; max?: number; step: number }[] = [
    { key: 'maxOrderValue', label: 'Maximum order value', hint: 'Block individual orders above this notional.', suffix: 'USD', min: 100, max: 100000, step: 100 },
    { key: 'maxPositionWeight', label: 'Maximum position weight', hint: 'Limit a single holding as a share of portfolio NAV.', suffix: '%', min: 1, max: 100, step: 1 },
    { key: 'approvalAbove', label: 'Approval threshold', hint: 'Require human approval above this order value.', suffix: 'USD', min: 0, max: 100000, step: 100 },
    { key: 'maxQuoteAgeSeconds', label: 'Quote freshness', hint: 'Reject a quote older than this limit.', suffix: 'seconds', min: 1, max: 300, step: 1 },
    { key: 'maxEvidenceAgeDays', label: 'Evidence freshness', hint: 'Maximum age of the underlying source relative to today.', suffix: 'days', min: 1, max: 365, step: 1 },
  ];
  const weightIsFraction = policy.maxPositionWeight <= 1;
  return <div className="settings-grid"><form className="panel mandate-form" onSubmit={e => { e.preventDefault(); void run({ action: 'policy', policy: draft }); }}><div className="panel-heading"><span className="inline"><SlidersHorizontal size={17} /><strong>Investment constraints</strong></span><span className="version-label">Version {policyVersion}</span></div><div className="settings-body">{fields.map(field => <div className="setting-row" key={field.key}><label htmlFor={field.key}><strong>{field.label}</strong><span>{field.hint}</span></label><div className="unit-input"><input id={field.key} type="number" required min={field.min} max={field.max} step={field.step} value={field.key === 'maxPositionWeight' && weightIsFraction ? Math.round(draft[field.key] * 100) : draft[field.key]} onChange={e => set(field.key, Number(e.target.value) / (field.key === 'maxPositionWeight' && weightIsFraction ? 100 : 1))} /><span>{field.suffix}</span></div></div>)}<div className="setting-row"><div><strong>Always require human approval</strong><p>Every order needs a reviewer, regardless of size.</p></div><button type="button" className={`switch ${draft.requireApproval ? 'on' : ''}`} role="switch" aria-label="Always require human approval" aria-checked={draft.requireApproval} onClick={() => set('requireApproval', !draft.requireApproval)}><span /></button></div><fieldset className="symbol-allowlist"><legend>Approved securities</legend><p className="muted">Orders outside this list are blocked.</p><div>{['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META'].map(symbol => <label key={symbol}><input type="checkbox" checked={draft.allowedSymbols.includes(symbol)} onChange={e => set('allowedSymbols', e.target.checked ? [...draft.allowedSymbols, symbol] : draft.allowedSymbols.filter(s => s !== symbol))} /><span>{symbol}</span></label>)}</div></fieldset></div><div className="settings-footer"><p>Saving creates a new mandate version. Existing approvals may need to be renewed.</p><button type="submit" className="button primary" disabled={!!busy}>{busy === 'policy' ? <Loader2 className="spin" size={15} /> : <Check size={15} />}Save mandate</button></div></form><aside className="roles-panel"><h2>Separation of duties</h2><p className="muted">Each role has a defined boundary in the paper workflow.</p>{[{ icon: BookOpen, title: 'Research agent', detail: 'Read disclosures and produce a cited memo.', access: 'Read + research' }, { icon: Layers3, title: 'Proposal agent', detail: 'Suggest an order. Cannot approve its own work.', access: 'Propose only' }, { icon: ShieldCheck, title: 'Human reviewer', detail: 'Approve or reject the exact proposed order.', access: 'Review + authorize' }, { icon: LockKeyhole, title: 'Execution gateway', detail: 'Recheck permissions before changing the paper ledger.', access: 'Enforce + record' }].map(role => <div className="role" key={role.title}><role.icon size={19} /><div><strong>{role.title}</strong><p>{role.detail}</p><span>{role.access}</span></div></div>)}<div className="quiet-note"><ShieldCheck size={17} /><p>An agent cannot change these rules or grant itself execution permission.</p></div></aside></div>;
}

export default function Home() {
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerMobileSnapshot);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const previousView = useRef<View>('Overview');
  const [snapshot, setSnapshot] = useState<DeskSnapshot | null>(null);
  const [view, setView] = useState<View>('Overview');
  const [marketMode, setMarketMode] = useState<MarketMode | null>(null);
  const marketModeRef = useRef<MarketMode | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<'desk' | 'demo'>('desk');
  const workspaceModeRef = useRef<'desk' | 'demo'>('desk');
  const refreshSequence = useRef(0);
  const [symbol, setSymbol] = useState('NVDA');
  const [busy, setBusy] = useState('');
  const busyRef = useRef(false);
  const mutationVersion = useRef(0);
  const [loadError, setLoadError] = useState('');
  const [authRecovery, setAuthRecovery] = useState<AuthRecovery | null>(null);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [researchId, setResearchId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [prompt, setPrompt] = useState('What changed in the latest earnings disclosure, and what should I consider before increasing our position?');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('all');
  const [queueStatus, setQueueStatus] = useState<{ lastCompletedAt?: string | null; running?: boolean; unavailable?: boolean } | null>(null);
  const [expandedEvent, setExpandedEvent] = useState('');
  const [tableMode, setTableMode] = useState<'watchlist' | 'positions'>('watchlist');
  const [resetConfirm, setResetConfirm] = useState(false);
  const recoverAuthentication = useCallback((status: number, body: unknown) => {
    const recovery = authenticationRecovery(status, body, window.location.pathname + window.location.search + window.location.hash);
    if (!recovery) return;
    setAuthRecovery(recovery); setSnapshot(null);
    setLoadError(recovery.portable ? 'Open a session to continue in your paper workspace.' : 'Sign in with ChatGPT to continue in your workspace.');
    if (recovery.portable) window.location.assign(recovery.href);
  }, []);
  const changeMarketMode = useCallback((mode: MarketMode) => {
    marketModeRef.current = mode;
    mutationVersion.current += 1;
    refreshSequence.current += 1;
    setMarketMode(mode);
    setLoadError('');
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const workspace = params.get('demo') === '1' ? 'demo' : 'desk';
      workspaceModeRef.current = workspace;
      setWorkspaceMode(workspace);
      if (workspace === 'demo') setSymbol('MSFT');
      if (params.get('judge') === '1') setView('Risk lab');
      changeMarketMode('yahoo');
    }, 0);
    return () => clearTimeout(initial);
  }, [changeMarketMode]);
  const refresh = useCallback(async () => {
    const mode = marketModeRef.current;
    const workspace = workspaceModeRef.current;
    if (busyRef.current || !mode) return;
    const version = mutationVersion.current, request = ++refreshSequence.current;
    const isCurrent = () => workspace === workspaceModeRef.current && mode === marketModeRef.current && request === refreshSequence.current && version === mutationVersion.current && !busyRef.current;
    try {
      const response = await fetch(`/api/desk?marketMode=${mode}&workspace=${workspace}`, { cache: 'no-store' });
      const result = await response.json() as DeskSnapshot & { error?: string };
      if (isCurrent()) recoverAuthentication(response.status, result);
      if (!response.ok) throw new Error(result.error || 'Unable to load the investment desk.');
      if (isCurrent()) { setSnapshot(result); setLoadError(''); setAuthRecovery(null); }
    } catch (err) { if (isCurrent()) setLoadError(err instanceof Error ? err.message : 'Unable to connect. Please try again.'); }
  }, [recoverAuthentication]);
  useEffect(() => {
    if (!marketMode) return;
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), 60000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [marketMode, refresh]);
  useEffect(() => { if (toast && !toast.error && !busy) { const timeout = setTimeout(() => setToast(null), 6500); return () => clearTimeout(timeout); } }, [toast, busy]);
  useEffect(() => {
    if (previousView.current !== view) { previousView.current = view; headingRef.current?.focus({ preventScroll: true }); }
  }, [view]);
  useEffect(() => {
    if (!mobileNav || !isMobile) return;
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const items = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') || []);
    items()[0]?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileNav(false); }
      if (event.key === 'Tab') {
        const elements = items(), first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, [mobileNav, isMobile]);
  const run = useCallback(async (action: Action, pending?: string) => {
    if (busyRef.current) return;
    const mode = marketModeRef.current || 'yahoo';
    const workspace = workspaceModeRef.current;
    busyRef.current = true; mutationVersion.current += 1; setBusy(action.action);
    if (pending) setToast({ message: pending, error: false });
    try {
      const response = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...action, marketMode: mode, workspace }) });
      const result = await response.json() as { snapshot?: DeskSnapshot; message?: string; error?: string };
      recoverAuthentication(response.status, result);
      if (result.snapshot && workspace === workspaceModeRef.current && mode === marketModeRef.current) setSnapshot(result.snapshot);
      if (!response.ok || result.error) throw new Error(result.error || 'The action could not be completed.');
      setToast({ message: result.message || 'Your desk is up to date.', error: false });
      const next = result.snapshot as DeskSnapshot | undefined;
      if ((action.action === 'research' || action.action === 'strategy_research') && next) { setResearchId(newest(next.state.research)[0]?.id || ''); setView('Research'); }
      if ((action.action === 'propose') && next) { setOrderId(newest(next.state.orders)[0]?.id || ''); setOrderFilter('all'); setView('Orders'); }
      if (action.action === 'reset') { setOrderId(''); setResearchId(''); setResetConfirm(false); setView('Overview'); }
      if (action.action === 'start_demo') { setOrderId(''); setResearchId(''); setSymbol('MSFT'); setView('Research'); setAuditQuery(''); setAuditFilter('all'); setExpandedEvent(''); }
    } catch (err) { setToast({ message: err instanceof Error ? err.message : 'Something went wrong. Please try again.', error: true }); }
    finally { busyRef.current = false; setBusy(''); if (mode !== marketModeRef.current) void refresh(); }
  }, [refresh, recoverAuthentication]);
  const queuedCount = snapshot?.state.orders.filter(order => order.status === 'queued').length || 0;
  useEffect(() => {
    if (!queuedCount) return;
    const controller = new AbortController();
    void fetch('/api/queue/status', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Queue status unavailable');
      return response.json() as Promise<{ lastCompletedAt?: string | null; running?: boolean }>;
    }).then(status => setQueueStatus(status)).catch(() => { if (!controller.signal.aborted) setQueueStatus({ unavailable: true }); });
    return () => controller.abort();
  }, [queuedCount, snapshot?.marketFeed.fetchedAt]);
  const processQueued = useCallback(async () => {
    if (busyRef.current || !queuedCount || document.visibilityState !== 'visible') return;
    const workspace = workspaceModeRef.current;
    const version = ++mutationVersion.current;
    busyRef.current = true; setBusy('process_queue');
    try {
      const response = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'process_queue', marketMode: 'yahoo', workspace }) });
      const result = await response.json() as { snapshot?: DeskSnapshot; error?: string };
      recoverAuthentication(response.status, result);
      if (result.snapshot && workspace === workspaceModeRef.current && version === mutationVersion.current) setSnapshot(result.snapshot);
      if (!response.ok) throw new Error(result.error || 'The queued-order check could not complete.');
    } catch (error) { setToast({ message: error instanceof Error ? error.message : 'The queued-order check could not complete.', error: true }); }
    finally { busyRef.current = false; setBusy(''); }
  }, [queuedCount, recoverAuthentication]);
  useEffect(() => {
    if (!queuedCount) return;
    const interval = setInterval(() => void processQueued(), 60000);
    return () => clearInterval(interval);
  }, [queuedCount, processQueued]);
  const closeEvidence = useCallback(() => setEvidence(null), []);
  const navigate = (next: View) => { setView(next); setMobileNav(false); };
  const demoNavigate = (next: View, id?: string) => {
    if (next === 'Research') { setSymbol('MSFT'); setResearchId(id || ''); }
    if (next === 'Orders') { setOrderId(id || ''); setOrderFilter('all'); }
    if (next === 'Audit trail') { setAuditQuery(''); setAuditFilter('all'); }
    navigate(next);
  };
  const exportAudit = () => { if (!snapshot) return; const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), environment: 'paper', workspace: snapshot.workspace || 'desk', marketFeed: snapshot.marketFeed, policy: snapshot.state.policy, audit: snapshot.state.audit, orders: snapshot.state.orders }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `mandate-audit-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); setToast({ message: 'Audit record exported as JSON.', error: false }); };
  const orders = useMemo(() => snapshot ? newest(snapshot.state.orders) : [], [snapshot]);
  const research = useMemo(() => snapshot ? newest(snapshot.state.research) : [], [snapshot]);
  const selectedResearch = research.find(item => item.id === researchId) || research.find(item => item.symbol === symbol);
  const selectedOrder = orders.find(item => item.id === orderId && (orderFilter === 'all' || item.status === orderFilter)) || orders.find(item => orderFilter === 'all' || item.status === orderFilter);
  const displayMode = snapshot?.marketFeed?.mode || marketMode || 'yahoo';
  const marketPending = !!marketMode && (!snapshot || displayMode !== marketMode);
  const quote = snapshot?.market.find(item => item.symbol === symbol);
  const selectedSecurity = SECURITIES.find(item => item.symbol === symbol) || SECURITIES[0];
  const positions = snapshot?.state.positions.filter(position => position.shares > 0) || [];
  const missingPositions = positions.filter(position => !hasPrice(snapshot?.market.find(item => item.symbol === position.symbol)));
  const completeValuation = missingPositions.length === 0;
  const pricedPositions = positions.filter(position => hasPrice(snapshot?.market.find(item => item.symbol === position.symbol)));
  const positionValue = pricedPositions.reduce((sum, position) => sum + position.shares * snapshot!.market.find(item => item.symbol === position.symbol)!.price, 0);
  const nav = completeValuation ? (snapshot?.state.cash || 0) + positionValue : null;
  const dayChange = completeValuation ? positions.reduce((sum, position) => { const q = snapshot!.market.find(item => item.symbol === position.symbol)!; return sum + position.shares * (q.price - q.previousClose); }, 0) : null;
  const lastChecked = snapshot?.marketFeed?.fetchedAt;
  const latestBlocked = orders.find(o => o.status === 'blocked');
  const pendingOrders = orders.filter(o => o.status === 'review' || o.status === 'approved' || o.status === 'queued');
  const audits = snapshot ? [...snapshot.state.audit].sort((a, b) => b.time.localeCompare(a.time)).filter(event => (auditFilter === 'all' || event.decision === auditFilter) && `${event.agent} ${event.tool} ${event.message} ${event.traceId}`.toLowerCase().includes(auditQuery.toLowerCase())) : [];
  const filteredOrders = orders.filter(o => orderFilter === 'all' || o.status === orderFilter);
  return <div className="app-shell">
    <aside ref={sidebarRef} id="workspace-navigation" className={`sidebar ${mobileNav ? 'mobile-open' : ''}`} inert={Boolean(evidence) || (isMobile && !mobileNav)} aria-hidden={isMobile && !mobileNav ? true : undefined}><a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('Overview'); }} aria-label="Mandate overview"><span className="brand-symbol"><i /><i /><i /></span><span>mandate<span className="brand-period">.</span></span></a><button className="nav-close icon-button" type="button" aria-label="Close navigation menu" onClick={() => setMobileNav(false)}><X size={20} /></button><div className="workspace-label"><span className="workspace-avatar">M</span><div>{workspaceMode === 'demo' ? 'Presentation demo' : 'Investment desk'}<small>{workspaceMode === 'demo' ? 'Separate paper portfolio' : 'Research workspace'}</small></div><ChevronDown size={14} /></div><nav aria-label="Main navigation">{NAV.map(item => <button type="button" key={item.name} aria-label={item.name} title={item.name} className={`nav-item ${view === item.name ? 'active' : ''}`} onClick={() => navigate(item.name)} aria-current={view === item.name ? 'page' : undefined}><item.icon size={18} strokeWidth={1.7} /><span>{item.name}</span>{item.name === 'Orders' && pendingOrders.length > 0 && <span className="nav-count">{pendingOrders.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="paper-status"><span className="status-dot" /><span>Paper environment</span><LockKeyhole size={12} /></div><p>Yahoo Finance quotes.<br />Real permission checks.</p><button className="sidebar-help" type="button" onClick={() => navigate('Connections')}><CircleHelp size={16} />Workspace setup<ArrowUpRight size={13} /></button><div className="profile"><span className="profile-avatar">PM</span><div>Portfolio manager<small>Reviewer access</small></div><ShieldCheck size={15} /></div></div></aside>
    {mobileNav && <button className="nav-scrim" type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <div className="main-shell" inert={Boolean(evidence) || (isMobile && mobileNav)}><header className="topbar"><div className="breadcrumb"><button type="button" className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation" aria-controls="workspace-navigation" aria-expanded={mobileNav}><span className={`menu-glyph ${mobileNav ? 'open' : ''}`} aria-hidden="true"><i /><i /></span></button><span>Workspace</span><ChevronRight size={13} /><strong>{view}</strong></div><div className="topbar-right"><span className="market-provider"><span className="status-dot" />Yahoo Finance</span><button type="button" className={`icon-button ${busy ? 'muted' : ''}`} onClick={() => void refresh()} disabled={!!busy} aria-label="Refresh desk"><RefreshCw size={15} className={busy ? 'spin' : ''} /></button><span className="top-avatar">PM</span></div></header>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Demo entry fully reloads to initialize its isolated workspace. */}
    <main id="main-content"><div className="page-heading"><div><h1 ref={headingRef} tabIndex={-1}>{titles[view]}</h1><p>{descriptions[view]}</p></div>{workspaceMode === 'desk' && <div className="heading-actions">{view !== 'Risk lab' && <button className="button secondary" type="button" onClick={() => navigate('Risk lab')}><ShieldCheck size={15} />Risk walkthrough</button>}{workspaceMode === 'desk' && <a className="button secondary" href="/?demo=1"><FlaskConical size={15} />Guided demo</a>}{view === 'Overview' && <button type="button" className="button primary" onClick={() => { setResearchId(''); navigate('Research'); }}>New research<span className="button-icon"><ArrowUpRight size={16} /></span></button>}{view === 'Audit trail' && <button type="button" className="button primary" onClick={exportAudit} disabled={!snapshot}><Download size={15} />Export audit</button>}</div>}</div>
    {loadError && view !== 'Risk lab' && <div className="connection-error" role="alert"><XCircle size={17} /><span>{loadError}{snapshot && ` Your last loaded Yahoo Finance desk is still visible.`}</span>{authRecovery ? <a className="text-button" href={authRecovery.href} target="_top">{authRecovery.label}<ArrowUpRight size={14} /></a> : <button type="button" onClick={() => void refresh()}>Retry</button>}</div>}
    {view !== 'Risk lab' && workspaceMode === 'demo' && snapshot?.workspace === 'demo' && <DemoGuide snapshot={snapshot} busy={loadError ? 'loading' : busy} error={loadError || (toast?.error ? toast.message : undefined)} run={run} navigate={demoNavigate} openEvidence={setEvidence} exportAudit={exportAudit} />}
    {view !== 'Risk lab' && snapshot && <div className={`market-feed-status ${snapshot.marketFeed?.status || 'ok'}`} role="status"><span><span className="status-dot" />{marketPending ? `${loadError ? 'Could not load' : 'Loading'} Yahoo Finance${loadError ? '.' : '…'} Displaying the last loaded prices.` : snapshot.marketFeed?.message || 'Yahoo Finance quotes'}</span><span>{lastChecked ? `Last checked ${marketTime(lastChecked)}` : 'Awaiting market data'}</span></div>}

    {view === 'Risk lab' ? <RiskLab workspace={workspaceMode} onOpenDesk={() => navigate('Overview')} /> : !snapshot ? <div className="loading-desk"><span className="loading-mark"><Layers3 size={24} /></span><h2>{authRecovery ? 'Sign in to open your workspace.' : loadError ? 'The desk is temporarily unavailable.' : 'Opening your investment desk…'}</h2><p>{authRecovery ? 'Continue using the sign-in link above to access your portfolio and research.' : loadError ? 'Retry the connection to load your portfolio and research.' : 'Loading the portfolio, source evidence, and order ledger.'}</p>{!loadError && <Loader2 className="spin muted" size={19} />}</div> : <div className="view-content" key={view} aria-busy={!!busy}>
    {view === 'Overview' && <>
      <section className="portfolio-strip" aria-label="Portfolio summary"><div className="nav-metric"><span>Paper portfolio value <span className="currency-label">USD</span></span><strong>{nav === null ? 'Unavailable' : money(nav)}</strong>{dayChange !== null && nav !== null ? <span className={dayChange >= 0 ? 'positive' : 'negative'}>{dayChange >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}{money(Math.abs(dayChange))} ({percent(nav - dayChange ? dayChange / (nav - dayChange) * 100 : 0)})<span className="muted">vs. prior market close</span></span> : <span className="muted">Incomplete valuation · missing {missingPositions.map(position => position.symbol).join(', ')} quotes</span>}</div><div className="strip-metric"><span>Available cash</span><strong>{money(snapshot.state.cash)}</strong><small>{nav ? `${(snapshot.state.cash / nav * 100).toFixed(1)}% of portfolio` : 'Cash balance only'}</small></div><div className="strip-metric"><span>{completeValuation ? 'Invested capital' : 'Priced holdings · partial'}</span><strong>{pricedPositions.length ? money(positionValue) : positions.length ? 'Unavailable' : money(0)}</strong><small>{completeValuation ? `${positions.length} open positions` : `${pricedPositions.length} of ${positions.length} positions priced`}</small>{completeValuation && <span className="allocation-track" aria-hidden="true">{pricedPositions.map((position, index) => <i key={position.symbol} style={{ flex: position.shares * snapshot.market.find(q => q.symbol === position.symbol)!.price, opacity: 1 - index * .2 }} />)}</span>}</div><button type="button" className="strip-metric metric-action" onClick={() => navigate('Orders')}><span>Pending orders <ArrowUpRight size={13} /></span><strong>{pendingOrders.length}</strong><small>View order queue</small></button></section>
      <div className="overview-grid"><div className="panel-shell market-shell"><section className="market-panel panel"><div className="panel-heading"><div className="inline"><span className="section-tab active">Market overview</span></div><span className="small muted">Yahoo Finance</span></div><div className="market-title"><div className="inline"><Ticker symbol={symbol} /><div><label className="sr-only" htmlFor="chart-symbol">Select chart symbol</label><div className="symbol-select"><select id="chart-symbol" value={symbol} onChange={e => setSymbol(e.target.value)}>{SECURITIES.map(item => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}</select><ChevronDown size={13} /></div><span>{quote?.name || selectedSecurity.name}</span></div></div><div className={`quote-price ${hasPrice(quote) ? '' : 'price-missing'}`}><strong>{hasPrice(quote) ? money(quote.price) : 'Unavailable'}</strong>{hasPrice(quote) && quote.previousClose > 0 && <span className={quote.price >= quote.previousClose ? 'positive' : 'negative'}>{percent((quote.price - quote.previousClose) / quote.previousClose * 100)}<small>vs. prior close</small></span>}</div></div>{hasPrice(quote) ? <><div className="quote-dateline"><span>{`Quoted ${marketTime(quote.timestamp)}`}</span>{<span>{quote.marketState === 'closed' ? 'Market closed' : quote.marketState === 'open' ? 'Market open' : 'Market status unknown'}{quote.stale ? ' · stale quote' : ''}</span>}</div>{quote.history.length ? <PriceChart key={`${displayMode}-${quote.symbol}`} quote={quote} /> : <Empty title="Chart history unavailable." description="The latest quote is available, but no intraday bars were returned." />}</> : <Empty title="Quote unavailable." description={`${selectedSecurity.symbol} has no usable Yahoo Finance price. Refresh to try again.`} />}<div className="market-source-note"><Clock3 size={12} /><span>{`Yahoo Finance · 5-minute bars. Quotes may be delayed${quote?.delaySeconds ? ` by ${Math.round(quote.delaySeconds / 60)} minutes` : ''}; real-time delivery is not guaranteed. ${lastChecked ? `Last checked ${marketTime(lastChecked)}.` : ''}`}</span></div></section></div>
      <div className="panel-shell decision-shell"><section className="decision-panel"><div className="decision-heading"><span className="inline"><span className="permission-emblem"><ShieldCheck size={18} /></span><h2>Permission desk</h2></span><span className="version-label">Mandate v{snapshot.state.policy.version}</span></div>{latestBlocked ? <><div className="blocked-label"><span className="status-dot" />Recent blocked action<span className="order-source-label">Yahoo Finance</span></div><h3>{latestBlocked.side === 'buy' ? 'Buy' : 'Sell'} {number(latestBlocked.quantity)} shares of {latestBlocked.symbol}</h3><div className="blocked-value mono">{money(latestBlocked.notional)}<span>proposed notional</span></div><p className="blocked-reason">{latestBlocked.checks.find(check => !check.passed)?.reason || 'This order did not satisfy the investment mandate.'}</p><div className="mini-checks">{[...latestBlocked.checks].sort((a, b) => Number(a.passed) - Number(b.passed)).slice(0, 3).map(check => <div key={check.key}>{check.passed ? <Check size={13} className="positive" /> : <X size={13} className="negative" />}<span>{check.label}</span><span className={check.passed ? 'positive' : 'negative'}>{check.passed ? 'Passed' : 'Blocked'}</span></div>)}</div><button type="button" className="button secondary full-width" onClick={() => { setOrderId(latestBlocked.id); setOrderFilter('all'); navigate('Orders'); }}>Inspect decision<span className="button-icon"><ArrowRight size={15} /></span></button></> : <><div className="permission-ready"><ShieldCheck size={30} /><h3>Boundaries are in place.</h3><p>Your mandate checks every proposed paper order.</p></div><button className="button secondary full-width" type="button" onClick={() => navigate('Strategies')}>Explore historical strategies<ArrowRight size={15} /></button></>}<div className="decision-footnote"><LockKeyhole size={13} />Execution requires permission.</div></section></div></div>
      <div className="panel-shell holdings-shell"><section className="holdings-panel panel"><div className="panel-heading"><div className="table-tabs"><button type="button" aria-pressed={tableMode === 'watchlist'} className={tableMode === 'watchlist' ? 'active' : ''} onClick={() => setTableMode('watchlist')}>Watchlist <span>{SECURITIES.length}</span></button><button type="button" aria-pressed={tableMode === 'positions'} className={tableMode === 'positions' ? 'active' : ''} onClick={() => setTableMode('positions')}>Positions <span>{snapshot.state.positions.length}</span></button></div><span className="small muted">Select a security to inspect</span></div><div className="table-scroll"><table className="data-table market-table"><thead><tr><th>Security</th><th>Price</th><th>Session change</th>{tableMode === 'positions' ? <><th>Shares</th><th>Market value</th><th>Weight</th></> : <><th>Price history</th><th>Research evidence</th></>}<th><span className="sr-only">Research</span></th></tr></thead><tbody>{SECURITIES.filter(item => tableMode === 'watchlist' || snapshot.state.positions.some(position => position.symbol === item.symbol)).map(item => { const q = snapshot.market.find(quote => quote.symbol === item.symbol); const position = snapshot.state.positions.find(position => position.symbol === item.symbol); const change = hasPrice(q) && q.previousClose > 0 ? (q.price - q.previousClose) / q.previousClose * 100 : null; const hasSource = snapshot.evidence.some(e => e.symbol === item.symbol); return <tr key={item.symbol} className={symbol === item.symbol ? 'selected-row' : ''}><td><button type="button" className="security-cell" onClick={() => setSymbol(item.symbol)}><Ticker symbol={item.symbol} small /><span><strong>{item.symbol}</strong><small>{q?.name || item.name}</small></span></button></td><td className="mono">{hasPrice(q) ? money(q.price) : <span className="quote-unavailable">Unavailable</span>}{hasPrice(q) && <small className="table-date">{q.marketState === 'closed' ? 'Market closed' : q.stale ? 'Stale quote' : 'Yahoo Finance'}</small>}</td><td className={`mono ${change === null ? 'muted' : change >= 0 ? 'positive' : 'negative'}`}>{change === null ? '—' : percent(change)}</td>{tableMode === 'positions' ? <><td className="mono">{number(position?.shares || 0)}</td><td className="mono">{hasPrice(q) ? money((position?.shares || 0) * q.price) : 'Unavailable'}</td><td className="mono">{hasPrice(q) && nav ? `${((position?.shares || 0) * q.price / nav * 100).toFixed(1)}%` : '—'}</td></> : <><td>{q ? <Sparkline values={q.history} positive={change !== null && change >= 0} /> : <span className="muted">—</span>}</td><td><span className={`evidence-indicator ${hasSource ? '' : 'unavailable'}`}><FileText size={12} />{hasSource ? 'Issuer disclosure' : 'No source loaded'}</span></td></>}<td><button type="button" className="text-button" onClick={() => { setSymbol(item.symbol); setResearchId(''); navigate('Research'); }}>Research<ArrowUpRight size={13} /></button></td></tr>; })}</tbody></table></div></section></div>
      <div className="overview-bottom"><section className="latest-research"><div className="section-line"><h2>Latest research</h2><button type="button" className="text-button" onClick={() => navigate('Research')}>All research<ArrowRight size={14} /></button></div>{research.length ? research.slice(0, 2).map(memo => <button type="button" className="research-preview" key={memo.id} onClick={() => { setResearchId(memo.id); setSymbol(memo.symbol); navigate('Research'); }}><span className="document-icon"><FileText size={19} /></span><span><span className="preview-label">{memo.symbol} <span>· {memo.mode === 'strategy' ? 'Historical strategy' : memo.mode === 'sample' ? 'Sample research' : 'Nicrron research'}</span></span><strong>{memo.title}</strong><small>{memo.evidenceIds.length} sources · {date(memo.createdAt)}</small></span><ArrowUpRight size={17} /></button>) : <Empty title="Start with a source." description="Generate your first research memo from a company disclosure." />}</section><section className="recent-activity"><div className="section-line"><h2>Recent activity</h2><button type="button" className="text-button" onClick={() => navigate('Audit trail')}>View audit<ArrowRight size={14} /></button></div>{audits.slice(0, 3).map(event => <div className="activity-row" key={event.id}><span className={`activity-dot ${event.decision}`} /><div><strong>{event.tool.replace(/[_.]/g, ' ')}</strong><p>{event.message}</p></div><time>{time(event.time)}</time></div>)}</section></div>
    </>}
    {view === 'Strategies' && <Strategies symbol={symbol} setSymbol={setSymbol} busy={busy} run={run} />}
    {view === 'Research' && <div className="research-layout"><aside className="research-sidebar"><form className="research-form" onSubmit={e => { e.preventDefault(); void run({ action: 'research', symbol, prompt }, 'Reading the disclosures and preparing research…'); }}><h2>Start with a question.</h2><label htmlFor="research-symbol">Security<select id="research-symbol" value={symbol} onChange={e => { setSymbol(e.target.value); setResearchId(''); }}>{SECURITIES.map(q => <option key={q.symbol} value={q.symbol}>{q.symbol} · {q.name}</option>)}</select></label><label htmlFor="research-question">Research question<textarea id="research-question" required rows={5} value={prompt} onChange={e => setPrompt(e.target.value)} /></label><button type="submit" className="button primary full-width" disabled={!!busy}>{busy === 'research' ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}Generate research</button><div className="research-mode"><span className={`status-dot ${snapshot.connections.nicrron.configured ? 'positive-bg' : ''}`} /><span>{snapshot.connections.nicrron.configured ? 'Nicrron inference configured' : 'Sample mode · configure Nicrron for inference'}</span></div><p className="helper">Historical 2025 disclosures available for NVDA, MSFT, and AAPL. These sources are too old for current-market orders under the default mandate. Use Strategies for a dated analysis of the latest available Yahoo history.</p></form><div className="research-history"><div className="section-line"><h3>Research history</h3><span>{research.length}</span></div>{research.map(memo => <button type="button" key={memo.id} aria-pressed={selectedResearch?.id === memo.id} className={selectedResearch?.id === memo.id ? 'active' : ''} onClick={() => { setResearchId(memo.id); setSymbol(memo.symbol); }}><span><strong>{memo.symbol}</strong><small>{time(memo.createdAt)}</small></span><p>{memo.title}</p><ChevronRight size={14} /></button>)}</div></aside><div>{selectedResearch ? <ResearchMemo key={selectedResearch.id} research={selectedResearch} snapshot={snapshot} busy={marketPending || loadError ? 'market' : busy} run={run} openEvidence={setEvidence} /> : <div className="panel"><Empty title="Evidence comes first." description="Choose a supported security and generate a memo. Each factual claim links to the source it came from." /></div>}</div></div>}
    {view === 'Orders' && <>{queuedCount > 0 && <div className="queue-summary"><Clock3 size={18} /><p><strong>{queuedCount} queued {queuedCount === 1 ? 'order' : 'orders'}.</strong> Checked every minute while this desk is open. Execution waits for a fresh Yahoo price during a regular market session.<small className="queue-background-status">Background check: {queueStatus?.unavailable ? 'status unavailable' : queueStatus?.running ? 'currently running' : queueStatus?.lastCompletedAt ? marketTime(queueStatus.lastCompletedAt) : 'no completed check recorded yet'}.</small></p><button type="button" className="button secondary compact" disabled={!!busy} onClick={() => void run({ action: 'process_queue' }, 'Checking queued orders against current Yahoo prices…')}>Check queue<RefreshCw size={14} /></button></div>}<div className="orders-toolbar"><div className="filter-tabs">{['all', 'review', 'approved', 'queued', 'blocked', 'executed', 'rejected', 'expired'].map(status => <button type="button" aria-pressed={orderFilter === status} className={orderFilter === status ? 'active' : ''} key={status} onClick={() => setOrderFilter(status)}>{status === 'all' ? 'All orders' : status === 'review' ? 'Needs review' : status}<span>{orders.filter(o => status === 'all' || o.status === status).length}</span></button>)}</div></div><div className="orders-layout"><section className="order-list panel">{filteredOrders.length ? filteredOrders.map(order => <button type="button" aria-pressed={selectedOrder?.id === order.id} className={`order-list-row ${selectedOrder?.id === order.id ? 'active' : ''}`} key={order.id} onClick={() => setOrderId(order.id)}><div className="order-list-top"><span className="inline"><Ticker symbol={order.symbol} small /><strong>{order.symbol}</strong></span><Badge status={order.status} /></div><div className="order-list-main"><span>{order.side === 'buy' ? 'Buy' : 'Sell'} {number(order.quantity)} shares</span><strong className="mono">{money(order.notional)}</strong></div><div className="order-list-bottom"><span>{time(order.createdAt)}<small className="order-list-source">Yahoo Finance</small></span><span>{order.checks.filter(c => c.passed).length}/{order.checks.length} checks<ChevronRight size={12} /></span></div></button>) : <Empty title="No orders in this view." description="Choose another status or propose an order from a research memo." />}</section><div>{selectedOrder ? <OrderDetails order={selectedOrder} snapshot={snapshot} busy={busy} run={run} openEvidence={setEvidence} /> : <div className="panel"><Empty title="Your next decision starts here." description="Propose an order from a research memo to inspect its permission checks." ><button className="button primary" type="button" onClick={() => navigate('Research')}>Open research<ArrowRight size={14} /></button></Empty></div>}</div></div></>}
    {view === 'Mandate' && <MandateEditor key={snapshot.state.policy.version} policy={snapshot.state.policy} busy={busy} run={run} />}
    {view === 'Audit trail' && <section className="panel audit-panel"><div className="audit-toolbar"><div className="search-input"><Search size={16} /><input type="search" aria-label="Search audit trail" placeholder="Search actions, agents, or trace IDs…" value={auditQuery} onChange={e => setAuditQuery(e.target.value)} /></div><label className="inline"><span className="small muted">Decision</span><select aria-label="Filter audit decision" value={auditFilter} onChange={e => setAuditFilter(e.target.value)}><option value="all">All decisions</option><option value="allowed">Allowed</option><option value="blocked">Blocked</option><option value="review">Review</option><option value="error">Error</option></select></label><span className="small muted">{audits.length} events</span></div><div className="table-scroll"><table className="data-table audit-table"><thead><tr><th>Time</th><th>Agent / tool</th><th>Decision</th><th>Event</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{audits.map(event => <AuditRow key={event.id} event={event} expanded={expandedEvent === event.id} onToggle={() => setExpandedEvent(expandedEvent === event.id ? '' : event.id)} />)}</tbody></table></div>{!audits.length && <Empty title="No matching events." description="Try a different search or decision filter." />}<div className="audit-footer"><LockKeyhole size={13} /><span>Local paper-workflow record. PRISM delivery status is visible in Connections.</span><button className="text-button" type="button" onClick={exportAudit}><Download size={13} />Export JSON</button></div></section>}
    {view === 'Connections' && <div className="connections-layout"><section className="panel connections-panel"><div className="panel-heading"><h2>Workspace integrations</h2><button type="button" className="button secondary compact" disabled={!!busy} onClick={() => void run({ action: 'test_connections' }, 'Testing configured connections…')}><RefreshCw size={13} />Test connections</button></div><div className="connection-item"><span className="connection-logo">N</span><div className="connection-main"><div className="section-line"><h3>Nicrron</h3><Badge status={snapshot.connections.nicrron.configured ? 'allowed' : 'sample'}>{snapshot.connections.nicrron.configured ? 'Configured' : 'Not configured'}</Badge></div><p>Model inference for research and evidence-backed proposals.</p><dl><div><dt>Model</dt><dd>{snapshot.connections.nicrron.model || 'Not selected'}</dd></div><div><dt>Current source mode</dt><dd>{snapshot.connections.nicrron.configured ? 'API inference available' : 'Explicitly labelled sample research'}</dd></div></dl></div></div><div className="connection-item"><span className="connection-logo prism-logo"><Layers3 size={23} /></span><div className="connection-main"><div className="section-line"><h3>PRISM</h3><Badge status={snapshot.connections.prism.configured ? 'allowed' : 'sample'}>{snapshot.connections.prism.configured ? 'Configured' : 'Not configured'}</Badge></div><p>Agent traces, knowledge retrieval, failure analysis, and evaluation.</p><dl><div><dt>Last delivery status</dt><dd>{snapshot.state.integration.prismLastStatus || 'No delivery attempted'}</dd></div><div><dt>Knowledge base</dt><dd>{snapshot.state.integration.knowledgeBaseSynced ? 'Sources synced' : 'Not synced'}</dd></div><div><dt>Guardrail enforcement</dt><dd>{snapshot.connections.prism.enforce ? 'Enabled' : 'Not enabled'}</dd></div></dl><button type="button" className="button secondary compact" disabled={!!busy || !snapshot.connections.prism.configured} onClick={() => void run({ action: 'sync_sources' }, 'Syncing historical sources to PRISM…')}><Database size={13} />Sync source evidence</button></div></div><div className="connection-item"><span className="connection-logo paper-logo"><ShieldCheck size={23} /></span><div className="connection-main"><div className="section-line"><h3>Paper execution</h3><Badge status="allowed">Available</Badge></div><p>Deterministic permission checks and a paper portfolio ledger.</p><dl><div><dt>Market</dt><dd>Yahoo Finance · 5-minute bars</dd></div><div><dt>Quote status</dt><dd>{`${snapshot.marketFeed?.status || 'unavailable'} · may be delayed`}</dd></div><div><dt>Last market check</dt><dd>{marketTime(lastChecked)}</dd></div><div><dt>Broker connection</dt><dd>None · no real-money execution</dd></div></dl></div></div></section><aside className="connection-guide"><h2>Configure your workspace.</h2><p>Keys stay on the server. Add the integration variables to your local <code>.dev.vars</code> file, then restart the development server.</p><div className="env-example"><span>NICRRON_API_KEY</span><span>NICRRON_MODEL</span><span>PRISM_API_KEY</span><span>PRISM_PROJECT_ID</span><span>PRISM_AGENT_ID</span><span>PRISM_ENFORCE</span></div><p className="helper">A configured key is not proof of connectivity. Run a connection test, then generate research to inspect a real trace.</p><div className="quiet-note"><LockKeyhole size={17} /><p>Never enter API keys in research prompts or commit them to your repository.</p></div><div className="reset-section"><h3>Reset paper workspace</h3><p>Clear paper orders, positions, research, and audit history. Restore the starting paper cash balance.</p>{resetConfirm ? <div className="reset-confirm"><p>This replaces the current paper workspace. Continue?</p><div className="inline"><button type="button" className="button danger compact" disabled={!!busy} onClick={() => void run({ action: 'reset' })}>Reset workspace</button><button type="button" className="button secondary compact" onClick={() => setResetConfirm(false)}>Cancel</button></div></div> : <button type="button" className="text-button negative" onClick={() => setResetConfirm(true)}>Reset paper workspace<RefreshCw size={13} /></button>}</div></aside></div>}
    <footer className="workspace-footer"><span><span className="footer-mark">M</span>Mandate · Evidence before execution.</span><span>Paper environment<span className="footer-divider">/</span>Historical sources · Yahoo Finance quotes</span></footer>
    </div>}
    </main></div>{toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <XCircle size={17} /> : busy ? <Loader2 className="spin" size={17} /> : <CheckCircle2 size={17} />}<span>{toast.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}{evidence && <EvidenceDrawer evidence={evidence} close={closeEvidence} />}
  </div>;
}

function AuditRow({ event, expanded, onToggle }: { event: AuditEvent; expanded: boolean; onToggle: () => void }) {
  return <><tr><td><span className="mono">{time(event.time)}</span><small className="table-date">{date(event.time)}</small></td><td><strong>{event.agent}</strong><code className="tool-name">{event.tool}</code></td><td><Badge status={event.decision} /></td><td className="audit-message">{event.message}</td><td><button type="button" className="icon-button" aria-label={`${expanded ? 'Hide' : 'Show'} details for ${event.tool}`} aria-expanded={expanded} onClick={onToggle}><ChevronDown size={15} className={expanded ? 'rotated' : ''} /></button></td></tr>{expanded && <tr className="audit-expanded"><td colSpan={5}><div><strong>Trace ID</strong><code>{event.traceId}</code>{event.orderId && <><strong>Order ID</strong><code>{event.orderId}</code></>}<strong>Recorded details</strong><pre>{JSON.stringify(event.details || { message: event.message }, null, 2)}</pre></div></td></tr>}</>;
}
