import { Hono, type Context } from "hono";
import { z } from "zod";
import { initDB, query, get, run } from "./db";
import { ErrorCode, err } from "./errors";
import {
  computeChargeStatus,
  currentUtcDate,
  isChargeOverdue,
  planChargeGeneration,
} from "./finance";
import {
  dateRangesOverlap,
  leaseClaimsUnit,
  reconcileUnitStatus,
} from "./leases";
import {
  hashPassword,
  verifyPassword,
  createSession,
  getSessionFromToken,
  deleteSessionByToken,
  deleteUserSessions,
  parseCookieHeader,
  setSessionCookie,
  clearSessionCookie,
  hasMinimumRole,
  isAuthEnabled,
  resetAuthCache,
  isSecureRequest,
} from "./auth";
import type { SessionUser } from "./auth";

type Env = { Bindings: { DB: D1Database }; Variables: { user: SessionUser | null } };

const app = new Hono<Env>();

app.use("*", async (c, next) => {
  initDB(c.env);
  await ensureSeeded();
  await next();
});

// ── Auth middleware ─────────────────────────────────────────────────
// Runs after DB init, before route handlers. Skips public routes and
// respects the AUTH_ENABLED feature flag for easy rollback.

app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  // Public routes — never require auth
  if (path === "/api/health" || path === "/api/auth/login" || path === "/api/auth/logout" || path === "/api/auth/session" || path === "/api/auth/bootstrap" || path === "/api/auth/status") {
    c.set("user", null);
    return next();
  }
  // Feature flag check — when disabled, don't enforce auth but still resolve session if present
  if (!(await isAuthEnabled())) {
    const token = parseCookieHeader(c.req.header("cookie"), "session_token");
    if (token) {
      const user = await getSessionFromToken(token);
      c.set("user", user);
    } else {
      c.set("user", null);
    }
    return next();
  }
  // Session check
  const token = parseCookieHeader(c.req.header("cookie"), "session_token");
  if (!token) {
    c.set("user", null);
    return c.json(err(ErrorCode.unauthorized, "Authentication required"), 401);
  }
  const user = await getSessionFromToken(token);
  if (!user) {
    c.set("user", null);
    return c.json(err(ErrorCode.unauthorized, "Invalid or expired session"), 401);
  }
  c.set("user", user);
  return next();
});

// ── Auth routes (public) ──────────────────────────────────────────
// POST /api/auth/login    — create session
// POST /api/auth/logout   — destroy session
// GET  /api/auth/session  — return current user
// POST /api/auth/bootstrap — create first owner (only when no users exist)

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

app.post("/api/auth/login", async (c) => {
  const parsed = await parseJson(c, LoginInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { email, password } = parsed.data;
  const user = await get<{ id: number; password_hash: string; role: string; display_name: string }>(
    "SELECT id, password_hash, role, display_name FROM users WHERE email = ?",
    [email.toLowerCase().trim()],
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json(err(ErrorCode.invalid_credentials, "Invalid email or password"), 401);
  }
  const secure = isSecureRequest(c.req);
  const { token, expiresAt } = await createSession(user.id);
  c.header("Set-Cookie", setSessionCookie(token, expiresAt, secure));
  return c.json({
    user: { id: user.id, email: email.toLowerCase().trim(), role: user.role, display_name: user.display_name },
  });
});

app.post("/api/auth/logout", async (c) => {
  const token = parseCookieHeader(c.req.header("cookie"), "session_token");
  if (token) await deleteSessionByToken(token);
  const secure = isSecureRequest(c.req);
  c.header("Set-Cookie", clearSessionCookie(secure));
  return c.json({ ok: true });
});

app.get("/api/auth/session", async (c) => {
  const token = parseCookieHeader(c.req.header("cookie"), "session_token");
  if (!token) return c.json({ user: null });
  const user = await getSessionFromToken(token);
  if (!user) return c.json({ user: null });
  return c.json({ user: { id: user.userId, email: user.email, role: user.role, display_name: user.display_name } });
});

const BootstrapInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1),
});

app.post("/api/auth/bootstrap", async (c) => {
  const parsed = await parseJson(c, BootstrapInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { email, password, display_name } = parsed.data;
  const password_hash = await hashPassword(password);
  // Atomic: INSERT only if no users exist (prevents race condition)
  const result = await run(
    `INSERT INTO users (email, password_hash, display_name, role)
     SELECT ?, ?, ?, 'owner'
     WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1)`,
    [email.toLowerCase().trim(), password_hash, display_name.trim()],
  );
  if (result.changes === 0) {
    return c.json(err(ErrorCode.bootstrap_unavailable, "Bootstrap is no longer available"), 409);
  }
  const user = await get<{ id: number; email: string; role: string; display_name: string }>(
    "SELECT id, email, role, display_name FROM users WHERE id = ?",
    [result.lastInsertRowid],
  );
  // Auto-login after bootstrap
  const secure = isSecureRequest(c.req);
  const { token, expiresAt } = await createSession(user!.id);
  c.header("Set-Cookie", setSessionCookie(token, expiresAt, secure));
  return c.json({ user }, 201);
});

app.get("/api/auth/status", async (c) => {
  const enabled = await isAuthEnabled();
  const count = await get<{ n: number }>("SELECT COUNT(*) as n FROM users");
  return c.json({ auth_enabled: enabled, has_users: (count?.n ?? 0) > 0 });
});

// ── First-run data ─────────────────────────────────────────────────
// A deploy applies `schema.sql` as DDL only — a seed INSERT there fails the
// whole build — so the defaults and the sample portfolio are written here,
// once, when their tables are still empty. A re-deploy never resurrects a
// row the user deleted, because the table is no longer empty.

const DEFAULT_SETTINGS: Record<string, string> = {
  default_rent_due_day: "1",
  late_fee_amount: "50",
  late_fee_grace_days: "5",
  currency: "DZD",
  locale: "fr-DZ",
};

const DEMO_PROPERTIES: Array<[string, string, string, string, string, string, string]> = [
  ["Oakwood Estate", "single_family", "210 Oakwood Ln", "Austin", "TX", "78704", "emerald"],
  ["Honeybee Hideaway", "single_family", "88 Bramble Ct", "Austin", "TX", "78704", "amber"],
  ["308 Mission Apartments", "multi_family", "308 Mission St", "Austin", "TX", "78702", "sky"],
];

/** property index (into DEMO_PROPERTIES), name, beds, baths, sqft, rent, status */
const DEMO_UNITS: Array<[number, string, number, number, number, number, string]> = [
  [0, "Main house", 3, 2, 1450, 2300, "occupied"],
  [1, "Main house", 2, 1, 980, 1700, "occupied"],
  [2, "Unit 1", 1, 1, 620, 1450, "occupied"],
  [2, "Unit 2", 1, 1, 620, 1450, "vacant"],
  [2, "Unit 3", 2, 1, 850, 1850, "occupied"],
];

const DEMO_VENDORS: Array<[string, string, string, string]> = [
  ["Emerald Pool Service", "general", "512-555-0144", "emerald"],
  ["Hill Country Plumbing", "plumber", "512-555-0188", "sky"],
  ["Bright Spark Electric", "electrician", "512-555-0102", "amber"],
];

let seeded = false; // per-isolate fast path; the COUNT re-checks are cheap

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  try {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [key, value]);
    }

    const props = await get<{ n: number }>("SELECT COUNT(*) AS n FROM properties");
    if ((props?.n ?? 0) === 0) {
      const ids: number[] = [];
      for (const p of DEMO_PROPERTIES) {
        await run(
          "INSERT INTO properties (name, type, address, city, state, zip, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
          p,
        );
        const row = await get<{ id: number }>("SELECT id FROM properties ORDER BY id DESC LIMIT 1");
        ids.push(row?.id ?? 0);
      }
      const units = await get<{ n: number }>("SELECT COUNT(*) AS n FROM units");
      if ((units?.n ?? 0) === 0) {
        for (const [pi, name, beds, baths, sqft, rent, status] of DEMO_UNITS) {
          if (!ids[pi]) continue;
          await run(
            "INSERT INTO units (property_id, name, bedrooms, bathrooms, sqft, market_rent, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [ids[pi], name, beds, baths, sqft, rent, status],
          );
        }
      }
    }

    const vendors = await get<{ n: number }>("SELECT COUNT(*) AS n FROM vendors");
    if ((vendors?.n ?? 0) === 0) {
      for (const v of DEMO_VENDORS) {
        await run("INSERT INTO vendors (name, category, phone, color) VALUES (?, ?, ?, ?)", v);
      }
    }
  } catch {
    // A cold database mid-migration, or a table this build has not created
    // yet: the next request retries. Never fail a request over sample data.
    seeded = false;
  }
  resetAuthCache();
}

// ── Helpers ────────────────────────────────────────────────────────

const intParam = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

async function parseJson<T>(c: Context, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; code: string; error: string }> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, code: ErrorCode.invalid_json, error: "Invalid JSON" };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, code: ErrorCode.validation, error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, data: parsed.data };
}

function buildUpdate(fields: Record<string, unknown>): { sets: string[]; params: unknown[] } {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) { sets.push(`${k} = ?`); params.push(v); }
  }
  return { sets, params };
}

// ── Properties ─────────────────────────────────────────────────────

const PropertyInput = z.object({
  name: z.string().min(1),
  type: z.enum(["single_family", "multi_family", "condo", "townhouse", "commercial"]).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  wilaya: z.string().optional().nullable(),
  commune: z.string().optional().nullable(),
  year_built: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  color: z.string().optional(),
});

app.get("/api/properties", async (c) => {
  const rows = await query(
    `SELECT p.*,
       (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id) as unit_count,
       (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id AND u.status = 'occupied') as occupied_count
     FROM properties p ORDER BY p.name`,
  );
  return c.json({ properties: rows });
});

app.get("/api/properties/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const row = await get("SELECT * FROM properties WHERE id = ?", [id]);
  if (!row) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ property: row });
});

app.post("/api/properties", async (c) => {
  const parsed = await parseJson(c, PropertyInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  const cols = ["name", "type", "address", "city", "state", "zip", "year_built", "notes", "color"];
  const vals = [d.name, d.type ?? "single_family", d.address ?? null, d.city ?? null, d.state ?? null, d.zip ?? null, d.year_built ?? null, d.notes ?? null, d.color ?? "sky"];
  // Geographical columns are additive and nullable; only write them when the
  // request supplies a value (a pre-migration database has no columns).
  for (const [key, value] of [["country", d.country], ["wilaya", d.wilaya], ["commune", d.commune]] as const) {
    if (value !== undefined && value !== null) {
      cols.push(key);
      vals.push(value);
    }
  }
  const result = await run(
    `INSERT INTO properties (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    vals,
  );
  const row = await get("SELECT * FROM properties WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ property: row }, 201);
});

app.put("/api/properties/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const parsed = await parseJson(c, PropertyInput.partial());
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE properties SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  const row = await get("SELECT * FROM properties WHERE id = ?", [id]);
  return c.json({ property: row });
});

app.delete("/api/properties/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const r = await run("DELETE FROM properties WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ ok: true });
});

// ── Units ──────────────────────────────────────────────────────────

const UnitInput = z.object({
  property_id: z.number().int(),
  name: z.string().min(1),
  bedrooms: z.number().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  sqft: z.number().int().optional().nullable(),
  market_rent: z.number().min(0).optional(),
  status: z.enum(["vacant", "occupied", "turnover", "unavailable"]).optional(),
  notes: z.string().optional().nullable(),
});

const UNIT_SELECT = `
  SELECT u.*,
    p.name as property_name,
    p.color as property_color,
    p.address as property_address,
    p.city as property_city,
    (SELECT l.id FROM leases l WHERE l.unit_id = u.id AND l.status = 'active' ORDER BY l.start_date DESC LIMIT 1) as active_lease_id,
    (SELECT t.first_name || ' ' || t.last_name FROM leases l LEFT JOIN tenants t ON t.id = l.primary_tenant_id WHERE l.unit_id = u.id AND l.status = 'active' ORDER BY l.start_date DESC LIMIT 1) as active_tenant_name
  FROM units u
  LEFT JOIN properties p ON p.id = u.property_id
`;

app.get("/api/units", async (c) => {
  const propertyId = intParam(c.req.query("property_id"));
  const status = c.req.query("status");
  const where: string[] = [];
  const params: unknown[] = [];
  if (propertyId) { where.push("u.property_id = ?"); params.push(propertyId); }
  if (status) { where.push("u.status = ?"); params.push(status); }
  const sql = `${UNIT_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY p.name, u.name`;
  const rows = await query(sql, params);
  return c.json({ units: rows });
});

app.get("/api/units/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const row = await get(`${UNIT_SELECT} WHERE u.id = ?`, [id]);
  if (!row) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ unit: row });
});

app.post("/api/units", async (c) => {
  const parsed = await parseJson(c, UnitInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  const result = await run(
    `INSERT INTO units (property_id, name, bedrooms, bathrooms, sqft, market_rent, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.property_id, d.name, d.bedrooms ?? 1, d.bathrooms ?? 1, d.sqft ?? null, d.market_rent ?? 0, d.status ?? "vacant", d.notes ?? null],
  );
  const row = await get(`${UNIT_SELECT} WHERE u.id = ?`, [result.lastInsertRowid]);
  return c.json({ unit: row }, 201);
});

app.put("/api/units/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const parsed = await parseJson(c, UnitInput.partial());
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE units SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  const row = await get(`${UNIT_SELECT} WHERE u.id = ?`, [id]);
  return c.json({ unit: row });
});

app.delete("/api/units/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const r = await run("DELETE FROM units WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ ok: true });
});

// ── Tenants ────────────────────────────────────────────────────────

const TenantInput = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  emergency_contact: z.string().optional().nullable(),
  employer: z.string().optional().nullable(),
  monthly_income: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

app.get("/api/tenants", async (c) => {
  const search = c.req.query("q")?.trim();
  if (search) {
    const like = `%${search}%`;
    const rows = await query(
      `SELECT t.*,
         (SELECT u.id FROM leases l LEFT JOIN units u ON u.id = l.unit_id
            WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_unit_id,
         (SELECT u.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id
            WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_unit_name,
         (SELECT p.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id LEFT JOIN properties p ON p.id = u.property_id
            WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_property_name
       FROM tenants t
       WHERE t.last_name LIKE ? OR t.first_name LIKE ? OR t.email LIKE ? OR t.phone LIKE ?
       ORDER BY t.last_name, t.first_name LIMIT 200`,
      [like, like, like, like],
    );
    return c.json({ tenants: rows });
  }
  const rows = await query(
    `SELECT t.*,
       (SELECT u.id FROM leases l LEFT JOIN units u ON u.id = l.unit_id
          WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_unit_id,
       (SELECT u.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id
          WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_unit_name,
       (SELECT p.name FROM leases l LEFT JOIN units u ON u.id = l.unit_id LEFT JOIN properties p ON p.id = u.property_id
          WHERE l.primary_tenant_id = t.id AND l.status = 'active' LIMIT 1) as active_property_name
     FROM tenants t ORDER BY t.last_name, t.first_name LIMIT 500`,
  );
  return c.json({ tenants: rows });
});

app.get("/api/tenants/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const row = await get("SELECT * FROM tenants WHERE id = ?", [id]);
  if (!row) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ tenant: row });
});

app.post("/api/tenants", async (c) => {
  const parsed = await parseJson(c, TenantInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  const result = await run(
    `INSERT INTO tenants (first_name, last_name, email, phone, date_of_birth, emergency_contact, employer, monthly_income, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.first_name, d.last_name, d.email ?? null, d.phone ?? null, d.date_of_birth ?? null, d.emergency_contact ?? null, d.employer ?? null, d.monthly_income ?? null, d.notes ?? null],
  );
  const row = await get("SELECT * FROM tenants WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ tenant: row }, 201);
});

app.put("/api/tenants/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const parsed = await parseJson(c, TenantInput.partial());
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE tenants SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  const row = await get("SELECT * FROM tenants WHERE id = ?", [id]);
  return c.json({ tenant: row });
});

app.delete("/api/tenants/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const r = await run("DELETE FROM tenants WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ ok: true });
});

// ── Leases ─────────────────────────────────────────────────────────

const LeaseInput = z.object({
  unit_id: z.number().int(),
  primary_tenant_id: z.number().int().nullable().optional(),
  start_date: z.string(),
  end_date: z.string(),
  monthly_rent: z.number().min(0).optional(),
  deposit: z.number().min(0).optional(),
  rent_due_day: z.number().int().min(1).max(31).optional(),
  late_fee: z.number().min(0).optional(),
  status: z.enum(["upcoming", "active", "ended", "cancelled"]).optional(),
  notes: z.string().optional().nullable(),
});

const LEASE_SELECT = `
  SELECT l.*,
    u.name as unit_name,
    p.id as property_id, p.name as property_name, p.color as property_color,
    t.first_name as tenant_first_name, t.last_name as tenant_last_name,
    t.email as tenant_email, t.phone as tenant_phone
  FROM leases l
  LEFT JOIN units u ON u.id = l.unit_id
  LEFT JOIN properties p ON p.id = u.property_id
  LEFT JOIN tenants t ON t.id = l.primary_tenant_id
`;

// Recompose a unit's occupancy from the lease truth (idempotent). P9: unit
// occupancy must never drift from the leases that actually exist, so every
// lease mutation and the dashboard summary converge through these helpers.
async function reconcileUnitOccupancy(unitId: number): Promise<void> {
  const unit = await get<{ status: string }>("SELECT status FROM units WHERE id = ?", [unitId]);
  if (!unit) return;
  const active = await get<{ n: number }>(
    "SELECT COUNT(*) as n FROM leases WHERE unit_id = ? AND status = 'active'", [unitId],
  );
  const target = reconcileUnitStatus(unit.status, active?.n ?? 0);
  if (target !== unit.status) {
    await run("UPDATE units SET status = ? WHERE id = ?", [target, unitId]);
  }
}

async function reconcileAllUnits(): Promise<{ checked: number; changed: number }> {
  const units = await query<{ id: number }>("SELECT id FROM units");
  let changed = 0;
  for (const u of units) {
    const before = await get<{ status: string }>("SELECT status FROM units WHERE id = ?", [u.id]);
    const active = await get<{ n: number }>(
      "SELECT COUNT(*) as n FROM leases WHERE unit_id = ? AND status = 'active'", [u.id],
    );
    const target = reconcileUnitStatus(before?.status ?? "vacant", active?.n ?? 0);
    if (target !== before?.status) {
      await run("UPDATE units SET status = ? WHERE id = ?", [target, u.id]);
      changed++;
    }
  }
  return { checked: units.length, changed };
}

app.get("/api/leases", async (c) => {
  const status = c.req.query("status");
  const tenantId = intParam(c.req.query("tenant_id"));
  const unitId = intParam(c.req.query("unit_id"));
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) { where.push("l.status = ?"); params.push(status); }
  if (tenantId) { where.push("l.primary_tenant_id = ?"); params.push(tenantId); }
  if (unitId) { where.push("l.unit_id = ?"); params.push(unitId); }
  const sql = `${LEASE_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY l.start_date DESC`;
  const rows = await query(sql, params);
  return c.json({ leases: rows });
});

app.get("/api/leases/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const row = await get(`${LEASE_SELECT} WHERE l.id = ?`, [id]);
  if (!row) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ lease: row });
});

app.post("/api/leases", async (c) => {
  const parsed = await parseJson(c, LeaseInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  // P9 — Occupancy integrity: reject a lease that claims a unit while an
  // active/upcoming lease on the same unit covers any overlapping period.
  if (leaseClaimsUnit(d.status ?? "active")) {
    const clash = await get<{ id: number }>(
      `SELECT l.id FROM leases l
        WHERE l.unit_id = ? AND l.status IN ('active', 'upcoming')
          AND l.start_date <= ? AND l.end_date >= ?
        LIMIT 1`,
      [d.unit_id, d.end_date, d.start_date],
    );
    if (clash) return c.json(err(ErrorCode.lease_conflict, "That unit already has a lease covering this period"), 409);
  }
  const result = await run(
    `INSERT INTO leases (unit_id, primary_tenant_id, start_date, end_date, monthly_rent, deposit, rent_due_day, late_fee, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.unit_id, d.primary_tenant_id ?? null, d.start_date, d.end_date, d.monthly_rent ?? 0, d.deposit ?? 0, d.rent_due_day ?? 1, d.late_fee ?? 0, d.status ?? "active", d.notes ?? null],
  );
  // Mark the unit as occupied if the new lease is active.
  if ((d.status ?? "active") === "active") {
    await run("UPDATE units SET status = 'occupied' WHERE id = ?", [d.unit_id]);
  }
  const row = await get(`${LEASE_SELECT} WHERE l.id = ?`, [result.lastInsertRowid]);
  return c.json({ lease: row }, 201);
});

app.put("/api/leases/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const parsed = await parseJson(c, LeaseInput.partial());
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  // P9 — Recheck overlap on edits touching dates/unit/status, excluding this
  // lease (so updating notes alone never trips the guard).
  const current = await get<{ unit_id: number; start_date: string; end_date: string; status: string }>(
    "SELECT unit_id, start_date, end_date, status FROM leases WHERE id = ?", [id],
  );
  if (current && leaseClaimsUnit(d.status ?? current.status)) {
    const clash = await get<{ id: number }>(
      `SELECT l.id FROM leases l
        WHERE l.unit_id = ? AND l.id != ? AND l.status IN ('active', 'upcoming')
          AND l.start_date <= ? AND l.end_date >= ?
        LIMIT 1`,
      [d.unit_id ?? current.unit_id, id, d.start_date ?? current.start_date, d.end_date ?? current.end_date],
    );
    if (clash) {
      return c.json(err(ErrorCode.lease_conflict, "That unit already has a lease covering this period"), 409);
    }
  }
  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE leases SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  const row = await get<{ id: number; unit_id: number }>(`${LEASE_SELECT} WHERE l.id = ?`, [id]);
  // P9 — An edit can open or close occupancy (e.g. status → ended/cancelled);
  // reconcile the unit to the lease truth so units.status never drifts.
  if (row?.unit_id) {
    await reconcileUnitOccupancy(row.unit_id).catch(() => undefined);
  }
  return c.json({ lease: row });
});


app.delete("/api/leases/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const lease = await get<{ unit_id: number }>("SELECT unit_id FROM leases WHERE id = ?", [id]);
  const r = await run("DELETE FROM leases WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  // P9 — The unit may now be vacant; reconcile its occupancy from the lease truth.
  if (lease) {
    await reconcileUnitOccupancy(lease.unit_id).catch(() => undefined);
  }
  return c.json({ ok: true });
});

// ── Rent charges & payments ────────────────────────────────────────

const ChargeInput = z.object({
  lease_id: z.number().int(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  due_date: z.string(),
  amount: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
});

const CHARGE_SELECT = `
  SELECT c.*,
    l.unit_id, l.monthly_rent as lease_rent, l.rent_due_day,
    u.name as unit_name,
    p.id as property_id, p.name as property_name, p.color as property_color,
    t.id as tenant_id, t.first_name as tenant_first_name, t.last_name as tenant_last_name
  FROM rent_charges c
  LEFT JOIN leases l ON l.id = c.lease_id
  LEFT JOIN units u ON u.id = l.unit_id
  LEFT JOIN properties p ON p.id = u.property_id
  LEFT JOIN tenants t ON t.id = l.primary_tenant_id
`;

// ── Overdue freshness ──────────────────────────────────────────────
// Shared read-path refresh: any open/partial charge that is past its due date
// with an outstanding balance is persisted as 'overdue'. Paid and waived
// charges are never touched. Idempotent — already-correct statuses are not
// rewritten, so repeated reads are harmless and produce no extra writes. The
// status guard on the write also makes concurrent payment updates safe: if a
// payment already set the charge 'paid'/'waived' between our read and write,
// the update no-ops instead of overwriting it back to 'overdue'.
async function markOverdue(): Promise<void> {
  const today = currentUtcDate();
  const candidates = await query<{ id: number; amount: number; amount_paid: number; due_date: string; status: string }>(
    "SELECT id, amount, amount_paid, due_date, status FROM rent_charges WHERE status IN ('open', 'partial')",
  );
  for (const charge of candidates) {
    if (isChargeOverdue(charge, today)) {
      await run(
        "UPDATE rent_charges SET status = 'overdue' WHERE id = ? AND status IN ('open', 'partial')",
        [charge.id],
      );
    }
  }
}

app.get("/api/rent-charges", async (c) => {
  await markOverdue();
  const period = c.req.query("period");
  const status = c.req.query("status");
  const where: string[] = [];
  const params: unknown[] = [];
  if (period) { where.push("c.period = ?"); params.push(period); }
  if (status) { where.push("c.status = ?"); params.push(status); }
  const sql = `${CHARGE_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY c.due_date, p.name, u.name`;
  const rows = await query(sql, params).catch(() => []);
  return c.json({ charges: rows });
});

app.post("/api/rent-charges", async (c) => {
  const parsed = await parseJson(c, ChargeInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  const result = await run(
    `INSERT INTO rent_charges (lease_id, period, due_date, amount, notes) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(lease_id, period) DO NOTHING`,
    [d.lease_id, d.period, d.due_date, d.amount ?? 0, d.notes ?? null],
  );
  if (!result.changes) {
    const existing = await get(`${CHARGE_SELECT} WHERE c.lease_id = ? AND c.period = ?`, [d.lease_id, d.period]);
    return c.json({ charge: existing });
  }
  const row = await get(`${CHARGE_SELECT} WHERE c.id = ?`, [result.lastInsertRowid]);
  return c.json({ charge: row }, 201);
});

// Generate (idempotent) charges for a given period across all active leases.
app.post("/api/rent-charges/generate", async (c) => {
  const body = await c.req.json().catch(() => ({})) as { period?: string };
  const period = body.period;
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return c.json(err(ErrorCode.period_required, "period (YYYY-MM) required"), 400);
  const leases = await query<{ id: number; monthly_rent: number; rent_due_day: number; end_date: string }>(
    "SELECT id, monthly_rent, rent_due_day, end_date FROM leases WHERE status = 'active'",
  );
  let created = 0;
  for (const plan of planChargeGeneration(leases, period)) {
    const r = await run(
      `INSERT INTO rent_charges (lease_id, period, due_date, amount) VALUES (?, ?, ?, ?)
         ON CONFLICT(lease_id, period) DO NOTHING`,
      [plan.lease_id, plan.period, plan.due_date, plan.amount],
    );
    if (r.changes) created++;
  }
  // Re-mark anything past due as 'overdue'.
  await markOverdue();
  return c.json({ created, period });
});

app.put("/api/rent-charges/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const Patch = z.object({
    amount: z.number().min(0).optional(),
    due_date: z.string().optional(),
    status: z.enum(["open", "partial", "paid", "overdue", "waived"]).optional(),
    notes: z.string().optional().nullable(),
  });
  const parsed = await parseJson(c, Patch);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE rent_charges SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);

  // ── Financial recomputation after edit ──────────────────────────
  // Recompute amount_paid from existing payments (payments are never mutated).
  const charge = await get<{ amount: number; status: string; due_date: string }>("SELECT amount, status, due_date FROM rent_charges WHERE id = ?", [id]);
  if (charge) {
    const sumRow = await get<{ total: number }>("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE charge_id = ?", [id]);
    const paid = sumRow?.total ?? 0;
    let newStatus = charge.status;

    if (charge.status === "waived") {
      // Waived charges keep their status — no auto-recompute.
    } else {
      // Derive status from payment state using existing business rules.
      newStatus = computeChargeStatus(charge.amount, paid);
      // Check overdue rule for open/partial charges.
      if (newStatus !== "paid") {
        const today = currentUtcDate();
        if (isChargeOverdue({ amount: charge.amount, amount_paid: paid, due_date: charge.due_date, status: newStatus }, today)) {
          newStatus = "overdue";
        }
      }
    }
    await run("UPDATE rent_charges SET amount_paid = ?, status = ? WHERE id = ?", [paid, newStatus, id]);
  }

  const row = await get(`${CHARGE_SELECT} WHERE c.id = ?`, [id]);
  return c.json({ charge: row });
});

app.delete("/api/rent-charges/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const r = await run("DELETE FROM rent_charges WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ ok: true });
});

const PaymentInput = z.object({
  charge_id: z.number().int(),
  paid_at: z.string().optional(),
  amount: z.number().min(0),
  method: z.enum(["cash", "check", "ach", "credit", "other"]).optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

app.get("/api/rent-charges/:id/payments", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const rows = await query("SELECT * FROM payments WHERE charge_id = ? ORDER BY paid_at DESC", [id]);
  return c.json({ payments: rows });
});

app.post("/api/payments", async (c) => {
  const parsed = await parseJson(c, PaymentInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  await run(
    `INSERT INTO payments (charge_id, paid_at, amount, method, reference, notes)
     VALUES (?, COALESCE(?, datetime('now')), ?, ?, ?, ?)`,
    [d.charge_id, d.paid_at ?? null, d.amount, d.method ?? "cash", d.reference ?? null, d.notes ?? null],
  );
  // Recompute the charge's amount_paid + status.
  const charge = await get<{ amount: number }>("SELECT amount FROM rent_charges WHERE id = ?", [d.charge_id]);
  if (!charge) return c.json(err(ErrorCode.charge_not_found, "Charge not found"), 404);
  const sumRow = await get<{ total: number }>("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE charge_id = ?", [d.charge_id]);
  const paid = Number(sumRow?.total ?? 0);
  const status = computeChargeStatus(charge.amount, paid);
  await run("UPDATE rent_charges SET amount_paid = ?, status = ? WHERE id = ?", [paid, status, d.charge_id]);
  const updated = await get(`${CHARGE_SELECT} WHERE c.id = ?`, [d.charge_id]);
  return c.json({ charge: updated }, 201);
});

app.delete("/api/payments/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const row = await get<{ charge_id: number }>("SELECT charge_id FROM payments WHERE id = ?", [id]);
  if (!row) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  await run("DELETE FROM payments WHERE id = ?", [id]);
  // Recompute the charge.
  const sumRow = await get<{ total: number }>("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE charge_id = ?", [row.charge_id]);
  const charge = await get<{ amount: number }>("SELECT amount FROM rent_charges WHERE id = ?", [row.charge_id]);
  const paid = Number(sumRow?.total ?? 0);
  const status = !charge ? "open" : computeChargeStatus(charge.amount, paid);
  await run("UPDATE rent_charges SET amount_paid = ?, status = ? WHERE id = ?", [paid, status, row.charge_id]);
  return c.json({ ok: true });
});

// ── Vendors ────────────────────────────────────────────────────────

const VendorInput = z.object({
  name: z.string().min(1),
  category: z.enum(["plumber", "electrician", "hvac", "handyman", "cleaning", "landscaping", "general"]).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  color: z.string().optional(),
});

app.get("/api/vendors", async (c) => {
  const rows = await query("SELECT * FROM vendors ORDER BY name");
  return c.json({ vendors: rows });
});

app.post("/api/vendors", async (c) => {
  const parsed = await parseJson(c, VendorInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  const result = await run(
    "INSERT INTO vendors (name, category, phone, email, notes, color) VALUES (?, ?, ?, ?, ?, ?)",
    [d.name, d.category ?? "general", d.phone ?? null, d.email ?? null, d.notes ?? null, d.color ?? "slate"],
  );
  const row = await get("SELECT * FROM vendors WHERE id = ?", [result.lastInsertRowid]);
  return c.json({ vendor: row }, 201);
});

app.put("/api/vendors/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const parsed = await parseJson(c, VendorInput.partial());
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE vendors SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  const row = await get("SELECT * FROM vendors WHERE id = ?", [id]);
  return c.json({ vendor: row });
});

app.delete("/api/vendors/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const r = await run("DELETE FROM vendors WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ ok: true });
});

// ── Work orders ────────────────────────────────────────────────────

const WorkOrderInput = z.object({
  property_id: z.number().int().nullable().optional(),
  unit_id: z.number().int().nullable().optional(),
  tenant_id: z.number().int().nullable().optional(),
  vendor_id: z.number().int().nullable().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["open", "assigned", "in_progress", "completed", "cancelled"]).optional(),
  scheduled_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  cost: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const WO_SELECT = `
  SELECT w.*,
    p.name as property_name, p.color as property_color,
    u.name as unit_name,
    t.first_name as tenant_first_name, t.last_name as tenant_last_name,
    v.name as vendor_name, v.color as vendor_color
  FROM work_orders w
  LEFT JOIN properties p ON p.id = w.property_id
  LEFT JOIN units u ON u.id = w.unit_id
  LEFT JOIN tenants t ON t.id = w.tenant_id
  LEFT JOIN vendors v ON v.id = w.vendor_id
`;

app.get("/api/work-orders", async (c) => {
  const status = c.req.query("status");
  const propertyId = intParam(c.req.query("property_id"));
  const where: string[] = [];
  const params: unknown[] = [];
  if (status) { where.push("w.status = ?"); params.push(status); }
  if (propertyId) { where.push("w.property_id = ?"); params.push(propertyId); }
  const sql = `${WO_SELECT}${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY
    CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
    w.created_at DESC`;
  const rows = await query(sql, params).catch(() => []);
  return c.json({ work_orders: rows });
});

app.post("/api/work-orders", async (c) => {
  const parsed = await parseJson(c, WorkOrderInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  // P7 completion stamp: an order created directly as "completed" without a
  // timestamp receives one, keeping the invariant consistent with the edit path.
  if (d.status === "completed" && d.completed_at == null) {
    d.completed_at = new Date().toISOString();
  }
  const result = await run(
    `INSERT INTO work_orders (property_id, unit_id, tenant_id, vendor_id, title, description, priority, status, scheduled_at, completed_at, cost, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.property_id ?? null, d.unit_id ?? null, d.tenant_id ?? null, d.vendor_id ?? null,
      d.title, d.description ?? null,
      d.priority ?? "normal", d.status ?? "open",
      d.scheduled_at ?? null, d.completed_at ?? null,
      d.cost ?? null, d.notes ?? null,
    ],
  );
  const row = await get(`${WO_SELECT} WHERE w.id = ?`, [result.lastInsertRowid]);
  return c.json({ work_order: row }, 201);
});

app.put("/api/work-orders/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const parsed = await parseJson(c, WorkOrderInput.partial());
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);

  // P7 completion stamp: when an edit moves a work order to "completed" and no
  // completion timestamp is supplied (including an explicit null), stamp it
  // once. Re-editing an already completed order without changing the completion
  // state preserves the original timestamp instead of clearing or re-stamping it.
  if (parsed.data.status === "completed") {
    const existing = await get<{ completed_at: string | null }>("SELECT completed_at FROM work_orders WHERE id = ?", [id]);
    if (!existing) return c.json(err(ErrorCode.not_found, "Not found"), 404);
    const desired = parsed.data.completed_at === undefined ? existing.completed_at : parsed.data.completed_at;
    if (desired == null) {
      parsed.data.completed_at = new Date().toISOString();
    }
  }

  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE work_orders SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  const row = await get(`${WO_SELECT} WHERE w.id = ?`, [id]);
  return c.json({ work_order: row });
});

app.delete("/api/work-orders/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const r = await run("DELETE FROM work_orders WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ ok: true });
});

// ── Applications ───────────────────────────────────────────────────

const ApplicationInput = z.object({
  unit_id: z.number().int().nullable().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  monthly_income: z.number().optional().nullable(),
  employer: z.string().optional().nullable(),
  desired_move_in: z.string().optional().nullable(),
  status: z.enum(["new", "screening", "approved", "declined", "withdrawn"]).optional(),
  notes: z.string().optional().nullable(),
});

app.get("/api/applications", async (c) => {
  const rows = await query(
    `SELECT a.*, u.name as unit_name, p.name as property_name
     FROM applications a
     LEFT JOIN units u ON u.id = a.unit_id
     LEFT JOIN properties p ON p.id = u.property_id
     ORDER BY a.created_at DESC`,
  ).catch(() => []);
  return c.json({ applications: rows });
});

app.post("/api/applications", async (c) => {
  const parsed = await parseJson(c, ApplicationInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const d = parsed.data;
  const result = await run(
    `INSERT INTO applications (unit_id, first_name, last_name, email, phone, monthly_income, employer, desired_move_in, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.unit_id ?? null, d.first_name, d.last_name,
      d.email ?? null, d.phone ?? null, d.monthly_income ?? null, d.employer ?? null,
      d.desired_move_in ?? null, d.status ?? "new", d.notes ?? null,
    ],
  );
  const row = await get(
    `SELECT a.*, u.name as unit_name, p.name as property_name
     FROM applications a LEFT JOIN units u ON u.id = a.unit_id LEFT JOIN properties p ON p.id = u.property_id
     WHERE a.id = ?`,
    [result.lastInsertRowid],
  );
  return c.json({ application: row }, 201);
});

app.put("/api/applications/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const parsed = await parseJson(c, ApplicationInput.partial());
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { sets, params } = buildUpdate(parsed.data);
  if (!sets.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  const r = await run(`UPDATE applications SET ${sets.join(", ")} WHERE id = ?`, params);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  const row = await get(
    `SELECT a.*, u.name as unit_name, p.name as property_name
     FROM applications a LEFT JOIN units u ON u.id = a.unit_id LEFT JOIN properties p ON p.id = u.property_id
     WHERE a.id = ?`,
    [id],
  );
  return c.json({ application: row });
});

app.delete("/api/applications/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const r = await run("DELETE FROM applications WHERE id = ?", [id]);
  if (!r.changes) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  return c.json({ ok: true });
});

// ── Dashboard summary ──────────────────────────────────────────────

app.get("/api/dashboard/summary", async (c) => {
  // Refresh overdue states first so summary metrics reflect current statuses.
  await markOverdue().catch(() => undefined);
  const today = new Date().toISOString().slice(0, 10);
  const periodNow = today.slice(0, 7);

  const safeGet = <T,>(sql: string, params: unknown[] = [], fallback: T) =>
    get<T>(sql, params).catch(() => fallback as T | undefined).then((v) => v ?? fallback);
  const safeQuery = <T,>(sql: string, params: unknown[] = []): Promise<T[]> =>
    query<T>(sql, params).catch(() => [] as T[]);

  const [
    propertyCount,
    unitCount,
    occupiedCount,
    vacantCount,
    activeLeases,
    upcomingMoveOuts,
    monthOutstanding,
    monthCollected,
    overdueRow,
    openWorkOrders,
    urgentWorkOrders,
    recentWorkOrders,
    upcomingExpirations,
  ] = await Promise.all([
    safeGet<{ n: number }>("SELECT COUNT(*) as n FROM properties", [], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*) as n FROM units", [], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*) as n FROM units WHERE status = 'occupied'", [], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*) as n FROM units WHERE status = 'vacant'", [], { n: 0 }),
    safeGet<{ n: number }>("SELECT COUNT(*) as n FROM leases WHERE status = 'active'", [], { n: 0 }),
    safeGet<{ n: number }>(
      "SELECT COUNT(*) as n FROM leases WHERE status = 'active' AND end_date <= date('now', '+30 days')",
      [], { n: 0 },
    ),
    safeGet<{ total: number }>(
      "SELECT COALESCE(SUM(amount - amount_paid), 0) as total FROM rent_charges WHERE period = ? AND status != 'waived'",
      [periodNow], { total: 0 },
    ),
    safeGet<{ total: number }>(
      "SELECT COALESCE(SUM(amount_paid), 0) as total FROM rent_charges WHERE period = ?",
      [periodNow], { total: 0 },
    ),
    safeGet<{ total: number; n: number }>(
      "SELECT COALESCE(SUM(amount - amount_paid), 0) as total, COUNT(*) as n FROM rent_charges WHERE due_date < date('now') AND amount_paid < amount AND status != 'waived'",
      [], { total: 0, n: 0 },
    ),
    safeGet<{ n: number }>(
      "SELECT COUNT(*) as n FROM work_orders WHERE status NOT IN ('completed', 'cancelled')",
      [], { n: 0 },
    ),
    safeGet<{ n: number }>(
      "SELECT COUNT(*) as n FROM work_orders WHERE priority = 'urgent' AND status NOT IN ('completed', 'cancelled')",
      [], { n: 0 },
    ),
    safeQuery<{ id: number; title: string; priority: string; status: string; property_name: string | null; unit_name: string | null; created_at: string }>(
      `SELECT w.id, w.title, w.priority, w.status, p.name as property_name, u.name as unit_name, w.created_at
       FROM work_orders w
       LEFT JOIN properties p ON p.id = w.property_id
       LEFT JOIN units u ON u.id = w.unit_id
       WHERE w.status NOT IN ('completed', 'cancelled')
       ORDER BY CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, w.created_at DESC
       LIMIT 6`,
    ),
    safeQuery<{ id: number; end_date: string; tenant_first_name: string | null; tenant_last_name: string | null; unit_name: string | null; property_name: string | null }>(
      `SELECT l.id, l.end_date,
         t.first_name as tenant_first_name, t.last_name as tenant_last_name,
         u.name as unit_name, p.name as property_name
       FROM leases l
       LEFT JOIN tenants t ON t.id = l.primary_tenant_id
       LEFT JOIN units u ON u.id = l.unit_id
       LEFT JOIN properties p ON p.id = u.property_id
       WHERE l.status = 'active' AND l.end_date <= date('now', '+60 days')
       ORDER BY l.end_date ASC LIMIT 6`,
    ),
  ]);

  return c.json({
    period: periodNow,
    properties: propertyCount.n,
    units: unitCount.n,
    occupied: occupiedCount.n,
    vacant: vacantCount.n,
    occupancy_rate: unitCount.n ? Math.round((occupiedCount.n / unitCount.n) * 100) : 0,
    active_leases: activeLeases.n,
    upcoming_move_outs: upcomingMoveOuts.n,
    month_outstanding: monthOutstanding.total,
    month_collected: monthCollected.total,
    overdue_total: overdueRow.total,
    overdue_count: overdueRow.n,
    open_work_orders: openWorkOrders.n,
    urgent_work_orders: urgentWorkOrders.n,
    recent_work_orders: recentWorkOrders,
    upcoming_expirations: upcomingExpirations,
  });
});

// ── Settings (key/value) ───────────────────────────────────────────

app.get("/api/settings", async (c) => {
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings").catch(() => []);
  // Defaults first, so a caller always gets a currency and a due day even if
  // the seed has not run yet (a brand-new database, or a deleted row).
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return c.json({ settings: out });
});

app.put("/api/settings", async (c) => {
  const user = c.get("user");
  const authEnabled = await isAuthEnabled();
  // When auth is enabled, only admin/owner can update settings
  if (authEnabled && (!user || !hasMinimumRole(user.role, "admin"))) {
    return c.json(err(ErrorCode.forbidden, "Forbidden"), 403);
  }
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json(err(ErrorCode.invalid_json, "Invalid JSON"), 400); }
  if (!body || typeof body !== "object") return c.json(err(ErrorCode.invalid_body, "Body must be an object"), 400);
  const entries = Object.entries(body as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null);
  for (const [key, value] of entries) {
    await run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, String(value)],
    );
  }
  if (entries.some(([k]) => k === "AUTH_ENABLED")) resetAuthCache();
  const rows = await query<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return c.json({ settings: out });
});

// ── Occupancy integrity (admin) ───────────────────────────────────

// P9 — Force a full occupancy reconciliation across all units. Idempotent:
// converges each units.status to whatever the active leases require, so a
// drifted row is fixed on demand by an admin.
app.post("/api/admin/reconcile-occupancy", async (c) => {
  const user = c.get("user");
  if (!user || !hasMinimumRole(user.role, "admin")) {
    return c.json(err(ErrorCode.forbidden, "Forbidden"), 403);
  }
  const result = await reconcileAllUnits();
  return c.json(result);
});

// ── User management (owner + admin) ──────────────────────────────

app.get("/api/users", async (c) => {
  const user = c.get("user");
  if (!user || !hasMinimumRole(user.role, "admin")) {
    return c.json(err(ErrorCode.forbidden, "Forbidden"), 403);
  }
  const rows = await query<{ id: number; email: string; display_name: string; role: string; created_at: string }>(
    "SELECT id, email, display_name, role, created_at FROM users ORDER BY created_at",
  );
  return c.json({ users: rows });
});

const CreateUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1),
  role: z.enum(["owner", "admin", "manager"]),
});

app.post("/api/users", async (c) => {
  const user = c.get("user");
  if (!user || !hasMinimumRole(user.role, "admin")) {
    return c.json(err(ErrorCode.forbidden, "Forbidden"), 403);
  }
  const parsed = await parseJson(c, CreateUserInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { email, password, display_name, role } = parsed.data;
  // Only owners can create other owners
  if (role === "owner" && user.role !== "owner") {
    return c.json(err(ErrorCode.forbidden, "Only owners can create owner accounts"), 403);
  }
  const existing = await get<{ id: number }>("SELECT id FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (existing) return c.json(err(ErrorCode.email_taken, "Email already in use"), 409);
  const password_hash = await hashPassword(password);
  const result = await run(
    "INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
    [email.toLowerCase().trim(), password_hash, display_name.trim(), role],
  );
  const created = await get<{ id: number; email: string; display_name: string; role: string; created_at: string }>(
    "SELECT id, email, display_name, role, created_at FROM users WHERE id = ?",
    [result.lastInsertRowid],
  );
  return c.json({ user: created }, 201);
});

const UpdateUserInput = z.object({
  display_name: z.string().min(1).optional(),
  role: z.enum(["owner", "admin", "manager"]).optional(),
  password: z.string().min(8).optional(),
});

app.put("/api/users/:id", async (c) => {
  const caller = c.get("user");
  if (!caller || !hasMinimumRole(caller.role, "admin")) {
    return c.json(err(ErrorCode.forbidden, "Forbidden"), 403);
  }
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  const target = await get<{ id: number; role: string }>("SELECT id, role FROM users WHERE id = ?", [id]);
  if (!target) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  // Non-owners cannot modify owner accounts
  if (target.role === "owner" && caller.role !== "owner") {
    return c.json(err(ErrorCode.cannot_modify_owner, "Cannot modify owner account"), 403);
  }
  const parsed = await parseJson(c, UpdateUserInput);
  if (!parsed.ok) return c.json(err(parsed.code, parsed.error), 400);
  const { display_name, role, password } = parsed.data;
  // Only owners can assign owner role
  if (role === "owner" && caller.role !== "owner") {
    return c.json(err(ErrorCode.forbidden, "Only owners can assign owner role"), 403);
  }
  const updates: string[] = [];
  const params: unknown[] = [];
  if (display_name !== undefined) { updates.push("display_name = ?"); params.push(display_name.trim()); }
  if (role !== undefined) { updates.push("role = ?"); params.push(role); }
  if (password !== undefined) { updates.push("password_hash = ?"); params.push(await hashPassword(password)); }
  if (!updates.length) return c.json(err(ErrorCode.no_fields, "No fields"), 400);
  params.push(id);
  await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
  if (role) await deleteUserSessions(id);
  const updated = await get<{ id: number; email: string; display_name: string; role: string; created_at: string }>(
    "SELECT id, email, display_name, role, created_at FROM users WHERE id = ?", [id],
  );
  return c.json({ user: updated });
});

app.delete("/api/users/:id", async (c) => {
  const caller = c.get("user");
  if (!caller || caller.role !== "owner") {
    return c.json(err(ErrorCode.forbidden, "Only owners can delete users"), 403);
  }
  const id = intParam(c.req.param("id"));
  if (!id) return c.json(err(ErrorCode.invalid_id, "Invalid ID"), 400);
  if (id === caller.userId) return c.json(err(ErrorCode.cannot_delete_self, "Cannot delete your own account"), 409);
  const target = await get<{ id: number }>("SELECT id FROM users WHERE id = ?", [id]);
  if (!target) return c.json(err(ErrorCode.not_found, "Not found"), 404);
  await deleteUserSessions(id);
  await run("DELETE FROM users WHERE id = ?", [id]);
  return c.json({ ok: true });
});

// ── Health ─────────────────────────────────────────────────────────

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;

// Test hook: lets integration tests start from an unseeded database (Vitest
// runs each test in the same module instance, so the fast-path flag needs a
// way back to false).
export function resetSeedForTests(): void {
  seeded = false;
  resetAuthCache();
}
