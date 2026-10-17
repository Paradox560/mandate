import type {Quote,SymbolCode} from '../../lib/types.ts';

const INSTRUMENTS: { symbol: SymbolCode; name: string; sector: string; baseline: number; phase: number }[] = [
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Information Technology', baseline: 180.45, phase: 0.3 },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Information Technology', baseline: 512.22, phase: 1.1 },
  { symbol: 'AAPL', name: 'Apple', sector: 'Information Technology', baseline: 232.14, phase: 2.4 },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Communication Services', baseline: 212.38, phase: 3.3 },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary', baseline: 229.70, phase: 4.6 },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Communication Services', baseline: 738.40, phase: 5.2 },
];

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const REPLAY_EPOCH = Date.parse('2025-08-29T20:00:00Z');
const round = (value: number) => Math.round(value * 100) / 100;

function syntheticPrice(baseline: number, phase: number, now: number): number {
  const minutes = (now - REPLAY_EPOCH) / MINUTE;
  // Bounded, repeatable motion with no random returns or performance history.
  const variation = Math.sin(minutes / 137 + phase) * 0.0055
    + Math.sin(minutes / 19 + phase * 1.7) * 0.0018;
  return round(baseline * (1 + variation));
}

/** Synthetic quotes stamped with their generation time; never exchange prices. */
export function marketSnapshot(now = Date.now()): Quote[] {
  const timestamp = new Date(now).toISOString();
  // The synthetic day closes at UTC midnight, independent of exchange sessions.
  const previousCloseTime = Math.floor(now / DAY) * DAY - MINUTE;
  return INSTRUMENTS.map(({ symbol, name, sector, baseline, phase }) => {
    const price = syntheticPrice(baseline, phase, now);
    const previousClose = syntheticPrice(baseline, phase, previousCloseTime);
    return {
      symbol,
      name,
      sector,
      price,
      previousClose,
      change: round(((price - previousClose) / previousClose) * 100),
      history: Array.from({ length: 96 }, (_, index) => syntheticPrice(baseline, phase, now - (95 - index) * 5 * MINUTE)),
      timestamp,
    };
  });
}

