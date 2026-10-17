import { env } from 'cloudflare:workers';
import type { DeskState } from '../lib/types';
import { seededState } from '../lib/fixtures';
import { migrateYahooState } from '../lib/yahoo-migration';

function db(){if(!env.DB)throw new Error('Database is unavailable. Apply the D1 migration before starting.');return env.DB;}

export async function readState(userId:string):Promise<DeskState>{
  let row=await db().prepare('SELECT payload, revision FROM workspaces WHERE id = ?').bind(userId).first<{payload:string;revision:number}>();
  if(!row){const state=seededState();await db().prepare('INSERT OR IGNORE INTO workspaces(id,payload,revision) VALUES(?,?,?)').bind(userId,JSON.stringify(state),state.version).run();row=await db().prepare('SELECT payload, revision FROM workspaces WHERE id = ?').bind(userId).first<{payload:string;revision:number}>();}
  if(!row)throw new Error('Workspace could not be initialized.');
  const state=JSON.parse(row.payload) as DeskState;state.version=row.revision;
  if(migrateYahooState(state)){
    try{await saveState(userId,state,row.revision);}catch{
      const current=await db().prepare('SELECT payload, revision FROM workspaces WHERE id = ?').bind(userId).first<{payload:string;revision:number}>();
      if(!current)throw new Error('Workspace disappeared during migration.');
      const fresh=JSON.parse(current.payload) as DeskState;fresh.version=current.revision;
      if(fresh.yahooMigrationVersion!==1)throw new Error('Workspace changed during Yahoo migration. Refresh and retry.');
      return fresh;
    }
  }
  return state;
}

// Compare-and-swap makes ledger fills and their audit events one atomic write.
// Concurrent approval/execution requests cannot silently overwrite each other.
export async function saveState(userId:string,state:DeskState,expected:number){
  state.version=expected+1;
  const result=await db().prepare('UPDATE workspaces SET payload=?, revision=? WHERE id=? AND revision=?').bind(JSON.stringify(state),state.version,userId,expected).run();
  if(result.meta.changes!==1)throw new Error('Workspace changed in another request. Refresh and retry; no trade was executed.');
}

/** Bounded background work scans only workspaces containing explicit queue consent. */
export async function listQueuedWorkspaceKeys(limit=100):Promise<string[]>{
  const result=await db().prepare("SELECT id FROM workspaces WHERE EXISTS (SELECT 1 FROM json_each(workspaces.payload, '$.orders') AS orders WHERE json_extract(orders.value, '$.status') = 'queued' AND json_extract(orders.value, '$.marketMode') = 'yahoo' AND json_extract(orders.value, '$.queue.fingerprint') IS NOT NULL) ORDER BY (SELECT MIN(COALESCE(json_extract(pending.value, '$.queue.lastCheckedAt'), json_extract(pending.value, '$.queue.queuedAt'), json_extract(pending.value, '$.createdAt'))) FROM json_each(workspaces.payload, '$.orders') AS pending WHERE json_extract(pending.value, '$.status') = 'queued'), id LIMIT ?").bind(Math.max(1,Math.min(100,limit))).all<{id:string}>();
  return result.results.map(row=>row.id);
}
