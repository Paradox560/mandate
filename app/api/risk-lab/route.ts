import {env} from 'cloudflare:workers';
import {ZodError} from 'zod';
import {checkOrigin, requestUser} from '../../../lib/request-auth';
import {riskLabSnapshot, runRiskCase} from '../../../lib/risk-lab';

const headers = {'Cache-Control': 'no-store'};

export async function GET(request: Request) {
  try {
    const workspace = new URL(request.url).searchParams.get('workspace') || 'desk';
    if (workspace !== 'desk' && workspace !== 'demo') return Response.json({error: 'Unknown workspace.'}, {status: 400, headers});
    return Response.json(await riskLabSnapshot(await requestUser(request), env, workspace), {headers});
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : 'Risk lab is unavailable.'}, {status: 503, headers});
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requestUser(request);
    const body = await request.text();
    if (body.length > 1000) throw new Error('Risk lab accepts one named case per request.');
    return Response.json(await runRiskCase(user, env, JSON.parse(body)), {headers});
  } catch (error) {
    const message = error instanceof ZodError ? 'Choose one supported risk case and workspace.'
      : error instanceof Error ? error.message : 'Risk run failed. No order execution was attempted.';
    return Response.json({error: message}, {status: 400, headers});
  }
}
