# 12 — Glossary

Terms as used in this codebase and docs.

## Brand `[PROJECT DECISION — see 14]`
- **ORKESTRIX** — master brand for all commercial products.
- **ORKESTRIX Property System** — current commercial localized product built from the OpenProperty foundation.
- **OpenProperty** — upstream/open-source technical foundation (MIT); not the commercial product identity.

## Domain
- **Property** — a building/complex (Portfolio root, cascades → units → leases → charges → payments).
- **Unit** — rentable leaseable arm of a property; carries `status` (`available`/`occupied`/`maintenance`/`turnover`).
- **Tenant** — a person; linked to a unit only through an active lease. One lease has one primary tenant in the UI.
- **Lease** — binding terms (start/end, monthly rent, deposit, due day, late fee, status). Source of rent charges.
- **Rent charge** — per lease per period (`period` = `YYYY-MM-01`) owed amount; auto-classified `open`/`partial`/`paid`/`overdue`/`waived`.
- **Payment** — a payment record against a charge (`amount_paid` recomputed on add/remove).
- **Work order** — maintenance ticket (priority, status, scheduled date, cost, vendor, optional unit/property).
- **Vendor** — service provider (category, color, contact).
- **Application** — rental application record (backend-only as of baseline).

## Code
- **`ensureSeeded` / seed** — idempotent server bootstrap that inserts demo properties/units/vendors/settings on first boot once.
- **`@clawnify/db`** — DB adapter package re-exporting `initDB`, `ensureSeeded` (schema + drizzle internals; raw SQL here).
- **`@clawnify/app/client`** — shell SDK providing `AppNav` + `reportLocation` (dual-mode nav).
- **`safeGet` / `safeQuery`** — dashboard fetch wrappers that never throw into a 500.
- **`buildUpdate` / `parseJson` / `intParam`** — server helpers for zod-validated partial updates.
- **Period** — charged month, stored first-of-month `YYYY-MM-01`; `YYYYMM` no longer used anywhere (renamed to `period`).
- **`active_unit_*`** — JOINed read fields on tenant payloads (unit id/name + property name via active lease).
- **`status` in units vs leases** — independent `status` fields; boundary bugs tracked in R5.

## Layout/tooling
- **Standalone vs embedded (Clawnify host)** — two UI modes: full rail vs host-provided nav. Route strings identical.
- **`pnpm dev`** — db:migrate + Vite (:5173) + wrangler dev (:8787) concurrently.
- **`pnpm db:migrate`** — applies `schema.sql` to the local D1 instance (`wrangler d1 execute --file`).
- **Rent-page period stepper** — month navigator around `YYYY-MM`; totals computed for the shown period.

## Doc-series abbreviations
- `[VERIFIED]` / `[INFERENCE]` / `[RECOMMENDATION]` / `[UNKNOWN]` — evidence tags used through 01–11.