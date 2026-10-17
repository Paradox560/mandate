import { env } from 'cloudflare:workers';
import { snapshot } from '../../../lib/desk';
import { requestUser } from '../../../lib/request-auth';
export async function GET(request:Request){try{return Response.json(await snapshot(await requestUser(request),env),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({error:error instanceof Error?error.message:'Workspace unavailable.'},{status:503});}}
