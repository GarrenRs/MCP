import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { D1Stub } from "./helpers/d1";
import {
  BASE_NAME,
  BASE_VERSION,
  appliedVersions,
  planPending,
  runMigrations,
  type Migration,
  type MigrationDriver,
} from "../src/server/migrate";

function driverFor(stub: D1Stub): MigrationDriver {
  return {
    async exec(sql: string): Promise<void> {
      stub.exec(sql);
    },
    async query<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
      return stub.prepare(sql).all<T>().results;
    },
  };
}

function schemaBase(): Migration {
  return {
    version: BASE_VERSION,
    name: BASE_NAME,
    sql: readFileSync(resolve(process.cwd(), "src/server/schema.sql"), "utf8"),
  };
}

function fooMigration(): Migration {
  return {
    version: "0002_foo",
    name: "0002_foo.sql",
    sql: `CREATE TABLE mig_foo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note TEXT NOT NULL DEFAULT ''
    );`,
  };
}

function barMigration(): Migration {
  return {
    version: "0003_bar",
    name: "0003_bar.sql",
    sql: `
      CREATE TABLE mig_bar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        foo_id INTEGER NOT NULL REFERENCES mig_foo(id) ON DELETE CASCADE
      );
      CREATE INDEX mig_bar_foo ON mig_bar(foo_id);
    `,
  };
}

describe("planPending", () => {
  it("filters out applied versions", () => {
    const applied = new Set(["0002_foo"]);
    const pending = planPending([fooMigration(), barMigration()], applied);
    expect(pending.map((m) => m.version)).toEqual(["0003_bar"]);
  });

  it("sorts pending migrations by version", () => {
    const pending = planPending([barMigration(), fooMigration()], new Set());
    expect(pending.map((m) => m.version)).toEqual(["0002_foo", "0003_bar"]);
  });
});

describe("runMigrations", () => {
  it("applies pending migrations in order and records each version", async () => {
    const stub = new D1Stub(false);
    const applied = await runMigrations(driverFor(stub), [
      barMigration(),
      fooMigration(),
    ]);
    expect(applied.applied).toEqual(["0002_foo", "0003_bar"]);
    expect(applied.skipped).toEqual([]);

    const versions = await appliedVersions(driverFor(stub));
    expect([...versions].sort()).toEqual(["0002_foo", "0003_bar"]);

    const barRow = stub.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='mig_bar_foo'").all<{ name: string }>().results;
    expect(barRow.length).toBe(1);
  });

  it("re-running is a no-op (idempotent)", async () => {
    const stub = new D1Stub(false);
    const driver = driverFor(stub);
    await runMigrations(driver, [fooMigration(), barMigration()]);
    const second = await runMigrations(driver, [fooMigration(), barMigration()]);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["0002_foo", "0003_bar"]);
    const versions = await appliedVersions(driver);
    expect([...versions].sort()).toEqual(["0002_foo", "0003_bar"]);
  });

  it("never mutates an already-applied version", async () => {
    const stub = new D1Stub(false);
    const driver = driverFor(stub);
    const first = fooMigration();
    await runMigrations(driver, [first]);

    const mutated = { ...first, sql: "CREATE TABLE mig_foo_rewritten (id INTEGER PRIMARY KEY);" };
    const second = await runMigrations(driver, [mutated]);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["0002_foo"]);

    const rewritten = stub.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mig_foo_rewritten'").all<{ name: string }>().results;
    expect(rewritten.length).toBe(0);
  });
});

describe("fresh vs pre-existing database convergence", () => {
  it("converges an empty DB and a schema.sql-only DB to the same state", async () => {
    const extra = fooMigration();

    const fresh = new D1Stub(false);
    await runMigrations(driverFor(fresh), [schemaBase(), extra]);

    const existing = new D1Stub(true);
    await runMigrations(driverFor(existing), [schemaBase(), extra]);

    const tables = (stub: D1Stub): string[] =>
      stub
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all<{ name: string }>()
        .results.map((r) => r.name);

    expect(tables(fresh)).toEqual(tables(existing));

    const ledger = (stub: D1Stub): string[] =>
      stub
        .prepare("SELECT version FROM schema_migrations ORDER BY version")
        .all<{ version: string }>()
        .results.map((r) => r.version);

    expect(ledger(fresh)).toEqual([BASE_VERSION, "0002_foo"]);
    expect(ledger(existing)).toEqual(ledger(fresh));
  });
});