# Execution Log — P3: i18n Infrastructure, Settings & Error Codes

Records the execution of phase P3 from `Docs/plans/13-v1-implementation-plan.md` (P3 section) and
`Docs/plans/13c-v1-implementation-plan.md` (order step 3). Authored by the execution agent
(systemorkestrix-pixel) on 2026-09-20.

## Status

[COMPLETE] — landed as git commit `d431909` ("feat: establish i18n settings and error codes")
on `main`, 2026-09-20 17:09 +0100. Preceded by `7e97091` (P2 migration ledger) and `b1b3b55`
(P1 test foundation).

## Objective vs. delivered

Plan objective (13, P3): establish the localization/configuration foundation and stable server
error-code infrastructure required by later V1 phases, without changing business behavior.

Delivered:

- Dependency-free i18n infrastructure: `src/client/i18n/index.ts` (catalog-backed `t()`,
  `setLocale`/`getLocale`, `isSupportedLocale`, `resolveErrorMessage`), `en.json` (full error +
  settings catalog) and `ar.json` (placeholder catalogs). No third-party i18n dependency added —
  the plan's "lightweight i18n library if required" resolved to a minimal in-repo module.
- Product `locale` setting (default `"en"`) added to `DEFAULT_SETTINGS` on the server and
  `AppSettings` on the client; GET/PUT `/api/settings` stay additive (defaults merged with rows,
  no new validation).
- Settings UI Policy tab gained a Language select (English / العربية) beside the existing
  Currency input; saving persists `locale`.
- Explicit-locale, crash-proof formatters in `src/client/lib/utils.ts`: `formatDate`,
  `formatMoney`, `formatPeriod` accept an explicit locale (validated against supported locales,
  else the active one). Malformed currency codes never throw — they fall back to a locale-aware
  plain number (prevents `Intl.NumberFormat` `RangeError`).
- Stable server error codes: `src/server/errors.ts` centralizes an 8-code set and an `err()`
  helper. Every error response in `src/server/index.ts` now returns `{ error, code }`; the legacy
  `{ error }` shape is unchanged so existing clients keep working. No large taxonomy.
- Client error mapping in `src/client/api.ts`: `api()` throws `ApiError(status, code, message)`;
  known codes resolve through the catalog, unknown codes fall back to the server message.
- Active locale activated on load: `use-app-state` calls `setLocale(settings.locale)` and sets
  `document.documentElement.lang`.

## Design decisions

- **No i18n library dependency.** The plan named `react-i18next` as an example but scoped to "the
  appropriate lightweight i18n library *if required by the plan*". A minimal in-repo module
  (dot-lookup catalog, en → key fallback) satisfies the catalog + locale-selection requirement
  without adding a runtime dependency.
- **No new server validation.** Malformed currencies are tolerated at the formatter layer rather
  than rejected at the settings write; a bad setting can crash a render, so the render layer was
  made defensive instead.
- **`validation` kept out of the client catalog** so zod's detailed field messages continue to
  reach the user verbatim (legacy behavior preserved); the other seven codes map through `en.json`.
- **Additive-only server change.** `parseJson` failures now carry a `code` (`invalid_json` /
  `validation`) threaded into the response; route bodies are otherwise untouched.
- Per the safe-change rules (`Docs/references/10-evolution.md`), no schema, migration, auth, or
  financial-rule changes were made in this phase.

## Verification evidence

- [VERIFIED] `pnpm typecheck` exits 0 (TYPECHECK_OK).
- [VERIFIED] `pnpm test` runs green: 6 files, 71/71 tests passed — 50 from P1/P2 plus 21 new
  P3 tests (`tests/settings-i18n-errors.test.ts`).
- [VERIFIED] New tests cover the plan's required cases (13, P3 §6):
  - settings merged additively; partial update preserves untouched keys;
  - locale + currency read/write round-trips;
  - existing settings intact after locale-only update;
  - server error paths expose stable codes (`invalid_id`, `not_found`, `validation`, `no_fields`,
    `invalid_json`, `invalid_body`, `period_required`) with the legacy `{ error }` string present;
  - client mapping: known codes localized (incl. Arabic), unknown/absent code falls back to the
    server message;
  - malformed currency codes (`EURO`, `X!`, `12`, `""`, null/undefined) never throw.
- [VERIFIED] Live behavioral check after the phase:
  - `GET /api/settings` returns defaults incl. `locale: "en"`;
  - `GET /api/properties/abc` → `400` with `{"error":"Invalid ID","code":"invalid_id"}`;
  - `PUT /api/settings {locale:"ar"}` then GET returns `locale:"ar"`; restored to `"en"`;
  - `/api/health` 200; `/api/dashboard/summary` unchanged (`period=2026-09`, 3 properties,
    5 units, 4 occupied, `occupancy_rate=80`).

## Files changed (commit stat)

`src/client/api.ts`, `src/client/components/settings/settings-page.tsx`,
`src/client/hooks/use-app-state.ts`, `src/client/lib/utils.ts`, `src/client/i18n/ar.json` (new),
`src/client/i18n/en.json` (new), `src/client/i18n/index.ts` (new), `src/server/errors.ts` (new),
`src/server/index.ts`, `tests/settings-i18n-errors.test.ts` (new). 10 files, +463/−84.

## Risks / notes

- [INFERENCE] Client modules imported by the new tests (`i18n`, `utils`, `api`) are
  React/DOM-free at import time, so they run unmodified under the Vitest node environment; the
  DOM-touching `use-app-state` locale effect was not exercised by Vitest and is covered only by
  live-app observation.
- Rollback per plan P3 §8: revert `d431909`; the server reverts to legacy `{ error }`-only bodies
  and the client to browser-locale formatting — no data or contract migration involved.
- This phase unblocks P4 (Arabic UI strings, DZD currency handling via the crash-proof formatter,
  and the `locale` setting wired here).
- Note: `Docs.zip` (audit archive) remains untracked in the repo and is never staged.