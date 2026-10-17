import { env } from 'cloudflare:workers';
import { act } from '../../../lib/desk';
import { checkOrigin, requestUser } from '../../../lib/request-auth';
import { ZodError } from 'zod';
export async function POST(request:Request){
  try{checkOrigin(request);const user=await requestUser(request);const text=await request.text();if(text.length>12000)throw new Error('Request is too large.');return Response.json(await act(user,env,JSON.parse(text)),{headers:{'Cache-Control':'no-store'}});}
  catch(error){const message=error instanceof ZodError?'Invalid request. Check the order fields and retry.':error instanceof Error?error.message:'Action failed. No order was executed.';return Response.json({error:message},{status:400,headers:{'Cache-Control':'no-store'}});}
}
