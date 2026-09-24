# 13c — V1 Implementation Plan (Part 3): Phases P10–P12, Dependencies, Order

Continues `Docs/plans/13b-v1-implementation-plan.md` (P7–P9).

## P10 — Applications UI

1. **Objective**: Surface the backend-only module (C/M10) as a minimal screen.
2. **Files/modules affected**: new `src/client/components/applications/*` (list + dialog),
   `src/client/app.tsx` (route + nav), `hooks/use-app-state.ts` (data fetch),
   `src/client/api.ts` / `types.ts` (hook typed but unwired).
3. **Database changes**: none (`applications` table fully present).
4. **API changes**: none (existing CRUD; `status` transitions `new → screening →
   approved/declined/withdrawn` as stored; no integrations).
5. **UI changes**: nav/route for Applications; list + detail dialog in FR; "move approved to
   tenant" shortcut stays out of V1 (keep manual).
6. **Tests required**: CRUD flows incl. status guards; empty state; i18n keys complete.
7. **Risk level**: LOW.
8. **Rollback**: revert commit; new route/files only, removes cleanly.

## P11 — CSV export

1. **Objective**: Exportable data (R9): period rent ledger + tenant/property directory as CSV.
2. **Files/modules affected**: `src/server/index.ts` (additive export endpoints),
   `src/client/components/rent/rent-page.tsx`, `tenants-list.tsx`, `properties-list.tsx`
   (Export buttons), `src/client/api.ts` (download), i18n labels.
3. **Database changes**: none.
4. **API changes**: additive `GET /api/export/rent-ledger?period=`, `GET /api/export/tenants`,
   `GET /api/export/properties` returning CSV (Content-Type + Content-Disposition). Read-only;
   reuses existing joins; aligned with P8 overdue math.
5. **UI changes**: Export buttons on the three list pages; localized filenames
   (e.g. `loyers-2026-05.csv`).
6. **Tests required**: CSV shape (columns, quoting, commas in names), empty dataset, DZD amounts,
   period parity with Rent page; authorization (P5) enforced.
7. **Risk level**: LOW.
8. **Rollback**: revert commit; additive read-only endpoints; UI-only buttons.

## P12 — Audit trail

1. **Objective**: Accountability (R15): record of destructive + money changes tied to the P5 user.
2. **Files/modules affected**: `src/server/index.ts` (audit helper in write paths: charge edits,
   payments, lease mutations, deletes, settings changes), new Settings → Audit tab (read-only),
   migration definition.
3. **Database changes**: additive `audit_logs(id, actor_user_id REFERENCES users, action, entity,
   record_id, old_value, new_value, created_at)` (users FK via P5/P2).
4. **API changes**: additive `GET /api/audit?entity=&limit=` (owner/admin) + write-side inserts;
   existing write contracts unchanged.
5. **UI changes**: Settings → Audit tab: recent entries with actor + change summary.
6. **Tests required**: audit row for each audited action; actor attached; owner/admin read only;
   no PII in key/values; limit/rotation behavior.
7. **Risk level**: LOW (depends on P5 for actor; additive storage).
8. **Rollback**: revert commit; audited paths return immediately; table/data kept.

---

## Dependencies

- **P1, P2**: none (parallelizable).
- **P3**: P1 (test gate for `api.ts` contract work).
- **P4**: P3. **P5**: P3 (localized/login errors), P2 (users table).
- **P6**: P1 (financial tests), P3.
- **P7**: P3. **P8**: P1 (tests). **P9**: P1, P2 (index), P3 (labels).
- **P10**: P3. **P11**: P3, P8 (period/overdue parity). **P12**: P5 (actor), P2.

## Recommended implementation order (exact)

Critical path sequential; parallel lanes noted.

1. **P1** Environment & test foundation
2. **P2** Migration ledger
3. **P3** i18n infrastructure, settings, error codes
4. **P4** Algerian localization content (parallel with P5)
5. **P5** Auth & single-tenant roles
6. **P6** Charge administration UI (parallel with P7/P8/P9/P10)
7. **P7** Work-order completion stamp
8. **P8** Overdue freshness
9. **P9** Lease & occupancy hardening
10. **P10** Applications UI
11. **P11** CSV export (after P8)
12. **P12** Audit trail (after P5)

Merge gate after each phase: `pnpm typecheck` + `pnpm test` clean; each phase lands as its own
commit; no phase ships above its risk ceiling without P1 test coverage.

## Minimum V1 deliverables checklist

- [ ] Usable disk + green test gate (P1)
- [ ] Versioned migrations (P2)
- [ ] Localized FR catalog, DZD currency, dd/MM/yyyy, locale/currency settings, error codes (P3)
- [ ] Wilaya/commune/country address fields (P4)
- [ ] Login + owner/admin/manager roles (P5)
- [ ] Charge administration UI incl. waive (P6)
- [ ] Work-order completion stamp (P7)
- [ ] Live overdue marking (P8)
- [ ] Lease/occupancy integrity (P9)
- [ ] Applications UI (P10)
- [ ] CSV export (P11)
- [ ] Audit trail (P12)