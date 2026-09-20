# 03 — Database

## Platform

- Cloudflare **D1** (SQLite engine). Local dev: miniflare SQLite controlled by Wrangler.
- DB name: `open-property-db`; binding `DB` in `wrangler.toml` `[VERIFIED]`.
- Local state lives under `.wrangler/state/v3/d1/` (gitignored). `[VERIFIED]`
- `PRAGMA foreign_keys` returns **1** on the local connection — foreign keys are enforced and
  `ON DELETE` rules apply (tested via `wrangler d1 execute`). `[VERIFIED]`

## Managed tables (13 total at baseline)

Tables created by `src/server/schema.sql`:

| # | Table | Purpose |
|---|---|---|
| 1 | `settings` | Key/value app defaults (currency, due day, late fee, grace days) |
| 2 | `properties` | Buildings (name, type, address, color, year built, notes) |
| 3 | `units` | Rentable spaces within a property |
| 4 | `tenants` | People (primary lease holders; contact + employment + income) |
| 5 | `leases` | A unit lease with primary tenant + financial terms |
| 6 | `lease_tenants` | **Unused** join table for multi-tenant (occupant) leases |
| 7 | `rent_charges` | One charge per lease per period (ledger rows) |
| 8 | `payments` | Payments applied to a charge |
| 9 | `vendors` | Service providers directory |
| 10 | `work_orders` | Maintenance requests |
| 11 | `applications` | Manual rental applications (no UI) |

Plus framework tables `sqlite_sequence` and `_cf_METADATA` (D1 internal). `[VERIFIED]`

## Relationships

```
properties 1──∞ units
units      1──∞ leases
tenants    1──∞ leases  (primary_tenant_id, ON DELETE SET NULL)
leases     1──∞ rent_charges   ((lease_id, period) UNIQUE)
rent_charges 1──∞ payments
vendors    1──∞ work_orders (ON DELETE SET NULL)
properties 1──∞ work_orders (ON DELETE SET NULL)
units      1──∞ work_orders (ON DELETE SET NULL)
tenants    1──∞ work_orders (ON DELETE SET NULL)   -- "who reported it"
units      1──∞ applications (ON DELETE SET NULL)
leases    ∞─∞ tenants  (lease_tenants — table exists, nothing writes it)
```

## Enums (stored as TEXT — enforced by static values, not DB CHECKs) `[VERIFIED]`

| Column | Values |
|---|---|
| `properties.type` | `single_family` `multi_family` `condo` `townhouse` `commercial` |
| `units.status` | `vacant` `occupied` `turnover` `unavailable` |
| `leases.status` | `upcoming` `active` `ended` `cancelled` |
| `rent_charges.status` | `open` `partial` `paid` `overdue` `waived` |
| `payments.method` | `cash` `check` `ach` `credit` `other` |
| `vendors.category` | `plumber` `electrician` `hvac` `handyman` `cleaning` `landscaping` `general` |
| `work_orders.priority` | `low` `normal` `high` `urgent` |
| `work_orders.status` | `open` `assigned` `in_progress` `completed` `cancelled` |
| `applications.status` | `new` `screening` `approved` `declined` `withdrawn` |

> `[RECOMMENDATION]` No DB-level CHECK constraints exist; enum drift between server Zod schemas
> and existing rows is possible. Add CHECKs in a future migration if strictness is wanted.

## Key constraints & indexes

- Unique indexes: `rent_charges(lease_id, period)` (idempotent generation), `settings(key)`
  (PK).
- Indexes: `units(property_id)`, `units(status)`, `tenants(last_name, first_name)`,
  `leases(unit_id/tenant_id/status)`, `rent_charges(due_date/status)`, `payments(charge_id)`,
  `work_orders(status/property_id/unit_id)`, `applications(status)`.
- Foreign keys with cascades: `units.property_id → properties` (CASCADE), `leases.unit_id →
  units` (CASCADE), `rent_charges.lease_id → leases` (CASCADE), `payments.charge_id →
  rent_charges` (CASCADE), `lease_tenants.* → leases/tenants` (CASCADE), and SET NULL paths for
  `leases.primary_tenant_id`, `work_orders.*`, `applications.unit_id`.

> **Consequence `[VERIFIED via schema]`**: deleting a property deletes its units → their leases
> → their charges → their payments. Deleting a **tenant** only nulls `primary_tenant_id` on
> leases (history is kept, contrary to the app's delete-confirmation copy in the tenant dialog —
> see `06`/`07`).

## Money & dates

- Money stored as **REAL** (`monthly_rent`, `deposit`, `late_fee`, `amount`, `amount_paid`,
  `cost`, `market_rent`, `monthly_income`). Display formatting rounds to whole units
  (`maximumFractionDigits: 0`) using the locale's browser default via `Intl.NumberFormat`.
  `[VERIFIED — lib/utils.ts formatMoney]`
- Dates stored as **TEXT** `YYYY-MM-DD` (or SQLite `datetime('now')` datetimes for
  `created_at`, `updated_at`, `paid_at`). Comparisons use SQLite `date('now')` (UTC) on the
  server while the client computes dates in local time — small boundary/cross-border risk.
  `[INFERENCE — acceptable but worth a test]`
- `rent_charges.period` is TEXT `YYYY-MM`.

## Seeding

- `schema.sql` is **DDL only** (no INSERT statements) `[VERIFIED]`.
- `ensureSeeded()` in `src/server/index.ts` writes, once per database:
  - `settings` → 4 defaults (due day 1, late fee 50, grace 5, currency USD) via
    `INSERT OR IGNORE`.
  - if `properties` empty → 3 demo properties + (if `units` empty) 5 demo units.
  - if `vendors` empty → 3 demo vendors.
- Guarded by `COUNT(*) = 0`, so user deletions are never resurrected `[VERIFIED — source]`.
- `[INFERENCE]` Tenants/leases/charges are intentionally NOT seeded, so the demo boots with an
  empty rent ledger and empty tenant/lease modules.

## Schema evolution

- Migration = editing `schema.sql` with `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT
  EXISTS`. Additive changes are safe; destructive changes are not (no drop/alter handling, no
  versioning, no migration ledger for this project). `[INFERENCE]`
- `@clawnify/db` documents a Drizzle + `drizzle-kit` migration path (`__clawnify_migrations`)
  that OpenProperty does not use. `[RECOMMENDATION — if schema churn begins, adopt Drizzle
  migrations or introduce a `schema_migrations` table before shipping V1 commercial.]`

## Backup / portability

- Local DB is a file under `.wrangler/state/v3/d1`; read-only copy = stop editor, copy file.
  `[INFERENCE]`
- No export/import features exist in-product (no CSV, no JSON dumps). `[VERIFIED]`
- `[RECOMMENDATION]` For the commercial V1, add a data-export utility (D1 export via
  `wrangler d1 export --local/--remote`) documented as an ops playbook, before any migration work.

## Baseline verification dump `[VERIFIED 2026-09-20]`

- Table list: `applications, lease_tenants, leases, payments, properties, rent_charges,
  settings, tenants, units, vendors, work_orders` (+ internal `sqlite_sequence`, `_cf_METADATA`).
- Rows: properties 3, units 5, tenants 0, leases 0, rent_charges 0, payments 0, vendors 3,
  work_orders 0, applications 0, settings 4.
- `PRAGMA foreign_keys` = 1.