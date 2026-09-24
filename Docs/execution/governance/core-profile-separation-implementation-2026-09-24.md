# Core + Algeria Profile — Implementation Report

**Date:** Thu Sep 24 2026
**Phase:** Core–Profile separation (implementation)
**Head:** `aab9081`
**Gate:** `Docs/execution/governance/core-profile-separation-gate-2026-09-24.md` (PASSED with preconditions)

## 1. Objective

Separate the product into a market-neutral GLOBAL CORE plus an ALGERIA PROFILE, with the smallest possible seam extraction, such that **Core + Algeria Profile ≡ current product behavior**. All upstream attribution, license, Phase A history and user-visible behavior are preserved.

## 2. Architecture

```
src/server/index.ts      deployment entry (wrangler main) — composes
├─ src/server/app.ts     core server factory  createApp(profile: ServerProfile)
│     settings defaults (core numerics + profile overrides)
│     property input schema built from profile.geo.columns
│     CSV properties export headers/data from profile.geo.columns
│     first-run seeding = settings only (no demo portfolio)
└─ src/profile/algeria/server.ts      profile server shape (settingsDefaults, geoColumns)

src/client/main.tsx      deployment entry (client) — registers profile,
│                        applies build-shell metadata, renders <App profile>
├─ src/client/app.tsx    core UI    App({ profile }) → useAppState(profile)
├─ src/client/i18n/      core i18n  English base + registerLocales/registerCatalogs
├─ src/client/profile-types.ts      core profile contract (ProductProfile)
└─ src/profile/algeria/  profile package (catalogs, wilayas, geo slot, shell, styles)
      ├─ shared.ts       settingsDefaults {currency:DZD, locale:fr-DZ}, countryDefault DZ,
      │                 geoColumns ["commune","wilaya"] (order is contractual)
      ├─ wilayas.ts      the 58 wilayas dataset (moved from core)
      ├─ locales.ts      catalogs {ar, fr-DZ, en-fragment} + rtlLocales ["ar"]
      ├─ client.tsx      AlgerianAddressFields — property-dialog geo slot
      ├─ server.ts       algeriaServer
      ├─ shell.ts        build-shell metadata (lang fr, FR title/meta, Cairo font)
      ├─ styles.css      Cairo font override + RTL/Arabic typography rules
      ├─ ar.json / fr.json / en-fragment.json
      └─ index.ts        client assembly (algeria: ProductProfile)
```

The core never imports a profile module. The two deployment entries (`src/server/index.ts`, `src/client/main.tsx`) are the only composition points.

## 3. Seams extracted (behavior-preserving)

| Seam | Core now | Profile owns |
|---|---|---|
| Settings defaults | `default_rent_due_day`, `late_fee_amount`, `late_fee_grace_days` | `currency: "DZD"`, `locale: "fr-DZ"` |
| Property country default | — | `"DZ"` |
| Property-geography columns | generic `geoColumns` list (input schema, write loop, CSV headers, address joins) | `["commune", "wilaya"]` — order is contractual (CSV header order == list/page join order) |
| Property-geography form | opaque geo slot (`profile.geo.component`) rendering `value`/`onChange` keyed by column | `AlgerianAddressFields` (wilaya Select of 58 + commune input); dialog normalizes trim-or-null per column at save |
| Locales | English base only; `registerLocales(ids)` + `registerCatalogs(catalogs)` (deep-merge over en) | `fr-DZ`, `ar` catalogs + en-fragment (brand, geo terms, option labels) |
| RTL | `document.dir` driven by `profile.locales.rtlLocales` | `["ar"]` |
| Typeface / Arabic typography | neutral `--font-sans` (Inter stack) | Cairo + `[lang=ar]`/`[dir=rtl]` rules overlaid via profile stylesheet |
| Build shell (`index.html`) | neutral shell; deployment applies `profile.shell` at boot | `lang="fr"`, FR title/meta, Cairo webfont link |
| Demo portfolio | removed from runtime `ensureSeeded` (settings only) | dev/QA fixture `tests/helpers/demo-fixture.ts` (same 3 props / 5 units / 3 vendors), applied explicitly by demo-dependent tests |

## 4. Proofs

1. **Core zero dependency on DZD / fr-DZ / Algeria / DZ / wilaya / commune / WILAYAS** — mechanical grep over `src/` (ts/tsx/json/html/css) returns matches only inside `src/profile/algeria/`. Comments in core were scrubbed so the proof is crisply verifiable.
2. **Algeria data/config/presentation isolated in Profile** — all tokens, catalogs, wilaya dataset, geo slot component, shell metadata and Arabic styles live under `src/profile/algeria/`.
3. **Core-only typecheck/tests succeed** — `tests/core-i18n.test.ts` exercises the bare core with no profile registered (English-only fallbacks, neutral `formatMoney`, registration additive/idempotent); `pnpm typecheck` passes with only the profile imported via deployment entries.
4. **Core + Profile reproduces current behavior** — full suite green: **16 files / 223 tests passed** (`pnpm vitest run --no-file-parallelism`), including the demo-dependent dashboard/charges/charge-admin/payments/overdue-freshness/lease-occupancy/localization-p4 suites and the settings/i18n/CSV/audit contracts. Existing tests were left as contract evidence, updated only at the seam (import paths, explicit fixture + locale registration).
5. **Changing Profile never requires Core business rule changes** — every Algeria-specific value crosses the compose boundary through `ServerProfile` / `ProductProfile`; finance.ts, leases.ts, dashboard, work-orders, applications, audit, export-csv are untouched by profile data.
6. **Settings overrides work independently of Profile defaults** — settings table rows win over `settingsDefaults` (server `INSERT OR IGNORE` + read-path, client `parseSettings(raw, defaults)`); verified by the pre-existing override tests (`persists a setting override`, `merges settings additively`, localization defaults test).

## 5. Verification performed

- `pnpm typecheck` — PASS (0 errors)
- `pnpm vitest run --no-file-parallelism` — PASS (16 files, 223 tests)
- Token grep over `src/` — all DZD/fr-DZ/Algeria/DZ/wilaya/commune/WILAYAS occurrences inside `src/profile/algeria/`
- `pnpm build` (vite, production) — PASS; 6415 modules transformed; bundle-level check of the built CSS confirms the profile stylesheet's Cairo `--font-sans`, `[lang=ar]` and `[dir=rtl]` rules are present as unlayered overrides winning over Tailwind's layered theme (identical net CSS to the pre-separation product)
- Browser smoke check — deferred: no desktop browser is connected to this session (experimental browser setting), so an interactive check was replaced by the production build + full integration suite (the suite exercises the composed server entry `src/server/index.ts`)

## 6. Review verdict

**orkestrix-reviewer: PASS** (second pass, after applying its single MEDIUM finding — demo fixture ordering in `tests/localization-p4.test.ts` moved inside the geography describe after `runMigrations`). Full suite re-run green after the fix: 16 files / 223 tests.

## 6. Intentional non-changes (scope guard)

- No new countries, no Profile Manager, no Jurisdiction rules, no business-behavior changes.
- API contracts unchanged: same routes, same response shapes, same CSV columns and order, same error codes/messages.
- DB schema untouched (migration `0002` still adds `country/wilaya/commune`; fixture runs against the base schema so it works pre-migration).
- No DI/registries/frameworks added — a single typed profile object + small factories.
- Finance and lease engines untouched.

## 7. Files changed

**Added**
- `src/profile/algeria/{shared,wilayas,locales,shell,client,server,index}.{ts,tsx}` , `styles.css`, `ar.json`, `fr.json`, `en-fragment.json`
- `src/client/profile-types.ts` (core profile contract)
- `src/server/app.ts` (core factory; carries the pre-existing AUDIT-consts change, non-exported)
- `tests/helpers/demo-fixture.ts` (QA demo fixture)
- `tests/core-i18n.test.ts` (core-only evidence)

**Moved (core → profile)**
- `src/client/lib/wilayas.ts` → `src/profile/algeria/wilayas.ts`
- `src/client/i18n/fr.json` → `src/profile/algeria/fr.json`
- `src/client/i18n/ar.json` → `src/profile/algeria/ar.json`

**Modified (core seams + tests)**
- `src/server/index.ts` — composed entry (`createApp(algeriaServer)`; keeps `export default app` + re-export `resetSeedForTests`)
- `src/client/i18n/index.ts` — en base + `registerLocales`/`registerCatalogs` deep-merge; `src/client/i18n/en.json` — dropped brand/geo.wilaya/geo.commune/vendors.option_*
- `src/client/hooks/use-app-state.ts` — `useAppState(profile)`, profile defaults, `rtlLocales`-driven dir
- `src/client/context.tsx` — `AppValue` carries `profile`
- `src/client/app.tsx` / `main.tsx` — `App({profile})`, registration + shell application
- `src/client/types.ts` — dropped `wilaya`/`commune` from `Property`
- `src/client/components/properties/{property-dialog,properties-list,property-page}.tsx` — generic geo slot + joins in `geoColumns` order
- `src/client/components/settings/settings-page.tsx` — profile-driven currency default/placeholder + locale options (`["en", ...profile.locales.ids]`)
- `src/client/lib/utils.ts` — `formatMoney` never assumes a currency (no DZD fallback); `formatDate` unchanged
- `src/client/styles.css` / `index.html` — neutralized (profile styles + shell supply market presentation)
- `tests/{dashboard,charges,charge-admin,payments,overdue-freshness,lease-occupancy,localization-p4}.test.ts` — apply `applyDemoFixture(env)` at end of beforeEach + explicit profile locale registration where catalogs are asserted
- `tests/settings-i18n-errors.test.ts` — registers profile locales for ar/fr-DZ lookups

## 8. Commit scope

Exactly ONE implementation commit, staging only the files above. Pre-existing unstaged/untracked working-tree items are intentionally EXCLUDED: `Docs/execution/ui-finalization/*`, `tests/audit.test.ts` (local AUDIT-consts change), `Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5..P8/`, `tc.txt`, `tc3.txt`, `vt.txt`, `vt3.txt`, and the gate report `Docs/execution/governance/core-profile-separation-gate-2026-09-24.md` (phase-history artifact already uncommitted). No push — waiting for explicit request.