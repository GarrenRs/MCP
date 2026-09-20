# 10 — Evolution Guidance (scope, safe changes, effort)

Objective: preserve the working core and guide it safely toward a localized commercial version,
**without redesigning or expanding the product beyond what V1 needs.** All recommendations here
are advisory; nothing is implemented by the audit.

## B. Core functionality to preserve (never break)

1. **Idempotent charge generation** — the `(lease_id, period)` unique guarantee and `ON CONFLICT
   DO NOTHING` behavior.
2. **Payment → charge reconciliation** — auto `amount_paid` / status recompute on add/remove.
3. **Schema-as-DDL + app-level seeding** model (`CREATE IF NOT EXISTS` + hidden COUNT guards).
4. **JOIN-rich read payloads** the screens depend on (unit/property, lease/tenant, charge joins).
5. **Relational cascade semantics** (property → … → payments) with FKs enforced.
6. **Settings defaults merge** (route never returns an empty settings object).
7. **The dual-mode shell** (standalone rail + Clawnify-embedded nav) and pushState routing.
8. **Strict zod validation on every write** and `@clawnify/db` scalar-binding guardrails.
9. **The design-token system** (status/category/brand/edge tokens; light+dark).
10. **Seed resilience** — never resurrect deleted demo rows.

## C. Missing / incomplete functionality (from audit)

| Area | Gap |
|---|---|
| Applications | Complete backend CRUD, zero UI/client support |
| Charge administration | No UI to edit amount/due_date/status (`waived`); API-only |
| Work orders | `completed_at` never settable from UI; no completion stamp |
| Lease lifecycle | No auto `active→ended`; no move-out/un-occupy; no overlap guard |
| Occupancy integrity | Unit status not reconciled with leases on end/cancel |
| Overdue freshness | Only re-marked during charge generation |
| Tenants | Server `?q=` search unused; LIMIT 500 un-paginated; no tenant→lease shortcut |
| Multi-occupant leases | `lease_tenants` table dead (no API/UI) |
| Delete copy | Tenant/vendor confirm text misdescribes what is kept |
| Data export | None (CSV/JSON/statements) |
| Audit trail | None (hard deletes, overwrites) |
| Settings | No locale; free-text currency; state is US-shaped address only |
| Demo data | No toggle; tenant/lease/rent modules boot empty |

## D. Localization requirements (summary — details in 08)

- i18n catalog + library, product locale setting separated from currency.
- Explicit locale across date/money formatters.
- Server error **codes** instead of English strings.
- Currency validation / select.
- Country-aware regions (schema-additive).
- RTL pass (logical properties) if a target market needs it.

## E. Recommended V1 commercial scope (preserve-first)

Proposed V1 cut — additive, low-risk, no core rewrite:

1. **Auth + single-tenant multi-user roles** (owner / admin / manager) with session tokens —
   the single biggest commercial blocker (R1). Keep the same data model; add a `users` table and
   protect `/api/*`.
2. **Applications UI** (surface existing backend; screening statuses only as stored).
3. **Charge administration UI** (edit amount/due date, waive, from the rent page).
4. **Work-order completion** — add `completed_at` to the dialog and stamp on `completed`.
5. **Lease lifecycle hardening** — overlap guard at write time; auto un-occupy on
   end/cancel; a "recompute unit statuses" path; overdue mark at read/dashboard time.
6. **Data export** (period ledger CSV + portfolio summary) — read-only, safe.
7. **Localization Tier 1–2** (catalog, locale setting, explicit formatters, currency select).
8. **Migration discipline** — introduce `schema_migrations` (or drizzle-kit) before any schema
   churn; keep `schema.sql` additive-compatible.
9. **Financial-core tests** (R2) as a gated CI step alongside `pnpm typecheck`.
10. **Ops fixes**: free C: disk (R4); optional font self-hosting.

## F. Features explicitly NOT to add yet

- Online card / ACH / bank payment processing.
- Two-way SMS or email blasts / automated notices.
- Public tenant or owner portals (authenticated self-service).
- Listing syndication / vacancy marketing integrations.
- Credit & background screening integrations.
- Multi-company SaaS tenancy (organizations/workspaces) before single-tenant commercial V1 is
  stable.
- Reporting dashboards/charts beyond export (defer analytics to post-V1).
- Real-time sync/websockets or offline PWA.
- Migration to Drizzle ORM for the whole data layer (keep raw SQL; adopt migrations only).

## G. Technical effort by module (relative)

| Module | Current difficulty | V1 commercial delta | Notes |
|---|---|---|---|
| M1 Shell/routing | LOW | LOW | auth-aware nav, route guards |
| M2 Design system | LOW | LOW | i18n-aware formatters in lib/utils |
| M3 Dashboard | LOW | LOW | currency/locale wiring, overdue freshness |
| M4 Properties & Units | LOW | LOW | optional country/region field |
| M5 Tenants | LOW | LOW | server search + pagination; tenant→lease CTA |
| M6 Leases | MEDIUM | MEDIUM | overlap guard + move-out side effects |
| M7 Rent & payments | MEDIUM | MEDIUM | charge-admin UI; export; tests |
| M8 Work orders | LOW | LOW | completed_at UI, completion stamp |
| M9 Vendors & policy | LOW | LOW | currency select + locale setting |
| M10 Applications UI | LOW | LOW | surface existing endpoints |
| M11 Server platform | MEDIUM | MEDIUM | auth middleware, error codes, migrations |
| M12 Seeding | LOW | LOW | demo toggle (env flag) |
| M13 Exports/reports | MEDIUM | MEDIUM | CSV statements |

## Safe-change rules (guard rails) `[RECOMMENDATION]`

- **Additive schema only**: new tables/columns/indexes with `IF NOT EXISTS`; never `ALTER` or
  `DROP` in `schema.sql`. Pair with a migration ledger.
- Keep `ensureSeeded` COUNT-guarded and idempotent.
- Never change HTTP contracts without keeping the old shape for one release (client and server
  share the repo, so coordinate both sides).
- Do not remove zod schemas or the `@clawnify/db` scalar guard.
- Preserve the demo-data resilience: new seeds must be opt-in.
- Run `pnpm typecheck` and the (new) financial tests before every merge.