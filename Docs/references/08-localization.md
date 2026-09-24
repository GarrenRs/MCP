# 08 — Localization Assessment & Path

Goal context: produce the localized commercial **ORKESTRIX Property System** (V1: Algerian market,
French UI, DZD) on top of the OpenProperty foundation. This section is an
assessment, not a change plan. `[INFERENCE]` marks interpretation of verified facts.

## Current state (survey) `[VERIFIED unless marked]`

1. **All UI strings are hard-coded English** in JSX (buttons, labels, empty states, dialog copy,
   dashboard headings) and in server code (validation error messages, `{error}` payloads).
2. `index.html` is `lang="en"` and loads **Inter** from Google Fonts (external fetch).
3. **Dates** already have partial locale-awareness: `formatDate` uses
   `toLocaleDateString(undefined, …)` → browser locale. Period labels use `toLocaleDateString`
   with `month: "long"`. `[VERIFIED — lib/utils.ts]`
4. **Money** uses `Intl.NumberFormat(undefined, { style: "currency", currency, … })` → browser
   locale + the app-level `currency` setting (default `USD`). Whole-unit display
   (`maximumFractionDigits: 0`) is a deliberate style choice. `[VERIFIED]`
5. **Data model is culturally specific**:
   - Address fields are US-shaped: `address / city / state / zip` with a free-text **State**
     input. `[VERIFIED]`
   - Currency is a single global setting; there is no per-lease, per-property, or per-tenant
     currency, and no locale/region setting at all. `[VERIFIED]`
   - Rent due **day**, late-fee, grace-days model is generic. `[VERIFIED]`
   - Dates stored as `YYYY-MM-DD` TEXT — locale-neutral storage (good). `[INFERENCE]`
6. **Enum/status labels** are displayed raw or via a small `label` map `[VERIFIED]` — e.g.
   `STATUS_TONE`, `TYPE_LABEL`, `VENDOR_CATEGORIES`, `.capitalize` of stored snake_case.
7. **No i18n library** (no `i18next`, `react-intl`, `lingui`, `@formatjs`), no string
   extraction, no translation files. `[VERIFIED — package.json]`
8. **Server errors** return English strings consumed by the UI and shown verbatim in the
   error banner. `[VERIFIED]`

## What must change for a localized commercial version (ordered)

### Tier 1 — localization plumbing (foundation)
- Introduce an i18n layer (recommend `react-i18next` or `@formatjs/react-intl`; both are small
  additions that pair with React 19). Extract all user-facing strings in `src/client` into a
  single locale catalog (`en.json`), including: nav labels, page titles/meta, dialog labels,
  empty states, confirm-delete copy, badge/status labels, dashboard prose (`"No upcoming
  move-outs"`, `"All caught up"`, etc.).
- Define a **locale + region setting** in `settings` (currently only currency exists). Keep
  `currency` separate from `locale` so e.g. `fr-CA / CAD` works.
- Convert server-side user-facing `{error}` strings to stable error **codes**
  (`INVALID_ID`, `NOT_FOUND`, `VALIDATION_FAILED`, `DUP_CHARGE`) and map to localized text
  client-side. `[RECOMMENDATION — adds complexity to api.ts but is the clean long-term shape]`
- Set `document.documentElement.lang` from the setting; update `index.html`.

### Tier 2 — localized formats
- Make `formatDate`/`formatMoney`/`formatPeriod` accept an explicit `locale` from settings
  instead of `undefined` (today they depend on browser locale, which differs from the product
  locale). `[RECOMMENDATION]`
- Validate the currency setting (drop invalid codes to prevent `Intl` `RangeError` from
  breaking renders). Consider a currency `<select>` instead of free text on the policy tab
  (e.g., USD, EUR, GBP, CAD, AUD, CHF…). `[INFERENCE + RECOMMENDATION]`
- Whole-unit money: decide per-locale decimal handling for rent amounts (some currencies need
  2 decimals; rent usually integer — recommend a per-currency fraction-digit map).

### Tier 3 — local market data shape
- Evaluate the address model for target markets: replace the free-text **State** input with a
  country-aware region select; add a **Country** field (schema change; additive — new nullable
  column is safe given `CREATE TABLE IF NOT EXISTS` + additive migrations). `[RECOMMENDATION]`
- Postcode/`zip` naming is US-specific; keep the column, localize its label.
- Confirm each target market's lease terminology (deposit, late-fee, due-day, grace) and whether
  status flows still fit (e.g., `turnover`).
- Right-to-left (RTL) support: layout uses logical-ish flex/grid but several places hard-code
  `text-left`, `left-3`, `border-l`, arrows. Tailwind v4 logical properties should be used when
  RTL is a target. `[INFERENCE — straight-index items are RTL-safe-ish, positioning classes are not]`

### Tier 4 — fonts & assets
- Inter is fine but font loading is a Google Fonts external dependency (privacy/security + offline
  risk). For a commercial localized product, self-host fonts or accept the external fetch.
  `[INFERENCE]`
- `index.html` `<title>`/`<meta description>` are English — localize per deploy/build or at first
  render.

## Risks if localization is added naively
- String keys change → stale translation gaps if keys are not namespaced per module.
- `capitalize`-ing stored enum values breaks in other languages; move all status/type display
  through the label maps (they already exist in several components — normalize them into one
  catalog).
- Server-generated content (e.g., due-date clamping, period math) is locale-neutral already, so
  the risk is low there. `[INFERENCE]`

## Effort estimate (relative)

| Work item | Effort | Risk |
|---|---|---|
| i18n library + catalog + settings locale/currency | LOW–MEDIUM | LOW |
| Server error-code refactor | MEDIUM | MEDIUM (touches api.ts + all dialogs) |
| Explicit locale in formatters | LOW | LOW |
| Currency validation/select | LOW | LOW |
| Country/region address model | MEDIUM | MEDIUM (schema + forms) |
| RTL layout pass | MEDIUM | MEDIUM |
| Font self-hosting | LOW | LOW |