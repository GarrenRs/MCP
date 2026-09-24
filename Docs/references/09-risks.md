# 09 — Technical & Operational Risks

Triage with severity. `[VERIFIED]` = observed; `[INFERENCE]` = concluded. Each risk includes the
mitigation direction (implemented in `10-evolution.md` only if recommended there).

## R1. No authentication / authorization / multi-tenancy — CRITICAL `[VERIFIED]`
The API is fully open (any `/api/*` call can read/write/delete everything); no login, roles, or
data isolation. Fine as a self-hosted single-actor tool; **blocking** for commercial SaaS.
> Mitigation direction: introduce auth + an org/user model or keep it self-hosted single-tenant.

## R2. No test suite, financial logic untested — HIGH `[VERIFIED]`
Money logic (payment status recompute, overdue marking, idempotent generation) has zero tests.
A regression here loses money data.
> Direction: add API-level tests around `generate` / `payment add` / `payment remove` before any
> financial change.

## R3. Database migrations unversioned & schema.sql is DDL-only — HIGH `[INFERENCE]`
No migration ledger for this app; additive changes are safe, destructive/altered columns are not.
`@clawnify/db` documents a Drizzle/drizzle-kit path that isn't adopted.
> Direction: for commercial V1 (ORKESTRIX Property System) the plan in `Docs/plans/13` P2 selects a
> `schema_migrations` table with an additive runner.

## R4. Local disk exhaustion (C: has 0 free bytes) — HIGH `[VERIFIED environment]`
`wrangler` could not write its debug log during the audit (`ENOSPC`). The project itself is on F:
(16 GB free) but the OS/log drive is full; npm/pnpm cache, .wrangler state, and workerd temp all
target C:. Can break installs and local dev at any moment.
> Direction: free space on C: and/or redirect `XDG_CONFIG_HOME`, `TMP`, pnpm store, and wrangler
> state off C: (document any env vars used).

## R5. Business-rule gaps around occupancy and lease states — MEDIUM `[VERIFIED]`
- Unit stays `occupied` when its lease ends or is cancelled (nothing writes the unit).
- Two active leases on one unit or tenant are allowed.
- Lease status never auto-transitions `active → ended`.
> Direction: add a unit-status reconciliation + overlap guard at write time; on-demand "recompute
> state" endpoint.

## R6. Overdue status only refreshed during `generate` — MEDIUM `[VERIFIED]`
Charges that pass their due date stay `open` until someone generates charges again. Dashboard
overdue numbers are consequently understated mid-period.
> Direction: mark overdue at read time (dashboard query) or on payment/lease activity.

## R7. Duplicated/denormalized read paths vs. data edits — LOW `[INFERENCE]`
Property "occupied" is derived from unit.status; unit.status is set at lease-create only; edits
via `PUT /api/units/:id` can diverge from reality. Same JOIn-heavy payloads recomputed per screen.

## R8. Free-text currency can break rendering — LOW `[INFERENCE]`
`Intl.NumberFormat` throws `RangeError` on malformed codes; a bad currency in settings breaks
every `formatMoney` call render. (Valid-format-but-unknown 3-letter codes degrade gracefully.)
> Direction: validate currency codes server-side; use a `<select>`.

## R9. Data is not exportable from the product — MEDIUM `[VERIFIED]`
No CSV/JSON export anywhere; local DB copy is the only manual backup. For a commercial product,
customers will demand export.

## R10. Tight coupling to `@clawnify` SDK — MEDIUM `[VERIFIED]`
Nav/shell + DB adapter live in `@clawnify/app` / `@clawnify/db`; version-pinned in the lockfile.
A fork or dependency change ripples into the shell, seeding behavior, and formatting.
> Direction: vendor the two packages (or re-implement the seam) before hard commercial
> dependency.

## R11. External Google Fonts at runtime — LOW `[INFERENCE]`
Offline/PII/availability concern; fallback fonts render fine.

## R12. Silent truncation & naive search — LOW `[VERIFIED]`
Tenants list `LIMIT 500` with client-side filtering can silently hide matches; no pagination on
any list; search is O(n) string includes.

## R13. Local-time vs UTC date drift — LOW `[INFERENCE]`
Server compares `date('now')` (UTC); client computes in local time; due-date boundary checks can
differ by a day across timezones.

## R14. Misleading destructive-action copy — LOW `[VERIFIED]`
Tenant delete says leases/rent go with the tenant (they are SET NULL — kept). Vendor delete says
the name stays on record (names are JOINed — not kept). No data is lost in either case; copy is
wrong, not the behavior.

## R15. No audit trail — MEDIUM `[VERIFIED]`
Deletes are hard; edits are overwrites; there is no history of who changed rent/status. Relevant
for property managers (accountability) and a commercial release.

## R16. Demo data coexists with real data — LOW `[INFERENCE]`
`ensureSeeded` never resurrects deleted rows but seeds also run on a fresh database alongside
future real data; no toggle to start "empty".

## Risk summary table

| # | Risk | Severity | Type |
|---|---|---|---|
| R1 | No auth / multi-tenant isolation | CRITICAL | Feature gap |
| R2 | No tests on financial core | HIGH | Process |
| R3 | Unversioned migrations | HIGH | Process/DB |
| R4 | C: disk full (ENOSPC observed) | HIGH | Environment |
| R5 | Occupancy/lease state gaps | MEDIUM | Business rule |
| R6 | Overdue only refreshed during generate | MEDIUM | Business rule |
| R7 | Unit status drift vs leases | LOW | Data integrity |
| R8 | Free-text currency crash | LOW | Validation |
| R9 | No data export | MEDIUM | Feature gap |
| R10 | @clawnify SDK coupling | MEDIUM | Dependency |
| R11 | External fonts | LOW | Ops |
| R12 | LIMIT 500/naive search | LOW | Scalability |
| R13 | TZ drift in overdue math | LOW | Correctness |
| R14 | Wrong delete copy | LOW | UX |
| R15 | No audit trail | MEDIUM | Feature gap |
| R16 | Demo data toggle | LOW | Ops |