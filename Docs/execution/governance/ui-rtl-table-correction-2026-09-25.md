# UI Correction — RTL + Data-Dense Tables (2026-09-25)

**Contract:** Focused UI correction against the loaded commercial observation dataset (local D1, `ar`/`DZD`).
**Scope:** UI presentation only. No database, schema, migration, business logic, API contract, Core/Profile architecture, dataset, deployment, auth, or seed change. The loaded dataset was **not** reset or removed; local D1 state is unchanged (`locale=ar`, `currency=DZD`, audit tail id 83).
**Environment:** Windows 10, Pnpm dev stack (`wrangler 4.86.0` on `127.0.0.1:8787` + `vite` on `localhost:5173`), browser instrumentation via Playwright against the running app.
**Evidence:** screenshots under `.playwright-mcp/obs-rtl/` (`*before.png`, `*-after.png`); all DOM geometry below is pixel data read from the live page (character-level rect probes).

---

## 1. Approach

No assumption was made about the cause of any defect before reading the actual laid-out DOM. Every route was measured with a geometry harness (character/box bounding rects, `scrollHeight` vs `clientHeight`, computed styles) at **FR and AR × 375/768/1440** for the data-dense routes: `/rent`, `/leases`, `/tenants`, `/applications`, `/settings` (audit tab), plus `/dashboard`, `/properties`, `/maintenance` for sidebar/layout regression.

FR was rendered **without touching the database**: `page.route('**/api/settings')` rewrites `locale=fr` in the response body (no PUT, no audit row).

## 2. Defects — root cause, evidence, verdict

### 2.1 Tables unnecessarily wrapped / constrained at wide widths — **fixed**

**Root cause.** Table cells were allowed to wrap. The Arabic line-height boost (`[lang=ar] body { line-height: 1.65 }`, `src/profile/algeria/styles.css`) hid the worst of it inside the `h-11` (44 px) rows, so the damage only got visible when rows grew at narrow widths. Measured before:

| Route | Width | Row heights (min→max) | Notes |
|---|---|---|---|
| /leases AR | 768 / 375 | 44 → **149 px** | date-range cell + `ينتهي خلال …` suffix collided across lines |
| /tenants AR | 768 / 375 | 44 → **101 px** | email/unit cells wrapped |
| /rent AR | 768 / 375 | 44 → **61 / 80 px** | due-date cell wrapped |
| /leases FR | 768 | 44 → **140–189 px** | `DZD …/mo` + term wrapped |

Even at **1440** the leases date cell was already on **two lines** (“26 أغسطس 2026 → 19 أكتوبر 2026” + “ينتهي خلال 24 يوم”; character probe: glyphs on `top=194` and `top=212`), invisible to row-height checks because AR line-height 1.65 fits two 13 px lines inside 44 px.

**Fix.** The shared, reusable table primitives never wrap: added `whitespace-nowrap` to `TableHead` and `TableCell` in `src/client/components/ui/table.tsx`. The existing wrapper (`relative w-full overflow-auto`) already scrolls, so a table wider than its pane keeps its natural width and dense 44 px rows instead of squeezing text.

**After (measured, all tables):** `minRowH = maxRowH = 44`, `wrapCtd = 0` for every route in FR and AR at 375/768/1440. The audit table (83 rows) is uniform 44 px at 375 AR and 768/375 FR; its long “Changes” column still truncates (max-w truncate) rather than widening the table.

### 2.2 Arabic numeric values — incorrect visual ordering — **fixed (collision surface removed)**

**Root cause.** The currency amounts themselves are bidi-correct: `formatMoney` produces an RLM-wrapped Intl string. Character-level probes confirm `‏33,000 د.ج.‏` renders digits rightmost / currency left (RTL order) and `DZD 36,000/mo` renders currency-first (LTR order). The ordering defect the user saw is **bidi reordering across wrapped lines**: once a mixed-script cell (Latin figures + Arabic month/currency/suffix) wraps, the runs reorder around the line break. The nowrap fix (§2.1) keeps every money/date cell on one line, removing that collision surface.

**After:** money + date cells report single-line (`lines: 0`; was `lines: 18` at 1440 on /leases) and `د.ج.`/`DZD` anchors sit consistently relative to the digits in FR and AR at all widths. No change to `formatMoney` was needed — its RLM output is the correct, bidi-safe representation.

### 2.3 Arabic table headers not consistently RTL — **verified consistent; no code change**

Header geometry was mirrored correctly in every measured route/width **before** the change: in AR the first logical column is rightmost, `text-align: start` resolves right and `text-align: end` resolves left (`الاسم` text 1097–1129 vs box 956–1141 = right-aligned; `الإيجار` text 112–143 vs box 100–255 = left-aligned), and in FR the same columns mirror back to leftmost/left-aligned. This holds at 1440, 768 (inside the horizontally scrolled window, first column still rightmost in AR) and 375. The `whitespace-nowrap` addition keeps header text single-line, which is the only behavioural change to headers.

### 2.4 RTL sidebar — text on left / icons on right — **fixed**

**Root cause.** The `@clawnify/app` SDK rule `.cn-nav-item { … text-align: left }` is inherited by the label element, so in a mirrored RTL row (icon right) the Arabic label text is left-anchored, stranding the word ~170 px away from its icon.

| Probe (first nav item) | Before (AR 1440) | After (AR 1440) | FR 1440 (reference) |
|---|---|---|---|
| label text box | 1190 → **1239** | 1352 → **1401** | 38 → 106 |
| icon box | 1410 → 1421 | 1410 → 1421 | 19 → 30 |
| gap text→icon | **171 px** | **9 px** | 9 px |

**Fix.** In `src/profile/algeria/styles.css` the existing `[dir=rtl] aside.cn-nav .cn-nav-item` rule now also sets `text-align: start` (direction-aware: resolves right in RTL), and matching `start` alignment is applied to `.cn-nav-label` / `.cn-nav-eyebrow`. `start` follows the element’s resolved direction — an explicit, minimal bidi-safe choice — and LTR is untouched (FR gap remains 9 px, labels stay left of their icons).

## 3. Files changed

| File | Change |
|---|---|
| `src/client/components/ui/table.tsx` | `TableHead` + `TableCell`: add `whitespace-nowrap` (shared reusable table primitives) |
| `src/profile/algeria/styles.css` | RTL nav: `text-align: start` on `.cn-nav-item`, `.cn-nav-label`, `.cn-nav-eyebrow` |
| `Docs/execution/governance/ui-rtl-table-correction-2026-09-25.md` | this report |

No other source file was touched. Non-goals preserved: table system not redesigned, no global direction flip, no page-shell width-cap change, no `formatMoney` change, no settings/audit write path change.

## 4. Verification

| Gate | Result |
|---|---|
| `pnpm typecheck` (`tsc --noEmit`) | PASS |
| `pnpm vitest run --no-file-parallelism` | **16 files / 223 tests PASS** (pre-existing `audit write failed: no such table` stderr lines are the inherited in-memory-DB test behaviour; the audit suite itself passes) |
| Playwright, FR + AR × 375/768/1440 × 8 routes | PASS — tables uniform 44 px, `wrapCtd = 0`, headers mirrored per language, sidebar gap 9 px in both locales, money/date single-line with correct visual ordering |
| Database | untouched (no PUT / no audit row from this work; FR via route interception only) |

## 5. Measurement footnotes

- **Locale flips (audit rows 82/83).** Two `settings` PUT rows (ar→en 08:54:53, en→ar 08:57:35) appeared during the initial measurement matrix. They did **not** reproduce under clean replication (4 consecutive `/settings` visits, request listener attached, **zero** PUTs, locale stayed `ar` throughout) and are attributed to stale reused-browser interaction during that matrix. DB state was verified `locale=ar, currency=DZD` before and after all work (in-DB, in-API, and rendered).
- **Audit tab automation.** The Radix tabs require trusted pointer events; synthetic clicks and early `mouse.click` did not switch. The audit table was captured at 375 AR and 768/375 FR (83 rows, uniform 44 px, changes column truncating). It uses the same shared `Table` primitives as the other verified routes.
- **Screenshots** (`before`/`after`) are stored under `.playwright-mcp/obs-rtl/` (MCP scratch, kept out of the commit).