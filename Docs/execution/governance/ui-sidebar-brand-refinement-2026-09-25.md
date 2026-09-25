# UI Refinement — Sidebar Branding & Product Navigation (2026-09-25)

**Contract:** Refine the standalone sidebar into a professional ORKESTRIX product navigation: the repo-root logo as the primary brand mark with **Property System** as a quiet secondary descriptor, consistent nav groups and a single restraint active state, a refined account footer (identity → localized logout), correct RTL/LTR, and intact responsive behaviour at 375 / 768 / 1440. Verified live in AR (375 / 768 / 1440) and FR (1440) across every route.
**Scope:** UI presentation only (sidebar brand row, nav row/group/active styling, account footer, rail collapse, i18n descriptor key). No database, schema, migration, API contract, business logic, Core/Profile, dataset, seed, stored value, auth-logic or routing change. No route renames. The logo asset is used as-is (no generation, recolor, crop or distortion; rendered at its natural 2:1).
**Environment:** Windows 10, pnpm dev stack (`wrangler` on `127.0.0.1:8787` + `vite` on `localhost:5173`), Playwright DOM/computed-style instrumentation against the running app. Evidence is DOM/computed measurement; screenshots for this pass were captured to `.playwright-mcp/sidebar-{ar-1440,ar-375,fr-1440}.png` (this model cannot render images, so all assertions below rest on the measured geometry).

---

## 1. Investigation — the platform rail and what it cannot express

The app's sidebar is `<AppNav>` from the compiled bundle `@clawnify/app` v0.2.1. It renders the rail with an injected `<style>` inside `aside.cn-nav`:

```
aside.cn-nav ─ 16.25rem column, border-inline-end
├─ a.cn-nav-brand     56px row — house glyph + title text (app.brand = "ORKESTRIX Property System")
├─ nav.cn-nav-groups  eyebrow labels + 28px tile-item rows (TileIcon + label + count)
└─ div.cn-nav-footer  app-supplied children (email + hover-underline link)
```

The app already restrained it with an `aside.cn-nav …` override block (muted surface `#f7f7f5`, 275px, 28px rows, ink-wash active `rgba(0,0,0,.04)`, logical paddings, 56px brand row whose bottom rule forms one continuous line with the page toolbar — DESIGN.md → Layout, "The shell").

The task's branding requirements cannot be delivered through that compiled component **without editing `node_modules`** (not committable):

1. **Logo as primary mark** — AppNav's brand row is hard-wired to `icon glyph + title text`; it cannot render the `logo.png` lockup, and injecting the logo as `title` children is not possible (the package builds the row).
2. **"Property System" as secondary descriptor** — the full string lives in `app.brand` as one text node; the compiled row has no concept of a separate descriptor.
3. **True RTL** — the package's CSS uses physical `text-align:left` / `border-right` / LTR paddings; the app's override fixes paint, but the DOM/CSS contract can't be extended to a direction-agnostic brand row + account card.

**Decision (commit-able):** the standalone path gets a local, source-controlled `Sidebar` component (`src/client/components/ui/sidebar.tsx`) that reuses the platform's own exports (`TileIcon`, `AppNavItem` types, `embedded`, `reportLocation`) so the two shells never drift. `<AppNav>` remains the render for the **embedded** host case — where it renders `null` and only bridges nav/location messages, i.e. **100% of embedded behaviour is preserved unchanged**. Standalone = local `Sidebar`; embedded = package `AppNav`. The IA (PORTFOLIO / OPERATIONS / ADMIN groups, dashboard-as-home hidden) is untouched.

## 2. Brand row

```
[ORKESTRIX logo lockup 80×40, 2:1, undistorted]  Property System
```

- **Primary mark:** `logo.png` (1774×887, transparent lockup) imported from the repo root and rendered at 80×40 (exact 2:1, natural aspect), `alt="ORKESTRIX"`. No copy, crop, recolor, second wordmark or duplicate ORKESTRIX text anywhere.
- **Descriptor:** `app.descriptor` → "Property System" (13px/500, `--muted-foreground`) — one rung below nav items (14px/500 foreground), wrapped in the existing `<Bidi dir="ltr">` isolation so it never reorders inside the Arabic page.
- **56px row preserved** (the rule the page-shell comment depends on): the brand row keeps `height:3.5rem` and `border-bottom`, so the brand-bottom and toolbar-bottom borders stay one continuous line across the shell (verified: both rule lines at y=56).
- The row is still the home link (`href="/dashboard"`, `data-active` + `aria-current="page"` on the dashboard route), exactly as the platform rail's brand row was.

## 3. Navigation groups / active state (unchanged IA)

- Same group contract as AppNav: PORTFOLIO (no label), OPERATIONS, ADMIN — eyebrows only for labelled groups (`العمليات / الإدارة`, `Opérations / Administration`), 13px/500 muted, quieter than items.
- Rows reuse `TileIcon` (identical coloured type tiles), 28px tall, `padding-inline: .5rem 1rem`, radius 9px, 14px/500 with `-0.01em` tracking; count badges keep `--muted-foreground`.
- **One active state everywhere:** `data-active` → neutral ink wash `rgba(0,0,0,.04)` + foreground, font-weight unchanged 500 (no bold shift), no width/icon movement; focus ring = `--ring`. Confirmations by probe on all 8 routes × both directions: `activeBg rgba(0,0,0,0.04)`, `fontWeight 500`, row x/y untouched.

## 4. Account footer

```
┌─────────────────────────┐
│ Yacine Haddad           │  ← display_name (or email fallback)
│ obs.admin@example.com   │  ← Bidi dir="ltr" (isolated LTR inside RTL)
│  ⎋ Se déconnecter       │  ← real logout action (localized)
└─────────────────────────┘
```

- **Hierarchy: identity → logout.** Name (14px/500), email (12px muted, `<bdi dir="ltr">` — the established bidi strategy, same as tables), then an explicit logout *button* with `SignOut` glyph (phosphor, 14px, consistent with TileIcon icons).
- **Intentional but secondary:** full-width restrained row, muted until hover → `--destructive` text on the quiet wash. Sits under `border-top` in the footer, visually separate from navigation.
- **No technical identifiers** (no ids/roles/ids), and **auth logic untouched**: same `handleLogout` handler and `auth.logout` key (`Sign out` / `تسجيل الخروج` / `Se déconnecter`).
- Footer drops away in the collapsed rail (as before).

## 5. RTL / LTR

- Whole implementation uses logical properties (`padding-inline`, `border-inline-end`, `margin-inline-start:auto` for counts, `text-align:start`) — no hard-coded left/right. Direction comes from `document.documentElement.dir` (RTL for AR via `rtlLocales`).
- Verified mirroring: AR 1440 the rail anchors **right** (`aside x=1165`, `1165+275=1440`); FR 1440 anchors **left** (`x=0`). Inside the brand row, AR places the descriptor then the logo reading right-to-left (desc `x=1230` → logo `x=1344`), FR the natural LTR order (logo `x=16` → desc `x=106`).
- Icons are not mirrored (TileIcon tiles are not directional-by-meaning, matching the prior governance); the `SignOut` glyph points in the "away from the page" direction in both scripts, as logged-out direction conventions require.
- **Logo/descriptor are naturally LTR tokens** — the asset itself and the Latin descriptor with `<Bidi dir="ltr">`; email isolated LTR. Arabic labels stay RTL inside RTL rows.

## 6. Responsive — 375 / 768 / 1440

- **≥768:** 275px column, brand row + full nav + footer (verified at 768 and 1440).
- **<768:** the rail collapses into the established horizontal strip (same as the SDK's narrow mode): `flex-direction:row`, brand row becomes a **compact logo link** (56×28, ratio 2.0 intact, descriptor hidden), groups scroll **inside their own wrapper** (`groups.scrollWidth 874 > clientWidth 295` at 375 — in-rail scroll, never page-level), footer hidden. **No page-level horizontal overflow** on any route (`scrollWidth === clientWidth`).
- `vite-env.d.ts` declares `*.png` so the root logo import typechecks (`tsc` EXIT=0); Vite bundles/hashes the asset (dev-served as `/logo.png`).

## 7. Verification (live Commercial Observation Dataset)

### AR — 375 / 768 / 1440, all 8 routes (dashboard, properties, tenants, leases, applications, rent, maintenance, settings)

| Viewport | Rail | Brand row | Logo | Descriptor | Confirmations |
|---|---|---|---|---|---|
| 375 (800h) | strip 375×60, `flex-direction:row` | compact link 80×56, `data-active` on dashboard | 56×28 ratio 2.0 | hidden (`display:none`) | 7 items, 28px rows, in-rail scroll 874→295, active wash + weight 500 per route, footer hidden, **no page overflow** |
| 768 (900h) | column 275, right-anchored `x=493` | 56px row, border-bottom at y=56 | 80×40 ratio 2.0 | visible `Property System` | groups start y=56 (continuous line with toolbar), rows uniform 28px (y=64,92,120,148…), footer y=796–900, **no page overflow** |
| 1440 (900h) | column 275, right-anchored `x=1165` | 56px row | 80×40 ratio 2.0 | desc x=1230 → logo x=1344 (RTL order) | same as 768; active label matches each route (`العقارات`, `المستأجرون`, … `الإعدادات`), `rgba(0,0,0,.04)` + 500 |

### FR — 1440, all 8 routes (route interception sets `locale=fr-DZ` in `/api/settings`; no DB write)

| Confirmations |
|---|
| rail left-anchored `x=0`, `dir=ltr`; logo 80×40 ratio 2.0; descriptor `Property System` in natural order (logo x=16→desc x=106); eyebrows `Opérations / Administration`; active per route (`Biens`, `Locataires`, … `Paramètres`); logout button `Se déconnecter`; footer with `Yacine Haddad` + `obs.admin@example.com`; **no page overflow** |

All measurements above are pragmatic probes on the live page (getBoundingClientRect + getComputedStyle). Screenshot captures for this pass exist at `.playwright-mcp/sidebar-ar-1440.png`, `sidebar-ar-375.png`, `sidebar-fr-1440.png` (not part of the commit; `.playwright-mcp` is ignored).

**Observation (benign, pre-existing):** the very first `/api/settings` fetch after a cold `workerd` start can fail and the app briefly falls back to the profile default locale (`fr-DZ`) before the fetch succeeds and re-renders AR. It is unrelated to this change (the API itself is untouched and returns `ar`; D1 confirmed `locale=ar`). One first-load probe caught it mid-settle; every subsequent measurement was fully settled.

### Regression gates

| Gate | Result |
|---|---|
| `pnpm typecheck` (`tsc --noEmit`) | EXIT=0 |
| `pnpm vitest run --no-file-parallelism` | 16 files / 223 tests PASS |
| i18n keys | `app.descriptor` added to en-fragment / ar / fr following the `app.brand` pattern; `auth.logout` already present in all three |
| Databases / dataset | untouched (AR = D1 `ar`; FR via client-side response rewrite only; no write calls in this pass) |

## 8. Files changed

| File | Change |
|---|---|
| `src/client/components/ui/sidebar.tsx` | **new** — standalone sidebar: brand row (logo + descriptor), nav groups (TileIcon rows, eyebrows, ink-wash active), account footer slot |
| `src/client/vite-env.d.ts` | **new** — narrow `*.png` module declaration for the root logo import |
| `src/client/app.tsx` | standalone → `<Sidebar>`, embedded → `<AppNav>` (unchanged, renders null + bridge); refined footer card (user identity + localized logout) |
| `src/client/styles.css` | dead `aside.cn-nav…` override block replaced by the `.app-sidebar…` spec (same design language, logical properties, 56px brand, footer, rail collapse) |
| `src/profile/algeria/en-fragment.json` | + `app.descriptor` ("Property System") |
| `src/profile/algeria/ar.json` | + `app.descriptor` |
| `src/profile/algeria/fr.json` | + `app.descriptor` |
| `logo.png` (repo root) | staged untracked asset — used as-is by the sidebar |

`node_modules` untouched; the SDK remains the source of `TileIcon`/types/`embedded`/bridge.

## 9. Commit

Single focused commit (no amend, no push), staging exactly the files above plus this report. Reviewer gate runs after the commit; verdict delivered in the session response.