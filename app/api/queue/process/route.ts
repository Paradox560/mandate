import { env } from 'cloudflare:workers';
import { processAllQueuedOrders } from '../../../../lib/desk';
import { acquireQueueRun, finishQueueRun, queueRunStatus } from '../../../../db/queue-runs';

/**
 * Owner-private Sites service endpoint. Sites dispatch authenticates the service
 * credential before this handler. It does not impersonate a visitor. The only
 * authority here is each persisted order's explicit, bounded queue consent.
 * No user IDs, order details, approvals or policy overrides are accepted.
 */
export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origin is not authorized.'},{status:403});
  if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Origin is not authorized.'},{status:403});
  if((await request.text()).trim())return Response.json({error:'The queue runner does not accept parameters.'},{status:400});
  let token:string|null=null;
  try{
    token=await acquireQueueRun();
    if(!token)return Response.json({status:'already_running',...await queueRunStatus()},{status:202,headers:{'Cache-Control':'no-store'}});
    const result=await processAllQueuedOrders(env);
    await finishQueueRun(token,{status:'completed',...result});
    return Response.json({status:'completed',...await queueRunStatus()},{headers:{'Cache-Control':'no-store'}});
  }catch{
    if(token)await finishQueueRun(token,{status:'error',message:'Queue processing did not complete. Existing authorizations and ledger checks remain in force.'}).catch(()=>{});
    return Response.json({error:'Queue processing is unavailable; retry later. No unchecked fill is permitted.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}

export async function GET(){
  return Response.json({
    purpose:'Process only explicitly queued Yahoo-priced paper orders. No real broker is connected.',
    access:'Owner-private Sites service access. Obtain the current Site service credential via get_site; never save it in source or schedules.',
    run:{method:'POST',path:'/api/queue/process',body:'empty'},
    readback:{method:'GET',path:'/api/queue/status'},
    behavior:'Closed, unknown or stale quotes remain waiting. Open-session fresh quotes must pass authorization, price drift, mandate, portfolio, evidence and PRISM checks. Repeated requests cannot create duplicate fills.',
  },{headers:{'Cache-Control':'no-store'}});
}
