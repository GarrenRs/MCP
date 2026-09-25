# UI — Sidebar Final Visual Refinement (Centered Brand Block + Account Card)

**Date:** 2026-09-25
**Scope:** `src/client/styles.css`, `src/client/app.tsx` — presentation-only refinement of the standalone sidebar. No DB, schema, migration, API, auth, role, dataset, routing, table/form/icon-governance or BiDi-primitive changes.
**Base:** `8e67af9` (previous sidebar commit) → this commit.
**Locale ground truth:** Commercial Observation Dataset loaded in local D1; profile `locale=ar`. Deterministic locale control during verification: AR = no interception; FR = `page.route('**/api/settings*' → fr-DZ)` fulfilled client-side (no DB writes).

---

## 1. Before state

As of `8e67af9` the sidebar had:

- **Brand:** a 56px horizontal row — logo lockup 80×40 aligned to the inline-start edge, with "Property System" descriptor *beside* it. The row's bottom rule deliberately aligned with the 56px page toolbar (the "continuous line" shell rule).
- **Account:** a loose stacked text block at the bottom — name over email, then a separate logout row. No visual container.

Reviewer feedback and the product brief asked for a stronger product identity: a *centered* brand block (logo dominant, descriptor beneath) and a *contained professional account card*. The centered-brand requirement moves the brand zone off the 56px toolbar line (see §10, deliberate consequence).

## 2. Brand hierarchy changes

The sidebar now reads as three deliberate zones:

    BRAND          centered ORKESTRIX logo + "Property System" descriptor beneath
    NAVIGATION     3 groups / 7 rows, unchanged IA and row geometry
    ACCOUNT        compact card: avatar + identity + logout

### Brand block (desktop ≥768)

- `.app-sidebar-brand` becomes a **centered flex column**: `flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem`, `padding: 1.375rem 1.25rem 1.25rem` (22px top clearance — the logo is not pushed against the top edge), `border-bottom: 1px solid var(--sidebar-border)` as the (only) separator.
- The block is 124px tall (measured) — compact, not excessive: 22 top pad + 52 logo + 8 gap + 21 descriptor + 20 bottom pad + 1 rule.
- Nav begins at y=124, its separation from the brand zone being the rule + existing groups padding.

### Centered logo

- `.app-sidebar-logo`: `width: 6.5rem` (104px) × `height: auto` → **104×52, exact 2:1**, matching the asset's natural ratio (1774×887). Measured ratio 2.0 on every route/locale/viewport (desktop).
- Asset is the repo-root `logo.png` **used as-is** — no modification, redraw, crop, recolor or distortion (CSS only re-proportions the box with `width`+`height:auto`).
- Logo center == brand content center on both locales (AR: logo x=1251, aside center ≈1302.5; FR: logo x=85, center 137) — verified to 1px.
- No duplicate "ORKESTRIX" text: aside innerHTML contains exactly **one** ORKESTRIX occurrence (the `img.alt`); no text rendering duplicates it.

### "Property System" treatment

- Rendered via the existing i18n key `app.descriptor` (Latin in all locales, same as `app.brand`), wrapped in `<Bidi dir="ltr">` for LTR isolation.
- Centered directly beneath the logo (desc center == logo center, measured), 13px/500 muted (`--muted-foreground`) — one rung below the 14px/500 nav rows, so the hierarchy logo → descriptor → nav reads instantly.
- Hidden at ≤767px (compact rail, see §8).

## 3. Account card structure

`app.tsx` footer replaced the loose `.app-sidebar-user` block with an `.app-sidebar-card`:

```
┌────────────────────────────┐
│ (YH)  Yacine Haddad        │  32px initials avatar · name (primary)
│       obs.admin@example.com│  email (secondary, isolated LTR <bdi>)
├────────────────────────────┤  hairline divider
│ (⇥)   تسجيل الخروج         │  logout action (icon + label)
└────────────────────────────┘
```

- **Card surface:** `background: var(--background)` (white in light, dark in dark theme — token-driven, no special-casing), `border: 1px solid var(--sidebar-border)`, radius 12px, our normal edge/noise shadow **absent** by design (calm, no heavy borders/gradients/shadows). Padding 10px, gap 6px.
- **Avatar:** 32px circle, neutral ink wash `rgba(0,0,0,0.06)` (dark: `rgba(255,255,255,0.08)`), initials computed from `display_name` first letters ("Yacine Haddad" → "YH"; falls back to email if no display name). No technical identifiers anywhere.
- **Identity:** name 14px/600 (primary), email 12px muted (secondary). Email remains `sessionUser.email` inside `<Bidi dir="ltr">` (bdi, dir=ltr, ellipsized).
- **Action:** hairline divider, then the logout row — full-width, height 28px, 14px icon + label, muted by default; on hover the ink wash strengthens and text turns `--destructive`; focus-visible ring via existing `--ring`. Never visually competes with navigation.
- Auth/session/API untouched: same `handleLogout`, same `sessionUser` reads, same `authEnabled` gate, same `t("auth.logout")` key (AR تسجيل الخروج / FR Se déconnecter / EN Sign out).

The account card is pinned to the rail bottom (`.app-sidebar-footer { border-top … }` above a `flex:1` groups zone), so the three-zone rhythm is stable at any viewport height; the card's own containment plus the footer rule keep it visually attached to the interface, not floating in the empty area.

## 4. Icon decisions

- **Identity:** initials avatar instead of a user/account glyph — same professional signal, zero decorative icon noise (task allows "User Icon / Avatar").
- **Email:** *no* mail icon — "only if useful"; in a compact card the envelope adds noise to no purpose. Documented decision.
- **Logout:** existing phosphor `SignOut` at 14px — the single icon in the card and the exact size used by nav rows (one consistent family/size).
- No new/custom icon graphics anywhere.

## 5. RTL / LTR behavior

- **Brand:** centering is direction-neutral (no physical start/end). Measured identical centering in RTL (AR) and LTR (FR).
- **Descriptor:** `<Bidi dir="ltr">` keeps "Property System" intact in RTL.
- **Card:** `flex` row reverses naturally under `dir=rtl` — avatar at inline-start (right) in AR (x=1389 @1440, card center ≈1318) and at left in FR (x=19). Logout row `gap: 0.5rem` puts icon at the RTL-leading edge; label renders RTL.
- **Email:** `<Bidi dir="ltr">` verified (`dir=ltr`, tag BDI) in both locales.
- All layout uses logical properties (flex/gap/inline paddings); no hard-coded left/right anywhere in the new CSS.

## 6. Responsive behavior

- **1440 / 768:** full centered brand block (124px), full account card, logo 104×52. Consistent geometry across both widths.
- **375:** the rail keeps its collapsed single-strip behavior (as the SDK's did) — `.app-sidebar` becomes a 56px horizontal row; the brand collapses to a compact logo link (56×28, ratio 2.0), the descriptor hides ("structurally necessary" — no room in the strip), the account card drops away exactly as the SDK rail did (footer `display:none`, matching the platform rail precedent — no behavior regression; logout stays reachable on desktop/tablet as before). Navigation rows remain 28px, scrollable in-strip; **no page-level or body overflow** at 375 on any route (measured `scrollWidth <= clientWidth` for both html and body).
- `@media (max-width: 767px)` confines the collapsed geometry so it can never affect column layout at wider widths.

## 7. DOM / computed evidence (Playwright, deterministic locales)

All 32 combinations measured (AR 375/768/1440 × 8 routes, FR 1440 × 8 routes); representative values:

| Check | AR 1440 (all routes) | AR 768 | AR 375 | FR 1440 |
|---|---|---|---|---|
| Brand block height | 124px | 124px | 56px (rail) | 122px |
| Logo (rendered) | 104×52, ratio 2.0 | 104×52 | 56×28, ratio 2.0 | 104×52 |
| Logo natural | 1774×887 (2.0) | — | — | — |
| "Property System" | y=82, centered | centered | hidden (y=0) | y=82, centered |
| Centered (logo/desc vs brand) | true/true/true | true/true/true | n/a (rail) | true/true/true |
| Nav groups start | y=124 | y=124 | y=0 (rail) | y=122 |
| Rows | 7 × 28px | 7 × 28px | 7 × 28px | 7 × 28px |
| Active wash | rgba(0,0,0,0.04)/500 | same | same | same |
| Account card | 258×108, bg #fff, rad 12px | same | hidden (zero-size) | 258×104 |
| Avatar | "YH" 32px, R side | R side | hidden | L side (x=19) |
| Name/email | Yacine Haddad / obs.admin@example.com (bdi ltr) | same | same | same |
| Logout | تسجيل الخروج, 14px icon | same | same | Se déconnecter, 14px icon |
| ORKESTRIX occurrences | 1 (alt only) | 1 | 1 | 1 |
| html/body overflow | none | none | none | none |

Active-state routing: on `/dashboard` the home/brand link carries `data-active="true"` + `aria-current="page"` (dashboard is represented by the brand, matching the pre-existing IA — the home item is not duplicated in the groups); every other route shows the wash on its nav row (e.g. AR /properties → "العقارات", rgba(0,0,0,0.04), font-weight 500).

`lang` nuance: with the FR interception the document reports `lang="fr-DZ"` (the profile's stored locale), which is exactly what the app applies — French labels, LTR layout, brand/descriptor/card identical structure to AR. The D1 ground truth stays `locale=ar`; no interception was active for the AR runs.

## 8. Verification results

- `pnpm typecheck` → **exit 0**.
- `pnpm vitest run --no-file-parallelism` → **16 files / 223 tests passed**.
- Playwright (same live session as the running app + injected dataset): DOM/computed measurements above; no auth/API behavior change observed (session user, logout handler, auth gate untouched).

## 9. Unexpected findings

None blocking. Minor notes:

1. **Toolbar continuous-line rule retired (intentional).** The previous 56px brand row aligned its rule with the page toolbar. The brief explicitly asks for a *centered* brand block, which cannot fit 56px; the block is now 124px with its own rule. This supersedes the earlier shell rule deliberately — flagged for the record, not a defect.
2. **`0.8px` computed border thickness.** `getComputedStyle(card).border` reports `0.8px solid rgb(229,227,222)` for the 1px 1DPR border — a standard sub-pixel rounding artifact of the browser/DPR; visible line is a normal hairline.
3. **Reported `lang` for FR is `fr-DZ`** (not plain `fr`) — cosmetic; the app's own locale application is correct.

## 10. Commit hygiene

- Exactly one commit, no amend, no push.
- Staged: `src/client/app.tsx`, `src/client/styles.css` (sidebar presentation), this report. `logo.png` is already tracked from the previous commit (unchanged, no re-stage). All harness/log artifacts are gitignored. Working-tree inherited exceptions (Docs.zip, Docs/Docs.zip, P5–P8/, prior gate docs, tc/tc3/vt/vt3.txt, ui-finalization edits, tests/audit.test.ts) left untouched and unstaged.