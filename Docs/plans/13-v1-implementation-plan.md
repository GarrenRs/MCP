# 13 — V1 Implementation Plan (Part 1) — ORKESTRIX Property System

Commercially usable Algerian local version — phases P1–P6. Part 2: `13b` (P7–P12 + order).

Baseline: git `main` @ `98bfc4a`. Sources: `Docs/00-README.md`, `Docs/references/01–12`,
`Docs/archive/11`. All changes follow the safe-change rules
from `Docs/references/10-evolution.md`: additive schema only, COUNT-guarded seeds, no breaking HTTP contracts,
keep zod + `@clawnify/db` guards, typecheck + financial tests gated, new seeds opt-in.

**This document is a plan only — no application code is modified by this doc.**

## 0. Pre-V1 operational prerequisites (no code)

- Free disk on C: (R4) or relocate pnpm store / `.wrangler` state / `TMP` off C:.
- Cloudflare account + remote D1 DB id (replaces the `local` placeholder in `wrangler.toml`);
  decide the wrangler `assets` story for the static build with the Clawnify host (UNKNOWN #2).
- Decide V1 languages: French (`fr-DZ`) primary, Arabic (`ar-DZ`) deferred.

### Out of scope for V1 (final list)
Auth beyond single-tenant roles; online/remote payment processing; tenant/owner/public portals;
listing syndication; screening integrations; SMS/email automation; multi-company SaaS tenancy;
analytics dashboards; real-time sync; PWA/offline; Drizzle adoption for the data layer; Arabic RTL
pass (deferred after FR V1); multi-occupant lease UI (`lease_tenants` stays dead in V1).

## P1 — Environment & test foundation
1. **Objective**: Make the repo safe for financial-logic changes: usable disk, test harness (R2),
   clean `pnpm typecheck`.
2. **Files/modules affected**: `package.json` (devDeps + `test` script), new `tests/` (financial
   core), ops/tooling only.
3. **Database changes**: none.
4. **API changes**: none.
5. **UI changes**: none.
6. **Tests required**: Vitest; extract non-rewriting pure helpers for the money rules (charge
   `generate` idempotence + due-day clamp ≤28; payment add/remove → `amount_paid`/`status`
   recompute; overdue rule `due_date < date('now') AND amount_paid < amount`; `waived` no-op);
   integration tests via `app.request()` with a stubbed D1 binding + existing demo fixture. Gate CI
   on `pnpm typecheck` + `pnpm test`.
7. **Risk level**: LOW–MEDIUM (full disk can block; extraction is read-only-safe if behavior
   stays identical).
8. **Rollback**: revert commit; helpers are new files + thin call-site swaps; no contract change.

## P2 — Migration ledger
1. **Objective**: Replace the unversioned DDL-only model (R3) before any future schema change:
   versioned additive migrations, reconcilable with `schema.sql` for fresh DBs.
2. **Files/modules affected**: `package.json` (`db:migrate`), new `migrations/` + runner
   (`src/server` or tooling), `wrangler.toml` optional.
3. **Database changes**: additive `schema_migrations(version, applied_at)`; a v1 migration records
   current `schema.sql` state as applied (base DDL stays idempotent for fresh installs).
4. **API changes**: none.
5. **UI changes**: none.
6. **Tests required**: runner applies pending files in order; idempotent re-run; never mutates an
   applied version; fresh-DB and pre-existing-DB converge.
7. **Risk level**: LOW (tooling; touches `db:migrate` only).
8. **Rollback**: revert commit; unaffected until first real migration; fresh DBs still clone
   via DDL.

## P3 — i18n infrastructure, settings, error codes
1. **Objective**: Localization foundation + product-level config: `locale` and `currency` as
   separate settings, stable server error **codes** (not English strings), i18n catalog + library.
   Prepares auth and every UI phase.
2. **Files/modules affected**: `package.json` (i18n dep, e.g. react-i18next), `src/client/api.ts`
   (error-code mapping), `src/server/index.ts` (`DEFAULT_SETTINGS` + error helpers),
   `src/client/lib/utils.ts` (explicit-locale `formatDate`/`formatMoney`/`formatPeriod`),
   `src/client/context.tsx`, `src/client/components/settings/settings-page.tsx`,
   new `src/client/i18n/en.json` (+ `ar.json` placeholder), `Docs/references/08` reviewed.
3. **Database changes**: none (`settings` is key/value; new defaults are code-level).
4. **API changes**: `GET /api/settings` returns `locale`/`currency` (additive, merged like today);
   `PUT /api/settings` accepts them; error responses ship stable `code` + `message` **while
   keeping** the legacy `{error}` shape for one release.
5. **UI changes**: policy tab gains Locale + Currency controls; format helpers use explicit locale;
   `index.html lang` set at runtime; error banner localizes codes.
6. **Tests required**: settings merge/additive; error-code mapping across all paths; malformed-
   currency regression (R8) asserting formatters never throw.
7. **Risk level**: MEDIUM (contract-shape care; touches every dialog error path).
8. **Rollback**: revert commit; legacy `{error}` retained keeps old clients working; new settings
   are additive keys.

## P4 — Algerian localization content
1. **Objective**: Algerian product surface: French (`fr-DZ`) catalog, DZD money formatting,
   dd/MM/yyyy dates, Algeria-shaped address (country + wilaya + commune).
2. **Files/modules affected**: `src/client/i18n/fr.json`, `src/client/components/**`,
   `src/client/lib/utils.ts` (fraction map; DZD whole-dinar default), wilaya/commune widgets
   (static 58-wilaya list), `src/client/components/properties/*` (+ dialogs), `index.html`
   (`lang="fr"` + title/meta), `Docs/references/08` update.
3. **Database changes**: additive columns via P2 migration: `properties.country TEXT`,
   `properties.wilaya TEXT`, `properties.commune TEXT` (nullable, `ALTER TABLE ADD COLUMN`; keep
   `state`/`zip` untouched). Demo-row defaults opt-in only.
4. **API changes**: property create/update zod schemas accept the new optional fields (additive);
   GET payloads include them.
5. **UI changes**: property dialog re-labels address group (Wilaya select/City, Commune, Country);
   currency select includes DZD; rent as whole dinars `1 500 DA`; dates dd/MM/yyyy.
6. **Tests required**: DZD/FR formatting units; property CRUD with new fields incl. legacy rows
   (NULL → no crash); wilaya list sanity.
7. **Risk level**: LOW.
8. **Rollback**: revert commit; new columns stay NULL for old rows; additive migration has no
   drops; fully optional fields.

## P5 — Auth & single-tenant roles
1. **Objective**: Remove the open-API blocker (R1) with minimal surface: login, session, roles
   (`owner` / `admin` / `manager`) for one organization. No multi-tenancy.
2. **Files/modules affected**: `package.json` (session lib: hono cookie + jose or built-in
   crypto), `src/server/index.ts` (middleware, `/api/auth/*`, protect `/api/*` except
   auth+health), `schema.sql` + P2 migration (`users` table), `src/client/app.tsx`,
   `context.tsx` (session bootstrap), new `login-page`, `page-shell.tsx` (user chip + logout),
   `api.ts` (credentials), settings page (Users tab).
3. **Database changes**: additive `users(id, email UNIQUE, password_hash, display_name, role,
   created_at)` + index; seed `users` opt-in (enabled separately, never in the demo seed).
4. **API changes**: `POST /api/auth/login|logout`, `GET /api/auth/session`; auth middleware
   (owner/admin manage users; deletions admin+; all roles read/write operations); endpoints and
   payloads otherwise unchanged.
5. **UI changes**: login screen; session-expiry → redirect to login; nav unchanged; settings
   gains Users tab.
6. **Tests required**: unauthenticated/unauthorized access across every route group; password
   hashing; session expiry; role matrix; regression dashboard/proxy still work.
7. **Risk level**: HIGH (security surface; middleware touches every route).
8. **Rollback**: feature-flag middleware (`AUTH_ENABLED=false` → current open behavior for one
   release); revert commit restores open API; `users` additive and inert until flag on.

## P6 — Charge administration UI
1. **Objective**: Expose existing API-only charge powers (edit amount/due date/status incl.
   `waived`, notes) — closes the biggest rent-ledger gap (C/M7).
2. **Files/modules affected**: `src/client/components/rent/rent-page.tsx`,
   `src/client/components/rent/payment-dialog.tsx`, new `charge-dialog.tsx`, `src/client/api.ts`
   (PUT/waive calls), `src/client/types.ts` (fields already exist).
3. **Database changes**: none (`rent_charges` has `amount`, `due_date`, `status`, `notes`).
4. **API changes**: none new (uses existing `PUT /api/rent-charges/:id`); add an idempotent
   `recompute` after edits so `amount_paid`/`status`/totals stay consistent.
5. **UI changes**: edit action per charge row; dialog for amount/due date/status (`waived` with
   confirmation) + notes; warn (not block) when editing a `paid` charge.
6. **Tests required**: post-edit recalc (amount change → totals; status change → summary);
   `waived` excluded from overdue/totals; regression on payment add/remove.
7. **Risk level**: MEDIUM (money UI; mitigated by P1 tests).
8. **Rollback**: revert commit; endpoints unchanged; UI-only delta.