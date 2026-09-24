# Core/Profile Dependent-Effect Verification — Execution Report

- **Date:** 2026-09-24
- **Phase:** Dependent-effect verification of the Core + Algeria Profile separation (JURISDICTION V1 out of scope; no new countries; no Profile Manager; no business-rule changes)
- **Implementation under test:** `b46168a` "Separate global core from Algeria profile"
- **Baseline SOT:** GitHub `origin/main` = `b46168a`
- **Governance parent:** `f1c1a99` "docs: establish dependent-effect closure rule"
- **Commit (this closure):** recorded post-commit (see Closure record below)

---

## 1. Objective

Verify the user-visible / runtime-visible effects introduced by the Core/Profile
separation (b46168a) against the pre-separation product contract, and correct with the
smallest possible change any directly-dependent defect. Not a new feature phase.

## 2. Verification environment

- Dev stack (already running): Vite UI `http://localhost:5173` (proxy `/api` → `:8787`),
  API `http://127.0.0.1:8787` (wrangler dev, local D1).
- Drive: Playwright (browser MCP). Viewport widths 375 / 768 / 1440.
- Auth: real login flow via a throwaway dev user created directly in the local D1
  (`verify@local.test`, PBKDF2 hash matching the app's `auth.ts` format), removed at the end.
- Dev D1 state at start: users `owner@example.com` + `sara@gmail.com`; settings
  `locale=en`, `currency=DZD`, `AUTH_ENABLED=true`; 3 demo properties (commune/wilaya NULL).

## 3. Browser verification — PASS

| Area | Results |
|---|---|
| **Login** | Sign-in form renders in the profile-default locale (`fr-DZ` EN/FR/AR catalogs verified over the flow); valid login → redirect `/dashboard`; invalid/session handling unchanged. Login screen language falls back to profile defaults when `/api/settings` 401s (identical to pre-separation `DEFAULT_SETTINGS.locale = "fr-DZ"`). |
| **Properties** | List (3 cards, `3 properties · 5 units`, Export CSV button), card → detail page with units/work-orders, address join with zip. |
| **Property geography fields** | New-property dialog renders the profile geo slot between Address and City/Country: **Wilaya** select with the full profile dataset (**58 wilayas**, verified `Adrar…Alger` present) + **Commune** input + default Country `DZ` (profile `countryDefault`). Created "Verify House": `wilaya=Alger`, `commune=El Biar`. List join renders **profile column order (commune before wilaya)**: `1 Verify St, El Biar, Alger, DZ, Algiers, Algiers`; page join adds zip (`…, 16000`). Edit dialog round-trips the geo values (wilaya `Alger` preserved); delete flow (Edit → Delete → ConfirmDelete) works. Property then removed to restore the dev DB. |
| **Settings** | Tabs Vendors / Rent policy / Users / Audit (owner role); Rent policy form: due day 1, late fee 50, grace days 5, Currency field placeholder **DZD** (profile default), Language picker. |
| **Locale switching** | Settings → Rent policy → Language → Save, verified EN→FR, FR→AR, AR→FR, FR→EN through the UI. After save the active page re-renders on the next render/route change and persists on reload — same effect-timing as the pre-separation implementation (identical `useEffect([settings.locale])` + i18n `DEFAULT_LOCALE="en"`); reload with a session applies the saved locale from `/api/settings`. |
| **Arabic RTL** | `document.dir="rtl"` and `lang="ar"` driven by the profile's `rtlLocales`; Arabic nav and dashboard text (`لوحة التحكم`, العقارات…), `4 من 5 وحدة`, money `0 د.ج.` (DZD), Cairo in the font stack. |
| **Shell metadata** | `document.title = "ORKESTRIX Property System"`; `<meta name="description">` = the French Algeria description; Cairo webfont `<link>` appended — all from the profile `shell` package via `applyShell` in `src/client/main.tsx`; Inter font link remains from core. |
| **Navigation/tabs/forms** | Nav rail localized in EN/FR/AR (Biens/Locataires…, العقارات/المستأجرون…); settings tabs localized; property form + policy form localized; nav rail collapses to icons at 375 (both locales). |
| **Widths** | FR and AR verified at 375 / 768 / 1440 (dashboard, properties, settings; screenshots saved under `.playwright-mcp/verify/`, gitignored). |

Console: 0 errors on authenticated pages; the only console errors are the three 401s of the
anonymous first-load `refreshLookups` (properties/vendors/settings) — identical pre-separation
mount behavior, not a regression.

Observed-but-out-of-scope (pre-existing, untouched by b46168a): the dashboard meta line
`Snapshot of septembre 2026` formats the month with `new Date().toLocaleDateString(undefined,…)`
(browser locale) rather than the app locale — `dashboard-page.tsx` is not part of the b46168a diff.

## 4. Defects found and fixes made

**D1 (regression from b46168a, FIXED):** the settings locale picker rendered the raw key
`vendors.option_fr_DZ` for the French option label.

- Cause: b46168a generalized the hard-coded `<SelectItem value="fr-DZ">` entries into a
  derivation `vendors.option_${id.replace(/-/g,"_")}`, which yields `option_fr_DZ` (uppercase)
  for `fr-DZ`. Pre-separation catalogs and the current profile catalogs
  (`en-fragment.json`, `fr.json`, `ar.json`) all declare the key as **lowercase `option_fr_dz`**
  (verified at `aab9081` and HEAD), so the lookup failed and the key rendered raw.
- Fix (smallest correction, one line): lowercase the derived key —
  `vendors.option_${id.replace(/-/g,"_").toLowerCase()}` in
  `src/client/components/settings/settings-page.tsx` (PolicyTab). EN (`option_en`) and AR
  (`option_ar`) were unaffected (no dashes); only the dashed `fr-DZ` id was broken.
- Verified in browser post-fix: options render `["English", "Français (Algérie)", "العربية"]`.
- No other defects found.

## 5. Tests

- `pnpm typecheck` → exit 0.
- `pnpm vitest run --no-file-parallelism` → 16 files, **223/223 passed**, exit 0.
  (The `audit write failed` stderr lines are expected fixture behavior of the app's
  best-effort audit logging in the minimal test env; all assertions pass. The earlier
  "exit 1" observation was a PowerShell pipeline artifact; direct exit code is 0.)
- Browser sweep (above) is the interactive evidence for this phase.

## 6. Reviewer

`orkestrix-reviewer` subagent — **PASS**.

- Fix correctness (key contract lowercase in all catalogs, no `option_fr_DZ` anywhere): PASS.
- Scope leakage (only the label-key derivation line changed): PASS.
- Regression risk (localeOptionKey used only for option labels; typecheck + 223 tests green): PASS.
- Commit hygiene (path-limited staging; never amend `b46168a`/`f1c1a99`; never push): PASS.
- LOW: no automated assertion guards label-key normalization — noted; a focused regression
  test is deferred deliberately to keep this closure to the smallest corrective surface.

## 7. Closure record (post-commit info)

- Commit: <recorded post-commit>
- Parent: `f1c1a99`
- Staged paths (exactly two): `src/client/components/settings/settings-page.tsx`,
  `Docs/execution/governance/core-profile-dependent-effect-verification-2026-09-24.md`
- Unrelated scope touched: none (only the one-line fix + this report).
- Inherited working-tree exceptions preserved and excluded from the commit (ui-finalization
  docs, `tests/audit.test.ts`, `Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5..P8/`, gate
  report, tc/vt scratch).
- Push: NOT DONE (per instruction).