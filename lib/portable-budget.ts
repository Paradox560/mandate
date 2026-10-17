type UsageStatement = {
  bind(...values: unknown[]): UsageStatement;
  run(): Promise<{meta: {changes: number}}>;
};
type UsageDatabase = {prepare(sql: string): UsageStatement};

const LIMIT_MESSAGE = 'The daily demo analysis limit has been reached. Prices and existing records remain available.';

/** Reserve both daily counters atomically before starting an analysis attempt. */
export async function reservePortableBudget(
  db: UsageDatabase,
  userId: string,
  configuredLimit: string | undefined,
  now = new Date(),
): Promise<void> {
  const configured = Number(configuredLimit || 100);
  const globalLimit = Number.isInteger(configured) && configured > 0 && configured <= 1000 ? configured : 100;
  const day = now.toISOString().slice(0, 10);
  const globalBucket = `global:${day}`;
  const userBucket = `${userId}:${day}`;

  await db.prepare('CREATE TABLE IF NOT EXISTS portable_usage(bucket TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0)').run();
  await db.prepare('INSERT OR IGNORE INTO portable_usage(bucket,used) VALUES(?,0)').bind(globalBucket).run();
  // A full global budget must not permit unlimited new session rows either.
  await db.prepare(`INSERT OR IGNORE INTO portable_usage(bucket,used)
    SELECT ?,0 WHERE (SELECT used FROM portable_usage WHERE bucket=?) < ?`)
    .bind(userBucket, globalBucket, globalLimit).run();

  // MATERIALIZED fixes the eligibility snapshot before either row changes.
  // One SQLite statement reserves both counters or neither, including when
  // another connection is competing for the last remaining global slot.
  const result = await db.prepare(`WITH allowed AS MATERIALIZED (
      SELECT 1 WHERE (SELECT used FROM portable_usage WHERE bucket=?) < ?
        AND (SELECT used FROM portable_usage WHERE bucket=?) < 20
    )
    UPDATE portable_usage SET used=used+1
    WHERE bucket IN (?,?) AND EXISTS (SELECT 1 FROM allowed)`)
    .bind(globalBucket, globalLimit, userBucket, globalBucket, userBucket).run();
  if (result.meta.changes !== 2) throw new Error(LIMIT_MESSAGE);
}
