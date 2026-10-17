import {portableQueueAccess} from '../../../../lib/portable-operations';
import { queueRunStatus } from '../../../../db/queue-runs';

// Aggregate operational status only; no workspace IDs, positions or order data.
export async function GET(request:Request){
  const denied=await portableQueueAccess(request);if(denied)return denied;
  try{return Response.json(await queueRunStatus(),{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'Queue runner status is unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
