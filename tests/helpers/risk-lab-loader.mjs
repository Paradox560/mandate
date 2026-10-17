export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL?.endsWith('/lib/risk-lab.ts')) {
    const sources = {
      '../db/risk-lab': 'export async function listRiskRuns(key){return globalThis.__riskTest.list(key)}; export async function saveRiskRun(key,run){return globalThis.__riskTest.save(key,run)};',
      '../db/store': 'export async function readState(key){return globalThis.__riskTest.read(key)};',
      './market-data': 'export async function getMarketData(){return globalThis.__riskTest.market()};',
      './strategies': 'export async function getHistoricalStrategy(){return globalThis.__riskTest.history()};',
    };
    if (sources[specifier]) return {url: `data:text/javascript,${encodeURIComponent(sources[specifier])}`, shortCircuit: true};
  }
  if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
}
