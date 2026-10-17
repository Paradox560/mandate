import {getHistoricalData, validHistoryDate, type HistoricalBar, type HistoricalData} from './history-data.ts';
import type {Evidence, SymbolCode} from './types.ts';

export const STRATEGIES = [
  {id: 'buy-and-hold', name: 'Buy and hold', description: 'Hold the stock after the common 50-session observation period.'},
  {id: 'sma-20-50', name: '20 / 50 day trend', description: 'Hold when the 20-session average is above the 50-session average; otherwise hold cash.'},
  {id: 'momentum-20', name: '20 day momentum', description: 'Hold when the adjusted close is above its level 20 sessions earlier; otherwise hold cash.'},
] as const;
export type StrategyId = typeof STRATEGIES[number]['id'];
export type StrategyPoint = {date: string; price: number; adjustedClose: number; equity: number; benchmarkEquity: number; drawdownPct: number; position: 'long' | 'cash'; trade: 'buy' | 'sell' | null};
export type StrategyMetrics = {initialCapital: number; endingEquity: number; totalReturnPct: number; benchmarkReturnPct: number; maxDrawdownPct: number; trades: number; transactionCostBps: number};
export type HistoricalStrategy = {
  symbol: SymbolCode;
  provider: 'yahoo';
  strategy: typeof STRATEGIES[number];
  asOf: string;
  latestAvailableDate: string;
  earliestAvailableDate: string;
  fetchedAt: string;
  bars: HistoricalBar[];
  points: StrategyPoint[];
  metrics: StrategyMetrics;
  signal: {side: 'buy' | 'hold'; date: string; explanation: string};
  evidence: Evidence;
  methodology: string[];
};
const INITIAL_CAPITAL = 10_000;
const WARMUP_SESSIONS = 50;
const TRANSACTION_COST_BPS = 10;
const FEE = TRANSACTION_COST_BPS / 10_000;
const round = (value: number) => Math.round(value * 100) / 100;
export function isStrategyId(value: string): value is StrategyId {return STRATEGIES.some(strategy => strategy.id === value);}
function mean(bars: HistoricalBar[], index: number, length: number): number {
  return bars.slice(index + 1 - length, index + 1).reduce((sum, bar) => sum + bar.adjustedClose, 0) / length;
}
function exposureAt(bars: HistoricalBar[], index: number, strategy: StrategyId): boolean {
  if (index < WARMUP_SESSIONS - 1) return false;
  if (strategy === 'buy-and-hold') return true;
  if (strategy === 'sma-20-50') return mean(bars, index, 20) > mean(bars, index, 50);
  return bars[index].adjustedClose > bars[index - 20].adjustedClose;
}

/** Signals use completed session t, and change exposure only at observed session t+1's open. */
export function simulateHistoricalStrategy(data: HistoricalData, strategyId: StrategyId = 'sma-20-50', requestedDate?: string): HistoricalStrategy {
  if (!isStrategyId(strategyId)) throw new Error('Unknown historical strategy.');
  if (requestedDate !== undefined && !validHistoryDate(requestedDate)) throw new Error('History date must be a valid YYYY-MM-DD date.');
  const strategy = STRATEGIES.find(item => item.id === strategyId)!;
  const latestAvailableDate = data.bars.at(-1)?.date;
  if (!latestAvailableDate || data.bars.length <= WARMUP_SESSIONS) throw new Error('At least 51 complete Yahoo daily sessions are required.');
  if (requestedDate && requestedDate > latestAvailableDate) throw new Error(`History is available through ${latestAvailableDate}.`);
  const bars = data.bars.filter(bar => !requestedDate || bar.date <= requestedDate).map(bar => ({...bar}));
  if (bars.length <= WARMUP_SESSIONS) throw new Error(`Choose a session on or after ${data.bars[WARMUP_SESSIONS].date} to include the 50-session observation period.`);
  const last = bars.at(-1)!;
  let cash = INITIAL_CAPITAL;
  let units = 0;
  let trades = 0;
  let peak = INITIAL_CAPITAL;
  let maxDrawdownPct = 0;
  const first = bars[WARMUP_SESSIONS];
  // These are adjusted-value units, not executable share quantities. Raw opening prices remain in bars.
  const benchmarkUnits = INITIAL_CAPITAL / ((first.open * first.adjustedClose / first.close) * (1 + FEE));
  const points: StrategyPoint[] = [];
  for (let index = WARMUP_SESSIONS; index < bars.length; index++) {
    const bar = bars[index];
    const wantsLong = exposureAt(bars, index - 1, strategyId);
    const adjustedOpen = bar.open * bar.adjustedClose / bar.close;
    let trade: StrategyPoint['trade'] = null;
    if (wantsLong && units === 0) {
      units = cash / (adjustedOpen * (1 + FEE));
      cash = 0;
      trades++;
      trade = 'buy';
    } else if (!wantsLong && units > 0) {
      cash = units * adjustedOpen * (1 - FEE);
      units = 0;
      trades++;
      trade = 'sell';
    }
    const equity = cash + units * bar.adjustedClose;
    if (!Number.isFinite(equity) || equity <= 0) throw new Error('Historical simulation produced an invalid portfolio value.');
    peak = Math.max(peak, equity);
    const drawdownPct = 100 * (equity / peak - 1);
    maxDrawdownPct = Math.min(maxDrawdownPct, drawdownPct);
    points.push({date: bar.date, price: bar.close, adjustedClose: bar.adjustedClose, equity: round(equity),
      benchmarkEquity: round(benchmarkUnits * bar.adjustedClose), drawdownPct: round(drawdownPct), position: units > 0 ? 'long' : 'cash', trade});
  }
  const endingEquity = cash + units * last.adjustedClose;
  const metrics: StrategyMetrics = {
    initialCapital: INITIAL_CAPITAL, endingEquity: round(endingEquity), totalReturnPct: round(100 * (endingEquity / INITIAL_CAPITAL - 1)),
    benchmarkReturnPct: round(100 * (benchmarkUnits * last.adjustedClose / INITIAL_CAPITAL - 1)), maxDrawdownPct: round(maxDrawdownPct),
    trades, transactionCostBps: TRANSACTION_COST_BPS,
  };
  const latestIndex = bars.length - 1;
  const sma20 = mean(bars, latestIndex, 20);
  const sma50 = mean(bars, latestIndex, 50);
  const momentum20Pct = 100 * (last.adjustedClose / bars[latestIndex - 20].adjustedClose - 1);
  const side = exposureAt(bars, latestIndex, strategyId) ? 'buy' : 'hold';
  const explanation = strategyId === 'buy-and-hold'
    ? `The buy-and-hold rule maintains long exposure after the observation period; the latest completed session is ${last.date}.`
    : strategyId === 'sma-20-50'
      ? `At ${last.date}, the 20-session adjusted-close average is $${sma20.toFixed(2)} and the 50-session average is $${sma50.toFixed(2)}. The rule calls for ${side === 'buy' ? 'long exposure' : 'cash'}.`
      : `At ${last.date}, the adjusted close changed ${momentum20Pct.toFixed(2)}% over 20 sessions. The rule calls for ${side === 'buy' ? 'long exposure' : 'cash'}.`;
  const methodology = [
    'Actual Yahoo Finance daily observations over the requested two-year range. Missing sessions are omitted; unfinished current-session bars are excluded.',
    'Every rule has the same 50-session observation period. Signals use completed closes and execute at the next observed session open. No current-session closing price is used to decide its opening trade.',
    'Indicators use Yahoo adjusted close. Simulation opening values equal observed open × adjusted close / close, so the adjusted-value return series accounts for provider split and dividend adjustments. Raw OHLC remains available for inspection.',
    'Long or cash, no leverage, fractional adjusted-value units, $10,000 starting capital, and 10 basis points (0.10%) cost on each entry or exit. Cash earns no interest; taxes, borrow costs, and market impact are excluded. Final holdings are marked to close without an assumed liquidation.',
    'A retrospective model using today’s provider history, which can be revised. This is not an archived point-in-time dataset or a prediction of future returns. Actual queued paper orders use current Yahoo quotes, whole shares, permission checks, and separate approval.',
  ];
  const evidence: Evidence = {
    id: `yahoo-history-${data.symbol}-${last.date}-${strategyId}`, symbol: data.symbol,
    title: `${data.symbol} · ${strategy.name} · Yahoo history through ${last.date}`,
    url: data.sourceUrl, publishedAt: last.timestamp, period: `${bars[0].date} to ${last.date}`,
    text: `Yahoo Finance daily history for ${data.symbol} contains ${bars.length} completed observed sessions from ${bars[0].date} through ${last.date}. The last reported close is $${last.close.toFixed(2)} and adjusted close is $${last.adjustedClose.toFixed(2)}. ${explanation} The retrospective ${strategy.name} model returned ${metrics.totalReturnPct.toFixed(2)}% after the stated 0.10% per-trade cost, with a maximum drawdown of ${metrics.maxDrawdownPct.toFixed(2)}%. These are historical model results, not a forecast.`,
    metrics: {close: last.close, adjustedClose: last.adjustedClose, sma20, sma50, momentum20Pct, totalReturnPct: metrics.totalReturnPct, maxDrawdownPct: metrics.maxDrawdownPct, sessions: bars.length},
    provenance: {provider: 'yahoo', kind: 'historical-strategy', symbol: data.symbol, strategyId, asOf: last.date, latestAvailableDate, retrievedAt: data.fetchedAt},
  };
  return {symbol: data.symbol, provider: 'yahoo', strategy, asOf: last.date, latestAvailableDate, earliestAvailableDate: data.bars[WARMUP_SESSIONS].date,
    fetchedAt: data.fetchedAt, bars, points, metrics, signal: {side, date: last.date, explanation}, evidence, methodology};
}

export async function getHistoricalStrategy(symbol: SymbolCode, strategyId: StrategyId = 'sma-20-50', asOf?: string): Promise<HistoricalStrategy> {
  return simulateHistoricalStrategy(await getHistoricalData(symbol), strategyId, asOf);
}
