import {env} from 'cloudflare:workers';
import type {RiskRun} from '../lib/risk-lab-types';

function database() {
  if (!env.DB) throw new Error('Risk lab database is unavailable.');
  return env.DB;
}

/** The caller derives this workspace key from authenticated identity, never a request field. */
export async function saveRiskRun(workspaceId: string, run: RiskRun): Promise<void> {
  await database().prepare('INSERT INTO risk_runs(id, workspace_id, created_at, payload) VALUES(?, ?, ?, ?)')
    .bind(run.id, workspaceId, run.createdAt, JSON.stringify(run)).run();
}

export async function listRiskRuns(workspaceId: string): Promise<{runs: RiskRun[]; totalRuns: number}> {
  const [rows, count] = await Promise.all([
    database().prepare('SELECT payload FROM risk_runs WHERE workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT 50')
      .bind(workspaceId).all<{payload: string}>(),
    database().prepare('SELECT COUNT(*) AS total FROM risk_runs WHERE workspace_id = ?')
      .bind(workspaceId).first<{total: number}>(),
  ]);
  return {runs: rows.results.map(row => JSON.parse(row.payload) as RiskRun), totalRuns: count?.total ?? 0};
}
