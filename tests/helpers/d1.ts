import { DatabaseSync, type StatementSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// D1-compatible in-memory database backed by node:sqlite, used only by tests.
// Mirrors the shape @clawnify/db's d1Impl expects:
//   prepare(sql).bind(...params).all()  -> { results: rows[] }
//   prepare(sql).bind(...params).first() -> row | null
//   prepare(sql).bind(...params).run()  -> { meta: { changes, last_row_id } }

interface D1Result<T = Record<string, unknown>> {
  results: T[];
}

interface D1RunMeta {
  changes: number;
  last_row_id: number;
}

class PreparedStatement {
  private stmt: StatementSync;
  private params: unknown[] = [];

  constructor(stmt: StatementSync) {
    this.stmt = stmt;
  }

  bind<T extends unknown[]>(...params: T): this {
    this.params = params;
    return this;
  }

  all<T = Record<string, unknown>>(): D1Result<T> {
    return { results: this.stmt.all(...this.params) as T[] };
  }

  first<T = Record<string, unknown>>(): T | null {
    const row = this.stmt.get(...this.params) as T | undefined;
    return row ?? null;
  }

  run(): { meta: D1RunMeta } {
    const info = this.stmt.run(...this.params);
    return {
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }
}

export class D1Stub {
  private db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON;");
    const schema = readFileSync(resolve(process.cwd(), "src/server/schema.sql"), "utf8");
    this.db.exec(schema);
  }

  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.db.prepare(sql));
  }
}

export type TestEnv = { DB: D1Stub };

export function createTestEnv(): TestEnv {
  return { DB: new D1Stub() };
}