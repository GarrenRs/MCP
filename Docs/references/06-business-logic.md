# 06 — Business Logic & Workflows

Written as manager workflows. Everything below is `[VERIFIED — source]` unless marked.
"Current behavior" = behavior at baseline commit. No recommendations stated here affect the
running app; see `10-evolution.md` for change guidance.

## 1. Portfolio setup (Properties → Units)

1. Create a property (name required; type/address/city/state/zip/year built/color/notes).
2. Create units under it (name, bedrooms, baths, sqft, market rent, status).
3. Property "occupied" counts are derived at read time from unit status (`occupied`).

**Rules**
- Deleting a property cascades: units → leases → charges → payments (FK ON).
- Occupancy % per property = occupied units / total units; portfolio occupancy in dashboard.

## 2. Tenant lifecycle

- Create tenant (first/last name required; email, phone, DOB, emergency contact, employer,
  monthly income, notes optional).
- Tenant is linked to a unit only **through an active lease** (`active_unit_*` JOIN in the API).
- Detail page shows: active lease, about fields, full lease history.
- **Delete tenant → leases keep `primary_tenant_id = NULL`** — lease history + rent history are
  preserved. The delete dialog copy ("Their leases and rent history go with them") is **inaccurate**
  for tenants. `[VERIFIED — schema ON DELETE SET NULL]`
- No unique constraint on tenant email; duplicates allowed.

## 3. Leasing workflow

1. Pick a unit (any status — the app does **not** block leasing a vacant-only unit) `[VERIFIED]`.
2. Pick an existing primary tenant.
3. Set start/end dates, monthly rent, deposit, due day, late fee, status.
4. Defaults pre-fill from: `settings.default_rent_due_day`, `settings.late_fee_amount`, and the
   unit's `market_rent` when rent is still 0 (new lease only).

**Rules / current behavior**
- **Creating a lease with status `active` sets the unit `occupied`** (POST side effect).
- **Nothing un-set the unit when a lease ends or is cancelled** — unit status must be changed
  manually (status field on the unit itself). Known gap.
- There is **no overlap check**: two active leases can exist for the same unit or the same
  tenant simultaneously.
- Expiring leases are flagged in the UI (Leases list "Ends in N days", dashboard 30/60-day
  lists) but lease `status` is **never auto-transitioned** from `active` → `ended`.
- Leases support a primary tenant only in the UI; the `lease_tenants` (multi-occupant) table
  exists but is unused everywhere. `[VERIFIED]`

## 4. Rent collection cycle (the product's core)

1. Admin sets policy defaults in Settings (due day, late fee, grace days, currency).
   These are defaults only — each lease stores its own effective values at creation.
2. On the Rent page, pick a period (default: current month), click **Generate charges**.
   - Creates one charge per **active** lease whose `end_date >= period-01`; due date =
     period + `rent_due_day` (clamped to 28); amount = lease `monthly_rent`.
   - **Idempotent** via unique `(lease_id, period)` — re-running never duplicates.
   - After generating, **re-marks overdue**: charges with `amount_paid < amount` and
     `due_date < date('now')` get status `overdue` (only open/partial).
3. Record payment (amount, method, paid-on date, reference, notes).
   - Server recomputes `amount_paid` and status: paid (sum ≥ amount) / partial (sum > 0) /
     open otherwise.
4. Remove payment → recompute again.
5. Totals: charged, collected (sum amount_paid), outstanding (charged − paid, floor 0), overdue.

**Rules**
- Payment amounts are not validated against the balance — overpayment is allowed (status will
  read `paid` because `paid ≥ amount`).
- Charge status can be manually set to `waived` **via API only** (no UI).
- The overdue re-marking runs only inside `/api/rent-charges/generate` — a charge can become
  past-due without a corresponding generate call and stay `open`. `[VERIFIED — code path]`
- Charges are never auto-generated on a schedule; the user must click **Generate charges** for
  each period. `[INFERENCE — no cron/queue exists]`
- FUTURE localization note: currency is global, one code, used by `Intl.NumberFormat`; there is
  no per-lease or per-property currency. `[INFERENCE]`

## 5. Maintenance workflow

1. Create work order (title required; optional property/unit/vendor, description, priority,
   status, scheduled date, cost, notes).
2. Filter tabs: Open (all non-completed/cancelled) · Unassigned (`open`) · Assigned ·
   In progress · Completed · All.
3. Track cost and scheduled date; the detail/dialog lets you edit priority/status.
   - **`completed_at` has no UI field**; completing via the dialog doesn't stamp it.
4. Dashboard lists recent open WOs + urgent count; property page lists that property's WOs.
5. Deleting a vendor/unit/property/tenant **nulls** the WO's reference (history text keeps
   nothing — the delete confirm copy in Settings claims the vendor name "keeps" on record,
   which is inaccurate because names are JOINed, not stored).

## 6. Vendors & settings

- Vendor directory (category, phone, email, color, notes) used by work orders.
- Rent-policy defaults persist via `settings` key/value; `GET /api/settings` always returns
  merged defaults + stored rows, so the UI never renders without a currency/due day.

## 7. Applications (backend only)

- CRUD API exists; `applications` table; **no screen exists**. The README calls it a
  "placeholder application record only" — consistent with "no public submission" scope.

## Cross-cutting rules

- **Single actor, no auth**: every screen assumes one logged-in manager; no login, roles,
  permissions, or multi-tenant data isolation.
- **All destructive deletes** go through `ConfirmDelete` (Radix alertdialog) with entity-specific
  text.
- **Empty states** guide first-run (Properties/Tenants/Leases/Maintenance/Rent have CTA buttons);
  Dashboard fully usable once stack is set up.
- **Demo data** keeps the app usable on first boot (3 properties, 5 units, 3 vendors) but the
  rent/tenant/lease modules start empty. `[VERIFIED — DB dump]`