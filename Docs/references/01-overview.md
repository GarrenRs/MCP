# 01 — Overview

## Product identity

Identity split — see `Docs/current/14-brand-architecture.md` `[PROJECT DECISION]`:

- **OpenProperty** — the **upstream / open-source technical foundation** this repo contains
  (MIT-licensed, built on the Clawnify template format). This document's technical content
  (stack, features, quick start, system map) describes the foundation as it exists at baseline.
- **ORKESTRIX Property System** — the **commercial localized product** built from this foundation
  (V1 target: Algerian market, French UI, DZD). OpenProperty and ORKESTRIX Property System are
  **not the same identity**; V1 executes on this codebase but ships under the ORKESTRIX Property
  System identity.

The following foundation description is preserved verbatim from the baseline audit:

- **OpenProperty** — open-source *property management software*, positioned as a self-hosted,
  cloud-based alternative to TenantCloud / AppFolio / Buildium / Propertyware for landlords,
  small property managers, and multi-family back-office teams.
- Built on the **Clawnify** template format: one codebase that runs identically locally and in
  production, deployable via `clawnify deploy` or wired directly to Cloudflare Workers + D1.
- License: MIT `[VERIFIED — package.json / LICENSE]`.

## Core feature set (what the product actually does)

- **Dashboard** — portfolio KPIs (occupancy, active leases, outstanding/collected/overdue rent,
  open & urgent work orders, upcoming lease expirations) for the current month.
- **Properties & units** — property cards (type, address, color tag, occupancy snapshot),
  per-property page with summary tiles, unit grid, and property work orders; units track
  bedrooms, bathrooms, sqft, market rent, and status.
- **Tenants** — searchable list (client-side) and detail page (active lease, contact, employer,
  income, emergency contact, lease history).
- **Leases** — list with active/upcoming/ended/all filters, tenant/unit/property columns,
  edit-in-dialog with start/end, rent, deposit, due day, late fee, status.
- **Rent ledger** — per-period charges generated idempotently from active leases, period
  navigator, charged/collected/outstanding/overdue totals, payment recording with automatic
  status recomputation, payment removal.
- **Maintenance** — work orders with priority and status, filter tabs (open/unassigned/assigned/
  in progress/completed/all), property + unit + vendor linkage, scheduled date, cost.
- **Vendors & settings** — vendor directory by category; rent-policy defaults (due day, late
  fee, grace days, currency).

## Explicitly out of scope (from README)

Listing syndication, credit/background screening, 2-way SMS/email, online payment processing,
public tenant/owner portals.

## Stack `[VERIFIED — package.json, wrangler.toml, vite.config.ts]`

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript (strict), Tailwind CSS v4, shadcn/ui primitives (Radix), lucide-react + @phosphor-icons/react icons |
| Backend | Hono 4 on Cloudflare Workers (`wrangler dev` locally), Zod validation |
| Database | Cloudflare D1 (SQLite). Local dev: `wrangler` + miniflare SQLite under `.wrangler/state/v3/d1` |
| Data adapter | `@clawnify/db` raw SQL API (`initDB/query/get/run`) — dual binding D1 (prod) / STORAGE (preview) |
| Shell/SDK | `@clawnify/app/client` — `AppNav`, `reportLocation`, nav items, tile icons (standalone rail or embedded in the Clawnify dashboard) |
| Package manager | pnpm (v11, `pnpm-workspace.yaml` present; `pnpm-lock.yaml` committed) |
| Routing | In-app pushState router (`use-router.ts`); nav metadata shared with `@clawnify/app` |
| Deploy | Clawnify CLI (`clawnify deploy`) or raw Cloudflare (binding `DB`, database `open-property-db`) |

## Runtime requirements

- Node.js ≥ 18 (`pnpm dev` tested on Node v24.12.0 `[VERIFIED]`).
- pnpm ≥ 9 (tested pnpm 11.1.2 `[VERIFIED]`).
- `workerd` and `esbuild` build scripts enabled via `pnpm-workspace.yaml -> allowBuilds` `[VERIFIED]`.
- No environment variables or secret files are required; `.env`, `.env.local`, `.dev.vars` are not
  present and not referenced `[VERIFIED]`.

## Quick start (verified working)

```bash
pnpm install
pnpm dev        # = "pnpm db:migrate && concurrently -n ui,api 'vite' 'wrangler dev --port 8787'"
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787` (`/api/health` → `{"ok":true}`)
- Vite proxies `/api/*` to `http://localhost:8787` `[VERIFIED — vite.config.ts]`
- `pnpm db:migrate` applies `src/server/schema.sql` to the **local** D1 database `[VERIFIED]`.

## System map (final report section A — condensed)

```
Browser
  │
  ├─ http://localhost:5173        Vite dev server (React 19 SPA)
  │     └─ /api/*  → proxy → http://localhost:8787
  │
  └─ http://localhost:8787        Wrangler dev (Hono Worker, nodejs_compat)
        ├─ GET/POST/PUT/DELETE /api/<entity>  (zod-validated)
        ├─ middleware: initDB(env) + ensureSeeded() on EVERY request
        └─ @clawnify/db → D1 (local miniflare SQLite)

┌────────────────────────────── Client app (src/client/) ──────────────────────────────┐
│ app.tsx      shell + route dispatch          context.tsx   AppContext provider        │
│ use-router   pushState routing               use-app-state global lookups + mutations │
│ api.ts       fetch wrapper (JSON + error)    types.ts     entity + view models        │
│ lib/utils    cn, colors, dates, money, period helpers                                 │
│ components/  page-shell, error-banner, dashboard, properties, tenants, leases,        │
│              rent, maintenance, settings, ui/ (shadcn primitives)                     │
└───────────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────── Server (src/server/) ──────────────────────────────────┐
│ index.ts  Hono routes for all entities + dashboard summary + settings + health       │
│ db.ts     re-export of @clawnify/db (initDB, query, get, run)                        │
│ schema.sql Tables + indexes (DDL only; no seed data)                                 │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

## Local database state at baseline `[VERIFIED — wrangler d1 execute]`

| Table | Rows | Notes |
|---|---|---|
| properties | 3 | seed: Oakwood Estate, Honeybee Hideaway, 308 Mission Apartments |
| units | 5 | seed; 4 occupied / 1 vacant |
| tenants | 0 | no seed |
| leases | 0 | no seed |
| rent_charges | 0 | none generated yet |
| payments | 0 | — |
| vendors | 3 | seed: Emerald Pool Service, Hill Country Plumbing, Bright Spark Electric |
| work_orders | 0 | — |
| applications | 0 | — |
| settings | 4 | default_rent_due_day, late_fee_amount, late_fee_grace_days, currency |

The seed path is `ensureSeeded()` in `src/server/index.ts` (settings + demo properties/units/
vendors), not `schema.sql` — see `03-database.md`. Dashboard shows empty rent/maintenance until
a tenant, lease, and charges are created manually. `[VERIFIED]`