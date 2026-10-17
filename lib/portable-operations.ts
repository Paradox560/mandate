import {env} from 'cloudflare:workers';
import {portableRuntime,checkAccessCode} from './portable-auth';
import {reservePortableBudget} from './portable-budget';
/** Sites service auth is handled by its private edge. Portable hosting requires its own scheduler secret. */
export async function portableQueueAccess(request:Request):Promise<Response|null>{
  if(!portableRuntime())return null;
  const secret=process.env.MANDATE_QUEUE_SECRET||'';
  const headers={'Cache-Control':'no-store'};
  if(secret.length<32)return Response.json({error:'Background queue processing is disabled. Configure MANDATE_QUEUE_SECRET and a scheduler on this host. The signed-in browser can still process its own queue.'},{status:503,headers});
  const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]||'';
  if(!token||!await checkAccessCode(token,secret))return Response.json({error:'A valid scheduler credential is required.'},{status:401,headers});
  return null;
}
/** Cap interactive analysis attempts, including when a portable demo allows open sessions. */
export async function consumePortableBudget(userId:string):Promise<void>{
  if(!portableRuntime())return;
  const db=env.DB;if(!db)throw new Error('Usage accounting is unavailable.');
  await reservePortableBudget(db,userId,process.env.MANDATE_DAILY_RUN_LIMIT);
}
