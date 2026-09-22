# Execution Log — P9: Lease ↔ Unit Occupancy Integrity

Records the execution of phase P9 from `Docs/13-v1-implementation-plan.md` (P9 section). Authored by
the execution agent (systemorkestrix-pixel) on 2026-09-22.

## Status

[COMPLETE] — occupies git commit `88db3b0` ("feat: enforce lease/unit occupancy integrity") on `main`,
2026-09-22. Preceded by `87c861b` (P8 overdue freshness).

## Objective vs. delivered

Plan objective (P9): the API let anyone POST a lease that overlapped an existing active lease on the
same unit ~~and let edits drift it~~, so two leases could claim the same unit for the same period and
`units.status` could fall out of sync with the lease truth it is supposed to reflect. Required
invariant: no unit may have two `active`/`upcoming` leases whose periods overlap (inclusive of both
end dates), and `units.status` must always match what the leases actually claim (**occupied** when an
active lease covers the unit, **vacant** otherwise), preserved across create, edit, delete, and the
dashboard read.

Delivered:

- **Pure, single-sourced rules** in new `src/server/leases.ts` — `dateRangesOverlap(aStart, aEnd,
  bStart, bEnd)` (inclusive of both end points), `leaseClaimsUnit(status)` (`active`/`upcoming` claim
  the unit), and `reconcileUnitStatus(current, activeLeaseCount)` (occupied iff an active lease
  exists; a manual `turnover`/`unavailable` override is never clobbered). Every route imports these
  verbatim, so the conflict and occupancy rules can never drift between handlers.
- **Create guard (POST /api/leases):** before INSERT, when the new lease claims the unit, a
  single-row overlap probe (`WHERE l.unit_id = ? AND l.status IN ('active','upcoming')
  AND l.start_date <= ? AND l.end_date >= ?`) returns `409 lease_conflict` on any clash; otherwise the
  unit is marked **occupied** for an active lease.
- **Conservative edit guard (PUT /api/leases/:id):** re-probes overlap on edits that can open or
  close occupancy (dates/unit/status), **excluding the lease itself** (`l.id != ?`) so a notes-only
  update never trips the guard. On success the unit is reconciled to the lease truth (`status →
  ended/cancelled` re-opens occupancy).
- **Delete reconcile (DELETE /api/leases/:id):** captures `unit_id` before the row is removed and
  reconciles the unit to vacancy when the deleted lease was the week's claim.
- **Read-path convergence:** `reconcileUnitOccupancy(unitId)` / `reconcileAllUnits()` reconcile
  `units.status` from the lease truth, called from each lease mutation and from the dashboard summary
  read, plus an idempotent admin endpoint `POST /api/admin/reconcile-occupancy` to fix any legacy
  drift on demand.
- **Errors & i18n:** new `ErrorCode.lease_conflict` in `src/server/errors.ts` and the
  `lease_conflict` message in `en`/`fr`/`ar`.
- **Migration (additive):** `migrations/0004_lease_unit_occupancy.sql` — composite indexes
  `idx_leases_unit_dates` and `idx_leases_unit_status`, schema preserved (no table/column changes).

## Verification evidence

- [VERIFIED] `npx tsc --noEmit` exits 0 (TYPECHECK_OK).
- [VERIFIED] `npx vitest run` green: **12 files, 157 tests passing**, including the new
  `tests/lease-occupancy.test.ts` (6 P9 cases: overlap reject with `409 lease_conflict`, period-gap
  allowance, same-unit/overlap integrity, notes-only update allowed, occupied→vacant on delete,
  turnover override preserved) and all pre-existing suites (P1–P8) still green.
- [VERIFIED] Dashboard summary (`occupied`/`vacant`/`occupancy_rate`) reflects the seed fixture and
  reconciles occupancy on create/edit/delete without drift after the fresh guard.
- [VERIFIED] `git --no-pager diff HEAD --stat` matches P9 scope exactly: `src/server/index.ts`,
  `src/server/errors.ts`, the three `src/client/i18n/*.json` files; new untracked `leases.ts`,
  migration `0004_lease_unit_occupancy.sql`, test, and this doc. Nothing outside P9 was touched.

## Files changed (commit stat)

`src/server/index.ts`, `src/server/errors.ts`, `src/client/i18n/{en,fr,ar}.json`, plus new
`src/server/leases.ts`, `migrations/0004_lease_unit_occupancy.sql`,
`tests/lease-occupancy.test.ts`, `Docs/execution/p9-lease-occupancy.md`. Commit `88db3b0`.

## Risks / notes

- [INFERENCE] The overlap probes compare YYYY-MM-DD directly (ISO — lexicographic is correct); the
  POST/PUT guards and `dateRangesOverlap` agree on inclusive endpoints, so an edit that simply
  shortens a lease to a period no longer covering the current one reopens occupancy — intended.
- [INFERENCE] Concurrent double-POST of identical overlapping leases: both read-before-write may pass
  the probe; SQLite serializes writes, and the second INSERT is then accepted only if the first
  hasn't committed yet (the guard is read-time, not a unique constraint). Same LIMIT-1 design as the
  existing finance guards (its accepted weakness, unchanged, non-blocking).
- Rolling back: `git revert 88db3b0` removes the guards, reconcile calls, admin endpoint, migration
  indexes, `lease_conflict` error/message, and tests; the added indexes are additive and harmless if
  left in place.
