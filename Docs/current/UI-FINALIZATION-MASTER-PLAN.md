# UI FINALIZATION MASTER PLAN — ORKESTRIX Property System

**Status**: AUTHORITATIVE PLANNING DOCUMENT for the post-P12 UI Finalization phase
(Phase A below). Supersedes `Docs/plans/13` / `13b` / `13c` **as future execution guidance**
(those plans were fully executed as P1–P12 and remain as historical evidence).

This document is a **plan only**. It does not modify application code, the database, or the API.

---

## A. CURRENT BASELINE

- P1–P12 COMPLETE. Functional / operational **V1** is implemented on `main`.
- HEAD = `4b7177d` — "feat: add audit trail" (P12). [VERIFIED — git log]
- Parent chain: `4b7177d` → `79441f2` (P11) → `4a42eaf` (builder-routing fix) → `5d2a394` (P10) → …
- Authoritative phase index: `Docs/V1-PHASE-INDEX.md`.
- Source truth at runtime: `src/server/index.ts`, `src/client/**`, `migrations/**`, `tests/**`.

## B. WHAT IS COMPLETE

**P1–P12 = FUNCTIONAL / OPERATIONAL V1 IMPLEMENTATION** ([VERIFIED — git history, phase logs]):

| Phase | Status |
|---|---|
| P1 Test Foundation / P2 Migration Ledger / P3 i18n-settings-errors / P4 Algerian Localization / P5 Auth & Roles / P6 Charge Administration UI / P7 Work-Order Completion Stamp / P8 Overdue Freshness / P9 Lease↔Unit Occupancy / P10 Applications UI / P11 CSV Export / P12 Audit Trail | **COMPLETE** |

See `Docs/V1-PHASE-INDEX.md` for the per-phase execution-log path and final commit.

## C. UI FINALIZATION OBJECTIVE

Polish the existing V1 user interface to a **presentation-complete, bilingual (French primary /
Arabic added), RTL-correct, responsive, visually consistent** state — **without changing any
business logic, API contract, database, migration, or P1–P12 behavior**.

Outcome: the same functions (Dashboard → Audit) become fully usable and correctly rendered in
`fr-DZ` *and* `ar`, at desktop, laptop, tablet, and narrow widths, with clean browser QA.

## D. UI FINALIZATION SCOPE

Only the following bounded work items. No additional product features.

- **UI-F1 — Arabic**: complete `src/client/i18n/ar.json` (311 missing keys out of 420).
- **UI-F2 — Hard-coded strings**: move remaining literal user-facing strings into i18n keys.
- **UI-F3 — Typography**: Arabic-capable font in the stack + `[dir=rtl]`/`[lang=ar]` tuning.
- **UI-F4 — Responsive**: collapse dialog grids, KPI trio, nav/tabs/header wrap at narrow widths.
- **UI-F5 — RTL**: set `document.documentElement.dir`, logical-property pass, mirrored icons/rail.
- **UI-F6 — Visual consistency + browser QA**: badge/CTA/empty/loading unification, then
  Playwright verification (3 widths × FR/AR).

## E. PER-WORK-ITEM DETAIL

### UI-F1 — Arabic localization

- **Objective**: bring `ar.json` to 420/420 string keys, structurally identical to `en.json` /
  `fr.json`, keeping `fr-DZ` and `en` byte-compatible; fix the single FR leak
  (`fr.json:88 unit_status.vacant` = "Vacant" → French. [VERIFIED — content diff]).
- **Known evidence**: Arabic completeness ≈ **26%** (109/420 leaf keys);
  311 keys missing; zero surplus keys; no token-order mismatches in the 109 existing AR strings.
  Missing groups: `nav.*` (9), `common.*` (63), all status/priority/method/type/category vocabularies,
  `dashboard.*` (24), `properties.*`, `units.*`, `tenants.*`, `leases.*`, `rent.*`, `payments.*`,
  `maintenance.*`, `work_order.*`, `vendors.*`, `app.*`. [VERIFIED — key-tree diff]
- **Files expected**: `src/client/i18n/ar.json` (fill), `src/client/i18n/fr.json` (1 fix).
  `en.json` only if a placeholder key is needed (keep as source of truth).
- **Dependencies**: none (data-only). Order first.
- **Tests**: i18n parity checks (en/fr/ar identical key trees; every value non-empty; token
  order consistent) in the existing test suite pattern; AR smoke on Settings → Audit, Login, Users.
- **Browser verification**: AR selected via Settings → Rent policy → Locale; verify every page
  shows Arabic (no English fallback) at desktop + tablet.
- **Risk / Rollback**: LOW / revert single commit; pure JSON + 1 fix.
- **Acceptance**: any visible string that bypasses `t()`/`tf()` in AR is a defect; `fr-DZ` output
  unchanged except the `vacant` fix.

### UI-F2 — Hard-coded strings → keys

- **Objective**: no unexplained hard-coded user-facing string in any locale.
- **Known evidence** ([VERIFIED — source scan]): `ui/alert-dialog.tsx:123,143` default
  "Delete"/"Cancel"; `ui/dialog.tsx:45` sr-only "Close"; placeholder text
  (`work-order-dialog.tsx:132`, `unit-dialog.tsx:95`, `property-dialog.tsx:115,146`,
  `tenant-dialog.tsx:118`); English color-swatch labels (`settings-page.tsx:209`,
  `property-dialog.tsx:136`); settings header uses `vendors.title` where `settings.title` exists
  (`settings-page.tsx:34`). Intentional non-leaks (wilaya data, currency codes, audit diff keys)
  stay as-is.
- **Files expected**: the components above + `i18n/{en,fr,ar}.json` entries.
- **Dependencies**: UI-F1 (keys exist in all three catalogs).
- **Tests**: string-leak scan (no `>text<`/placeholder not through `t`); parity for new keys.
- **Browser verification**: dialogs in FR and AR show localized defaults.
- **Risk / Rollback**: LOW / revert commit.
- **Acceptance**: default confirm/cancel/close/placeholders/colors/header localized in FR + AR.

### UI-F3 — Arabic typography

- **Objective**: correct, stable Arabic glyph rendering without degrading Latin/French.
- **Known evidence** ([VERIFIED — stylesheet + live DOM]): `--font-sans: "Inter", -apple-system,
  …, "Segoe UI", sans-serif` (`styles.css:193`); `index.html:11` loads only Inter 400–700; Inter
  has **no Arabic glyphs** → Arabic falls back to the OS font (live computed
  `font-family` = Inter chain). No Arabic webfont referenced anywhere in the repo.
- **Minimum change** ([RECOMMENDATION]): add `"Noto Sans Arabic"` to the stack
  (`styles.css:193`) + extend the existing Google-Fonts link in `index.html:11` (400;500;600;700);
  add `[lang=ar]/[dir=rtl]` rules: `letter-spacing: 0` on titles/labels and a looser
  `line-height` for Arabic. No redesign of the token system.
- **Files expected**: `src/client/styles.css`, `index.html`.
- **Dependencies**: none (CSS-only). Safe to run early; must not depend on UI-F5.
- **Tests**: FR/Latin rendering regression via existing tests + visual; Arabic glyph presence in
  rendered DOM (no tofu/`\ufffd`).
- **Browser verification**: Arabic labels render shaped and readable at desktop + mobile widths.
- **Risk / Rollback**: LOW / revert commit (additive font URL + CSS rules).
- **Acceptance**: Arabic text uses Noto Sans Arabic consistently; `fr-DZ`/`en` text unchanged.

### UI-F4 — Responsive behavior

- **Objective**: no unintended horizontal overflow; dialogs/tables/forms usable at
  tablet/narrow widths; sidebar/nav usable.
- **Known evidence** ([VERIFIED — live measurements]): no *document-level* horizontal overflow at
  1536/1024/768/390. Issues: dialog form grids never collapse below ~768 (3-col rows → ~140px
  inputs at 375–414px); Dashboard "this month" trio is fixed `grid-cols-3`
  (`dashboard-page.tsx:114`); Maintenance filter `TabsList` (6 triggers) overflows 375px
  (`maintenance-page.tsx:89-98`); PageShell header actions don't wrap (`page-shell.tsx:31-41`);
  at 390 the SDK rail scrolls horizontally and `<main overflow-hidden>` clips ~57px
  ([INFERENCE] — likely the header/actions min-content).
- **Files expected**: all dialog files (`property/lease/tenant/unit/work-order/application/
  payment/charge-edit/settings`), `dashboard-page.tsx`, `maintenance-page.tsx`, `page-shell.tsx`.
- **Dependencies**: UI-F1 (labels wrap in AR too).
- **Tests**: existing suite must stay green; no layout logic tested by unit tests — rely on QA.
- **Browser verification**: 3 widths (desktop/tablet/mobile) × FR/AR: `scrollWidth <= clientWidth`,
  dialogs fully on-screen, no element clipped.
- **Risk / Rollback**: LOW–MEDIUM / revert; class-only changes, no behavior change.
- **Acceptance**: at 375–414px no page-level horizontal scroll, dialogs fit, all actions reachable.

### UI-F5 — RTL (largest blast radius)

- **Objective**: correct bidirectional layout: document direction, mirrored layouts, logical
  spacing/alignment, semantic icons, readable numbers/dates/tables/dialogs/forms.
- **Known evidence** ([VERIFIED — live DOM]): `document.documentElement.lang` is set
  (`use-app-state.ts:99`) but **`dir` is never set** — with `lang="ar"` the computed direction is
  `ltr` (`dir` absent). Physical LTR classes found across ~30 files: `ml-*/mr-*`,
  `left-*/right-*`, `pl-*/pr-*`, `text-left/text-right`, `space-x-*`, `border-r`, absolute
  position icons in search inputs/selects/dropdowns/dialogs, directional chevrons/back arrows
  (rent stepper, property/tenant back links). SDK rail uses physical `border-right`/`text-align:left`
  (`@clawnify/app` dist) — fix by app-side override in `styles.css` **only**, never in
  `node_modules`.
- **Files expected**: `src/client/hooks/use-app-state.ts` (dir plumbing),
  `src/client/styles.css` (`[dir=rtl]` rules + rail border-inline), the ~30 files with physical
  classes (see Explorer report §4 + §8), `ui/select.tsx`, `ui/dropdown-menu.tsx`, `ui/dialog.tsx`,
  `ui/table.tsx`.
- **Dependencies**: UI-F1 (Arabic strings exist), UI-F3 (Arabic font renders while mirroring).
- **Tests**: existing suites remain green (no logic change); RTL-specific assertions where the
  codebase supports them.
- **Browser verification**: `lang="ar"` + `dir="rtl"`; sidebar on the right; tables mirror;
  numbers/dates unmangled (formatMoney/formatPeriod use the active locale); icons semantically
  correct.
- **Risk / Rollback**: MEDIUM (wide touch surface) / revert or targeted revert; class-only.
- **Acceptance**: `[dir=rtl]` present for AR, `[dir=ltr]` for EN/FR; no inverted-layout defect in
  any page; `fr-DZ` baseline layout unchanged.

### UI-F6 — Visual consistency + browser QA

- **Objective**: unify badge/CTA/empty/loading patterns; close the audit header text shape; then
  full browser QA.
- **Known evidence** ([VERIFIED — code scan]): three badge mechanisms (token tint spans vs
  `Badge` variants vs raw palette for user roles); payment-dialog CTA uses `payments.title`
  instead of `common.save`; settings page header uses `vendors.title`; `audit-tab.tsx:66-67`
  renders `audit.empty` as the permanent card description even when entries exist; dynamic
  swatches `bg-${c}-500` are invisible to Tailwind v4 JIT (unstyled swatch); detail pages
  hand-roll a back-button header duplicating PageShell; empty/loading states differ per page.
- **Files expected**: `ui/badge.tsx` or the tinted-span components, `payment-dialog.tsx`,
  `settings-page.tsx`, `audit-tab.tsx`, `page-shell.tsx`, role badges in `users-tab.tsx`.
- **Dependencies**: UI-F1 … UI-F5 (QA is last).
- **Tests**: full `pnpm test` + `pnpm typecheck` at the end; no logic regression.
- **Browser verification**: Playwright at desktop/tablet/mobile × FR/AR — Login, Users, Audit and
  all P1–P12 routes; console-error budget; no clipped dialogs; no untranslated visible strings;
  no RTL inversion.
- **Risk / Rollback**: LOW / revert.
- **Acceptance**: one badge system, consistent CTA labels, correct audit empty text, swatches
  styled, browser QA green.

## F. EXPLICIT NON-GOALS (OUT OF SCOPE FOR UI FINALIZATION)

- No API changes; no new endpoints; no HTTP contract change.
- No database changes; no migrations; no schema change.
- No business-logic changes; no P1–P12 behavior change (only presentation).
- No P13+ product features (no multi-tenancy, no integrations, no portals…).
- No Commercial/Deployment Closure work (see section G — planning boundary only).
- No packaging, installer, desktop shell, LAN topology, update channels.
- No changes inside `node_modules` (`@clawnify/app` adaptations only via app-side CSS).
- No framework/architecture migration; desktop/laptop remains the primary context; narrow-width
  support is *graceful*, not a mobile-first redesign.

## G. POST-UI COMMERCIAL / DEPLOYMENT CLOSURE — PLANNING BOUNDARY ONLY

Phase B is **NOT implemented** and NOT scheduled inside this plan. It is only the governance
boundary for future work. When it opens, its scope will be:
Local Web-Application runtime; desktop-shell packaging; local server; LAN topology;
multi-device access; user/session/role model in deployment; local data ownership;
backup/restore; upgrade/versioning strategy; secure on-demand update channel;
installation/setup; recovery/support model; release packaging; clean-machine QA;
final release candidate. **None of these are started by UI Finalization.**

## H. DEFINITION OF DONE — UI FINALIZATION

- `ar.json` complete (420/420), FR parity kept, no unexplained hard-coded strings.
- Document direction set (`dir=rtl` for AR); no RTL inversion; Arabic renders with Noto Sans Arabic.
- No page-level horizontal overflow at 375–1440px; dialogs/forms/tables usable at narrow widths.
- `fr-DZ` and `en` output and behavior unchanged (except the documented `vacant` fix).
- One badge/CTA/empty/loading convention; swatch bug fixed; audit header text correct.
- Playwright browser QA passes (3 widths × FR/AR) for Login, Users, Audit, and all P1–P12 routes.
- `pnpm typecheck` exits 0; full `pnpm test` green.
- Reviewer verdict = PASS.
- Execution log at `Docs/execution/ui-finalization/ui-finalization.md` exists and is committed.
- Exactly **one** UI-finalization commit; P12 (`4b7177d`) untouched; no amend of prior phases.

## I. DEFINITION OF DONE — COMMERCIAL / DEPLOYMENT CLOSURE

(Planning-boundary criteria recorded now so the boundary is explicit; not acted on in Phase A.)
- Local runtime + desktop packaging build on a clean machine; no cloud dependency for operation.
- LAN multi-device access verified with the deployment user/session/role model.
- Local data ownership with working backup/restore and documented recovery path.
- Versioned upgrade and secure on-demand update channel exercised end-to-end.
- Installer/setup, uninstall, and support model validated on a clean machine.
- Release candidate tagged only after the UI Finalization DoD above is fully met.

## J. EVIDENCE DISCIPLINE

Every claim in this plan is tagged: **[VERIFIED]** (observed in source, running app, live DOM,
or git), **[INFERENCE]** (reasonable conclusion not directly exercised), **[RECOMMENDATION]**
(advisory), **[UNKNOWN]** (explicitly not confirmed). An inference is never presented as a fact.
Baseline for the UI audit: working tree @ `4b7177d` (2026-09-23).

— End of authoritative planning document. Review Gate applies before any Builder invocation.