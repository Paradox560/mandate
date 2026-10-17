import type { DeskState, Evidence, Quote, Research, SymbolCode } from './types.ts';

/** Verified issuer disclosures. These are historical facts, never live market data. */
export const EVIDENCE: Evidence[] = [
  {
    id: 'AAPL-FY25-Q3-REVENUE',
    symbol: 'AAPL',
    title: 'Apple reports third quarter results',
    url: 'https://www.apple.com/newsroom/2025/07/apple-reports-third-quarter-results/',
    publishedAt: '2025-07-31',
    period: 'Fiscal Q3 2025, ended June 28, 2025',
    text: 'Apple reported fiscal Q3 2025 revenue of $94.0 billion, 10% above the prior-year quarter, and diluted EPS of $1.57, up 12%.',
    metrics: { revenueBillions: 94, revenueGrowthPercent: 10, dilutedEps: 1.57, dilutedEpsGrowthPercent: 12 },
  },
  {
    id: 'MSFT-FY25-Q4-REVENUE',
    symbol: 'MSFT',
    title: 'Microsoft FY25 Q4 earnings release',
    url: 'https://www.microsoft.com/en-us/Investor/earnings/FY-2025-Q4/press-release-webcast',
    publishedAt: '2025-07-30',
    period: 'Fiscal Q4 2025, ended June 30, 2025',
    text: 'Microsoft reported fiscal Q4 2025 revenue of $76.4 billion, an 18% year-over-year increase, and operating income of $34.3 billion, up 23%.',
    metrics: { revenueBillions: 76.4, revenueGrowthPercent: 18, operatingIncomeBillions: 34.3, operatingIncomeGrowthPercent: 23 },
  },
  {
    id: 'MSFT-FY25-AZURE',
    symbol: 'MSFT',
    title: 'Microsoft FY25 Q4 earnings release — Azure disclosure',
    url: 'https://www.microsoft.com/en-us/Investor/earnings/FY-2025-Q4/press-release-webcast',
    publishedAt: '2025-07-30',
    period: 'Fiscal year 2025, ended June 30, 2025',
    text: 'Microsoft disclosed that Azure revenue exceeded $75 billion in fiscal 2025, increasing 34% from the preceding fiscal year.',
    metrics: { azureRevenueBillionsLowerBound: 75, azureRevenueGrowthPercent: 34 },
  },
  {
    id: 'NVDA-FY26-Q2-DATACENTER',
    symbol: 'NVDA',
    title: 'NVIDIA announces second quarter fiscal 2026 results',
    url: 'https://investor.nvidia.com/news/press-release-details/2025/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2026/default.aspx',
    publishedAt: '2025-08-27',
    period: 'Fiscal Q2 2026, ended July 27, 2025',
    text: 'NVIDIA reported fiscal Q2 2026 revenue of $46.7 billion, up 56% year over year. Data Center contributed $41.1 billion and also grew 56%.',
    metrics: { revenueBillions: 46.7, revenueGrowthPercent: 56, dataCenterRevenueBillions: 41.1, dataCenterRevenueGrowthPercent: 56 },
  },
  {
    id: 'NVDA-FY26-Q2-CHINA',
    symbol: 'NVDA',
    title: 'NVIDIA fiscal Q2 2026 results — H20 sales and outlook',
    url: 'https://investor.nvidia.com/news/press-release-details/2025/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2026/default.aspx',
    publishedAt: '2025-08-27',
    period: 'Fiscal Q2 2026 results and Q3 2026 outlook, issued August 27, 2025',
    text: 'NVIDIA reported no H20 sales to customers based in China during fiscal Q2 2026. Its forecast for the following quarter assumed no H20 shipments to China.',
    metrics: { h20ChinaSalesBillions: 0 },
  },
];

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

/** A demonstrative ledger, initialized now, with a separate historical evidence clock. */
export function seededState(now = Date.now()): DeskState {
  const createdAt = new Date(now).toISOString();
  const market = marketSnapshot(now);
  const nvda = market.find((quote) => quote.symbol === 'NVDA')!;
  const cash = 126_579.40;
  const positions = [
    { symbol: 'MSFT', shares: 100, costBasis: 480 },
    { symbol: 'NVDA', shares: 220, costBasis: 156 },
    { symbol: 'AAPL', shares: 140, costBasis: 218 },
  ];
  const nav = cash + positions.reduce((total, position) => total + position.shares * market.find((quote) => quote.symbol === position.symbol)!.price, 0);
  const research: Research[] = [
    {
      id: 'seed-research-nvda',
      symbol: 'NVDA',
      title: 'NVIDIA · historical earnings review',
      summary: 'Sample research for the August 29, 2025 evidence replay. NVIDIA reported growth in revenue and Data Center sales, alongside a disclosed interruption in H20 sales to China. This fixture was prepared without model inference.',
      claims: [
        { text: EVIDENCE.find((evidence) => evidence.id === 'NVDA-FY26-Q2-DATACENTER')!.text, evidenceIds: ['NVDA-FY26-Q2-DATACENTER'], supported: true },
        { text: EVIDENCE.find((evidence) => evidence.id === 'NVDA-FY26-Q2-CHINA')!.text, evidenceIds: ['NVDA-FY26-Q2-CHINA'], supported: true },
      ],
      risks: ['The H20 disclosure exposes a geographic and product-specific constraint.', 'These August 2025 disclosures do not establish current valuation or future returns.'],
      evidenceIds: ['NVDA-FY26-Q2-DATACENTER', 'NVDA-FY26-Q2-CHINA'],
      // Coverage of the fixture's cited claims, not investment confidence or performance.
      score: 100,
      createdAt,
      mode: 'sample',
      model: 'sample-fixture · no model call',
      recommendation: { side: 'buy', quantity: 20, rationale: 'Demonstration quantity for an evidence-linked paper proposal; the disclosures alone do not justify an investment decision.' },
      traceId: 'seed-trace-nvda-research',
    },
    {
      id: 'seed-research-msft',
      symbol: 'MSFT',
      title: 'Microsoft · historical cloud review',
      summary: 'Sample research for the August 29, 2025 evidence replay. Microsoft reported quarterly revenue and operating-income growth and disclosed annual Azure revenue. This fixture was prepared without model inference.',
      claims: [
        { text: EVIDENCE.find((evidence) => evidence.id === 'MSFT-FY25-Q4-REVENUE')!.text, evidenceIds: ['MSFT-FY25-Q4-REVENUE'], supported: true },
        { text: EVIDENCE.find((evidence) => evidence.id === 'MSFT-FY25-AZURE')!.text, evidenceIds: ['MSFT-FY25-AZURE'], supported: true },
      ],
      risks: ['Reported growth does not establish whether the synthetic share price represents fair value.', 'The evidence is dated July 2025 and is only fresh within the explicit historical replay.'],
      evidenceIds: ['MSFT-FY25-Q4-REVENUE', 'MSFT-FY25-AZURE'],
      score: 100,
      createdAt,
      mode: 'sample',
      model: 'sample-fixture · no model call',
      recommendation: { side: 'buy', quantity: 10, rationale: 'Demonstration quantity for reviewing an order above the approval threshold; no live investment recommendation.' },
      traceId: 'seed-trace-msft-research',
    },
  ];
  const quantity = 100;
  const notional = round(quantity * nvda.price);
  const weight = ((220 + quantity) * nvda.price) / nav;

  return {
    version: 1,
    portfolioVersion: 1,
    cash,
    positions,
    research,
    orders: [
      {
        id: 'seed-order-nvda-oversized',
        researchId: 'seed-research-nvda',
        symbol: 'NVDA',
        side: 'buy',
        quantity,
        price: nvda.price,
        notional,
        status: 'blocked',
        checks: [
          { key: 'allowed_symbol', label: 'Allowed instrument', passed: true, reason: 'NVDA is on the six-symbol paper-trading allowlist.' },
          { key: 'max_order_value', label: 'Order value limit', passed: false, reason: `Sample proposal is $${notional.toFixed(2)}; the mandate permits at most $10,000 per order.` },
          { key: 'max_position_weight', label: 'Position concentration', passed: weight <= 0.3, reason: `Projected NVDA weight is ${(weight * 100).toFixed(1)}% against a 30% limit.` },
          { key: 'available_cash', label: 'Available cash', passed: notional <= cash, reason: 'The sample cash balance covers this proposal, but cash alone does not authorize it.' },
          { key: 'evidence_freshness', label: 'Historical evidence freshness', passed: true, reason: 'The August 27, 2025 source is two days old at the explicit August 29, 2025 replay date.' },
          { key: 'approval', label: 'Human authorization', passed: false, reason: 'This seeded blocked example has no approval and no fill.' },
        ],
        evidenceIds: ['NVDA-FY26-Q2-DATACENTER', 'NVDA-FY26-Q2-CHINA'],
        createdAt,
        traceId: 'seed-trace-nvda-oversized',
        fingerprint: 'seed-unapproved-oversized-example',
        scenario: 'Sample oversized order · no execution',
      },
    ],
    audit: [
      {
        id: 'seed-audit-initialized',
        time: createdAt,
        agent: 'Sample setup',
        tool: 'seed_fixture',
        decision: 'allowed',
        message: 'Initialized a synthetic paper portfolio and two sample reports. Evidence replay date: 2025-08-29. No live model or PRISM call is represented by these seed events.',
        traceId: 'seed-trace-initialized',
        details: { sample: true, replayDate: '2025-08-29', syntheticMarket: true },
      },
      {
        id: 'seed-audit-nvda-blocked',
        time: createdAt,
        agent: 'Sample mandate check',
        tool: 'seed_blocked_order',
        decision: 'blocked',
        message: 'Sample oversized NVDA proposal blocked at the $10,000 order-value limit. No paper fill or portfolio mutation occurred.',
        traceId: 'seed-trace-nvda-oversized',
        orderId: 'seed-order-nvda-oversized',
        details: { sample: true, notional, maxOrderValue: 10_000, executed: false },
      },
    ],
    policy: {
      version: 1,
      maxOrderValue: 10_000,
      maxPositionWeight: 0.3,
      approvalAbove: 5_000,
      allowedSymbols: ['NVDA', 'MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META'],
      maxQuoteAgeSeconds: 30,
      maxEvidenceAgeDays: 45,
      requireApproval: true,
    },
    createdAt,
    integration: { prismLastStatus: 'Not contacted · seed data only', knowledgeBaseSynced: false },
  };
}
