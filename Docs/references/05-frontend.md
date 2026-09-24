# 05 — Frontend

## Entry & shell

- `src/client/main.tsx` mounts `<App/>` into `#app` (`index.html`, `lang="en"`).
- `src/client/app.tsx`:
  - Defines the nav (`PORTFOLIO` / `OPERATIONS` / `ADMIN` groups) for `AppNav`
    (`@clawnify/app/client`) — standalone sidebar or host-fed when embedded in the Clawnify
    dashboard.
  - `useRouter()` → `{path, route, navigate}`; `reportLocation(path)` on every path change so
    the host can restore the screen.
  - Renders `AppContext.Provider`, nav, `<main>`, and the global `<ErrorBanner/>`.
  - Basic `Placeholder` "Not found" screen for unmatched routes.

## Routing `[VERIFIED — use-router.ts]`

PushState-based; parsed from `window.location.pathname`:

| Route union | Path |
|---|---|
| dashboard | `/` or `/dashboard` |
| properties | `/properties` |
| property | `/properties/:id` |
| tenants | `/tenants` |
| tenant | `/tenants/:id` |
| leases | `/leases` |
| rent | `/rent` |
| maintenance | `/maintenance` |
| settings | `/settings` |
| not-found | anything else |

- `navigate()` uses `history.pushState` + state update; `popstate` listener syncs on
  back/forward. No server-side routing; SPA only. `[INFERENCE — direct deep links work only
  because Vite serves the SPA for all paths in dev; the Worker has no asset routes.]`

## Screens (UI map)

| Screen | Component | Purpose |
|---|---|---|
| Dashboard | `dashboard/dashboard-page.tsx` | 4 KPIs (occupancy, active leases, outstanding rent, open WOs), portfolio card, month's rent card, open WOs list, lease-expirations list. Buttons → /properties, /rent, /maintenance, /leases |
| Properties | `properties/properties-list.tsx` | Property cards (type chip, address, units/occupied/occupancy, year built, edit); New property dialog; empty state |
| Property detail | `properties/property-page.tsx` | Header, 4 summary tiles (units, occupied, market rent, open WOs), unit grid (click → edit), work-orders list, New unit / Edit property / New work order dialogs |
| Tenants | `tenants/tenants-list.tsx` | Search box (client-side), table (name, active unit, email, phone), New tenant dialog, row → tenant detail |
| Tenant detail | `tenants/tenant-page.tsx` | Contact header, active lease card, About (DOB, emergency, employer, income, notes), Lease history, Edit dialog |
| Leases | `leases/leases-page.tsx` | Tabs (Active/Upcoming/Ended/All) + search (client-side), table (tenant, property·unit, term, rent, status), row click → edit; New lease dialog |
| Rent | `rent/rent-page.tsx` | Period stepper (◀ / today / ▶), Generate-charges action, 4 totals (charged/collected/outstanding/overdue), charges table (due, charged, paid, balance, status, Record payment / View), PaymentDialog; skeleton loading |
| Maintenance | `maintenance/maintenance-page.tsx` | Tabs (Open/Unassigned/Assigned/In progress/Completed/All), WO cards (title, location, priority, status, vendor, scheduled, cost, created); New/Edit work-order dialog |
| Settings | `settings/settings-page.tsx` | Tabs: Vendors (list + dialog) and Rent policy (due day, late fee, grace days, currency) |
| Not found | inline `Placeholder` | generic 404 |

## Global state `[VERIFIED — use-app-state.ts]`

- Initial load (`refreshLookups`): parallel GET `/api/properties`, `/api/vendors`, `/api/settings`,
  guarded (vendors/settings failures don't block startup).
- Settings parsed into typed `AppSettings` with fallbacks.
- Mutation helpers: create/update/delete × properties, units, tenants, leases, vendors, work
  orders; `listUnits`, `listTenants`, `listLeases`, `listCharges`, `generateCharges`,
  `recordPayment`, `updateSettings`.
- Most mutations call `refreshLookups()` afterwards to keep property/vendor/settings caches
  fresh (tenant & work-order mutations rely on the page's own reload instead).
- **`Application` is NOT in the hook** — no client path to applications. `[VERIFIED]`

## API client `[VERIFIED — api.ts]`

`api<T>(method, path, body?)` → fetch with `Content-Type: application/json`, parses JSON,
throws `Error(detail||"status statusText")` when `!ok`. Single source of HTTP behavior.

## Design system `[VERIFIED — styles.css, lib/utils.ts, components/ui/*]`

- Tailwind CSS v4 (`@theme inline` maps tokens to shadcn names). Custom "Clawnify Apps" tokens:
  `--brand*`, `--info/success/warning/destructive` (+ tint/solid), category families
  `--cat-*` (per-record-type color), edge recipes (`--shadow-edge/-raised/-float`), explicit
  radius scale. Light + dark via `prefers-color-scheme`.
- `colorPalette` in `lib/utils.ts` maps stored color names (sky/emerald/amber/rose/violet/
  fuchsia/teal/orange/slate) to token class sets via `colorClasses()`.
- shadcn primitives vendored in `components/ui/` (button, card, dialog, alert-dialog with
  `ConfirmDelete`, input, label, select, table, tabs, textarea, badge, separator, dropdown-menu,
  popover, scroll-area, tooltip; radix deps).
- Helpers: `cn`, `formatDate`, `formatMoney(currency)`, `toIsoDate`, `currentPeriod`,
  `addMonths`, `formatPeriod`, `daysBetween`.
- Rail styling overrides for `@clawnify/app`'s `AppNav` at `aside.cn-nav` specificity;
  agent mode (`data-agent`) enlarges interactive targets; iOS-safe input font-size ≥16px.

## State refresh gaps (documented)

- Property detail page load does not await `refreshLookups`; relies on its own fetch.
- New-unit creation prefills nothing from the parent property (must type everything).
- Tenant list search is client-side only over the 500-row server limit.
- Leases/WorkOrders filters are client-side.