# 07 — Modules, Part 1 (M1–M7)

Per-module deep dive. Each module documents: purpose, business workflow, screens, API endpoints,
database tables, existing logic, missing functionality, technical dependencies, modification
difficulty (LOW / MEDIUM / HIGH for additive, in-place work) `[INFERENCE]`.

---

## M1. Core shell, navigation & routing

- **Purpose**: App chrome, nav (standalone rail / Clawnify-embedded), route dispatch, global error surface.
- **Workflow**: User opens a path; shell resolves it to a `Route`, renders the matching page, and keeps the rail's active row lit (parent section on detail pages). In embedded mode the shell hands nav + location to the Clawnify host.
- **Files**: `app.tsx`, `main.tsx`, `hooks/use-router.ts`, `context.tsx`, `components/page-shell.tsx`, `components/error-banner.tsx`.
- **Screens**: all (hosts content).
- **Endpoints**: none (client-only).
- **Tables**: none.
- **Logic**: pushState router; nav groups (PORTFOLIO / Operations / Admin); `activeFor()`; `reportLocation()` bridge; `AppContext` provider; centered bottom error toast.
- **Missing**: no 404 recovery UX beyond a placeholder; no scroll restoration; no guards (pre-auth, so fine).
- **Deps**: `@clawnify/app/client` (AppNav, reportLocation), React, lucide-react.
- **Difficulty**: LOW (risk concentrated in the `@clawnify/app` coupling — document before forking).

## M2. Design system / UI primitives

- **Purpose**: Consistent tokens (surfaces, statuses, brand, category color families, edges, radii), typography, vendored shadcn/Radix primitives, date/money/period helpers.
- **Files**: `styles.css`, `lib/utils.ts`, `components/ui/*` (~15 primitives incl. `ConfirmDelete`).
- **Screens**: everywhere.
- **Endpoints / Tables**: none.
- **Logic**: `@theme inline` token mapping; `colorClasses()` per record color; `formatDate`/`formatMoney`/`formatPeriod`/`addMonths`/`daysBetween`; light/dark via `prefers-color-scheme`.
- **Missing**: no theme toggle (system-only); no keyboard shortcuts; money renders whole units (`maximumFractionDigits: 0`).
- **Deps**: Tailwind v4 + `@tailwindcss/vite`, Radix primitives, tailwind-merge, clsx, class-variance-authority, lucide-react, @phosphor-icons/react.
- **Difficulty**: LOW (additive utilities are safe).

## M3. Dashboard

- **Purpose**: Operational snapshot: occupancy, active leases, rent collected/outstanding/overdue, open + urgent work orders, upcoming lease expirations.
- **Workflow**: Load `/dashboard` → `GET /api/dashboard/summary` → render KPIs, portfolio, month's rent, open WOs, expirations. Buttons deep-link to `/properties`, `/rent`, `/maintenance`, `/leases`.
- **Screens**: `/dashboard`.
- **Endpoints**: `GET /api/dashboard/summary`.
- **Tables**: properties, units, leases, rent_charges, work_orders (read-only).
- **Logic**: 13 parallel queries via `safeGet/safeQuery` (never fails on cold DB); occupancy rate; month outstanding/collected; overdue (due < now, unpaid, not waived); expirations ≤ 60 days; recent open WOs ≤ 6; KPI warn tones when urgent/overdue.
- **Missing**: no charts; month is fixed to current period (no period stepper here); counts don't drill into filtered lists.
- **Deps**: lucide, ui primitives.
- **Difficulty**: LOW.

## M4. Properties & Units

- **Purpose**: Building registry + rentable units with live occupancy.
- **Workflow**: Create property → create units → unit status drives occupancy. Card → detail page for units + property work orders.
- **Screens**: `/properties`, `/properties/:id`.
- **Endpoints**: CRUD `/api/properties[/:id]`, `/api/units[/:id]`; GET filters `property_id`, `status`.
- **Tables**: properties, units; delete cascades downstream (units → leases → charges → payments).
- **Logic**: list joins `unit_count`/`occupied_count`; detail page computes market-rent sum, open WOs, occupancy; dialogs map form fields ↔ zod inputs with null-coalescing.
- **Missing**: no delete from page view (edit dialog only); no address validation; no geo; unit dialog doesn't flow into a "new lease"; no unit occupancy history.
- **Deps**: ui primitives, settings (currency for rent).
- **Difficulty**: LOW.

## M5. Tenants

- **Purpose**: People registry with contact, employment, income, active-lease context, lease history.
- **Workflow**: Search the list (client-side) → detail page shows active lease + about + history.
- **Screens**: `/tenants`, `/tenants/:id`.
- **Endpoints**: CRUD `/api/tenants[/:id]`; `GET ?q=` server search (implemented, unused by UI).
- **Tables**: tenants; joins leases/units/properties for active-unit context.
- **Logic**: active-unit joinders in SQL; client-side filter; detail page fetches tenant + all its leases.
- **Missing**: no "new lease" shortcut from tenant page; server `?q=` unused; `LIMIT 500` un-paginated; no email uniqueness; delete dialog copy overstates what's deleted (it's SET NULL, history kept).
- **Deps**: ui primitives.
- **Difficulty**: LOW.

## M6. Leases

- **Purpose**: Financial agreement between tenant and unit; the feeding source of rent charges.
- **Workflow**: Pick unit + primary tenant, set terms → active lease marks unit occupied → Rent page generates charges from active leases.
- **Screens**: `/leases`.
- **Endpoints**: CRUD `/api/leases[/:id]`; GET filters `status`, `tenant_id`, `unit_id`.
- **Tables**: leases; side-effects on units; joins tenants/properties/units; `lease_tenants` table unused.
- **Logic**: status tabs + search; 30-day "Ends in N days" inline warning (and dashboard 60-day window); dialog pre-fills default due day / late fee from settings and market_rent when rent is 0 (new leases only).
- **Missing**: no overlap prevention (two active leases per unit permitted); no auto `active`→`ended`; no move-out flow (unit stays `occupied`); no multi-tenant occupants UI; no end-date ≥ start-date hard validation server-side (dates are plain strings).
- **Deps**: ui primitives, settings store.
- **Difficulty**: MEDIUM (business-rule side effects touch server + dialog).

## M7. Rent ledger & payments (core money module)

- **Purpose**: Per-period charges, collection totals, payment recording — the product's financial core.
- **Workflow**: Generate charges for a period (one per active lease, idempotent) → record payments per charge → statuses/totals recompute automatically; overdue re-marked during generation.
- **Screens**: `/rent` (+ `payment-dialog.tsx`).
- **Endpoints**: `GET/POST /api/rent-charges`, `POST /api/rent-charges/generate`, `PUT/DELETE /api/rent-charges/:id`, `GET /api/rent-charges/:id/payments`, `POST /api/payments`, `DELETE /api/payments/:id`.
- **Tables**: rent_charges, payments; joins leases/units/properties/tenants.
- **Logic**: `ON CONFLICT(lease_id, period) DO NOTHING` idempotence; due date = period + due day (clamped ≤ 28); payment add/remove recompute `amount_paid` + status (`paid` ≥ amount, `partial` > 0); overdue rule `due_date < date('now') AND amount_paid < amount`; client totals from the loaded period.
- **Missing**:
  - **No UI to edit/waive a charge** (amount, due_date, status) — API-only.
  - Overdue re-mark only runs inside `generate`.
  - No charge-level notes UI.
  - No statements/receipts/CSV export.
  - Overpayment silently allowed (status clamps to `paid`).
- **Deps**: ui primitives, settings.currency.
- **Difficulty**: MEDIUM (financial-correctness changes require tests first).