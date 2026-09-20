// P2 migration runner CLI. Runs against the local D1 via `wrangler`.
// Node 24 executes TypeScript natively, so this file is invoked with `node scripts/migrate.ts`.
import {
  execFileSync,
} from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  tmpdir,
} from "node:os";
import {
  join,
  resolve,
} from "node:path";
import {
  BASE_NAME,
  BASE_VERSION,
  runMigrations,
  type Migration,
} from "../src/server/migrate.ts";

const WRANGLER_BIN = resolve("node_modules/wrangler/bin/wrangler.js");
const DB_NAME = "open-property-db";
const SCHEMA_FILE = resolve("src/server/schema.sql");
const MIGRATIONS_DIR = resolve("migrations");

class WranglerDriver {
  async exec(sql: string): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), "open-property-migrate-"));
    const script = join(dir, "migration.sql");
    writeFileSync(script, sql, "utf8");
    try {
      execFileSync(process.execPath, [
        WRANGLER_BIN,
        "d1",
        "execute",
        DB_NAME,
        "--local",
        "--file",
        script,
      ], { stdio: "inherit" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  async query<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
    const out = execFileSync(process.execPath, [
      WRANGLER_BIN,
      "d1",
      "execute",
      DB_NAME,
      "--local",
      "--json",
      "--command",
      sql,
    ], { encoding: "utf8" });
    const batch = JSON.parse(out) as Array<{ results: T[] }>;
    return batch.length ? batch[0].results : [];
  }
}

const driver = new WranglerDriver();

const base: Migration = {
  version: BASE_VERSION,
  name: BASE_NAME,
  sql: readFileSync(SCHEMA_FILE, "utf8"),
};

const additional: Migration[] = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((entry) => ({
    version: entry.name.replace(/\.sql$/, ""),
    name: entry.name,
    sql: readFileSync(join(MIGRATIONS_DIR, entry.name), "utf8"),
  }));

const result = await runMigrations(driver, [base, ...additional]);
console.log(
  `migrations: applied [${result.applied.join(", ") || "none"}], skipped [${result.skipped.join(", ") || "none"}]`,
);