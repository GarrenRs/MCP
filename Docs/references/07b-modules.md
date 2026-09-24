# 07b — Modules, Part 2 (M8–M13)

Continues `07-modules.md`.

---

## M8. Work orders / Maintenance

- **Purpose**: Track repairs and turnover work with priority, status, vendor, schedule, cost.
- **Workflow**: Create WO (optionally linked to property/unit/vendor) → work through status tabs → mark completed/cancelled.
- **Screens**: `/maintenance`.
- **Endpoints**: CRUD `/api/work-orders[/:id]`; GET filters `status`, `property_id`.
- **Tables**: work_orders; joins properties/units/tenants/vendors (all `SET NULL` on delete).
- **Logic**: priority sort (`urgent > high > normal > low`); tab counts incl. urgent; property page lists that property's WOs; dashboard shows recent open + urgent count.
- **Missing**:
  - **`completed_at` is settable only via API** — dialog has no field.
  - No status flow enforcement (a WO can go `open` → `completed` in one edit; no `in_progress` requirement).
  - No cost ledger / totals by property; no vendor history roll-up.
  - Delete-confirm copy implies vendor name is kept on record — it is not (JOINs read the name; `vendor_id` is nulled).
- **Deps**: ui primitives, vendors + properties from global state.
- **Difficulty**: LOW.

## M9. Vendors & Rent policy (Settings)

- **Purpose**: Service-provider directory + global rent-policy defaults.
- **Workflow**: Add/edit/remove vendors by category; adjust policy defaults that new leases prefill from.
- **Screens**: `/settings` (tabs: Vendors, Rent policy).
- **Endpoints**: CRUD `/api/vendors[/:id]`; GET/PUT `/api/settings`.
- **Tables**: vendors; settings (key/value).
- **Logic**: vendor category/color chips; policy tab validates due day (1–31), grace ≥ 0, likfer uppercase currency code; settings always merge defaults.
- **Missing**: no vendor search; no "vendor on work order" drill-down; currency is free text (invalid codes like `EURO` produce `Intl` errors `[INFERENCE — RangeError risk on render]`).
- **Deps**: ui primitives, settings store.
- **Difficulty**: LOW.

## M10. Applications (backend-only)

- **Purpose**: Manual record of rental applications (screening pipeline placeholder).
- **Workflow**: none in UI — API only.
- **Screens**: none (no route, no nav item, no state hook).
- **Endpoints**: CRUD `/api/applications[/:id]`.
- **Tables**: applications.
- **Logic**: status flow `new → screening → approved/declined/withdrawn`; unit join.
- **Missing**: entire client layer — type `Application` exists in `types.ts` but no API hook, screen, or dialog.
- **Deps**: none client-side.
- **Difficulty**: LOW to ADD (surface an existing backend), MEDIUM if it must integrate screening.

## M11. Server platform layer

- **Purpose**: Worker bootstrap, DB adapter wiring, schema DDL, idempotent demo seeding.
- **Files**: `index.ts` (middleware + helpers), `db.ts`, `schema.sql`.
- **Logic**: `initDB(c.env)` + `ensureSeeded()` per request; `intParam`, `parseJson`, `buildUpdate`; `DEFAULT_SETTINGS`/`DEMO_*` seed arrays; `safeGet/safeQuery` for the dashboard.
- **Missing**: migrations ledger/versioning; tests; structured logging; error envelope beyond `{error}`.
- **Deps**: hono, zod, `@clawnify/db` (drizzle-orm transitively).
- **Difficulty**: MEDIUM (platform changes affect everything).

## M12. Seeding & demo data

- **Purpose**: Make first boot usable: 3 properties, 5 units, 3 vendors, 4 settings.
- **Workflow**: First request after schema apply seeds; never resurrects deleted rows.
- **Logic**: `seeded` module flag fast-path; COUNT-guarded INSERTs try/catch-reset.
- **Missing**: no tenants/leases/charges seed (rent & tenants modules boot empty); no way to toggle demo data off (it silently coexists with real data).
- **Difficulty**: LOW.

## M13. Cross-cutting: data exports & reports

- **Purpose**: (absent) — no reporting/export features exist.
- **Missing**: CSV/PDF exports, statements, print-friendly ledger, annual/portfolio reports.
- **Difficulty**: MEDIUM (new surface; read-only so safe to add).

---

## Difficulty summary

| Module | Difficulty |
|---|---|
| M1 Shell/routing | LOW |
| M2 Design system | LOW |
| M3 Dashboard | LOW |
| M4 Properties & Units | LOW |
| M5 Tenants | LOW |
| M6 Leases | MEDIUM |
| M7 Rent & payments | MEDIUM |
| M8 Work orders | LOW |
| M9 Vendors & policy | LOW |
| M10 Applications (add UI) | LOW |
| M11 Server platform | MEDIUM |
| M12 Seeding | LOW |
| M13 Exports/reports | MEDIUM |