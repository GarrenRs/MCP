# UI Correction — Table/Form/BiDi Governance Follow-up (2026-09-25)

**Contract:** Focused UI governance correction pass against the live commercial observation dataset (local D1, `locale=ar`, `currency=DZD`), following the BiDi/Numeric pass of the same day (commit `4656d53`).
**Scope:** UI presentation only. No database, schema, migration, business logic, API contract, Core/Profile architecture, dataset, seed, stored value, or financial-calculation change. No global `direction:ltr`; no ASCII→Arabic-Indic conversion; no redesign. D1 state unchanged (`locale=ar`, `currency=DZD`).
**Environment:** Windows 10, Pnpm dev stack (`wrangler` on `127.0.0.1:8787` + `vite` on `localhost:5173`), Playwright instrumentation against the running app. Screenshots remain unavailable in this session (rendering capture stalls under ~0.76 GB free RAM); all evidence is DOM/computed-style measurement.
**Investigation rule honored:** every defect below was confirmed via DOM/computed-style evidence (screenshot is symptom only) before editing.

---

## 1. Root causes (confirmed in live DOM before any edit)

### 1a. i18n leak — missing catalog keys (user-visible raw keys)
Two production keys were referenced by components but absent from **all three** catalogs (`src/client/i18n/en.json`, `src/profile/algeria/ar.json`, `src/profile/algeria/fr.json`):

| Key | Site | Live DOM before fix (AR) |
|---|---|---|
| `payments.record_payment` | Payment dialog save button | footer buttons `[إلغاء, payments.record_payment]` |
| `leases.monthly_rent` | Lease dialog rent label | `<label for="l-rent">leases.monthly_rent</label>` |

Both referenced the translation mechanism correctly (`tf("payments.record_payment")` / `tf("leases.monthly_rent")`) — the catalogs simply lacked the entries. No hard-coded fallback was added anywhere; the existing mechanism is the fix. Mirror values were copied from the semantically identical keys that already exist in all three catalogs: `rent.record_payment` (EN "Record payment"/AR "تسجيل دفعة"/FR "Enregistrer un paiement") and the `tenants`/`common` `monthly_rent` entries (EN "Monthly rent"/AR "الإيجار الشهري"/FR "Loyer mensuel").

### 1b. Applications table overflow at 1440 px
`/applications` (AR, 1440): table scroll width **1151** vs container **1104** — a persistent 47 px overflow visible as a clipped right edge. Root cause isolated by DOM experiment: the property·unit column's min-content width was 335 px because the French property names (`OBS: …`) were forced onto one line by the shared table's `whitespace-nowrap` cell rule. Setting `white-space: normal` on that one column fit the table at exactly 1104 with **zero row-height change** (44 px). Leases (1198/1198) and rent (1198/1198) were unaffected by the same treatment in the experiment (already comfortable), so the fix is safe to share across all three tables.

### 1c. Table icon governance — decorative per-row semantic icons
Tenants table had per-row `lucide-mail` + `lucide-phone`; applications had per-row `lucide-phone`. These are decorative: the header text already names the column (`email`, `phone`), no other column in either table carries a per-row semantic icon (applications' email column had none — the phone icon was the odd one out), and the icons carry no affordance (both cells are plain text; rows open a dialog). Rule applied: **semantic icons at header level or absent; per-row icons only when they are actions.** Action icons (rent table `Pencil` + record/view buttons) are retained. The detail-page contact lines (`tenant-page`, `property-page` address `MapPin`) are page-level contact info, not table rows — out of scope.

### 1d. Users settings tab — missing bidi isolation + input direction
- Users list email line rendered the email as a raw text node inside an RTL context (`dir=null`, computed `rtl`) with **no isolation** — inconsistent with every other email/phone token in the app (all `<Bidi dir="ltr">`).
- `UserDialog` email input `#u-email` lacked `dir="ltr"` — the only dialog field still missing it (tenant/application/vendor/property dialogs all carry `dir`).

### 1e. Verified-correct — left untouched (evidence documented)
- **Rent composite** (`36,000 د.ج./شهر`): per-character visual-order probe confirmed correct RTL reading order (RLM-wrapped Intl money composed with `/شهر`); `formatMoney` unchanged.
- **Rent table statuses, money/balance cells, KPIs**: measured clean.
- **Audit tab** (settings, AR 1440): 83 rows, fits (976/976); the `changes` column is ASCII-dominant metadata (`unit_id: 23, start_date: 2026-10-25`) with `truncate` + tooltip — no directive defect.
- **All CRUD dialogs** already share one structure (DialogHeader/Title, `gap-3` grid, footer = destructive `sm:me-auto` + ghost cancel + primary save).
- **Narrow-screen scrolling** (375/768) remains scrollable-by-design; not a regression.

---

## 2. Fixes

1. **Catalogs** — added `payments.record_payment` + `leases.monthly_rent` to `en.json`, `ar.json`, `fr.json` (mirror values, placed in the existing alphabetical key order).
2. **New shared primitive `src/client/components/ui/property-unit.tsx`** — the "Property · Unit" composite used by the applications, leases and rent tables: muted property · `·` separator · medium unit, `white-space: normal` so a long property name can wrap instead of forcing the column past the table width; renders the existing `—` fallback when no unit. One shared composite instead of three page-local variants; no page hack.
3. **Icon removal** — `tenants-list.tsx` (Mail + Phone), `applications-page.tsx` (Phone); the Bidi-wrapped values and cell classes are otherwise unchanged.
4. **Applications/leases/rent tables** — property·unit cell now uses `PropertyUnit` (fixes the 47 px overflow for applications; provably no-op width/height change for leases and rent).
5. **`users-tab.tsx`** — users-list email wrapped in `<Bidi dir="ltr">`; `#u-email` input gets `dir="ltr"`.

No change to dialogs' translation calls (they were already correct), `formatMoney`/`formatDate`, the shared table, i18n module, profile wiring, or the database.

---

## 3. Before → after (measured, AR)

| Site | Before | After |
|---|---|---|
| Payment dialog footer | `[إلغاء, payments.record_payment]` | `[إلغاء, تسجيل دفعة]` |
| Lease dialog `l-rent` label | `leases.monthly_rent` | `الإيجار الشهري` |
| Applications table @1440 | scrollW **1151** > clientW 1104 (47 px overflow) | **1104/1104 fits**, 8 rows, row height 44 px unchanged |
| Applications rows icons | 8 × `lucide-phone` | 0 |
| Leases table @1440 | 1198/1198 fits | **1117/1117 fits**, 13 rows, 44 px, rent composite `36,000 د.ج./شهر` intact |
| Rent table @1440 | 1198/1198 fits | **1117/1117 fits**, 13 rows, money/status intact, 13 × action `Pencil` (allowed) |
| Tenants table @1440 | 16 rows, per-row Mail+Phone icons | 16 rows, **0 icons**, fits 1102/1102, phones `+213 …` in order |
| Users list email | raw text, `dir=null`, computed `rtl` | `<bdi dir="ltr">owner@example.com</bdi>` (1 `bdi`/row) |
| `#u-email` input | `dir=null` | `dir="ltr"` |
| Applications @768 / @375 | scrolls | scrolls (980 table in 445/327 container — accepted narrow behavior) |

## 4. FR spot-check (1440, `page.route` rewrites `locale=fr-DZ` in the `/api/settings` body — no DB write)

- Applications: headers `Nom / Bien · Unité / E-mail / Téléphone / Emménagement souhaité / Statut / Reçue le`, fits 1104/1104, `dir=ltr`.
- Rent: fits 1117/1117. Payment dialog: `[Annuler, Enregistrer un paiement]` — no raw key.
- Lease dialog: rent label `Loyer mensuel` — no raw key.
- Tenants: headers `Nom / Unité actuelle / E-mail / Téléphone`, fits 1102/1102, 0 row icons.

## 5. Files changed

| File | Change |
|---|---|
| `src/client/components/ui/property-unit.tsx` | **new** shared Property · Unit composite (`whitespace-normal`, muted property · medium unit, `—` fallback) |
| `src/client/components/applications/applications-page.tsx` | phone icon removed; property·unit cell → `PropertyUnit` |
| `src/client/components/leases/leases-page.tsx` | property·unit cell → `PropertyUnit` (render unchanged) |
| `src/client/components/rent/rent-page.tsx` | property·unit cell → `PropertyUnit` (render unchanged) |
| `src/client/components/tenants/tenants-list.tsx` | per-row Mail/Phone icons removed (values remain Bidi-wrapped) |
| `src/client/components/settings/users-tab.tsx` | users-list email `<Bidi dir="ltr">`; `#u-email` `dir="ltr"` |
| `src/client/i18n/en.json` | + `payments.record_payment`, `leases.monthly_rent` |
| `src/profile/algeria/ar.json` | + `payments.record_payment` (تسجيل دفعة), `leases.monthly_rent` (الإيجار الشهري) |
| `src/profile/algeria/fr.json` | + `payments.record_payment` (Enregistrer un paiement), `leases.monthly_rent` (Loyer mensuel) |
| `Docs/execution/governance/ui-table-form-bidi-governance-correction-2026-09-25.md` | this report |

## 6. Verification

| Gate | Result |
|---|---|
| i18n key audit (312 referenced keys, `i18n-audit.cjs`) | PASS — `payments.record_payment` / `leases.monthly_rent` no longer missing; remaining `MISSING` entries are the known regex false positives (`-`, `.`, `a`, `link`, `property_id`, `status`, `tenant_id`, `unit_id`) and `app.brand` (resolves via the profile en-fragment) |
| `tsc --noEmit` | PASS |
| `pnpm vitest run --no-file-parallelism` | **16 files / 223 tests PASS** (pre-existing `audit write failed: no such table: audit_logs` stderr lines are the inherited in-memory-DB test behaviour; the audit suite itself passes) |
| Playwright AR 375/768/1440 | PASS — applications fits at 1440 (1104/1104) with identical row height; leases/rent/tenants fit; dialogs show translated keys; users tab bidi-isolated; narrow widths scroll as designed |
| Playwright FR 1440 (route interception) | PASS — all tables fit, all dialog labels/buttons translated, 0 row icons |
| Database | untouched (FR via route interception only; no writes from this work) |

## 7. Notes

- The applications table was also verified at 768/375: the table scrolls inside its container (container 445/327, table 980) — the accepted narrow-screen behavior, not a regression.
- Screenshots for this pass could not be captured (render capture stalls under ~0.76 GB free RAM); the accepted evidence mode for this session is DOM/computed measurement, as recorded above.