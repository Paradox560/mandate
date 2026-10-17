import type { DeskState, Evidence } from './types.ts';

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

/** Paper capital is virtual; all later marks and fills must come from Yahoo. */
export const INITIAL_PAPER_CASH = 250_000;
export function seededState(now = Date.now()): DeskState {
  return {
    version: 1, portfolioVersion: 1, cash: INITIAL_PAPER_CASH, initialCash: INITIAL_PAPER_CASH,
    positions: [], research: [], orders: [], audit: [], evidence: [], yahooMigrationVersion: 1,
    policy: {version:1,maxOrderValue:10_000,maxPositionWeight:.3,approvalAbove:5_000,
      allowedSymbols:['NVDA','MSFT','AAPL','GOOGL','AMZN','META'],maxQuoteAgeSeconds:120,
      maxEvidenceAgeDays:45,requireApproval:true},
    createdAt:new Date(now).toISOString(),
    integration:{prismLastStatus:'Not contacted',knowledgeBaseSynced:false},
  };
}
