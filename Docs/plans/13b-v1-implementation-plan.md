# 13b — V1 Implementation Plan (Part 2): Phases P7–P9

Continues `Docs/plans/13-v1-implementation-plan.md` (prerequisites, out-of-scope, P1–P6).

## P7 — Work-order completion stamp

1. **Objective**: Close work orders from the UI and stamp `completed_at` (R14/M8 gap).
2. **Files/modules affected**: `src/client/components/maintenance/work-order-dialog.tsx`,
   `src/client/components/maintenance/maintenance-page.tsx`, `src/client/api.ts` (PATCH with
   `completed_at`), `src/client/types.ts`.
3. **Database changes**: none (`work_orders.completed_at` exists, API-only today).
4. **API changes**: PATCH `/api/work-orders/:id` accepts `completed_at` (already supported;
   make client and server agree that `status = 'completed'` stamps it when absent).
5. **UI changes**: dialog sets Completed-at automatically on `completed`; list shows the date.
6. **Tests required**: completing via UI stamps a value; re-editing doesn't clear it; cancel
   leaves it null.
7. **Risk level**: LOW.
8. **Rollback**: revert commit; endpoint already tolerant; UI-only delta.

## P8 — Overdue freshness

1. **Objective**: Overdue status must not depend solely on `generate` (C/R6): re-mark at read time
   and on payment/lease activity.
2. **Files/modules affected**: `src/server/index.ts` (dashboard query, rent-charges GET, shared
   `markOverdue` helper; reuse P1 helpers), none in client beyond badges.
3. **Database changes**: none (in-place status update).
4. **API changes**: additive behavior only — `GET /api/rent-charges*` and
   `GET /api/dashboard/summary` mark `overdue` before responding; no new endpoint initially (a
   `POST /api/rent-charges/recompute` may come with P9 if needed).
5. **UI changes**: corrected overdue badges; Rent page re-renders after `generate`/payment/charge
   edit.
6. **Tests required**: mid-period overdue on dashboard + rent GET; `paid`/`waived` excluded;
   idempotent re-mark; dashboard and Rent page counts match.
7. **Risk level**: LOW–MEDIUM (financial read-path change; covered by P1 tests).
8. **Rollback**: revert commit; write-path unchanged; additive read behavior.

## P9 — Lease & occupancy hardening

1. **Objective**: Close the occupancy/lease-state gaps (C/R5): overlap guard, auto un-occupy on
   lease end/cancel, unit-status reconciliation.
2. **Files/modules affected**: `src/server/index.ts` (lease POST/PUT/DELETE side effects, new
   `recomputeUnitStatuses` helper), `src/client/components/leases/*` (conflict surfacing,
   localized in P3), one-shot admin reconcile action (Settings tab or `POST` guarded by P5 auth).
3. **Database changes**: additive via P2 — index `(unit_id, status)`; no column changes.
4. **API changes**: lease write rejects overlapping active lease for the unit (400, error code);
   lease `ended`/`cancelled` (or tenant move-out) sets unit to `vacant`/`turnover`; reconciler
   endpoint no-ops when nothing to fix.
5. **UI changes**: lease dialog surfaces conflicts; unit detail shows lease-derived occupancy;
   manual unit-status override still allowed.
6. **Tests required**: overlap rejection; end/cancel un-occupies; tenant delete with lease keeps
   unit integrity; reconciler idempotent and truthful.
7. **Risk level**: MEDIUM (business-rule side effects; mitigated by P1 tests + cascade safety).
8. **Rollback**: feature-flag `RECONCILE_UNITS=true`; revert commit keeps current manual behavior;
   additive index harmless.