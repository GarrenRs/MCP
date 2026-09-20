# 11 — Audit Verification Register

Consolidated triage of the audit evidence. The baseline is the working tree at commit `98bfc4a`
(2026-09-20) with a clean `pnpm typecheck` and a running `pnpm dev`.

> **AUTHORITATIVE PROJECT DECISION (not a source-code fact):** the commercial product identity
> is **ORKESTRIX Property System**; **OpenProperty** is its upstream open-source foundation.
> See `Docs/14-brand-architecture.md`. All `[VERIFIED]` statements below concern the OpenProperty
> foundation code as observed; they make no claim about the commercial product.

## VERIFIED FACTS (observed directly)

1. **Stack & tooling** — node v24.12.0, pnpm 11.1.2; lockfile committed; `pnpm-workspace.yaml`
   present; wrangler 4.86.0, vite 6.4.2, react 19.2.5, hono 4.12.15, zod 3.25.76.
2. **Dev run** — `pnpm dev` = `db:migrate` + concurrent `vite` (:5173) + `wrangler dev --port
   8787`. Verified live: `GET /api/health` → `{"ok":true}`; proxy `:5173/api/health` works;
   dashboard summary returns seeded counts.
3. **Schema applied** — `pnpm db:migrate` executed 25 statements successfully on local D1.
4. **Local DB state** — 13 tables (11 business + `sqlite_sequence`, `_cf_METADATA`); rows:
   3 properties, 5 units, 0 tenants, 0 leases, 0 rent_charges, 0 payments, 3 vendors, 0
   work_orders, 0 applications, 4 settings.
5. **Foreign keys ON** — `PRAGMA foreign_keys` → 1 on the local connection; cascade behaviors
   are live.
6. **Typecheck clean** — `pnpm typecheck` exits 0 with no diagnostics.
7. **No secrets/env** — no `.env*`, no `.dev.vars`, no `.npmrc`; nothing sensitive to commit.
8. **All 29 files of client + server + schema read** for this audit (see Doc map).
9. **API surface** — 44 endpoint declarations mapped to the UI (see 04).
10. **UI surface** — 9 routes; pages: dashboard, properties(+detail), tenants(+detail), leases,
    rent, maintenance, settings (+ not-found).
11. **Backend-only features** — applications CRUD; charge PATCH; `completed_at`; tenant `?q=`;
    lease status filter.
12. **Side effects** — lease POST with status `active` sets unit `occupied`; nothing un-occupies;
    overdue only re-marked in `generate`.
13. **Dead schema** — `lease_tenants` joined nowhere; no writes, no API.
14. **Environment hazard** — C: drive has **0 free bytes**; wrangler log write failed with
    `ENOSPC` during the audit. F: drive ~16 GB free.

## INFERENCES (concluded from the above)

1. D1 enforces FKs in local dev (observed) and `ON DELETE` rules therefore apply to the seeded
   DB — production D1 enforces FKs too `[strong — Cloudflare D1 default]`.
2. Production hosting of static assets via raw Cloudflare requires an `assets` block or the
   Clawnify host; `wrangler.toml` has none (API-only worker). Exact Clawnify hosting mechanics
   not verified on a live deploy.
3. Money is whole-unit by design; a malformed currency code can crash `Intl.NumberFormat`
   rendering (RangeError) — inferred from spec behavior, not reproduced.
4. Multi-user/multi-tenant behavior is entirely absent; single global currency; dates browser-
   localized; hard-coded English UI = the main localization work.
5. Server-side search/filter endpoints are unused by the UI (client-side filters instead).
6. The tenant delete copy overstates deletion (actually SET NULL); the vendor delete copy
   overstates name retention (actually JOINed then nulled).

## RECOMMENDATIONS (advisory)

- Adopt auth + single-tenant roles before commercial V1 (R1); then applications UI, charge-admin
  UI, `completed_at` UI, occupancy/overdue reconciliation, CSV export, i18n Tier 1–2, migrations
  ledger, and financial tests (R2), in that order. Full scope in `10-evolution.md`.
- Free disk space on C: (or relocate cache/state/temp) before further dev on this machine (R4).
- Validate currency server-side; replace free-text with a select (R8).
- Introduce `schema_migrations` or drizzle-kit before any destructive schema change (R3).
- Add an ops runbook for D1 backup/export (`wrangler d1 export`) (R9).

## UNKNOWN / NOT VERIFIED

1. **Live/deployed behavior of the Clawnify pipeline** (how assets are served, whether
   `schema.sql` DDL is auto-applied on deploy) — not exercised locally; basis for R3.
2. **Production D1 migration-on-deploy behavior and E2E data (remote) state** — no remote
   binding configured (`database_id = "local"` placeholder in `wrangler.toml`).
3. **Exact `Intl.NumberFormat` failure mode** for arbitrary user-entered currency codes.
4. Whether workerd/miniflare versions on other OSes differ in FK defaults (observed 1 here).
5. Font loading success offline and CSP posture of any production host.
6. Behavior under concurrent writes (D1 serialization) — not load-tested.
7. The meaning of `_cf_METADATA` table contents — D1 internal; not inspected.
8. Whether the `minimumReleaseAgeExclude` / `minimumReleaseAge` pnpm configs
   (`pnpm-workspace.yaml`, `package.json`) alter installs on other machines/times.