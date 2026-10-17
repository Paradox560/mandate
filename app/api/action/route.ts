import {consumePortableBudget} from '../../../lib/portable-operations';
import { env } from 'cloudflare:workers';
import { act } from '../../../lib/desk';
import { authErrorResponse, checkOrigin, requestUser } from '../../../lib/request-auth';
import { ZodError } from 'zod';
export async function POST(request:Request){
  try{checkOrigin(request);const user=await requestUser(request);const text=await request.text();if(text.length>12000)throw new Error('Request is too large.');const body=JSON.parse(text);if(['research','test_connections','sync_sources'].includes(body.action))await consumePortableBudget(user);return Response.json(await act(user,env,body),{headers:{'Cache-Control':'no-store'}});}
  catch(error){const auth=authErrorResponse(error);if(auth)return auth;const message=error instanceof ZodError?'Invalid request. Check the order fields and retry.':error instanceof Error?error.message:'Action failed. No order was executed.';return Response.json({error:message},{status:400,headers:{'Cache-Control':'no-store'}});}
}
