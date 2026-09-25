# UI Correction — Bidi/Numeric Direction in Mixed Arabic + LTR Values (2026-09-25)

**Contract:** Focused UI presentation correction against the live commercial observation dataset (local D1, `locale=ar`, `currency=DZD`).
**Scope:** UI direction/bidi isolation only. No database, schema, migration, business logic, API contract, Core/Profile architecture, dataset, deployment, auth, seed, or tooling change. The loaded dataset was **not** reset or re-loaded; D1 state is unchanged (`locale=ar`, `currency=DZD`).
**Environment:** Windows 10, Pnpm dev stack (`wrangler` on `127.0.0.1:8787` + `vite` on `localhost:5173`), browser instrumentation via Playwright against the running app.
**Evidence:** screenshots under `.playwright-mcp/obs-bidi/` (MCP scratch, kept out of the commit); all visual-order data below is pixel geometry read from the live page via per-character range-rect probes.

---

## 1. Root cause

In an RTL base paragraph (`dir="rtl"`), a text run whose **first strong character is absent / late** inherits the paragraph direction and reorders. The defective values are "weak-leading" strings:

- **Phones** stored as `+213 555 10 20 09` — start with `+` and digits (weak characters, no direction) → the whole run mirrors: `09 20 10 555 213+`.
- **Emails** (`obs.amine@example.com`) start with a strong LTR letter and render fine **on their own**, but when **joined** into one text node with other tokens (`+213 … · obs.atelier@example.com`) the run reorders as a unit through the weak phone, and the `·` separator is torn away.
- **Names/addresses starting with digits** (`308 Mission Apartments`, `308 Mission St, Austin, TX`, `23 Rue Sansonnet, …`) — the digits are weak-leading, so the whole token re-slots to the right of the Arabic context and the number is visually displaced (`Mission Apartments 308`).
- **Joined work-order meta** (`Appartement 1 · 25 سبتمبر 2026`) — mixed strong-LTR unit label + strong-RTL date in one text node collide and scramble across the run.

Money and dates were verified **already correct** (see §4): `formatMoney` emits RLM-wrapped Intl strings (`‏33,000 د.ج.‏` renders digits-right/currency-left), and standalone Arabic dates keep their standard RTL form. No change was made to either.

## 2. Design — shared `Bidi` isolation primitive

New reusable primitive `src/client/components/ui/bidi.tsx` renders a `<bdi>` (bidirectional isolate, computed `unicode-bidi: isolate`):

- **`<Bidi dir="ltr">`** for data that is intrinsically LTR but weak-leading — phone numbers and emails. Forcing `ltr` keeps `+` attached to the digits (`+213 555 10 20 09`) in any surrounding direction.
- **`<Bidi>`** (no `dir` → auto) for **free-form** content — property names, street-level addresses, work-order part labels. The first strong character decides: Arabic content stays RTL, digit-prefixed Latin content self-resolves to LTR — without ever flattening Arabic text.

Empirically confirmed before implementation (injected `<bdi>` nodes, live page):

| Content | `dir` attr | Visual order |
|---|---|---|
| `+213 555 10 20 09` | `ltr` | `+213 555 10 20 09` ✅ |
| `obs.amine@example.com` | `ltr` | `obs.amine@example.com` ✅ |
| `308 Mission St, Austin, TX` | auto | `308 Mission St, Austin, TX` ✅ (number first) |
| `308 Mission Apartments` | auto | `308 Mission Apartments` ✅ |
| `15 أكتوبر 2026` | auto | `2026 أكتوبر 15` (standard RTL date) ✅ no regression |
| `512-555-0102` (no strong char) | auto | auto falls back LTR ✅ |

Joined `phone · email` and `unit · vendor · date` lines are no longer one text node: each token is rendered as its own isolate with the `·` separator as a neutral between tokens (mirrors in RTL; order reverts in FR). Dialog inputs get `dir`: `ltr` on phone/email fields (the value is intrinsically LTR-ordered), `auto` on property name/address fields (content-driven). Inputs carry no data change — only reading direction.

## 3. Defects — before → after (measured)

| Site | Before (AR, visual order) | After (AR, visual order) |
|---|---|---|
| Tenants table phone cell | `09 20 10 555 213+` | `+213 555 10 20 09` (375/768/1440) |
| Applications table phone cell | `09 20 10 555 213+` | `+213 555 30 40 01` ✅ |
| Tenant detail header contact | email/phone runs interleaved | `obs.amine@example.com` · `+213 555 10 20 01` clean |
| Settings vendors meta | `·  06 30 21 555 213+` + email pushed to 2nd line | `obs.atelier@example.com · +213 555 21 30 06` one line, tokens intact (RTL mirror) |
| Property name (list + detail) | `Mission Apartments 308` | `308 Mission Apartments` |
| Property address (list + detail) | `Mission St, Austin, TX 308`; `Rue Sansonnet, … 23` | `308 Mission St, Austin, TX`; `23 Rue Sansonnet, …` |
| Work-order meta (property detail) | `2026 سبتمبر Appartement 1 · 25` scrambled | `Appartement 1 · 25 سبتمبر 2026` (reads RTL: unit · vendor · date), date intact |
| Dialog inputs (tenant/app/vendor) | `dir` absent → inherited `rtl`; phone mirrored inside field | `dir="ltr"` → `computed direction: ltr`, value `+213 555 …` in order |
| Property dialog name/address inputs | `dir` absent → `rtl` | `dir="auto"` → content-driven reading order |

FR 1440 regression (rendered without touching the database, `page.route` rewrites `locale=fr` in the `/api/settings` response body): `dir="ltr"`, phone + `+`, vendor meta reads `+213 555 21 30 06 · obs.atelier@example.com` in FR logical order, property names/addresses unmodified — all unchanged from before the fix.

## 4. Verified-correct categories — **left untouched**

- **Money** (`formatMoney`): RLM-wrapped Intl output already bidi-correct in AR; no change.
- **Dates**: standalone Arabic dates render in standard RTL form; no change.
- **KPIs / percentages / portfolio numbers**, **rent & leases tables**, **maintenance cards**, **dashboard financials**: measured clean before; unchanged after (only benign word-wraps at 375, no reordering).

## 5. Files changed

| File | Change |
|---|---|
| `src/client/components/ui/bidi.tsx` | **new** shared `<bdi>` isolation primitive (`Bidi`; `dir="ltr"` for weak-leading LTR tokens, auto otherwise) |
| `src/client/components/tenants/tenants-list.tsx` | phone + email cells wrapped in `<Bidi dir="ltr">` |
| `src/client/components/applications/applications-page.tsx` | phone + email cells wrapped in `<Bidi dir="ltr">` |
| `src/client/components/tenants/tenant-page.tsx` | header contact email + phone wrapped in `<Bidi dir="ltr">` |
| `src/client/components/settings/settings-page.tsx` | VendorsTab meta split into isolated tokens (`phone`/`email` + neutral `·`); VendorDialog `#v-phone`/`#v-email` get `dir="ltr"` |
| `src/client/components/tenants/tenant-dialog.tsx` | `#t-phone`/`#t-email` inputs `dir="ltr"` |
| `src/client/components/applications/application-dialog.tsx` | `#app-phone`/`#app-email` inputs `dir="ltr"` |
| `src/client/components/properties/properties-list.tsx` | name + address line wrapped in auto `Bidi` |
| `src/client/components/properties/property-page.tsx` | name + address line in auto `Bidi`; work-order meta split into isolated tokens |
| `src/client/components/properties/property-dialog.tsx` | `#prop-name`/`#prop-addr` inputs `dir="auto"` |
| `Docs/execution/governance/ui-bidi-numeric-direction-correction-2026-09-25.md` | this report |

No other source file, style sheet, profile, or API file touched. No global `direction` flip; no ASCII→Arabic-Indic conversion anywhere.

## 6. Verification

| Gate | Result |
|---|---|
| `pnpm typecheck` (`tsc --noEmit`) | PASS |
| `pnpm vitest run --no-file-parallelism` | **16 files / 223 tests PASS** (pre-existing `audit write failed: no such table` stderr lines are the inherited in-memory-DB test behaviour; the audit suite itself passes) |
| Playwright AR 375/768/1440 — `/tenants`, `/applications`, `/tenants/:id`, `/settings`, `/properties`, `/properties/9`, tenant/vendor/application dialogs | PASS — phones read `+213 …` in order with `+` attached, all six dialog inputs compute `direction: ltr`, property names/addresses keep digit prefixes in place, WO meta reads unit · vendor · date, dates/money unregressed |
| Playwright FR 1440 (`locale=fr` via route interception) | PASS — phones, emails, vendor meta in FR logical order; layout unmodified |
| Database | untouched (no PUT from this work; FR via route interception only; no audit rows created) |

## 7. Measurement footnotes

- **Visual-order probe.** Per-character `Range.getBoundingClientRect()` sorted by rounded `top` then `left`, grouped into lines; "visual order" is the left→right glyph sequence of that line, so RTL lines legitimately appear reversed in the raw probe (e.g. the date `25 سبتمبر 2026` shows as `2026 … 25`). Verdicts were taken in both reading directions.
- **Tenant detail navigation.** Direct full-page navigation to `/tenants/1` raced intermittently (ERR_ABORTED / bounce to `/tenants`) during dialog automation; the app's own client-side row navigation + `button:has(.lucide-pencil)` targeting was used instead. No app error, no console errors — a transient dev-server navigation race only.
- **Screenshots** (`dialog-tenant-edit-after.png`, `dialog-vendor-edit-after.png`) are stored under `.playwright-mcp/obs-bidi/` (MCP scratch, gitignored, excluded from the commit).