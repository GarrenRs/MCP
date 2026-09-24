# Execution Log — P4: Algerian Localization Content

Records the execution of phase P4 from `Docs/plans/13-v1-implementation-plan.md` (P4 section)
and `Docs/plans/13c-v1-implementation-plan.md` (order step 4). Authored by the execution
agent (systemorkestrix-pixel) on 2026-09-20.

## Status

[COMPLETE] — landed as git commit `3ae7943` ("feat: localize ORKESTRIX Property System
for Algeria") on `main`, 2026-09-20. Preceded by `d431909` (P3).

## Objective vs. delivered

Plan objective (13, P4): produce the localized commercial **ORKESTRIX Property System**
(V1: Algerian market, French UI, DZD) — French `fr-DZ` catalog, DZD money formatting,
dd/MM/yyyy dates, Algeria-shaped address (country + wilaya + commune), static 58-wilaya
list, and global French UI.

Delivered:

- **i18n layer**: `src/client/i18n/index.ts` extended with `Locale = "en" | "ar" | "fr-DZ"`,
  a full French catalog `fr.json`, an expanded `en.json`, the Arabic placeholder
  `ar.json` untouched, plus a `tf(key, ...args)` interpolating helper with `{0}/{1}`
  tokens. `SUPPORTED_LOCALES` includes `fr-DZ`; `DEFAULT_LOCALE` stays `"en"`.
- **Defaults**: both server and client `DEFAULT_SETTINGS` → `currency: "DZD"`,
  `locale: "fr-DZ"`. Settings round-trip via PUT/GET `/api/settings`.
- **Formats**: `formatDate` defaults to dd/MM/yyyy for French-family locales
  (`formatDate("2026-04-01","fr-DZ")` → `"01/04/2026"`); explicit opts still honored.
  `formatMoney` falls back to DZD and renders whole dinars with the DA suffix
  (`formatMoney(1500,"DZD","fr-DZ")` → contains `"1 500 DA"`, no decimals).
- **Data model**: additive migration `migrations/0002_property_geography.sql` adds three
  nullable columns (`country`, `wilaya`, `commune`) via `ALTER TABLE ADD COLUMN`.
  State and zip untouched. The server POST insert writes geo columns only when supplied
  and non-null, keeping pre-migration test databases safe (their schema has no geo
  columns). The `schema_migrations` ledger records `0002_property_geography`;
  re-running is idempotent (`skipped`).
- **Address form**: property dialog re-labels the address group — a Wilaya select
  (static 58-wilaya list, `src/client/lib/wilayas.ts`), Commune and Country inputs;
  City / State / Zip kept as-is. Property-list and property-page display the geo
  fields in the address line; legacy NULL rows render without crash.
- **UI**: every user-facing string wrapped through `t()` / `tf()` across dashboard,
  properties, units, tenants, leases, rent, payments, maintenance, work orders,
  settings, error banner, app shell, and nav. `app.tsx` brand → "ORKESTRIX Property
  System"; `index.html` → `lang="fr"` with localized title/meta. Settings Policy tab
  gained the `Français (Algérie)` locale option beside Currency.
- **Tests**: updated default-locale/currency expectations (`fr-DZ` / `DZD`) in the
  existing settings and charges tests; added `tests/localization-p4.test.ts` covering
  catalog parity, fr-DZ activation, DZD + date formatting, migration additive +
  idempotent + convergence, property CRUD with geo incl. legacy NULL rows, wilaya
  sanity (58 entries, unique codes, Alger/Oran/Constantine/Tamanrasset present), and
  settings round-trip.

## Design decisions

- **Hand-rolled i18n, no library dependency.** Like P3, the plan scoped to a lightweight
  in-repo module. A dot-lookup catalog with English fallback plus `tf()` interpolation
  satisfies the catalog + locale-selection requirement without adding a runtime
  dependency (kept the same shape as P3).
- **Dynamic POST insert instead of auto-loading migrations in tests.** The earlier
  draft would have changed `createTestEnv()` to load migrations in every D1Stub; that
  would have broken the `migrations.test.ts` convergence test (which uses a
  schema.sql-only DB). Instead the server's POST insert appends geo columns only when
  the request supplies a value and it is non-null, so pre-migration databases never
  reference missing columns. P4 property-CRUD-with-geo tests apply migration 0002 to
  their own env before exercising CRUD.
- **`DEFAULT_LOCALE` stays `"en"` on purpose.** This keeps the P3 test expectations
  that use unsupported locales (`setLocale("fr")` → `"en"`) and `t("settings.locale",
  "fr")` → `"Language"` green, and ensures `ar.json` remains the placeholder catalog.
- **`formatMoney` fallback → `"DZD"`.** The server default is now DZD, so the formatter
  falls back to DZD when no explicit currency is supplied; callers that pass an explicit
  currency (the vast majority) continue to format correctly.
- **Wilaya module stores names.** `properties.wilaya` holds the wilaya name (e.g.
  `"Alger"`), not the code, matching the pick-list UX; the code list is used only to
  populate the select options.
- **Demo-row defaults opt-in.** The seeded Austin/TX rows are untouched and exercise
  the legacy NULL-geo path (no crash, NULL read back).

## Verification evidence

- [VERIFIED] `pnpm typecheck` exits 0 (TYPECHECK_OK).
- [VERIFIED] `npx vitest run --no-isolate --pool=forks --no-file-parallelism` green:
  7 files, 89/89 tests passed (71 from P1–P3 + 18 new P4 tests).
- [VERIFIED] `pnpm db:migrate` exits 0 with `applied [0002_property_geography],
  skipped [0001]` on a fresh run; re-running is idempotent
  (`applied [none], skipped [0001, 0002_property_geography]`).
- [VERIFIED] New tests cover the plan's required cases (P4 §6):
  - fr-DZ activates as a supported locale and selects the French catalog
    (`t("nav.dashboard","fr-DZ")` → `"Tableau de bord"`);
  - English stays the fallback for unsupported locales (`setLocale("fr")` → `"en"`);
  - French catalog covers every English key (parity check + round-trip);
  - `tf` substitutes positional tokens (`tf("leases.meta",3,1,"fr-DZ")` → French);
  - DZD whole-dinar formatting (`1 500 DA`, no decimals); French `dd/MM/yyyy` dates;
    English month-short kept for `en`; explicit opts honored;
  - migration `0002_property_geography` is additive, records its version, re-running is
    a no-op, and fresh/pre-existing databases converge;
  - property CRUD persists country/wilaya/commune; partial PUT updates them;
    legacy rows without geo fields stay valid (NULL, no crash);
  - server defaults serve `locale: "fr-DZ"` and `currency: "DZD"` on a cold database,
    and they round-trip through the API;
  - wilaya list has 58 entries, unique codes, non-empty names, and key wilayas.
- [VERIFIED] Git diff audit — changed files are limited to P4 scope (i18n, components,
  settings, utils, types, server defaults, tests, docs). No P5+ features (auth, roles,
  multi-tenancy, financial rules) were introduced. `Docs.zip` remains untracked and was
  never staged.

## Files changed (commit stat)

`src/server/index.ts`, `src/client/types.ts`, `src/client/hooks/use-app-state.ts`,
`src/client/i18n/index.ts`, `src/client/i18n/en.json`, `src/client/i18n/fr.json` (new),
`src/client/lib/utils.ts`, `src/client/lib/wilayas.ts` (new), `src/client/app.tsx`,
`src/client/components/dashboard/dashboard-page.tsx`,
`src/client/components/error-banner.tsx`, `src/client/components/leases/lease-dialog.tsx`,
`src/client/components/leases/leases-page.tsx`,
`src/client/components/maintenance/maintenance-page.tsx`,
`src/client/components/maintenance/work-order-dialog.tsx`,
`src/client/components/properties/properties-list.tsx`,
`src/client/components/properties/property-dialog.tsx`,
`src/client/components/properties/property-page.tsx`,
`src/client/components/properties/unit-dialog.tsx`,
`src/client/components/rent/payment-dialog.tsx`, `src/client/components/rent/rent-page.tsx`,
`src/client/components/settings/settings-page.tsx`,
`src/client/components/tenants/tenant-dialog.tsx`,
`src/client/components/tenants/tenant-page.tsx`,
`src/client/components/tenants/tenants-list.tsx`, `index.html`,
`Docs/08-localization.md`, `tests/localization-p4.test.ts` (new),
`tests/settings-i18n-errors.test.ts`, `tests/charges.test.ts`,
`migrations/0002_property_geography.sql` (new). 30 files, +1505/−406.

## Risks / notes

- [INFERENCE] Client modules imported by the new tests (`i18n`, `utils`, components) are
  React/DOM-free at import time, so they run unmodified under the Vitest node
  environment; DOM-touching effects were not exercised by Vitest and are covered only by
  the live-app path (no dev server was running at validation time, so the live API
  checks were replaced by the automated suite, which covers the same HTTP paths).
- The formatter produced locale-specific spacing characters (narrow no-break space U+202F
  and no-break space U+00A0) in French currency output; tests normalize these when
  asserting the `1 500 DA` shape rather than a literal ASCII space.
- Rollback per plan P4 §8: revert `3ae7943`; the new columns stay NULL for old rows, the
  additive migration has no drops, and all geo fields are optional — legacy clients
  continue to work unchanged.
- Note: `Docs.zip` (audit archive) remains untracked in the repo and is never staged.
