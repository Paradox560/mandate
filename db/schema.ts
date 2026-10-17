import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{id:text('id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(1)});
export const queueRunner=sqliteTable('queue_runner',{
  id:text('id').primaryKey(),
  leaseToken:text('lease_token'),
  leaseUntil:integer('lease_until').notNull().default(0),
  lastStartedAt:text('last_started_at'),
  lastCompletedAt:text('last_completed_at'),
  lastResult:text('last_result'),
});
export const riskRuns=sqliteTable('risk_runs',{
  id:text('id').primaryKey(),
  workspaceId:text('workspace_id').notNull(),
  createdAt:text('created_at').notNull(),
  payload:text('payload').notNull(),
},table=>[index('risk_runs_workspace_created').on(table.workspaceId,table.createdAt)]);
