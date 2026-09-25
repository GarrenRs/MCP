// Disposable Commercial Observation Dataset (OBS) — loader / verifier / resetter.
// Approved design: Docs/execution/governance/disposable-commercial-observation-dataset-design-2026-09-24.md
// Node 24 runs TypeScript natively (`node scripts/obs-dataset/load.ts`). Same
// pattern as scripts/migrate.ts (no build step, no app-source coupling).
//
// Modes:
//   node scripts/obs-dataset/load.ts            load the fixture into the LOCAL D1 (requires OBS_DATASET_ALLOW=1)
//   node scripts/obs-dataset/load.ts --verify   read-only verification of a loaded dataset (no env gate needed)
//   node scripts/obs-dataset/load.ts --reset    journal-driven reverse-FK reset of the LOCAL D1 (requires OBS_DATASET_ALLOW=1)
//   node scripts/obs-dataset/load.ts --clone <dest>   consistent single-file copy of the D1 (for reset proofs)
// Options: --db <path> (override target; still local-file only), --journal <path> (for clone-based reset proofs).
//
// Safety guards (design §7):
//   1. OBS_DATASET_ALLOW=1 env gate for load/reset.
//   2. OBS: name marker discipline (grep-verifiable, disjoint from the Austin seed).
//   3. Sentinel: refusal when OBS rows are already present OR a completed journal exists (settings stay untouched).
//   4. Target guard: only a local miniflare-D1DatabaseObject/*.sqlite file under .wrangler is accepted by default.
//   5. Status/dashboard normalization check inside the load transaction; abort (ROLLBACK) on any mismatch.
// No schema changes, no migrations, no seed changes: pure DDL-free INSERTs in FK order.

import { strict as assert } from "node:assert";
import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync,
} from "node:fs";
import { join, resolve, basename } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildFixture, addDaysISO, type ObsFixture } from "./fixture.ts";

const REPO = resolve(".");
const D1_STATE_DIR = join(REPO, ".wrangler", "state", "v3", "d1");
const JOURNAL_DIR = join(REPO, ".wrangler", "obs-journals");
const OBS_PREFIX = "OBS:";
const OBS_PASSWORD = "Obs!Commercial2026";

type Row = Record<string, unknown>;

// ── tiny helpers ──────────────────────────────────────────────────

function currentUtcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256");
  return `pbkdf2:100000:${salt.toString("hex")}:${hash.toString("hex")}`;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function argv(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--verify" || a === "--reset" || a === "--clone" || a === "--db" || a === "--journal") {
      if (a === "--verify" || a === "--reset") out[a.slice(2)] = true;
      else { i++; out[a.slice(2)] = args[i] ?? ""; }
    }
  }
  return out;
}

// ── target discovery & guard ──────────────────────────────────────

function discoverTarget(override: string | undefined): string {
  if (override) {
    const p = resolve(override);
    if (!existsSync(p)) throw new Error(`--db target not found: ${p}`);
    // Local-file-only guard: refuse anything that does not look like a SQLite
    // file we can reach (remote bind IDs or directories are rejected here).
    if (existsSync(p) && !p.toLowerCase().endsWith(".sqlite")) {
      throw new Error(`--db target must be a .sqlite file: ${p}`);
    }
    return p;
  }
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "miniflare-D1DatabaseObject") walk(full);
        else if (!e.name.startsWith("miniflare-")) continue;
        else walk(full);
      } else if (e.name.endsWith(".sqlite") && e.name !== "metadata.sqlite") {
        found.push(full);
      }
    }
  };
  if (existsSync(D1_STATE_DIR)) walk(D1_STATE_DIR);
  if (found.length === 0) throw new Error("No local D1 state database found under .wrangler/state/v3/d1");
  if (found.length > 1) throw new Error(`Multiple local D1 candidates — pass --db explicitly: ${found.join(", ")}`);
  const target = found[0];
  if (!target.includes("miniflare-D1DatabaseObject")) {
    throw new Error(`Target does not look like the local D1 object store: ${target}`);
  }
  return target;
}

function journalPathFor(dbPath: string): string {
  return join(JOURNAL_DIR, `${basename(dbPath).replace(/\.sqlite$/, "")}.json`);
}

function loadJournal(path: string): Record<string, unknown> {
  if (!existsSync(path)) throw new Error(`Journal not found: ${path} (unable to reset without it)`);
  return JSON.parse(readFileSync(path, "utf8"));
}

// ── DB access ─────────────────────────────────────────────────────

function openDb(path: string, readOnly = false): DatabaseSync {
  const db = new DatabaseSync(path, readOnly ? { readOnly: true } : {});
  db.exec("PRAGMA busy_timeout = 30000");
  if (!readOnly) db.exec("PRAGMA foreign_keys = ON");
  return db;
}

function rowCount(db: DatabaseSync, table: string): number {
  return Number(db.prepare(`SELECT COUNT(*) n FROM "${table}"`).get().n);
}

// ── verification (mirrors app.ts SQL so assertions are the product's math) ──

interface VerifyResult {
  ok: boolean;
  issues: string[];
  counts: Record<string, number>;
  dashboard: Record<string, unknown>;
  statuses: Record<string, Record<string, number>>;
}

function verifyLoaded(db: DatabaseSync, expected: Record<string, number>, baseline: Record<string, number>): VerifyResult {
  const issues: string[] = [];
  const counts: Record<string, number> = {};
  for (const t of ["properties", "units", "tenants", "leases", "lease_tenants", "rent_charges", "payments", "vendors", "work_orders", "applications", "users", "sessions", "audit_logs", "settings", "schema_migrations"]) {
    counts[t] = rowCount(db, t);
    if (expected[t] !== undefined && counts[t] !== expected[t]) {
      issues.push(`count ${t}: expected ${expected[t]}, got ${counts[t]}`);
    }
  }
  if (counts.lease_tenants !== 0) issues.push(`lease_tenants must stay 0 (no API write path), got ${counts.lease_tenants}`);
  // Settings must remain exactly the baseline (read-only per phase rule).
  const settings = db.prepare("SELECT key, value FROM settings ORDER BY key").all() as Row[];
  const settingsKey = settings.map((r) => `${r.key}=${r.value}`).join("|");
  const baselineSettings = (baseline.settingsKeys as string[]) ?? [];
  if (baselineSettings.length > 0 && settingsKey !== baselineSettings.join("|")) {
    issues.push("settings changed from baseline (must stay read-only)");
  }
  // Sessions: fixture inserts none; runtime logins may add some AFTER load.
  if (counts.sessions !== undefined && baseline.sessions !== undefined && counts.sessions < baseline.sessions) {
    issues.push(`sessions dropped below baseline ${baseline.sessions} → ${counts.sessions}`);
  }
  // Unique constraints
  const dupCharge = db.prepare("SELECT lease_id, period, COUNT(*) n FROM rent_charges GROUP BY lease_id, period HAVING n > 1").all();
  if (dupCharge.length) issues.push(`duplicate (lease_id, period) charges: ${JSON.stringify(dupCharge)}`);
  const dupEmail = db.prepare("SELECT email, COUNT(*) n FROM users GROUP BY email HAVING n > 1").all();
  if (dupEmail.length) issues.push(`duplicate user emails: ${JSON.stringify(dupEmail)}`);
  // FK integrity spot checks (child rows must resolve upward)
  const orphans: Array<[string, string]> = [
    ["payments", "charge_id", "rent_charges"],
    ["rent_charges", "lease_id", "leases"],
    ["leases", "unit_id", "units"],
    ["units", "property_id", "properties"],
    ["work_orders", "property_id", "properties"],
    ["work_orders", "unit_id", "units"],
    ["work_orders", "tenant_id", "tenants"],
    ["work_orders", "vendor_id", "vendors"],
    ["applications", "unit_id", "units"],
    ["audit_logs", "actor_user_id", "users"],
  ];
  for (const [child, fk, parent] of orphans) {
    const o = db.prepare(
      `SELECT COUNT(*) n FROM ${child} c LEFT JOIN ${parent} p ON p.id = c.${fk} WHERE c.${fk} IS NOT NULL AND p.id IS NULL`,
    ).get() as Row;
    if (Number(o.n) > 0) issues.push(`orphan ${child}.${fk} → ${parent}: ${o.n}`);
  }
  // Status distributions
  const statuses: Record<string, Record<string, number>> = {};
  for (const [table, col] of [["leases", "status"], ["rent_charges", "status"], ["units", "status"], ["work_orders", "status"], ["applications", "status"], ["users", "role"]] as const) {
    const map: Record<string, number> = {};
    for (const r of db.prepare(`SELECT ${col} v, COUNT(*) n FROM ${table} GROUP BY ${col}`).all() as Row[]) {
      map[String(r.v)] = Number(r.n);
    }
    statuses[table] = map;
  }
  // Dashboard math — identical SQL to src/server/app.ts /api/dashboard/summary
  const periodNow = currentUtcDate().slice(0, 7);
  const dashboard: Record<string, unknown> = {
    period: periodNow,
    properties: rowCount(db, "properties"),
    units: rowCount(db, "units"),
    occupied: Number(db.prepare("SELECT COUNT(*) n FROM units WHERE status = 'occupied'").get().n),
    vacant: Number(db.prepare("SELECT COUNT(*) n FROM units WHERE status = 'vacant'").get().n),
    active_leases: Number(db.prepare("SELECT COUNT(*) n FROM leases WHERE status = 'active'").get().n),
    upcoming_move_outs: Number(db.prepare("SELECT COUNT(*) n FROM leases WHERE status = 'active' AND end_date <= date('now', '+30 days')").get().n),
    month_outstanding: Number(db.prepare("SELECT COALESCE(SUM(amount - amount_paid), 0) total FROM rent_charges WHERE period = ? AND status != 'waived'").get(periodNow).total),
    month_collected: Number(db.prepare("SELECT COALESCE(SUM(amount_paid), 0) total FROM rent_charges WHERE period = ?").get(periodNow).total),
    overdue_total: Number(db.prepare("SELECT COALESCE(SUM(amount - amount_paid), 0) total FROM rent_charges WHERE due_date < date('now') AND amount_paid < amount AND status != 'waived'").get().total),
    overdue_count: Number(db.prepare("SELECT COUNT(*) n FROM rent_charges WHERE due_date < date('now') AND amount_paid < amount AND status != 'waived'").get().n),
    open_work_orders: Number(db.prepare("SELECT COUNT(*) n FROM work_orders WHERE status NOT IN ('completed', 'cancelled')").get().n),
    urgent_work_orders: Number(db.prepare("SELECT COUNT(*) n FROM work_orders WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')").get().n),
    upcoming_expirations: Number(db.prepare("SELECT COUNT(*) n FROM leases WHERE status = 'active' AND end_date <= date('now', '+60 days')").get().n),
  };
  dashboard.occupancy_rate = dashboard.units ? Math.round((Number(dashboard.occupied) / Number(dashboard.units)) * 100) : 0;
  const expDash = expected.dashboard as Record<string, unknown> | undefined;
  if (expDash) {
    for (const [k, v] of Object.entries(expDash)) {
      if (String(dashboard[k]) !== String(v)) issues.push(`dashboard ${k}: expected ${v}, got ${dashboard[k]}`);
    }
  }
  // Occupancy ⇔ lease truth (P9 reconcile rule) — scoped to OBS properties,
  // because the demo seed itself marks units 'occupied' with zero leases.
  const mismatch = db.prepare(
    `SELECT u.id, u.status FROM units u JOIN properties p ON p.id = u.property_id
     WHERE p.name LIKE 'OBS:%' AND u.status = 'occupied'
       AND (SELECT COUNT(*) FROM leases l WHERE l.unit_id = u.id AND l.status = 'active') = 0`,
  ).all();
  if (mismatch.length) issues.push(`OBS occupied units without active lease: ${JSON.stringify(mismatch.map((r) => (r as Row).id))}`);
  const vacantWithActive = db.prepare(
    `SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
     WHERE p.name LIKE 'OBS:%' AND u.status = 'vacant'
       AND (SELECT COUNT(*) FROM leases l WHERE l.unit_id = u.id AND l.status = 'active') > 0`,
  ).all();
  if (vacantWithActive.length) issues.push(`vacant units with active lease: ${JSON.stringify(vacantWithActive.map((r) => (r as Row).id))}`);
  // markOverdue should be a no-op at anchor: no open/partial charge past-due with balance.
  const wouldFlip = db.prepare(
    "SELECT COUNT(*) n FROM rent_charges WHERE status IN ('open','partial') AND due_date < date('now') AND amount_paid < amount",
  ).get() as Row;
  if (Number(wouldFlip.n) > 0) issues.push(`markOverdue would flip ${wouldFlip.n} charge(s) — statuses not pre-normalized`);

  return { ok: issues.length === 0, issues, counts, dashboard, statuses };
}

// ── load ──────────────────────────────────────────────────────────

function buildExpected(baseStatus?: { occupied: number; vacant: number }): Record<string, unknown> {
  const occ = baseStatus?.occupied ?? 0;
  const vac = baseStatus?.vacant ?? 0;
  return {
    properties: 11, units: 23, tenants: 16, leases: 19, lease_tenants: 0,
    rent_charges: 43, payments: 43, vendors: 10, work_orders: 10, applications: 8,
    users: 6, audit_logs: 81, settings: 6, schema_migrations: 5,
    dashboard: {
      properties: 11, units: 23, occupied: occ + 13, vacant: vac + 3,
      occupancy_rate: Math.round(((occ + 13) / 23) * 100),
      active_leases: 13, upcoming_move_outs: 2, month_outstanding: 75000,
      month_collected: 453000, overdue_total: 102000, overdue_count: 3,
      open_work_orders: 5, urgent_work_orders: 1, upcoming_expirations: 3,
    },
  };
}

interface IdMaps {
  [key: string]: Map<string, number>;
}

function resolveRef(ref: string, maps: IdMaps): number {
  const m = /^@(properties|units|tenants|leases|charges|payments|vendors|workOrders|applications|users):(.+)$/.exec(ref);
  if (!m) throw new Error(`bad ref: ${ref}`);
  const group = m[1];
  const handle = m[2];
  const targetMap =
    group === "properties" ? maps.property
    : group === "units" ? maps.unit
    : group === "tenants" ? maps.tenant
    : group === "leases" ? maps.lease
    : group === "charges" ? maps.charge
    : group === "payments" ? maps.payment
    : group === "vendors" ? maps.vendor
    : group === "workOrders" ? maps.workOrder
    : group === "applications" ? maps.application
    : maps.user;
  const id = targetMap.get(handle);
  if (id === undefined) throw new Error(`unresolved ${group}:${handle}`);
  return id;
}

function substituteRefs(value: unknown, maps: IdMaps): unknown {
  // Replace @entity:handle tokens inside a JSON-serialized value with resolved ints.
  if (value === null || value === undefined) return value;
  let json = JSON.stringify(value);
  json = json.replace(/@(properties|units|tenants|leases|charges|payments|vendors|workOrders|applications|users):([A-Za-z0-9._-]+)/g, (_m, g, h) => {
    const mapsByGroup: Record<string, Map<string, number>> = {
      properties: maps.property, units: maps.unit, tenants: maps.tenant, leases: maps.lease,
      charges: maps.charge, payments: maps.payment, vendors: maps.vendor,
      workOrders: maps.workOrder, applications: maps.application, users: maps.user,
    };
    const id = mapsByGroup[g as string].get(h as string);
    if (id === undefined) throw new Error(`unresolved ${g}:${h}`);
    return String(id);
  });
  return JSON.parse(json);
}

function load(dbPath: string): { journal: Record<string, unknown> } {
  const T = currentUtcDate();
  const fixture: ObsFixture = buildFixture(T);

  // Sentinel checks BEFORE any write.
  const db = openDb(dbPath, false);
  try {
    const existingOBS = Number(
      db.prepare("SELECT COUNT(*) n FROM properties WHERE name LIKE ?").get(`${OBS_PREFIX}%`).n,
    );
    if (existingOBS > 0) throw new Error(`OBS rows already present (properties LIKE '${OBS_PREFIX}%' = ${existingOBS}) — refusing to double-load`);
    const jPath = journalPathFor(dbPath);
    if (existsSync(jPath)) {
      const j = loadJournal(jPath);
      if (j.state === "loaded" || j.state === "reset-and-loaded") {
        throw new Error(`Completed journal exists (${jPath}) — refusing to double-load; reset first if needed`);
      }
    }

    // Baseline snapshot of the pre-load state (row counts + settings) for the journal.
    const tables = ["properties", "units", "tenants", "leases", "lease_tenants", "rent_charges", "payments", "vendors", "work_orders", "applications", "users", "sessions", "audit_logs", "settings"];
    const baseline: Record<string, number> = {};
    for (const t of tables) baseline[t] = rowCount(db, t);
    const settings = db.prepare("SELECT key, value FROM settings ORDER BY key").all() as Row[];
    const settingsKeys = settings.map((r) => `${r.key}=${r.value}`);
    // Full pre-injection gate: the live local D1 must be the known seed state.
    const want: Record<string, number> = {
      properties: 3, units: 5, tenants: 0, leases: 0, lease_tenants: 0,
      rent_charges: 0, payments: 0, vendors: 3, work_orders: 0, applications: 0,
      users: 2, sessions: 24, audit_logs: 42, settings: 6,
    };
    const gateDiffs = Object.entries(want).filter(([t, n]) => baseline[t] !== n);
    if (gateDiffs.length) {
      throw new Error(`Baseline gate failed: ${JSON.stringify(gateDiffs.map(([t, n]) => `${t} want ${n} got ${baseline[t]}`))}`);
    }
    // Seed unit status split (demo seed marks 4 of 5 units 'occupied' with no leases).
    const unitStatus = db.prepare("SELECT status, COUNT(*) n FROM units GROUP BY status").all() as Row[];
    const baseStatus = { occupied: 0, vacant: 0 };
    for (const r of unitStatus) {
      if (r.status === "occupied") baseStatus.occupied = Number(r.n);
      if (r.status === "vacant") baseStatus.vacant = Number(r.n);
    }
    if (baseStatus.occupied !== 4 || baseStatus.vacant !== 1) {
      throw new Error(`Unexpected seed unit status split: ${JSON.stringify(unitStatus)} (expected occupied 4 / vacant 1)`);
    }
    const expected = buildExpected(baseStatus);

    db.exec("BEGIN IMMEDIATE");
    try {
      const maps: IdMaps = {
        property: new Map(), unit: new Map(), tenant: new Map(), lease: new Map(),
        charge: new Map(), payment: new Map(), vendor: new Map(), workOrder: new Map(),
        application: new Map(), user: new Map(),
      };
      const insert = (sql: string, params: unknown[]): number => {
        const info = db.prepare(sql).run(...params);
        return Number(info.lastInsertRowid);
      };

      // users FIRST (actors for audit; also referenced by nothing else below except audit)
      for (const u of fixture.users) {
        const id = insert(
          "INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
          [u.email, hashPassword(u.password), u.display_name, u.role],
        );
        maps.user.set(u.handle, id);
      }
      // properties
      for (const p of fixture.properties) {
        const id = insert(
          `INSERT INTO properties (name, type, address, city, state, zip, year_built, notes, color, country, wilaya, commune, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [p.name, p.type, p.address, p.city, p.state, p.zip, p.year_built, p.notes, p.color, p.country, p.wilaya, p.commune],
        );
        maps.property.set(p.handle, id);
      }
      // units
      for (const u of fixture.units) {
        const id = insert(
          `INSERT INTO units (property_id, name, bedrooms, bathrooms, sqft, market_rent, status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [maps.property.get(u.prop), u.name, u.bedrooms, u.bathrooms, u.sqft, u.market_rent, u.status, u.notes],
        );
        maps.unit.set(u.handle, id);
      }
      // tenants
      for (const t of fixture.tenants) {
        const id = insert(
          `INSERT INTO tenants (first_name, last_name, email, phone, employer, monthly_income, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [t.first_name, t.last_name, t.email, t.phone, t.employer, t.monthly_income, t.notes],
        );
        maps.tenant.set(t.handle, id);
      }
      // leases
      for (const l of fixture.leases) {
        const id = insert(
          `INSERT INTO leases (unit_id, primary_tenant_id, start_date, end_date, monthly_rent, deposit, rent_due_day, late_fee, status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [maps.unit.get(l.unit), l.tenant ? maps.tenant.get(l.tenant) : null, l.start, l.end, l.monthly_rent, l.deposit, l.rent_due_day, l.late_fee, l.status, l.notes],
        );
        maps.lease.set(l.handle, id);
      }
      // rent_charges
      for (const c of fixture.charges) {
        const id = insert(
          `INSERT INTO rent_charges (lease_id, period, due_date, amount, amount_paid, status, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [maps.lease.get(c.lease), c.period, c.due_date, c.amount, c.amount_paid, c.status, c.notes],
        );
        maps.charge.set(c.handle, id);
      }
      // payments
      for (const p of fixture.payments) {
        const id = insert(
          `INSERT INTO payments (charge_id, paid_at, amount, method, reference, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [maps.charge.get(p.charge), p.paid_at, p.amount, p.method, p.reference, p.notes],
        );
        maps.payment.set(p.handle, id);
      }
      // vendors
      for (const v of fixture.vendors) {
        const id = insert(
          "INSERT INTO vendors (name, category, phone, email, notes, color) VALUES (?, ?, ?, ?, ?, ?)",
          [v.name, v.category, v.phone, v.email, v.notes, v.color],
        );
        maps.vendor.set(v.handle, id);
      }
      // work_orders
      for (const w of fixture.workOrders) {
        const id = insert(
          `INSERT INTO work_orders (property_id, unit_id, tenant_id, vendor_id, title, description, priority, status, scheduled_at, completed_at, cost, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [w.prop ? maps.property.get(w.prop) : null, w.unit ? maps.unit.get(w.unit) : null, w.tenant ? maps.tenant.get(w.tenant) : null, w.vendor ? maps.vendor.get(w.vendor) : null, w.title, w.description, w.priority, w.status, w.scheduled_at, w.completed_at, w.cost, w.notes],
        );
        maps.workOrder.set(w.handle, id);
      }
      // applications
      for (const a of fixture.applications) {
        const id = insert(
          `INSERT INTO applications (unit_id, first_name, last_name, email, phone, monthly_income, employer, desired_move_in, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [a.unit ? maps.unit.get(a.unit) : null, a.first_name, a.last_name, a.email, a.phone, a.monthly_income, a.employer, a.desired_move_in, a.status, a.notes],
        );
        maps.application.set(a.handle, id);
      }
      // audit_logs (last: actors + all referenced ids must exist)
      const auditIds: number[] = [];
      for (const a of fixture.audit) {
        const actorId = a.actor ? maps.user.get(a.actor) : null;
        const recordId = a.record ? resolveRef(a.record, maps) : null;
        const oldText = a.old_value === null || a.old_value === undefined ? null : JSON.stringify(substituteRefs(a.old_value, maps));
        const newText = a.new_value === null || a.new_value === undefined ? null : JSON.stringify(substituteRefs(a.new_value, maps));
        const id = insert(
          "INSERT INTO audit_logs (actor_user_id, action, entity, record_id, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [actorId, a.action, a.entity, recordId, oldText, newText, a.created_at],
        );
        auditIds.push(id);
      }

      // In-transaction verification (abort = rollback; the DB stays untouched).
      const check = verifyLoaded(db, expected, {
        settingsKeys, sessions: baseline.sessions, baseline_unit_status: baseStatus,
      } as Record<string, unknown>);
      if (!check.ok) {
        throw new Error(`Verification failed inside transaction:\n${check.issues.join("\n")}`);
      }

      const insertedIds: Record<string, number[]> = {};
      for (const [key, map] of Object.entries(maps)) insertedIds[key] = [...map.values()];
      db.exec("COMMIT");

      // Journal (evidence; written only after a successful commit).
      mkdirSync(JOURNAL_DIR, { recursive: true });
      const journal: Record<string, unknown> = {
        run_id: `${T}T${new Date().toISOString().slice(11, 19)}Z`,
        anchor: T,
        db_path: dbPath,
        state: "loaded",
        baseline_counts: baseline,
        baseline_unit_status: baseStatus,
        expected_counts: expected,
        inserted_ids: insertedIds,
        audit_ids: auditIds,
        settings: settingsKeys,
        created_at: new Date().toISOString(),
      };
      const jPath = journalPathFor(dbPath);
      writeFileSync(jPath, JSON.stringify(journal, null, 2), "utf8");
      console.log(`LOAD OK — journal: ${jPath}`);
      console.log(`  anchor=${T} period=${fixture.m0}`);
      console.log(`  counts=${JSON.stringify(check.counts)}`);
      console.log(`  dashboard=${JSON.stringify(check.dashboard)}`);
      return { journal };
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch { /* noop */ }
      throw e;
    }
  } finally {
    db.close();
  }
}

// ── reset (journal-driven, reverse FK order, transactional) ───────

function reset(dbPath: string, journalPath: string | undefined): void {
  const j = loadJournal(journalPath ?? journalPathFor(dbPath));
  if (j.state === "reset") throw new Error("Journal already reset");
  const inserted = j.inserted_ids as Record<string, number[]>;
  const ids = (k: string): number[] => (inserted[k] as number[]) ?? [];
  const auditIds = (j.audit_ids as number[] | undefined) ?? ids("audit");
  const db = openDb(dbPath, false);
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      const list = (arr: number[]): string => (arr.length ? arr.join(",") : "0");
      // reverse FK order (children first; SET NULL orphans must be deleted explicitly by id)
      db.exec(`DELETE FROM audit_logs WHERE id IN (${list(auditIds)})`);
      db.exec(`DELETE FROM payments WHERE id IN (${list(ids("payment"))})`);
      db.exec(`DELETE FROM rent_charges WHERE id IN (${list(ids("charge"))})`);
      db.exec(`DELETE FROM lease_tenants WHERE lease_id IN (${list(ids("lease"))})`);
      db.exec(`DELETE FROM leases WHERE id IN (${list(ids("lease"))})`);
      db.exec(`DELETE FROM work_orders WHERE id IN (${list(ids("workOrder"))})`);
      db.exec(`DELETE FROM vendors WHERE id IN (${list(ids("vendor"))})`);
      db.exec(`DELETE FROM applications WHERE id IN (${list(ids("application"))})`);
      db.exec(`DELETE FROM tenants WHERE id IN (${list(ids("tenant"))})`);
      db.exec(`DELETE FROM units WHERE id IN (${list(ids("unit"))})`);
      db.exec(`DELETE FROM properties WHERE id IN (${list(ids("property"))})`);
      db.exec(`DELETE FROM sessions WHERE user_id IN (${list(ids("user"))})`);
      db.exec(`DELETE FROM users WHERE id IN (${list(ids("user"))})`);
      // Belt & braces: any OBS-marker rows that slipped past the journal (e.g. runtime edge tests)
      db.exec(`DELETE FROM properties WHERE name LIKE '${OBS_PREFIX}%'`);
      db.exec("DELETE FROM vendors WHERE email LIKE 'obs.%@example.com'");
      db.exec("DELETE FROM users WHERE email LIKE 'obs.%@example.com'");

      const baseline = j.baseline_counts as Record<string, number>;
      const after: Record<string, number> = {};
      for (const t of Object.keys(baseline)) after[t] = rowCount(db, t);
      const diffs = Object.entries(baseline).filter(([t, n]) => after[t] !== n);
      if (diffs.length) {
        throw new Error(`Reset verification failed — baseline mismatch: ${JSON.stringify(diffs.map(([t, n]) => `${t} want ${n} got ${after[t]}`))}`);
      }
      db.exec("COMMIT");
      j.state = "reset";
      writeFileSync(journalPath ?? journalPathFor(dbPath), JSON.stringify(j, null, 2), "utf8");
      console.log(`RESET OK — restored to baseline: ${JSON.stringify(after)}`);
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch { /* noop */ }
      throw e;
    }
  } finally {
    db.close();
  }
}

// ── clone (consistent single-file copy via VACUUM INTO) ───────────

function clone(src: string, dest: string): void {
  const db = openDb(src, true);
  try {
    db.exec(`VACUUM INTO '${dest.replace(/\\/g, "/").replace(/'/g, "''")}'`);
    console.log(`CLONE OK — ${dest} (${sha256File(dest).slice(0, 16)}…)`);
  } finally {
    db.close();
  }
}

// ── main ──────────────────────────────────────────────────────────

function main(): void {
  const args = argv();
  const target = discoverTarget(typeof args.db === "string" && args.db ? args.db : undefined);

  if (args.verify === true) {
    const db = openDb(target, true);
    try {
      const baseline: Record<string, unknown> = {};
      // Reuse the journal's captured settings/ sessions baseline when present so
      // settings-readonly and sessions-not-removed checks still apply in verify.
      const jPath = journalPathFor(target);
      if (existsSync(jPath)) {
        const j = loadJournal(jPath);
        baseline.settingsKeys = (j.settings as string[]) ?? [];
        baseline.sessions = (j.baseline_counts as Record<string, number>).sessions;
        baseline.baseline_unit_status = j.baseline_unit_status ?? { occupied: 4, vacant: 1 };
      }
      const expected = buildExpected((baseline.baseline_unit_status ?? undefined) as { occupied: number; vacant: number } | undefined);
      const res = verifyLoaded(db, expected, baseline);
      console.log(`VERIFY (${target})`);
      console.log(`  counts=${JSON.stringify(res.counts)}`);
      console.log(`  dashboard=${JSON.stringify(res.dashboard)}`);
      console.log(`  statuses=${JSON.stringify(res.statuses)}`);
      if (res.ok) console.log("VERIFY PASS");
      else { console.error(`VERIFY FAIL:\n${res.issues.join("\n")}`); process.exitCode = 1; }
    } finally {
      db.close();
    }
    return;
  }

  if (typeof args.clone === "string") {
    clone(target, args.clone);
    return;
  }

  if (process.env.OBS_DATASET_ALLOW !== "1") {
    console.error("REFUSED: OBS_DATASET_ALLOW=1 is required (load/reset mutate the database).");
    process.exitCode = 1;
    return;
  }

  if (args.reset === true) {
    const jPath = typeof args.journal === "string" && args.journal ? args.journal : undefined;
    reset(target, jPath);
    return;
  }

  load(target);
}

main();