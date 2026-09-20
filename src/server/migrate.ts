// Versioned, additive migration runner for the D1 database.
// The ledger lives in `schema_migrations(version, applied_at)`. `schema.sql`
// stays the idempotent baseline (migration "0001"); later additive migrations
// live in `migrations/` and are applied strictly after it, in version order.

export interface Migration {
  version: string;
  name: string;
  sql: string;
}

export interface MigrationDriver {
  /** Execute multi-statement SQL (DDL scripts, temporary files, etc.). */
  exec(sql: string): Promise<void>;
  /** Run a statement and return its rows. */
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export const BASE_VERSION = "0001";
export const BASE_NAME = "0001_base";

const ensureLedgerSql = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);`;

async function ensureLedger(driver: MigrationDriver): Promise<void> {
  await driver.exec(ensureLedgerSql);
}

export async function appliedVersions(driver: MigrationDriver): Promise<Set<string>> {
  await ensureLedger(driver);
  const rows = await driver.query<{ version: string }>("SELECT version FROM schema_migrations");
  return new Set(rows.map((r) => r.version));
}

/** Non-destructive ordering: every migration once, when its version is pending. */
export function planPending(migrations: Migration[], applied: ReadonlySet<string>): Migration[] {
  return migrations
    .filter((m) => !applied.has(m.version))
    .sort((a, b) => a.version.localeCompare(b.version));
}

export async function applyMigration(driver: MigrationDriver, migration: Migration): Promise<void> {
  await driver.exec(migration.sql);
  await driver.exec(
    `INSERT OR IGNORE INTO schema_migrations (version) VALUES ('${migration.version}')`,
  );
}

/** Apply every pending migration in order; never re-runs an applied version. */
export async function runMigrations(
  driver: MigrationDriver,
  migrations: Migration[],
): Promise<{ applied: string[]; skipped: string[] }> {
  await ensureLedger(driver);
  const applied = await appliedVersions(driver);
  const pending = planPending(migrations, applied);
  const appliedNow: string[] = [];
  for (const m of pending) {
    await applyMigration(driver, m);
    appliedNow.push(m.version);
  }
  const skipped = migrations
    .filter((m) => applied.has(m.version))
    .map((m) => m.version);
  return { applied: appliedNow, skipped };
}