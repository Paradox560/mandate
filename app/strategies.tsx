'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import type { Action, Evidence } from '../lib/types';

type StrategyId = 'buy-and-hold' | 'sma-20-50' | 'momentum-20';
type Point = { date: string; price: number; adjustedClose: number; equity: number; benchmarkEquity: number; drawdownPct: number; position: 'long' | 'cash'; trade: 'buy' | 'sell' | null };
type HistoryResult = {
  symbol: string; strategy: { id: StrategyId; name: string; description: string }; asOf: string; latestAvailableDate: string; earliestAvailableDate: string; fetchedAt: string; provider: 'yahoo';
  bars: { date: string; timestamp: string; open: number; high: number; low: number; close: number; adjustedClose: number; volume: number | null }[];
  points: Point[]; metrics: { initialCapital: number; endingEquity: number; totalReturnPct: number; benchmarkReturnPct: number; maxDrawdownPct: number; trades: number; transactionCostBps: number };
  signal: { side: 'buy' | 'hold'; date: string; explanation: string }; evidence: Evidence; methodology: string[];
};
const SYMBOLS = ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META'];
const STRATEGIES = [{ id: 'buy-and-hold', label: 'Buy and hold' }, { id: 'sma-20-50', label: '20 / 50-day moving average' }, { id: 'momentum-20', label: '20-day momentum' }] as const;
const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const pct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const displayDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function HistoryChart({ result }: { result: HistoryResult }) {
  const [index, setIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<'price' | 'performance'>('price');
  const points = result.points;
  const selected = points[Math.min(index ?? points.length - 1, points.length - 1)];
  if (!selected) return <p className="helper">Not enough completed sessions for this strategy window.</p>;
  const values = points.flatMap(point => mode === 'price' ? [point.price] : [point.equity, point.benchmarkEquity]);
  const low = Math.min(...values), high = Math.max(...values), range = high - low || 1;
  const x = (i: number) => 8 + i * 896 / Math.max(1, points.length - 1);
  const y = (value: number) => 226 - (value - low) / range * 196;
  const path = (key: 'price' | 'equity' | 'benchmarkEquity') => points.map((point, i) => `${i ? 'L' : 'M'}${x(i)},${y(point[key])}`).join(' ');
  const active = Math.min(index ?? points.length - 1, points.length - 1);
  return <div className="history-chart">
    <div className="history-chart-tools"><div className="segmented" aria-label="Historical chart"><button type="button" className={mode === 'price' ? 'selected' : ''} aria-pressed={mode === 'price'} onClick={() => setMode('price')}>Price history</button><button type="button" className={mode === 'performance' ? 'selected' : ''} aria-pressed={mode === 'performance'} onClick={() => setMode('performance')}>Strategy comparison</button></div><span className="small muted">Yahoo · completed daily sessions</span></div>
    <div className="history-chart-readout" aria-live="polite"><span>{displayDate(selected.date)}</span><strong>{usd(mode === 'price' ? selected.price : selected.equity)}</strong><span>{mode === 'price' ? 'Historical closing price' : `Strategy · buy & hold ${usd(selected.benchmarkEquity)}`}</span></div>
    <div className="history-chart-canvas" tabIndex={0} role="group" aria-label="Inspect historical sessions" onPointerLeave={() => setIndex(null)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) { event.preventDefault(); setIndex(event.key === 'Escape' ? null : event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, active + (event.key === 'ArrowRight' ? 1 : -1)))); } }}>
      <span className="sr-only">Use arrow keys to inspect earlier and later sessions. Home selects the first date; End selects the latest.</span>
      <svg viewBox="0 0 920 260" role="img" aria-label={`${result.symbol} ${mode === 'price' ? 'historical Yahoo closing prices' : 'historical strategy and buy-and-hold performance'} through ${result.asOf}`} onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); setIndex(Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - bounds.left) / bounds.width * (points.length - 1))))); }}>
        {[.25, .5, .75].map(f => <line key={f} x1="8" x2="912" y1={30 + f * 196} y2={30 + f * 196} stroke="var(--chart-grid)" strokeDasharray="3 5" />)}
        {mode === 'performance' && <path d={path('benchmarkEquity')} fill="none" stroke="var(--secondary)" strokeWidth="1.7" strokeDasharray="5 5" />}
        <path d={path(mode === 'price' ? 'price' : 'equity')} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
        <line x1={x(active)} x2={x(active)} y1="15" y2="238" stroke="var(--secondary)" strokeDasharray="3 5" />
        <circle cx={x(active)} cy={y(mode === 'price' ? selected.price : selected.equity)} r="4" fill="var(--accent)" />
      </svg>
    </div>
    <div className="chart-bottom"><span>{displayDate(points[0].date)}</span><span>{points.length} observed sessions{mode === 'performance' ? ' · dashed: buy and hold' : ''}</span><span>{displayDate(points.at(-1)!.date)}</span></div>
  </div>;
}

export function Strategies({ symbol, setSymbol, busy, run }: { symbol: string; setSymbol: (symbol: string) => void; busy: string; run: (action: Action, pending?: string) => Promise<void> }) {
  const [strategy, setStrategy] = useState<StrategyId>('buy-and-hold');
  const [asOf, setAsOf] = useState('');
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const query = new URLSearchParams({ symbol, strategy, ...(asOf ? { asOf } : {}) });
        const response = await fetch(`/api/history?${query}`, { cache: 'no-store', signal: controller.signal });
        const next = await response.json() as HistoryResult & { error?: string };
        if (!response.ok) throw new Error(next.error || 'Historical data is temporarily unavailable.');
        if (id === requestId.current) setResult(next);
      } catch (error) { if (!controller.signal.aborted && id === requestId.current) { setResult(null); setError(error instanceof Error ? error.message : 'Historical data is temporarily unavailable.'); } }
      finally { if (id === requestId.current && !controller.signal.aborted) setLoading(false); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [symbol, strategy, asOf, revision]);
  const current = result && result.symbol === symbol && result.strategy.id === strategy && !loading;
  const historical = current && result.asOf < result.latestAvailableDate;
  const dates = result?.bars.map(bar => bar.date).filter(date => date >= result.earliestAvailableDate) || [];
  const index = result ? dates.indexOf(result.asOf) : -1;
  return <div className="strategies-layout" data-testid="strategies-view">
    <section className="panel strategy-main">
      <div className="panel-heading"><span className="inline"><CalendarDays size={17} /><strong>Historical market lab</strong></span><span className="small muted">Real Yahoo observations</span></div>
      <div className="strategy-controls"><label>Security<select aria-label="Historical security" value={symbol} onChange={event => { setSymbol(event.target.value); setAsOf(''); }}>{SYMBOLS.map(ticker => <option key={ticker}>{ticker}</option>)}</select></label><label>Strategy<select aria-label="Historical strategy" value={strategy} onChange={event => setStrategy(event.target.value as StrategyId)}>{STRATEGIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Through date<input aria-label="Historical as-of date" type="date" value={asOf || result?.asOf || ''} min={result?.earliestAvailableDate} max={result?.latestAvailableDate} onChange={event => setAsOf(event.target.value)} /></label></div>
      <div className="history-navigation"><button className="text-button" type="button" disabled={loading || index <= 0} onClick={() => setAsOf(dates[index - 1])}><ArrowLeft size={13} />Previous session</button><button className="text-button" type="button" disabled={loading || !asOf} onClick={() => setAsOf('')}>Latest available<ArrowRight size={13} /></button></div>
      {loading ? <div className="history-loading" role="status"><Loader2 size={22} className="spin" /><p>Loading actual Yahoo daily prices…</p></div> : error ? <div className="empty-state" role="alert"><h3>Historical data unavailable.</h3><p>{error}</p><button className="button secondary" type="button" onClick={() => setRevision(value => value + 1)}>Try again<RefreshCw size={14} /></button></div> : current ? <>
        <div className="history-title"><h2>{result.strategy.name}</h2><p>{result.strategy.description}</p></div>
        <HistoryChart key={`${symbol}-${strategy}-${result.asOf}`} result={result} />
        <div className="strategy-metrics" aria-label="Historical strategy results"><div><span>Strategy return</span><strong className={result.metrics.totalReturnPct >= 0 ? 'positive' : 'negative'}>{pct(result.metrics.totalReturnPct)}</strong></div><div><span>Buy & hold</span><strong>{pct(result.metrics.benchmarkReturnPct)}</strong></div><div><span>Maximum drawdown</span><strong>{pct(result.metrics.maxDrawdownPct)}</strong></div><div><span>Trades · cost per trade</span><strong>{result.metrics.trades} <small>· {result.metrics.transactionCostBps} bps</small></strong></div></div>
        <div className="history-methodology"><h3>How this was calculated</h3><ul>{result.methodology.map(line => <li key={line}>{line}</li>)}</ul><p>Historical strategy results are hypothetical. They are not paper fills or a forecast of future returns. Current Yahoo history may include later corporate-action adjustments.</p><a className="text-button" href={result.evidence.url} target="_blank" rel="noreferrer">Inspect Yahoo source<ExternalLink size={13} /></a></div>
      </> : null}
    </section>
    <aside className="strategy-action"><span className="strategy-eyebrow"><BookOpen size={15} />From history to a decision</span><h2>{historical ? 'You are viewing an earlier date.' : 'Review the rule before the order.'}</h2><p>{historical ? `The analysis stops at ${displayDate(result.asOf)}. Use the latest available session before creating current-order research.` : 'Create a cited memo from the latest completed Yahoo sessions. Then review its evidence, proposed size, and mandate checks.'}</p>{current && <div className="strategy-signal"><span>Rule observation · {displayDate(result.signal.date)}</span><strong>{result.signal.side === 'buy' ? 'Long signal' : 'Hold / remain in cash'}</strong><p>{result.signal.explanation}</p></div>}
      <button type="button" className="button primary full-width" disabled={!!busy || !current || !!historical} onClick={() => void run({ action: 'strategy_research', symbol, strategyId: strategy }, 'Building a cited strategy memo from Yahoo history…')}>{busy === 'strategy_research' ? <Loader2 className="spin" size={15} /> : <ArrowRight size={15} />}Create strategy memo</button>
      {historical && <button type="button" className="button secondary full-width" onClick={() => setAsOf('')}>Return to latest session</button>}
      <p className="helper">A strategy signal is an input to your review. Every order still requires valid evidence and permission. Closed-market orders can be approved and explicitly queued for a later market session.</p>
    </aside>
  </div>;
}
