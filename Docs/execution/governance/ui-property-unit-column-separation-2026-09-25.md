# UI Correction — Property / Unit Column Separation (2026-09-25)

**Contract:** One final focused table presentation correction against the live commercial observation dataset (local D1, `locale=ar`, `currency=DZD`, 16 OBS tenants). Split the combined **Property · Unit** column in every data table into two distinct columns — **Property** and **Unit**.
**Scope:** UI presentation only (table columns, headers, cells, sizing/alignment, RTL/LTR presentation of the separated values). No database, schema, migration, API contract, business logic, Core/Profile, dataset, seed, stored value, or commercial-layer change. No `direction:ltr`; no ASCII→Arabic-Indic conversion; no redesign.
**Environment:** Windows 10, pnpm dev stack (`wrangler` on `127.0.0.1:8787` + `vite` on `localhost:5173`), Playwright DOM/computed-style instrumentation against the running app (screenshots unavailable this session — rendering capture stalls under ~0.76 GB free RAM; all evidence is DOM measurement, as in the two prior passes).
**Investigation rule honored:** every finding was confirmed via DOM/computed-style evidence before and after edits; only the reported measurements were edited against.

---

## 1. Investigation — every table using the joined representation

| Table | Combined representation before | Data source (already separate in view-model) | Split at presentation level? |
|---|---|---|---|
| Applications | `applications.property_unit` header · `PropertyUnit` cell | `Application.property_name`, `Application.unit_name` | ✅ yes |
| Leases | `leases.property_unit` header · `PropertyUnit` cell | `Lease.property_name`, `Lease.unit_name` | ✅ yes |
| Rent / Charges | `rent.property_unit` header · `PropertyUnit` cell | `RentCharge.property_name`, `RentCharge.unit_name` | ✅ yes |
| Tenants | `tenants.active_unit` header · inline `active_property_name · active_unit_name` cell | `Tenant.active_property_name`, `Tenant.active_unit_name` | ✅ yes (cell joined the two entities under a single header) |

**Inspected and out of scope (not tables):** maintenance work-order cards (`maintenance-page.tsx:114`), dashboard work-order/lease list lines (`dashboard-page.tsx:156/194`), tenant/property detail meta lines, lease-dialog unit picker, payment/charge dialog summary lines — none are table columns; all keep their joined display.
**No duplicate data/API:** both fields exist independently per row in the API/view model; the split is purely presentational (the old `PropertyUnit` composite is deleted, no new data logic).

## 2. New table structure

**Header:** `Property · Unit` → `Property` + `Unit` (two `TableHead`s).
**Cells (all four tables):**

```tsx
<TableCell className="whitespace-normal">
  {row.property_name ? (
    <span className="text-sm text-muted-foreground">{row.property_name}</span>   {/* muted */}
  ) : (<span className="text-xs text-muted-foreground">—</span>)}
</TableCell>
<TableCell className="whitespace-normal">
  {row.unit_name ? (
    <span className="text-sm font-medium">{row.unit_name}</span>                 {/* medium */}
  ) : (<span className="text-xs text-muted-foreground">—</span>)}
</TableCell>
```

- Values are **not** re-concatenated; each column shows exactly one entity.
- Existing semantic hierarchy preserved: **property muted, unit medium** (span probes: property `font-weight 400` + `text-muted-foreground` gray `rgb(100,99,96)`; unit `font-weight 500` + foreground) — identical to the previous shared composite.
- No new per-row icons were introduced.
- `whitespace-normal` retained on both new columns (this was the previous composite's wrap rule — the fix behind the 47 px applications overflow) and **added to the rent tenant-name cell** (rationale in §4).

## 3. Catalog keys

Added (all three catalogs — `en.json` EN, `ar.json` AR, `fr.json` FR):

| Key | EN | AR | FR |
|---|---|---|---|
| `applications.property` | Property | العقار | Bien |
| `leases.property` | Property | العقار | Bien |
| `rent.property` | Property | العقار | Bien |
| `rent.unit` | Unit | الوحدة | Unité |
| `tenants.property` | Property | العقار | Bien |

Existing keys reused: `applications.unit`, `leases.unit`, `rent.unit`→ already present for applications/leases; `tenants.active_unit` retained ("Active unit" / الوحدة النشطة / Unité actuelle) because the tenants unit column is specifically the *current/active* unit — the localized header already existed and stays accurate. The retired `*_property_unit` catalog entries remain in the catalogs but are now unreferenced (kept for catalog stability; nothing in code consumes them).

## 4. Width / alignment decisions (measurement-driven)

- **Property column:** enough width for names; `whitespace-normal` so long French names (`OBS: Résidence El Djazaïr`) wrap inside the column instead of forcing overflow — this is the same rule the previous composite used (the 47 px applications fix), now scoped to the property column only.
- **Unit column:** compact vs property; `whitespace-normal` as well — the old composite's whole token could wrap, so allowing the unit token to break at its space is not a behavior change, and it is what keeps the FR rent table inside its width budget (see §6).
- **No equal widths forced** — auto layout distributes between min and max; property ends up visibly wider than unit at comfortable widths (AR 1440: property 161–270 px, unit 120–181 px per table).
- **Rent tenant cell** (`whitespace-normal`): the preceding correction's governance fixed long names by allowing wrap; the tenant-name column is the only other starvable content in the rent table. A 2-line name is 40 px < the shared `h-11` (44 px) floor, so **row height does not change**; this frees ~40 px of min-content so the rent table stays within budget in FR. No other table needed it (all fit).
- Actions stay **one line**: wrapping the record/view buttons (tested) stacked them into 92 px rows — rejected.

## 5. RTL / LTR

- Headers and cells inherit the RTL table direction (AR `dir=rtl`); no global direction change, no per-column `dir` change.
- Property/unit content is French (strong-LTR strings, e.g. `OBS: Cité des Palmiers`, `Appartement 2`) — each value is now a single run in its own column, so no mixed-direction reordering is possible; the previous verified-correct rendering is preserved (no `<Bidi>` wrapper added around bare table tokens, consistent with the prior pass's probe).
- Money composites untouched and verified intact: AR `36,000 د.ج./شهر`, FR `36 000 DA/mois` (RLM/Intl behavior unmodified).

## 6. Verification (live Commercial Observation Dataset)

### AR — 375 / 768 / 1440 (all four routes)

All at 1440: split headers correct, **no overflow** (fits exactly), all rows 44 px, 0 row icons:

| Route @1440 | Headers (AR) | table/wrapper | Row heights |
|---|---|---|---|
| Applications | الاسم · العقار · الوحدة · البريد الإلكتروني · الهاتف · الانتقال المرغوب · الحالة · تاريخ التقديم | 1104/1104 | [44] |
| Leases | المستأجر · العقار · الوحدة · المدة · الإيجار · الحالة | 1117/1117 | [44] |
| Rent | العقار · الوحدة · المستأجر · الاستحقاق · المحاسب · المدفوع · الرصيد · الحالة · (actions) | 1117/1117 | [44] |
| Tenants | الاسم · العقار · الوحدة النشطة · البريد الإلكتروني · الهاتف | 1104/1104 | [44] |

768 and 375: tables scroll inside their own wrapper (`overflow-auto`), values wrap, and **no page-level horizontal overflow** (`document.documentElement.scrollWidth === clientWidth` at 768 and 375 on every route) — the established accepted narrow-screen scrolling.

### FR — 1440 (route interception sets `locale=fr-DZ` in `/api/settings`, no DB write)

| Route | Headers (FR) | table/wrapper | Row heights |
|---|---|---|---|
| Applications | Nom · Bien · Unité · E-mail · Téléphone · Emménagement souhaité · Statut · Reçue le | 1104/1104 | [44, 61] |
| Leases | Locataire · Bien · Unité · Durée · Loyer · Statut | 1117/1117 | [44] |
| Rent | Bien · Unité · Locataire · Échéance · Facturé · Payé · Solde · Statut · (actions) | 1117/1117 | [44, 61] |
| Tenants | Nom · Bien · Unité actuelle · E-mail · Téléphone | 1104/1104 | [44] |

FR rent `[44, 61]` **matches the pre-split baseline** (old code measured `[44, 60]`, fits 1117/1117 — see §6b).

### Regression gates

| Gate | Result |
|---|---|
| `pnpm typecheck` (`tsc --noEmit`) | EXIT=0 |
| `pnpm vitest run --no-file-parallelism` | 16 files / 223 tests PASS |
| i18n key audit (`i18n-audit.cjs`, 314 referenced keys) | PASS — the only `MISSING` entries are the known regex false positives (`- . a link property_id status tenant_id unit_id app.brand`) |
| Live-DOM raw-key scan (AR + FR, all four tables) | 0 raw keys — rent headers now `العقار/الوحدة` (AR) and `Bien/Unité` (FR) |
| Databases | untouched (FR via route interception only; no write calls in this pass) |

## 6a. Unexpected finding 1 — missing `rent.property` / `rent.unit` keys (caught live)

A precursor grep matched the literal strings `"property"`/`"unit"` inside **`work_order`** (`work_order.property` = "Property", used by the work-order form) and I initially assumed they existed under `rent`. Live DOM check of the rent table exposed raw headers `rent.property` / `rent.unit` — both keys were absent from every catalog. **No hard-coded fallback was added**; the 6 missing entries (2 keys × 3 catalogs) were added via the existing mechanism. Post-fix probe: AR `العقار · الوحدة` and FR `Bien · Unité` headers render translated.

## 6b. Unexpected finding 2 — FR rent at 1440 initially overflowed after the split

With the split alone, FR rent min-content grew past the available width (measured **1138 vs 1102–1117**) and rows grew to **61–81 px** (property column starved to its 97 px min → 3-line wraps). A controlled A/B (temporarily restoring commit `3474516` files via `git show` + file swap, then restoring the split) proved the old code rendered 1117/1117 with rows `[44,60]` — i.e. the overflow/tall-rows were **new**, not pre-existing. Fix path:

1. Unit column back to `whitespace-normal` (mirrors the old composite's wrap rule) — min-content 1138 → 1111.
2. Rent tenant-name cell `whitespace-normal` (2-line name still inside the 44 px `h-11` floor) — frees ~40 px min-content while rows stay 44 px.

Final state: FR rent 1117/1117, rows `[44,61]` ≈ old `[44,60]` — no regression. **Rejected alternatives** (measured, then discarded): `flex-wrap` on the actions cell (stacked record/view buttons → 92 px rows); per-column `px-2` padding (breaks the shared `px-3` alignment governance); line-clamping property names ("no unnecessary truncation" violated).

## 7. Data / API safety

- No database writes, no schema/migration, no API contract change, no dataset/seed mutation, no business-logic or financial-calculation change (money/status helpers untouched; composites verified intact).
- FR verification never touches the DB (response rewrite only).
- Confirmed via `git status`: only the 8 staged-intent files changed; all inherited working-tree exceptions (Docs.zip, Docs/Docs.zip, P5–P8/, core-profile-separation gate doc, tc/tc3/vt/vt3.txt, ui-finalization edits, tests/audit.test.ts) remain untouched.

## 8. Files changed

| File | Change |
|---|---|
| `src/client/components/applications/applications-page.tsx` | header → `applications.property`+`applications.unit`; cell → two split cells; `PropertyUnit` import removed |
| `src/client/components/leases/leases-page.tsx` | header → `leases.property`+`leases.unit`; cell → two split cells; import removed |
| `src/client/components/rent/rent-page.tsx` | header → `rent.property`+`rent.unit`; cell → two split cells + tenant cell wrap-allowed; import removed |
| `src/client/components/tenants/tenants-list.tsx` | header → `tenants.property`+`tenants.active_unit`; joined cell → two split cells |
| `src/client/components/ui/property-unit.tsx` | **deleted** (no consumers remain) |
| `src/client/i18n/en.json` | + `applications.property`, `leases.property`, `rent.property`, `rent.unit`, `tenants.property` |
| `src/profile/algeria/ar.json` | + same 5 keys (AR: العقار / الوحدة) |
| `src/profile/algeria/fr.json` | + same 5 keys (FR: Bien / Unité) |

## 9. Commit

Single focused commit (no amend, no push), staging exactly the 8 files above plus this report (see §8). Reviewer gate runs after the commit; verdict delivered in the session response.