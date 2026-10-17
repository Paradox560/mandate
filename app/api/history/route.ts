import {isMarketSymbol} from '../../../lib/history-data';
import {getHistoricalStrategy, isStrategyId} from '../../../lib/strategies';
import {authErrorResponse, requestUser} from '../../../lib/request-auth';

export async function GET(request: Request) {
  try {
    await requestUser(request);
    const params = new URL(request.url).searchParams;
    const symbol = params.get('symbol') ?? 'MSFT';
    const strategy = params.get('strategy') ?? 'sma-20-50';
    const asOf = params.get('asOf') ?? undefined;
    if (!isMarketSymbol(symbol) || !isStrategyId(strategy)) return Response.json({error: 'Unknown historical symbol or strategy.'}, {status: 400});
    return Response.json(await getHistoricalStrategy(symbol, strategy, asOf), {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {const auth=authErrorResponse(error);if(auth)return auth;
    const message = error instanceof Error ? error.message : 'Historical data is unavailable.';
    const invalid = /History date|History is available|Choose a session|Unknown historical/.test(message);
    return Response.json({error: message}, {status: invalid ? 400 : 503, headers: {'Cache-Control': 'no-store'}});
  }
}
