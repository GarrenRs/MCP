# Disposable Commercial Observation Dataset — Design

**Date:** 2026-09-25
**Phase:** DESIGN + READ-ONLY VALIDATION ONLY (no injection, no code, no schema, no DB mutation)
**Baseline:** HEAD `e428591` (parent `45a9fd4`), `origin/main` `b46168a` (untouched)
**Commit:** <recorded post-commit>
**Gate (next phase):** GO-WITH-PRECONDITIONS

Evidence classes: `[VERIFIED]` = observed directly in schema/behavior this phase; `[INFERENCE]` = derived from verified facts; `[RECOMMENDATION]` = advisory for the next phase. All source-behavior claims were validated by reading `src/server/schema.sql`, `migrations/*.sql`, `src/server/app.ts`, `finance.ts`, `leases.ts`, `auth.ts`, `tests/helpers/demo-fixture.ts`, and `src/profile/algeria/shared.ts`. Nothing in this report was injected or executed against the live DB.

---

## 1. Executive purpose

ORKESTRIX Property System must be observed as a real operational product before commercial build-out. This specification defines a **disposable, deterministic, resettable "Commercial Observation Dataset" (OBS)** that exercises the existing Core + Algeria Profile system through realistic operational states: a mixed Algerian portfolio with healthy, distressed, vacant and transition properties; a full rent ledger with paid / partial / overdue / waived states and multi-payment reconciliation; maintenance and vendor lifecycles; an application pipeline; role-separated users; and an audit trail. The dataset is sized for this machine (~215 rows) yet rich enough to populate every dashboard tile and every operational screen with coherent, non-trivial values.

The dataset is **design-only** in this phase. The next phase (injection) is gated at the end of this document.

---

## 2. Dataset philosophy

1. **Scenarios first, rows second** — every record exists to instantiate one or more business scenarios (A–P); no row is added "for volume".
2. **Deterministic by construction** — all primary keys are journaled at load; all timestamps are explicit `YYYY-MM-DD`/`datetime` offsets from a single anchor; no reliance on `datetime('now')` defaults.
3. **Time-anchored, self-normalized** — `T` = injection moment, `M0` = T's month, `M-k` = k months before. Every status is written exactly as the server would compute it at anchor time (`markOverdue`/`computeChargeStatus` are read from source), so the first read produces no status rewrite.
4. **Referentially valid and internally coherent** — insertion follows FK order; amounts reconcile exactly (`amount_paid` = Σ payments; charge balances tie to dashboard totals); lease dates never violate the P9 overlap guard; unit occupancy always matches lease truth at anchor.
5. **Clearly synthetic** — Arabic/French names and Algerian geography for presentation relevance, but every person/company/SARL is obviously fictional; `obs.*@example.com` emails; documented constant password; `+213 5xx` placeholder phones; `OBS:` marker prefix on every entity name so the dataset is greppable and disposable.
6. **Disposable and resettable** — full restore from a pre-load snapshot is the canonical reset; a surgical marker-based cleanup is the alternative (both specified in §8).
7. **Never mixed with production seed semantics** — the app's post-separation runtime seeds only `settings`; the live dev DB additionally carries a pre-separation Austin sample portfolio (3 properties / 5 units / 3 vendors). OBS rows are disjoint in name and email, and the seed is never modified.

---

## 3. Scenario matrix (A–P)

| # | Scenario | Anchor property / unit | Dashboard / operational visibility |
|---|---|---|---|
| A | Healthy occupied property | P1 Résidence El Djazaïr (all 3 units occupied) | occupancy + active leases + collected |
| B | Vacant property | P4 Bastion 23 (single vacant unit) | vacant count, 0 revenue from this property |
| C | Property with maintenance issue | P5 Résidence Tassili (urgent tenant-reported leak) | open/urgent WO tiles + recent list |
| D | Active lease fully paid | P1/P2/P7 + P8·C1 | month_collected, paid ledger |
| E | Active lease partial payment | P3·O2 (35,000 DZD, paid 20,000, due T+6) | month_outstanding; stays `partial` (future due) |
| F | Overdue rent | P3·O1 (2 months unpaid) + P8·C2 (partial, past due) | overdue_total + overdue_count |
| G | Waived charge | P3·O3 (M0 waived; M-1 paid) | excluded from outstanding/overdue totals |
| H | Future lease | P3·O4 (upcoming, starts T+14) | upcoming lease row; unit stays vacant |
| I | Expired lease | P6·Dar El Bahia (ended T-7, unit turnover) | ended lease history, vacant/turnover unit |
| J | Unit occupancy conflict / boundary | P8·C3 (cancelled + ended + upcoming; no overlap) | P9 guard: adjacent dates legal; overlap → 409 |
| K | Application pipeline | O4 (approved), C3, D1, B1 (new/screening/approved/declined/withdrawn) | all 5 application statuses |
| L | Vendor + work-order lifecycle | P7·Eucalyptus (completed/in_progress/cancelled WOs, vendor costs) | open WO list, per-WO cost + vendor + completion |
| M | Multi-payment reconciliation | P8·C1 (charge paid by 3 payments: check + ACH + cash) | paid charge, payments list, reconciliation |
| N | Role-separated user activity | 4 users (owner/admin/manager×2) | gated endpoints: settings, users, audit, reconcile |
| O | Audit trail activity | ~39 audit rows, per-role actors, explicit timestamps | Audit tab (admin) filtering by entity/actor |
| P | Mixed portfolio dashboard state | entire portfolio combined | every dashboard tile non-zero and coherent |

**Scenario → entity coverage matrix** (● = creates rows, ○ = referenced/observed):

| Scenario | props | units | tenants | leases | charges | payments | vendors | WOs | apps | users | audit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | ● | ● | ● | ● | ● | ● | | | | | ● |
| B | ● | ● | | | | | | | | | |
| C | | ○ | ● | | | | | ● | | | |
| D | | | ● | ● | ● | ● | | | | | ● |
| E | | ○ | ● | ● | ● | ● | | | | | ● |
| F | | ○ | ● | ● | ● | | | | | | ○ |
| G | | ○ | ● | ● | ● | ● | | | | | ● |
| H | | ○ | ● | ● | | | | | ○ | | ● |
| I | | ○ | ● | ● | ● | ● | | | | | ● |
| J | | ○ | ● | ● | | | | | | | ● |
| K | | ○ | | | | | | | ● | | |
| L | | ○ | | | | | ● | ● | | | |
| M | | ○ | ● | ● | ● | ● | | | | | ● |
| N | | | | | | | | | | ● | ○ |
| O | | | | | | | | | | ○ | ● |
| P | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |

---

## 3.1 Per-scenario specification

### A. Healthy occupied property — *Résidence El Djazaïr* (multi_family, El Madania, Wilaya 16)
- **Business situation:** fully leased building, three quiet, paying households; the "good" part of the book.
- **Entities:** P1; units A1 (2bd/1ba, 68 m², 45,000), A2 (1bd/1ba, 52 m², 38,000), A3 (3bd/2ba, 96 m², 62,000); tenants (3); active leases; M-1 + M0 charges paid.
- **Requires (records):** 1 property, 3 units, 3 tenants, 3 leases, 6 charges (2/lease), 6 payments, 3 audit (lease creates).
- **Expected system state:** `unit.status = occupied` for all 3; `active_leases` +3; charges `paid`.
- **Expected visibility:** occupancy tiles; "this month" collected includes 145,000 DZD from this property.
- **Relationships that must hold:** `lease.monthly_rent === unit.market_rent`; every M0 charge paid in full; unit occupied ⇔ ≥1 active lease (P9 reconcile rule, `leases.ts` `[VERIFIED]`).
- **Edge cases:** none for this scenario; provides the healthy baseline every other scenario compares against.

### B. Vacant property — *Bastion 23* (single_family, Constantine, Wilaya 25)
- **Business situation:** a whole property sitting vacant; carrying cost with zero income.
- **Entities:** P4; unit B1 (3bd/2ba, 140 m², 55,000) `vacant`; one declined application (scenario K).
- **Requires:** 1 property, 1 unit, 1 application (declined).
- **Expected system state:** `units.status = 'vacant'`, 0 leases, 0 charges.
- **Expected visibility:** `vacant` count; occupancy_rate math; "vacancy loss" (market rent × vacant units) is **not** computed by the system — visible only by manual calculation (`[VERIFIED]` dashboard exposes occupied/vacant counts only).
- **Relationships:** no FK writes downward (no leases → no charges).
- **Edge cases:** proves the portfolio math dimensionless units don't skew; exposes the missing "vacant loss" KPI (blind spot §11).

### C. Property with maintenance issue — *Résidence Tassili* (Tizi Ouzou, Wilaya 15)
- **Business situation:** an urgent tenant-reported roof leak (T1) and an assigned boiler inspection (T2).
- **Entities:** P5; units T1/T2 occupied; tenants C-t1, C-t2 (reporters); WOs: WO-1 `urgent` + `open` (lease/move-in leak, no vendor yet, created T-3); WO-2 `high` + `assigned` (hvac vendor v3, scheduled T+2).
- **Requires:** 1 property, 2 units, 2 tenants, 2 WOs.
- **Expected system state:** open_work_orders +2 (> baseline), urgent count +1; recent list shows WO-1 first (priority ORDER BY, `[VERIFIED]`).
- **Relationships:** WO.tenant_id → tenant reporter; WO.property_id/unit_id → P5/T1.
- **Edge cases:** WO with vendor null while `assigned`? — WO-2 has vendor (assigned ⇒ vendor); WO-1 open with no vendor (correct lifecycle).

### D. Active lease with fully paid rent (spread across A, plus P2, P7, P8·C1)
- **Business situation:** the norm state: rent collected in full, on time each month.
- **Entities:** leases on V1 (Oran Villa Sables d'Or, 95,000), E1/E2 (Sétif), A1/A2/A3, T1/T2, C1.
- **Requires:** the D-carrying leases each get M-1 + M0 charges, both `paid`, one payment each.
- **Expected system state:** status `paid`; never re-marked by `markOverdue` (`paid` excluded `[VERIFIED] finance.ts`).
- **Expected visibility:** month_collected majority; ledgers green.
- **Relationships:** `amount_paid = amount`; payments exactly cover charges.
- **Edge cases:** none; provides the cash-flow mass of the book.

### E. Active lease with partial payment — *P3·O2* (35,000 DZD / paid 20,000)
- **Business situation:** tenant paid part of the month, owes the rest.
- **Entities:** O2 + tenant E-t; M0 charge 35,000, one payment 20,000 → `amount_paid=20,000`, status `partial`.
- **Requires:** 1 charge, 1 payment.
- **Expected system state:** `partial` **and stays partial** — due date is set to T+6 (future) so `markOverdue` (`due_date < date('now')`) never flips it; this is the *intended* stable partial state `[VERIFIED] isChargeOverdue`).
- **Expected visibility:** month_outstanding includes 15,000 balance.
- **Relationships:** `amount_paid = Σ payments`; balance = amount − amount_paid.
- **Edge cases:** documents the partial-vs-overdue boundary: partial + past due ⇒ overdue (F2 demonstrates the flip side).

### F. Overdue rent — *P3·O1* (42,000, 2 months) and *P8·C2* (33,000, paid 15,000)
- **Business situation:** two tenants behind; one completely, one partially.
- **Entities:** O1 M-1 + M0 charges `overdue` (written as overdue at load: past-due, unpaid, non-waived); C2 M0 charge partial with payment 15,000 and due T-25 → **written as overdue** directly (past-due partial).
- **Requires:** 3 charges, 1 payment (C2's 15,000).
- **Expected system state:** `overdue_total = 42,000 + 42,000 + 18,000 = 102,000`; `overdue_count = 3`; `markOverdue` on next read is a no-op (statuses already correct).
- **Expected visibility:** dashboard overdue tiles; ledger filter `status=overdue`.
- **Relationships:** overdue = balance>0 ∧ due_date < today ∧ non-waived — all rows satisfy at anchor.
- **Edge cases:** C2 proves partial+past-due ⇒ overdue; O1 proves multi-period stacking (M-1 + M0 both count in overdue_total, one in month_outstanding).

### G. Waived charge — *P3·O3* (28,000)
- **Business situation:** goodwill/maintenance credit — the month's rent waived after a serious leak outage.
- **Entities:** O3; M-1 charge paid; M0 charge status `waived` (no payment; `amount_paid=0`).
- **Requires:** 2 charges, 1 payment (M-1).
- **Expected system state:** `waived`; excluded from `month_outstanding` (`status != 'waived'`) and from `overdue` `[VERIFIED] dashboard SQL`).
- **Relationships:** waived charge has no payments (clean); a manually-waived charge **with** payments is representable but intentionally avoided (§9 misleading fields).
- **Edge cases:** documents that the PATCH endpoint keeps `waived` on edit (no recompute for waived, `[VERIFIED]` app.ts line 857).

### H. Future lease — *P3·O4* (40,000, starts T+14)
- **Business situation:** signed lease for next fortnight; unit currently vacant.
- **Entities:** O4; ended prior lease (end T-1, paid history); upcoming lease (status `upcoming`, tenant H-t); approved application (scenario K) whose `desired_move_in` = T+14.
- **Requires:** 2 leases (1 ended, 1 upcoming), 3 historical charges (M-3..M-1, paid), 3 payments, 1 application.
- **Expected system state:** `unit.status = vacant` (upcoming alone does **not** occupy — `reconcileUnitStatus` returns vacant when no active lease and no manual override `[VERIFIED] leases.ts`); upcoming lease visible in leases list `status=upcoming`.
- **Relationships:** upcoming lease must not overlap the prior ended lease (it doesn't: T-1 < T+14, gap).
- **Edge cases:** proves upcoming ≠ occupied; also pairing approved applicant ↔ upcoming tenant (pipeline→lease handoff).

### I. Expired lease — *Dar El Bahia* (Oran, Wilaya 31)
- **Business situation:** tenant completed a 12-month lease, moved out T-7.
- **Entities:** P6; unit D1 `turnover` (manual state); lease status `ended`, end T-7; 3 historical paid charges (M-3..M-1); applications for re-let (scenario K).
- **Requires:** 1 property, 1 unit, 1 tenant, 1 ended lease, 3 charges, 3 payments, 3 applications.
- **Expected system state:** `ended` lease with history; `unit.status = turnover` (manual, never clobbered by reconcile `[VERIFIED] leases.ts`).
- **Relationships:** tenant retained in tenants table (history record); lease `primary_tenant_id` kept (no SET NULL until tenant deleted).
- **Edge cases:** turnover unit is neither occupied nor vacant in dashboard (`occupied`/`vacant` counts exclude it — note in §11).

### J. Unit occupancy conflict / boundary — *P8·C3* (58,000)
- **Business situation:** the unit's occupancy timeline must be legal under the P9 guard and exercise the boundary conditions.
- **Entities:** C3 with three non-overlapping leases: **cancelled** (T-150..T-90, status cancelled), **ended** (T-120..T-31, paid history), **upcoming** (T+30..T+400); plus applications (scenario K: screening + withdrawn).
- **Requires:** 3 leases, 3 paid historical charges for the ended lease, 3 payments, 2 applications.
- **Expected system state:** all three leases coexist (no overlaps among *claiming* statuses: cancelled does not claim the unit `[VERIFIED] leaseClaimsUnit`); unit vacant at anchor; the terminated lease overlapping the cancelled one in time is legal because cancelled never claims.
- **Boundary edges (documented, to be exercised during injection QA, not stored):**
  - Adjacent dates are legal: `dateRangesOverlap` is inclusive (`aStart <= bEnd && bStart <= aEnd`) — a lease ending T-31 followed by one starting T-30 does **not** overlap `[VERIFIED] leases.ts`. Equivalent to the O4 ended→upcoming gap and the C3 ended→upcoming gap.
  - An overlapping **active** lease attempt on a unit holding an upcoming lease (e.g., on O4 with dates crossing T+14) must return **409 lease_conflict** `[VERIFIED] app.ts POST /api/leases`. This is a runtime observation during the injection phase, not a dataset record.
- **Relationships:** cancelled lease → no charges (no rent obligation); ended lease → paid history.

### K. Application pipeline (8 applications, all 5 statuses)
- **Business situation:** the leasing funnel across vacant/turnover units.
- **Entities:** app-1 `new` on D1; app-2 `screening` on D1; app-3 `declined` on D1 (income below threshold — documented in notes); app-4 `approved` on O4 (matches upcoming lease, `desired_move_in` = T+14); app-5 `new` on C3; app-6 `screening` on C3; app-7 `withdrawn` on C3; app-8 `declined` on B1.
- **Requires:** 8 application rows.
- **Expected system state:** applications list ordered `created_at DESC` with unit/property name joins `[VERIFIED] app.ts`.
- **Relationships:** `applications.unit_id` → units (O4, C3, D1, B1 all real); approved app targets a unit whose upcoming lease starts the same day.
- **Edge cases:** declined-on-vacant (B1) shows that a vacancy can exist *despite* applications (intake ≠ leasing).

### L. Vendor + work-order lifecycle — *Eucalyptus Gardens* (Sétif, Wilaya 19)
- **Business situation:** maintenance history: completed jobs with costs, one in progress, one cancelled, plus the open ones from scenario C.
- **Entities:** P7; units E1 (occupied), E3 (turnover); vendors v1 (plumber), v4 (cleaning), v6 (handyman); WOs: WO-3 completed (gasket, 8,000, completed T-12), WO-4 completed (facade paint, 45,000, completed T-30), WO-5 in_progress (drain unclog, v1, scheduled T-1), WO-6 cancelled (terrace fitting) on E3, WO-7 completed (post-moveout cleaning, v4, 12,000, completed T-2).
- **Requires:** 7 vendors total (6 named in §5 + 1 general), 7 WOs (2 property-level from C + 5 here).
- **Expected system state:** open_work_orders counts only non-terminal statuses; completed WOs keep `completed_at` and `cost` (the P7 stamping rule `[VERIFIED] app.ts`).
- **Relationships:** WO.vendor_id → vendors; completed ⇒ `completed_at` set; cancelled WO excluded from open counts.
- **Edge cases:** vendor referenced by multiple WOs (v1 ×2) — the same vendor serves both property workflows.

### M. Multi-payment reconciliation — *P8·C1* (37,000)
- **Business situation:** rent settled via three instruments across the week.
- **Entities:** C1 + tenant M-t; M0 charge 37,000 paid by: p-1 check (15,000, ref "Chèque n°1142", paid_at T-9), p-2 ACH (17,000, ref "VIR-2026-091", T-6), p-3 cash (5,000, T-5).
- **Requires:** 1 charge, 3 payments.
- **Expected system state:** `amount_paid = 37,000` (= Σ payments), status `paid`; payments list shows 3 rows ordered `paid_at DESC` `[VERIFIED]`.
- **Relationships:** the reconciliation invariant — charge recompute after any payment add/delete uses Σ payments (`[VERIFIED] app.ts POST/PUT payment paths`).
- **Edge cases:** overpayment is representable (Σ > amount ⇒ still `paid`, no credit balance concept) — deliberately **not** used here; documented blind spot (§11).

### N. Role-separated user activity
- **Business situation:** an owner, an admin, and two managers operate the portfolio; the system gates by role.
- **Entities:** users: u-owner (role `owner`, "Dalia Merabet"), u-admin (`admin`, "Yacine Haddad"), u-fin (`manager`, "Nadia Cherif"), u-maint (`manager`, "Sofiane Belkacem"). All passwords = documented constant `Obs!Commercial2026`, PBKDF2-hashed at load (`[VERIFIED] hashPassword auth.ts`); unique `obs.*@example.com` emails.
- **Requires:** 4 users, 3 audit rows for user creates (owner actor).
- **Expected system state / gated endpoints (verified in app.ts):** `/api/audit`, `/api/users` GET/POST/PUT, PUT `/api/settings`, POST `/api/admin/reconcile-occupancy` require `admin`+; DELETE `/api/users` and owner-role assignment require `owner`; managers can operate all portfolio entities. Observation phase will log in as each role and confirm the 403 gates.
- **Relationships:** `sessions` are created at login during observation (7-day TTL `[VERIFIED] auth.ts`) — none inserted by the fixture; audit `actor_user_id` references real users.
- **Edge cases:** owner can create owners; admin cannot modify owner accounts; non-owner role assignment rejected.

### O. Audit trail activity
- **Business situation:** a credible, attributable operational log.
- **Entities:** ~39 audit rows with explicit `created_at` and actor ids: 12 lease creates (subset, manager/public actors), 3 rent_charge `generate` events (period + created count), 12 payment creates, 2 settings updates (locale fr-DZ, currency DZD), 3 user creates (owner actor), 1 vendor create, and delete-actions deliberately **absent** (fixture deletes nothing — audit deletes are exercised at runtime, see §11).
- **Requires:** 39 audit_logs rows.
- **Expected state:** `/api/audit?entity=rent_charge` filtering works; actors resolve via JOIN users `[VERIFIED] app.ts`; admin-only.
- **Relationships:** `actor_user_id` must exist (4 fixture users); `record_id` journaled to real fixture PKs.
- **Edge cases:** `generate` with `record_id = null` (allowed, `[VERIFIED] app.ts line 823`).

### P. Mixed portfolio dashboard state — everything combined
- **Business situation:** one portfolio that simultaneously shows healthy cash flow, distress, maintenance, and pipeline.
- **Expected system state at anchor T (all tile formulas `[VERIFIED]` from `/api/dashboard/summary`):**

| Tile | Expected |
|---|---|
| properties | 8 |
| units | 18 |
| occupied / vacant / turnover | 13 / 3 / 2 |
| occupancy_rate | round(13/18×100) = **72%** |
| active_leases | 13 |
| upcoming_move_outs (≤30 d) | 2 (E1 ends T+24, C1 ends T+21) |
| month_outstanding (M0, non-waived) | 15,000 (E) + 42,000 (F·O1) + 18,000 (F2·C2) = **75,000** |
| month_collected (M0, Σ amount_paid) | **453,000** (see §5 reconciliation) |
| overdue_total | 42,000 + 42,000 + 18,000 = **102,000** |
| overdue_count | **3** |
| open_work_orders | **5** (WO-1 urgent, WO-2, WO-5, leak-sink, water-heater low) |
| urgent_work_orders | **1** |
| recent_work_orders | 6 rows, urgent first |
| upcoming_expirations (≤60 d) | C1 (T+21), E1 (T+24), A2 (T+55) = 3 |

- **Relationships:** every tile is derivable from the same row set — the dashboard is a pure derivation of the fixture, so any drift is a fixture-arithmetic error caught by the §10 verification assertions.

---

## 4. Entity / relationship matrix

**FK dependency / insertion order** (verified against `schema.sql` + migrations):

```
settings ─────────┐
users ─────────────┼──► (users before sessions & audit_logs: actor FK)
properties ─► units ─► leases ─► lease_tenants* ─► rent_charges ─► payments
   ▲                     │
   └── work_orders ◄─────┴──── tenants
vendors ─► work_orders         tenants ─► lease_tenants* / leases.primary_tenant
units ─► applications          tenants ─► work_orders.tenant_id (reporter)
```

*`lease_tenants`: schema exists (PK lease_id+tenant_id, both CASCADE) but **no API write path exists** (`[VERIFIED]` no INSERT in app.ts) — the fixture adds **0 rows** here and §11 flags the blind spot.

**Cardinality at load (target):** properties 8 → units 18 (3 single-family w/ 1 unit, 5 multi-family) → tenants 16 → leases 19 (13 active, 2 upcoming, 3 ended, 1 cancelled) → rent_charges 43 → payments 43; vendors 7 → work_orders 10; units → applications 8; users 4; audit_logs 39; sessions 0 (runtime). Settings unchanged (seed untouched).

**Cross-entity invariants the fixture must hold:**
1. `payments.charge_id` ⊆ `rent_charges.id`; Σ(payments.amount) per charge = `rent_charges.amount_paid`.
2. `rent_charges` unique `(lease_id, period)` — one row per lease-month.
3. Occupied unit ⇔ ≥1 `active` lease at anchor; `turnover`/`unavailable` are manual and never clobbered.
4. Claiming leases (`active`/`upcoming`) never overlap on the same unit (§3.1 J).
5. `work_orders.property_id/unit_id/tenant_id/vendor_id` all reference existing rows; nulls allowed per schema.
6. `audit_logs.actor_user_id` ∈ fixture users (or NULL only for system events — none used).
7. Charge `due_date` = `${period}-${clamp(due_day)}` (clamp 1..28 `[VERIFIED] finance.ts`); `rent_due_day` 1–31 on leases, effectively ≤28 for due dates.
8. `lease.monthly_rent === unit.market_rent` for occupied units (avoids the misleading divergence in §9).

---

## 5. Required records (complete manifest)

| Table | Rows | Notes |
|---|---|---|
| properties | 8 | `OBS:` prefix; communes/wilayas/country `DZ` from profile geoColumns `[VERIFIED] shared.ts`; 5 types incl. multi_family ×5 |
| units | 18 | status mix 13 occupied / 3 vacant / 2 turnover; sqft column carries **m²** values (Algerian convention) with a note |
| tenants | 16 | Arabic/French synthetic names, `obs.*@example.com`, +213 5xx placeholder phones, employers = fictional SARLs, monthly_income ≥1.5× rent (credit posture) |
| leases | 19 | 13 active / 2 upcoming / 3 ended / 1 cancelled; rents 26,000–95,000 DZD; `rent_due_day` 1–5; deposits 2× rent; dates per §3.1 |
| lease_tenants | 0 | schema-only (§4; deliberate) |
| rent_charges | 43 | 13 active ×(M0,M-1) = 26; 8 of those ×M-2 = 8; ended history (O4 3, D1 3, C3 3) = 9; statuses: 33 paid, 1 partial (future due), 3 overdue (O1×2, C2), 1 waived, 5 open→none (all covered); **all non-paid rows past-due written as `overdue` at load** |
| payments | 43 | methods cash/check/ach/credit; references "Chèque n°…"/"VIR-…"; M0 paid charges 1 each + C1 ×3; partial/overdue charge payments sized to leave exact balances; `paid_at` explicit |
| vendors | 7 | categories plumber, electrician, hvac, cleaning, landscaping, handyman, general; fictional SARL names (FR/AR) |
| work_orders | 10 | 5 non-terminal (1 urgent open, 2 high, 1 in_progress, 1 low), 4 completed (costs 6,500–45,000 + completed_at), 1 cancelled; mixed property/unit/tenant/vendor links |
| applications | 8 | all 5 statuses: 2 new, 2 screening, 1 approved, 2 declined, 1 withdrawn |
| users | 4 | owner/admin/manager×2; distinct `obs.*@example.com`; PBKDF2 at load |
| sessions | 0 | created at login during observation (7-day TTL) |
| audit_logs | 39 | 12 lease creates + 3 charge generate + 12 payment creates + 2 settings updates + 3 user creates + 1 vendor create + rest coverage; explicit created_at/actor |
| settings | 0 new | seed untouched; OBS uses existing rows (locale `fr-DZ`, currency `DZD`, AUTH_ENABLED `true`) |

**Past-due / due-date engineering (critical for determinism):** O2 (partial) gets `due_date = T+6` so it stays partial; O1 (M-1 and M0) and C2 get `due_date` in the past, so their statuses are written as `overdue` and `markOverdue` no-ops. All paid/waived rows are past-due-irrelevant (`paid`/`waived` never re-marked `[VERIFIED]`).

**Aggregate reconciliation at anchor (DZD):** month_collected = 9 paid M0 (A1 45 + A2 38 + A3 62 + V1 95 + T1 39 + T2 34 + E1 36 + E2 32 + C1 37 = 418,000) + E 20,000 + F2 15,000 = **453,000**. month_outstanding = E 15,000 + O1 42,000 + C2 18,000 = **75,000**. overdue_total = 102,000 (count 3). Waived excluded everywhere.

---

## 6. State coverage

| Domain state | Covered by |
|---|---|
| Unit: occupied / vacant / turnover | 13 / 3 / 2 (A, B, I, J) |
| Lease: upcoming / active / ended / cancelled | 2 / 13 / 3 / 1 (H, D/I, I, J) |
| Charge: open / partial / paid / overdue / waived | 0 / 1 / 33 / 3 / 1 (E/D, E, D, F/G) — open intentionally 0 (only transient) |
| Payment method: cash / check / ach / credit / other | all five (M, D spread) |
| WO priority: low / normal / high / urgent | 1 / 1 / 2+ / 1 (C, L) |
| WO status: open / assigned / in_progress / completed / cancelled | 3 / 1 / 1 / 4 / 1 (C, L) |
| Application: new / screening / approved / declined / withdrawn | 2 / 2 / 1 / 2 / 1 (K) |
| User roles: owner / admin / manager | 1 / 1 / 2 (N) |
| Locale/currency presentation | Arabic + French names, DZD, Algiers-first geography (fr-DZ default; ar RTL observable at runtime) |
| Geography (Algeria profile) | commune/wilaya on 8 properties; country `DZ`; CSV export header order `commune, wilaya` `[VERIFIED] shared.ts` |

**Deliberately absent states** (documented, not by omission): no `open` charges (they exist only pre-due-date), no overpayment, no delete-actions in audit, no `lease_tenants` rows.

---

## 7. Reset / isolation design

- **Canonical reset — whole-DB snapshot (recommended):** copy `…/d1/miniflare-D1DatabaseObject/<hash>.sqlite` (+ `-wal`/`-shm`, `metadata.sqlite`) before load; reset = stop wrangler, restore copy, remove stale `-wal`/`-shm`, restart. 100 % coherent, trivially deterministic. `[VERIFIED]` local D1 is a plain SQLite file (WAL).
- **Surgical reset (alternative, keeps live seed):** `DELETE FROM properties WHERE name LIKE 'OBS:%'` cascades units → leases → rent_charges → payments (`ON DELETE CASCADE` `[VERIFIED] schema.sql`); work_orders/applications referencing those units/properties are **SET NULL** — must be deleted separately by journaled ids; tenants deleted by journaled id list; users by `obs.*@example.com` emails (sessions cascade); audit_logs by journaled actor/record ids; note `sqlite_sequence` auto-increment residue (harmless for a disposable dataset).
- **Isolation strategy:** load only into the **local dev D1** (wrangler `--local`), never a remote worker/DB; the loader refuses any non-local target. A separate D1 binding for observation would require a `wrangler.toml` change — out of scope for this phase, documented as an option.
- **Loading mechanism (next phase):** a single `node` script (TypeScript via Node 24, same pattern as `scripts/migrate.ts` `[VERIFIED]`) using `wrangler d1 execute --local` (DDL-free INSERTs), executing in the FK order of §4, writing a **journal file** (`{ run_id, inserted_ids: { table: [ids] }, anchor: T }`).
- **Cleanup mechanism (next phase):** journal-driven reverse-order delete + status check, or full snapshot restore (§ above).
- **Safety guards (design, not implemented):**
  1. Env gate: loader requires `OBS_DATASET_ALLOW=1`; refuses otherwise.
  2. Marker discipline: every inserted entity name starts with `OBS:` (grep-verifiable); tenant emails end `@example.com` with `obs.` prefix.
  3. Sentinel: loader sets `settings['obs_dataset_loaded'] = run_id` (existing table — no schema change) and refuses to re-run when set; reset clears it.
  4. Target guard: DB path must match the known local miniflare D1 prefix; any remote binding id aborts.
  5. Status normalization check: loader recomputes expected totals (§5) against the loaded DB and aborts on mismatch.

---

## 8. Database safety review (against current schema + demo fixture)

1. **Safest insertion boundary:** after migrations + `ensureSeeded()` (settings only, `[VERIFIED]` app.ts line 220) and after the pre-separation Austin sample rows, in a **disposable clone** of the local D1. The seed (`applyDemoFixture`-style rows, now tests-only `[VERIFIED] demo-fixture.ts`) is never part of the observation dataset and is never modified.
2. **Coordinated inserts:** (a) lease + its per-period charges (unique `(lease_id, period)`); (b) charge + payments (arithmetic bound); (c) lease + unit occupancy write (active ⇒ occupied) or the POST-lease reconcile path; (d) application approved ↔ upcoming lease `desired_move_in` alignment; (e) WO completed ⇒ `completed_at` stamped; (f) audit actor/record ids bound to fixture PKs.
3. **FK/order dependencies:** §4 order; `work_orders`/`applications` tolerate null links from deletes (SET NULL); `tenants` never deleted in fixture (history). Deletion order for surgical reset is reverse-FK.
4. **Date dependencies:** every row timestamp explicit; charges due ≤ 28th (`clampDueDay`); `markOverdue` + dashboard use wall-clock `date('now')` — dataset is normalized at anchor, and **progress of wall-clock time will legitimately flip `partial`→`overdue`** for past-due balances (only E's future-due partial is stable) — acceptable for a disposable dataset; reset restores.
5. **Unique constraints:** `users.email`, `sessions.token_hash`, `rent_charges(lease_id, period)` — fixture is disjoint from seed (OBS names/emails) and internal periods are unique per lease.
6. **Fields that can create misleading commercial observations:**
   - `unit.market_rent` vs `lease.monthly_rent` divergence (occupied units must match — invariant 8).
   - Overpayment (`amount_paid > amount`): system still shows `paid`, no credit ledger — fixture avoids it; flag §11.
   - Manually `waived` charge that also has payments (keeps `amount_paid`): avoided for clarity.
   - `notes` free text: used for scenario tags (`OBS:<scenario>`) to keep the dataset self-documenting.
   - `sqft` carries m² in the Algerian context — noted in unit notes so exports are not misread.
   - `sessions` count is runtime-generated (24 rows exist today from prior browser QA) — not part of OBS.
7. **Seed behavior must remain untouched:** yes. The live dev DB's 3 Austin properties / 5 units / 3 vendors + settings (locale, currency, AUTH_ENABLED, due-day/late-fee defaults) stay exactly as found; OBS rows are name/email-disjoint; no settings rows are added or altered by the fixture (the settings *update* audit rows in scenario O document the *creation-time* normalization only and are written as audit history, not executed live).

---

## 9. Commercial observation questions

With this dataset loaded, the following can be observed operationally:

1. **Cash posture:** month_collected vs month_outstanding; overdue_total and count; the ratio of paid to distressed rent across the book (453k / 75k / 102k at anchor).
2. **Occupancy economics:** occupancy_rate 72 %, vacant + turnover units; the *manual* vacancy-loss calculation (unoccupied market rent).
3. **Lease risk:** upcoming_move_outs (≤30 d) and upcoming_expirations (≤60 d) reveal renewal/move-out planning surface.
4. **Maintenance cost visibility:** completed WO costs per property/vendor; open vs completed workload; urgent queue.
5. **Leasing funnel:** application status distribution and the approved→upcoming-lease handoff on O4.
6. **Ledger reconciliation:** multi-payment charges; per-charge payment lists; CSV export (`/api/export/rent-ledger?period=M0`) column correctness incl. `commune, wilaya` order.
7. **Role enforcement:** which endpoints 403 per role (audit/users/settings/reconcile admin+; user delete owner).
8. **Audit completeness:** which actions appear in `/api/audit` and which are missing (see §10).
9. **Localization:** FR/AR rendering, DZD formatting, RTL (ar) — via the existing browser QA harness.

## 10. Known blind spots (invisible even with this dataset)

1. **No tenant screening scores** — applications are manual records only (README: "placeholder application records only").
2. **No proration** — charges are always full `monthly_rent`; first/last-month fractions are unmodelable; OBS uses whole months only.
3. **No late-fee automation** — `late_fee` is a field; nothing charges it (blind even in distress scenarios).
4. **No credits/deposits ledger** — deposits are numeric on the lease; no refund/forfeit workflow; overpayment has no credit balance.
5. **No P&L / expenses** — only WO `cost`; no rent-roll income statement, no owner distributions.
6. **No vacancy marketing/pipeline** — B1 stays vacant with no funnel beyond manual applications.
7. **No renewals** — a lease is created fresh; no renewal action or negotiation history.
8. **`lease_tenants` occupants invisible** — occupancy beyond `primary_tenant_id` is schema-only (no UI/API); OBS deliberately has 0 rows (a phantom occupant would mislead).
9. **`turnover`/`unavailable` fall between occupied and vacant** in dashboard counts — an operational nuance the dataset exposes, not solves.
10. **No payment gateway / failed payments / chargebacks** — methods are tags only.
11. **Audit gaps:** property/unit/tenant/vendor **creates and updates** and WO/app/user **creates and updates** are not audited (`[VERIFIED]` writeAudit call sites: create/update only for lease, rent_charge, payment, settings, user-delete, entity deletes). The OBS audit rows reflect this asymmetry on purpose.
12. **Session lifecycle** — 7-day TTL sessions; observation beyond a week needs re-login.

These capabilities become visible only inside the Commercial Layer and are out of scope by rule.

## 11. Injection preconditions (next phase)

1. **Backup first:** snapshot the local D1 file set (§7); restore is the reset.
2. **Stack:** dev stack up (Vite :5173, wrangler :8787), `AUTH_ENABLED=true` (role gates need it).
3. **Local-only, flagged:** `OBS_DATASET_ALLOW=1` + local-path check + sentinel idempotence guard.
4. **Sequential execution** (this machine: ~0.5 GB RAM free at baseline — tests/builds/QA must not run concurrently with load).
5. **FK-order inserts with explicit timestamps and journaling** (§4, §5, §7).
6. **Statuses pre-normalized at anchor;** verify no immediate `markOverdue` rewrites after first read.
7. **Verification assertions against API:** dashboard summary equals §3.1 P table exactly; `leases?status=upcoming/ended/cancelled` counts 2/3/1; `rent-charges?status=overdue` count 3; `/api/audit?entity=rent_charge` filter works; CSV export for M0 header order `commune, wilaya`.
8. **Runtime edge tests (observation notes, not stored data):** overlapping active lease → 409; admin/owner-only endpoints → 403/200 matrix; RTL ar rendering smoke test.
9. **Revert pathway documented and rehearsed** (snapshot restore) before load.
10. **Do NOT** change `wrangler.toml`, `schema.sql`, `migrations/`, `src/**`, or `package.json`; no migrations; no seed changes.

## 12. Gate — next phase (actual injection)

## **GO-WITH-PRECONDITIONS**

The dataset design is consistent with the validated schema, behavior, and dashboard math (`[VERIFIED]` at every cited rule). Injection may proceed **only with** §11 preconditions satisfied, foremost: full backup first, `OBS_DATASET_ALLOW=1` gate, local-D1-only target, sequential execution, and post-load dashboard-assertion verification. **NO-GO** conditions: any deviation from §11, any schema/migration/source change to support loading, or any run against a remote binding.

---

## 13. Unexpected findings only

1. `lease_tenants` has **no API write path** — schema supports occupants, product ignores them; OBS includes 0 rows (invisible-occupant trap avoided).
2. `markOverdue` mutates **on read** (GET /rent-charges, dashboard, generate, CSV export) — statuses are not stable attributes; the fixture's O2 `partial` row is the only non-terminal status that stays put (future due date).
3. Deletes cascade a long chain (property → units → leases → charges → payments) — the surgical reset must handle work_orders/applications SET NULL orphans explicitly; the snapshot restore avoids all of it.
4. Dashboard `month_*` tiles are **current-calendar-month only**, while `overdue_*` is all-time — the split is easy to misread when designing multi-month fixtures (addressed via M0-anchored construction).
5. Audit is intentionally asymmetric (creates/updates of core entities mostly silent; deletes + lease/charge/payment/settings serialized) — mirror-reality fixture must not pretend to a fuller log.
6. Baseline live DB carries a **pre-separation Austin sample** (3 properties/5 units/3 vendors) alongside settings — OBS must coexist disjointly; the environment baseline report already flagged `settings.locale=ar` residue there, unrelated to this design.