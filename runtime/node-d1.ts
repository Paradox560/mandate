import {createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {DatabaseSync, type SQLInputValue, type SQLOutputValue} from 'node:sqlite';

// Keep these immutable: the same schema is shipped in drizzle/0000–0002.
// Embedding the SQL makes the production Node bundle independent of its cwd.
const migrations = [
  {id: '0000_cute_true_believers', sql: `CREATE TABLE workspaces (
    id text PRIMARY KEY NOT NULL, payload text NOT NULL, revision integer DEFAULT 1 NOT NULL
  );`},
  {id: '0001_little_vindicator', sql: `CREATE TABLE queue_runner (
    id text PRIMARY KEY NOT NULL, lease_token text, lease_until integer DEFAULT 0 NOT NULL,
    last_started_at text, last_completed_at text, last_result text
  );`},
  {id: '0002_flawless_captain_marvel', sql: `CREATE TABLE risk_runs (
    id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, created_at text NOT NULL, payload text NOT NULL
  );
  CREATE INDEX risk_runs_workspace_created ON risk_runs (workspace_id, created_at);`},
] as const;

type Row = Record<string, SQLOutputValue>;
export type NodeD1Result<T = Row> = {
  success: true;
  results: T[];
  meta: {changes: number; last_row_id: number; duration: number};
};

function input(value: unknown): SQLInputValue {
  if (value === null || typeof value === 'string' || typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('SQLite bindings must be finite numbers, strings, null, or byte buffers.');
}

/** The D1 subset used by Mandate. Every mutation runs as one SQLite statement. */
export class NodeD1Statement {
  private readonly parameters: SQLInputValue[];
  private readonly owner: NodeD1Database;
  private readonly sql: string;

  constructor(owner: NodeD1Database, sql: string, parameters: unknown[] = []) {
    this.owner = owner;
    this.sql = sql;
    this.parameters = parameters.map(input);
  }

  bind(...values: unknown[]): NodeD1Statement {
    return new NodeD1Statement(this.owner, this.sql, values);
  }

  async first<T = Row>(column?: string): Promise<T | null> {
    const row = this.owner.connection().prepare(this.sql).get(...this.parameters);
    if (!row) return null;
    if (column !== undefined) {
      if (!Object.hasOwn(row, column)) throw new Error(`SQLite result has no column named ${column}.`);
      return row[column] as T;
    }
    return {...row} as T;
  }

  async all<T = Row>(): Promise<NodeD1Result<T>> {
    const started = performance.now();
    const rows = this.owner.connection().prepare(this.sql).all(...this.parameters);
    return {success: true, results: rows.map(row => ({...row}) as T), meta: {changes: 0, last_row_id: 0, duration: performance.now() - started}};
  }

  async run(): Promise<NodeD1Result> {
    const started = performance.now();
    const result = this.owner.connection().prepare(this.sql).run(...this.parameters);
    return {success: true, results: [], meta: {changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid), duration: performance.now() - started}};
  }
}

/**
 * A fresh persistent store for the standalone Node deployment, never a Sites
 * data import. Construction and module imports do not create files or open DBs.
 * Deploy one Node process per persistent SQLite volume; use a network database
 * before scaling across containers that do not share that volume.
 */
export class NodeD1Database {
  readonly path: string;
  private database?: DatabaseSync;

  constructor(path = process.env.MANDATE_DATABASE_PATH || './data/mandate.sqlite') {
    this.path = path === ':memory:' ? path : resolve(path);
  }

  prepare(sql: string): NodeD1Statement {
    return new NodeD1Statement(this, sql);
  }

  connection(): DatabaseSync {
    if (this.database) return this.database;
    if (this.path !== ':memory:') mkdirSync(dirname(this.path), {recursive: true, mode: 0o700});
    const database = new DatabaseSync(this.path);
    try {
      database.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
      database.exec(`CREATE TABLE IF NOT EXISTS mandate_node_migrations (
        id TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL
      );`);
      database.exec('BEGIN IMMEDIATE');
      try {
        for (const migration of migrations) {
          const checksum = createHash('sha256').update(migration.sql).digest('hex');
          const existing = database.prepare('SELECT checksum FROM mandate_node_migrations WHERE id = ?').get(migration.id);
          if (existing) {
            if (existing.checksum !== checksum) throw new Error(`Applied database migration changed: ${migration.id}.`);
            continue;
          }
          database.exec(migration.sql);
          database.prepare('INSERT INTO mandate_node_migrations(id, checksum, applied_at) VALUES(?, ?, ?)')
            .run(migration.id, checksum, new Date().toISOString());
        }
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
      this.database = database;
      return database;
    } catch (error) {
      database.close();
      throw error;
    }
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }
}
