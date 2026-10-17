import { env } from 'cloudflare:workers';

const ID = 'yahoo-paper-queue';
const LEASE_MS = 180_000;
type RunnerRow = {lease_until:number;last_started_at:string|null;last_completed_at:string|null;last_result:string|null};
function db(){if(!env.DB)throw new Error('Queue storage is unavailable.');return env.DB;}

export async function acquireQueueRun(now=Date.now()):Promise<string|null>{
  await db().prepare('INSERT OR IGNORE INTO queue_runner(id) VALUES(?)').bind(ID).run();
  const token=crypto.randomUUID();
  const result=await db().prepare('UPDATE queue_runner SET lease_token=?, lease_until=?, last_started_at=? WHERE id=? AND lease_until<=?')
    .bind(token,now+LEASE_MS,new Date(now).toISOString(),ID,now).run();
  return result.meta.changes===1?token:null;
}

export async function finishQueueRun(token:string,result:Record<string,unknown>):Promise<void>{
  await db().prepare('UPDATE queue_runner SET lease_token=NULL, lease_until=0, last_completed_at=?, last_result=? WHERE id=? AND lease_token=?')
    .bind(new Date().toISOString(),JSON.stringify(result),ID,token).run();
}

export async function queueRunStatus(){
  const row=await db().prepare('SELECT lease_until,last_started_at,last_completed_at,last_result FROM queue_runner WHERE id=?').bind(ID).first<RunnerRow>();
  return {
    mode:'paper' as const,provider:'Yahoo Finance',
    running:!!row&&row.lease_until>Date.now(),
    lastStartedAt:row?.last_started_at??null,lastCompletedAt:row?.last_completed_at??null,
    lastResult:row?.last_result?JSON.parse(row.last_result) as Record<string,unknown>:null,
  };
}
