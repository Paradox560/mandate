import { env } from 'cloudflare:workers';
import { snapshot } from '../../../lib/desk';
import { requestUser } from '../../../lib/request-auth';
export async function GET(request:Request){try{const mode=new URL(request.url).searchParams.get('marketMode')??'yahoo';if(mode!=='yahoo'&&mode!=='replay')return Response.json({error:'Unknown market data source.'},{status:400});return Response.json(await snapshot(await requestUser(request),env,mode),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({error:error instanceof Error?error.message:'Workspace unavailable.'},{status:503});}}
