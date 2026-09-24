# 02 — Architecture

## Component diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT  src/client/ (React 19 SPA, single mount point #app)             │
│                                                                         │
│  main.tsx ──▶ App (app.tsx)                                             │
│   ├─ AppNav (@clawnify/app/client) — standalone rail OR embedded host   │
│   ├─ useRouter() — pushState URL ↔ Route union                          │
│   ├─ useAppState() — global data via AppContext (use-app-state.ts)      │
│   └─ <PageShell> per screen; <ErrorBanner> global                      │
│   Pages: Dashboard, Properties(+detail), Tenants(+detail), Leases,      │
│          Rent, Maintenance, Settings                                    │
│   Data access: api.ts → fetch("/api/...")  (same origin, Vite proxy)    │
│   Types: types.ts (entities + joined view models + input types)         │
└─────────────────────────────────────────────────────────────────────────┘
                              │ /api/* (JSON over HTTP) + Vite proxy
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVER  src/server/ (Hono worker, run by wrangler dev / Cloudflare)     │
│                                                                         │
│  index.ts                                                               │
│   ├─ app.use("*") → initDB(c.env) + ensureSeeded() (per isolate, each   │
│   │   request; seeding cached in a module-level `seeded` flag)          │
│   ├─ Entity CRUD: properties, units, tenants, leases, rent-charges,     │
│   │   payments, vendors, work-orders, applications                      │
│   ├─ generate charges (idempotent) + dashboard/summary + settings       │
│   ├─ Zod schemas on every write; intParam guards on every id           │
│   └─ /api/health                                                        │
│  db.ts → @clawnify/db raw adapter (initDB, query, get, run)             │
└─────────────────────────────────────────────────────────────────────────┘
                              ▼
        D1 (prod)  |  STORAGE RPC (Clawnify preview) | miniflare SQLite (local)
```

## Key architectural decisions `[VERIFIED unless noted]`

1. **One codebase, identical locally/production.** Hono worker + D1-native storage; local dev
   substitutes miniflare SQLite. The dev script applies the same `schema.sql`.
2. **Raw SQL, not an ORM.** The app uses `@clawnify/db`'s raw `query/get/run` API. Drizzle is
   available transitively and is the *preferred* path for new apps (`getDB`), but OpenProperty
   does not use it. `[VERIFIED — src/server/db.ts is a 1-line re-export]`.
3. **Schema as DDL-only SQL, seed in application code.** `schema.sql` contains only
   `CREATE TABLE IF NOT EXISTS` + indexes. A seed INSERT there would break the Clawnify deploy
   pipeline (DDL-only apply), so sample data is written by `ensureSeeded()` guarded by
   `COUNT(*) = 0` checks. Re-deploy never resurrects deleted rows.
4. **Separate HTTP surfaces, single origin in dev.** Vite `server.proxy` forwards `/api` → 8787;
   the SPA calls relative `/api/...` paths, so no CORS is configured anywhere.
5. **`@clawnify/app` dual-mode shell.** The app declares its own nav; standalone it renders a
   sidebar, embedded in the Clawnify dashboard it hands the nav to the host via a postMessage
   bridge (`reportLocation` keeps the URL shareable/restorable). `AppNav` injects its own CSS;
   `styles.css` re-paints it at `aside.cn-nav` specificity.
6. **Per-isolate seeding with a fast path.** `seeded` module flag avoids repeated COUNT queries;
   on error it resets so the next request retries. Cold-DB mid-migration is tolerated.
7. **Denormalized JOIN views in SQL.** Read endpoints return joined payloads (e.g., unit →
   property name, lease → tenant/property/unit, charge → lease/unit/property/tenant) so the UI
   needs no cross-table client joins.

## Data flow — one request

1. Browser renders screen component → calls `useApp()`/`api()`.
2. `fetch("/api/...")` → Vite proxy → Wrangler worker.
3. Middleware: `initDB(c.env)` (binds env.DB) → `ensureSeeded()` (maybe).
4. Route handler: parse params (`intParam`), optional Zod body validation via `parseJson`, run
   SQL via the adapter, return `c.json(payload)`.
5. Client: `api.ts` parses JSON, throws `Error(msg)` on `!r.ok`, component updates state or
   surfaces the error via `ErrorBanner` (global bottom toast).

## Write-path conventions `[VERIFIED]`

- **create** → `INSERT`, return `{ property/unit/... }` with status 201.
- **update** → partial `PUT /:id` via `buildUpdate()` (only defined fields become `SET k = ?`).
- **delete** → `DELETE /:id`, return `{ ok: true }`.
- Missing ids → 400 `{ error: "Invalid ID" }`; not found rows → 404 `{ error: "Not found" }`;
  validation failures → 400 `{ error: "<details>" }`.

## Development vs. production topology

| Concern | Local dev | Production |
|---|---|---|
| Static assets | Vite dev server (:5173) | Hosted by Clawnify (or add `assets` to wrangler for raw CF) `[UNKNOWN for raw CF — wrangler.toml has no assets config]` |
| API | Wrangler dev (:8787) | Cloudflare Workers |
| Database | miniflare SQLite (`.wrangler/state/v3/d1`) | D1 database `open-property-db` (binding `DB`) |
| Migrations | `wrangler d1 execute --local --file=schema.sql` | Deploy pipeline applies DDL `[RECOMMENDATION: verify exact mechanism]` |
| Env/secrets | none | none required |

## Build / verify pipeline `[VERIFIED]`

- `pnpm typecheck` → `tsc --noEmit` (passes cleanly at baseline).
- `pnpm build` → `vite build` (emits `dist/`).
- `pnpm db:migrate` → D1 local DDL apply.
- No test suite exists. `[VERIFIED — no test files, no test script]`

## Coupling notes

- **Tight coupling to `@clawnify` packages**: nav/shell and the DB adapter come from Clawnify
  SDK packages (`@clawnify/app`, `@clawnify/db`, transitively `@clawnify/routes`). Locked by
  `pnpm-lock.yaml`; `pnpm-workspace.yaml` pins `minimumReleaseAgeExclude` for `@clawnify/app@0.2.1`.
  Changing/forks of these packages ripple across the app. `[RECOMMENDATION: vendor the two things
  that must survive a fork (adapter + nav) before commercializing]`
- **CSS hand-tuned around the SDK rail** (`aside.cn-nav` overrides). If the rail implementation
  changes, colors/geometry may need re-tuning. `[INFERENCE]`