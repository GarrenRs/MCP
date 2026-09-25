# Role & Operational Responsibility Mapping — Owner / Admin / Manager

**Date:** 2026-09-25
**Scope:** Analysis + governance only. **No source, database, schema, migration, API, permission, UI, dataset, seed, or auth-logic changes.** No roles added or removed. Read-only verification of the running app and local D1 (Commercial Observation Dataset, `AUTH_ENABLED=true`).
**Evidence levels used throughout:** `[VERIFIED]` = observed in current code/tests/live data; `[INFERENCE]` = logical interpretation of verified behavior; `[UNKNOWN]` = not determinable from the current system.

---

## 1. Executive Summary

The current system implements a **cumulative three-level role hierarchy** — `manager` < `admin` < `owner` (`ROLE_HIERARCHY`, `src/server/auth.ts:154-165`, enforced via `hasMinimumRole`) — but applies it to only **four guarded surfaces (seven handlers)**: settings writes, occupancy reconciliation, user management, and audit read. Every operational resource (properties, units, tenants, leases, rent charges, payments, vendors, work orders, applications, dashboard, CSV exports) is **session-gated only**: any authenticated user of any role has identical read/create/update/delete power, including money operations and deletions. The model is therefore really a **two-layer structure** — an operational layer shared by all three roles, and an administrative layer shared by owner+admin with a narrow owner-only user-lifecycle sovereignty — rather than a three-tier operational separation. Judged against a realistic single-organization property business, the topology is **COHERENT WITH GAPS**: understandable and operable, but with significant overlapping authority in money/delete/export operations, one UI/backend mismatch (the policy form), and role semantics ("manager", "settings") that are broader than their names suggest.

## 2. Current Role Implementation

`[VERIFIED]` — `src/server/auth.ts`, `src/server/app.ts`, `tests/auth.test.ts`, `Docs/execution/P5/p5-auth-single-tenant-roles.md`.

- **Session model:** PBKDF2-SHA256 hashing (100 000 iterations); D1-backed sessions with SHA-256 hashed tokens; 7-day TTL; `HttpOnly`, `SameSite=Strict`, `Secure` cookies (via `X-Forwarded-Proto`).
- **Middleware (`app.ts:90-121`):** public allowlist = `/api/health`, `/api/auth/login|logout|session|bootstrap|status`. When `AUTH_ENABLED=true`: every other `/api/*` route requires a valid session (401 otherwise); no role filtering at the middleware. When `AUTH_ENABLED=false`: enforcement is skipped (operational routes reopen), the session is still resolved if a cookie is present.
- **Role gate points (complete inventory — every handler that reads the session user):**

| Endpoint | Gate | Note |
|---|---|---|
| `PUT /api/settings` | `authEnabled && !admin+` → 403 | `app.ts:1320` |
| `POST /api/admin/reconcile-occupancy` | `admin+` → 403 (always enforced) | `app.ts:1357` |
| `GET /api/users` | `admin+` → 403 (always enforced) | `app.ts:1367` |
| `POST /api/users` | `admin+`; **owner only** may pass `role=owner` | `app.ts:1386-1395` |
| `PUT /api/users/:id` | `admin+`; **owner only** may modify an owner account or assign `role=owner`; role change revokes the target's sessions | `app.ts:1418-1444` |
| `DELETE /api/users/:id` | **owner only**; cannot delete self; audited | `app.ts:1452-1464` |
| `GET /api/audit` | `admin+` → 403 | `app.ts:1472` |

- **Operational CRUD** (properties, units, tenants, leases, rent-charges + generate, payments, vendors, work-orders, applications), **dashboard**, **settings GET**, and **CSV exports** (rent-ledger, tenants, properties): **no handler-level role check** — any valid session role has identical access. `[VERIFIED]` via absence of `c.get("user")` role checks in those handlers.
- **Delivered != plan:** the plan (`Docs/plans/13-v1-implementation-plan.md:109`) said "deletions admin+"; the delivered implementation and its tests tightened user deletion to **owner only** (`P5 doc`, `tests/auth.test.ts` "DELETE /api/users/:id deletes a user (owner only)"). `[VERIFIED]`
- **Bootstrapping:** `POST /api/auth/bootstrap` creates the **first user as `owner`** atomically (`INSERT … WHERE NOT EXISTS`), auto-login; 409 once users exist. `[VERIFIED]` (`app.ts:175-199`)

## 3. Role Permission Matrix

Per role — what it can read/create/update/delete, and at which layer each restriction lives (API-level = enforced in the handler regardless of UI; UI-level = enforced by hiding/disabled UI; unenforced = present in UI but only blocked server-side).

| Capability | Owner | Admin | Manager |
|---|---|---|---|
| All operational read (properties→applications, dashboard) | ✓ | ✓ | ✓ |
| All operational create/update (incl. charge generate, waive, payment record) | ✓ | ✓ | ✓ |
| All operational delete (property/unit/tenant/lease/charge/payment/vendor/work order/application) | ✓ | ✓ | ✓ |
| CSV exports (rent ledger is the full financial ledger) | ✓ | ✓ | ✓ |
| Read settings | ✓ | ✓ | ✓ |
| Write settings (policy: due day, late fee, grace, currency, locale) | ✓ | ✓ | **— (API 403)** |
| Reconcile occupancy | ✓ | ✓ | **— (API 403)** |
| List users / read user accounts | ✓ | ✓ | **— (API 403, tab hidden)** |
| Create users (non-owner) | ✓ | ✓ | **—** |
| Create/assign `owner` role | **✓ owner only** | — | — |
| Modify owner accounts | **✓ owner only** | — | — |
| Delete users | **✓ owner only** (not self) | — | — |
| Read audit log | ✓ | ✓ | **— (API 403, tab hidden)** |
| Login / logout / session / status | public, any role | public | public |
| Bootstrap (first owner) | public while zero users | — | — |
| UI: Settings nav item | visible | visible | **visible** (vendors are operational) |
| UI: Users + Audit tabs | visible | visible | **hidden** |
| UI: Policy tab form | editable | editable | **editable but save → 403** (unenforced in UI) |

Layer key: everything above the "API-level" split is enforced at both layers where the tab is hidden; the single **unenforced** item is the manager's Policy form (visible+editable, server 403 on save).

## 4. Owner Responsibility Map

- **Responsibility** `[INFERENCE]`: business principal — owns the organization identity, the account roster, and ultimate accountability for money and policy.
- **Authority** `[VERIFIED]`: everything Admin and Manager can do (see §3), **plus** the only owner-exclusive powers in the system: delete any user (self excepted), create `owner` accounts, modify `owner` accounts, and assign the `owner` role.
- **Visibility** `[VERIFIED]`: all operational data, settings, users, audit — complete.
- **Accountability** `[VERIFIED]`: user deletions are audited with actor identity; settings updates are audited; all audited money/delete actions attribute the actor. Owner actions that are *not* audited: operational creates/updates (same as everyone, §11).
- **Sensitivity** `[INFERENCE]`: owner-monopoly on the user roster (delete/create-owner/assign-owner) is the highest-impact exclusive surface; an owner can silently revoke other owners (delete owner accounts) — the system has no last-owner protection beyond self-delete being blocked. `[VERIFIED]` no other owner guard exists.

## 5. Admin Responsibility Map

- **Responsibility** `[INFERENCE]`: administrative operator — the user who runs the day-to-day administration: account roster (create/edit non-owner users), policy, occupancy integrity, audit review.
- **Authority** `[VERIFIED]`: users list/create/update (non-owner targets and non-owner role assignments only), settings write, reconcile-occupancy, audit read — plus **full operational CRUD identical to Manager** (§3).
- **Visibility** `[VERIFIED]`: same as Owner except user-role nuance (cannot see/modify owner accounts — `GET /api/users` returns all users including owners, so visibility is full; only *modification* of owners is blocked. Distinction: read-all, mutate-non-owners).
- **Accountability** `[VERIFIED]`: admin user mutations are limited to creating and updating **non-owner** accounts (user deletion is owner-only, so admins never delete users). Neither admin user create nor update is recorded by `writeAudit` — the log records only user *delete* (`app.ts:1463`), an action only owners can trigger (see §11). Settings updates by admin are audited.
- **Sensitivity** `[INFERENCE]`: admin is the highest-privilege **non-sovereign** role: can change financial policy (late fees, currency, due day) and can re-role/demote managers and admins, but cannot touch owners.

## 6. Manager Responsibility Map

- **Responsibility** `[INFERENCE]`: operational staff — property, tenant, lease, rent, maintenance, and application operations.
- **Authority** `[VERIFIED]`: **full operational CRUD on every operational resource**, including money: create/generate/waive/edit/delete rent charges, record payments, delete payments, edit leases, delete any operational record; dashboard; settings read; all CSV exports.
- **Visibility** `[VERIFIED]`: all operational data and the full rent ledger (via UI and CSV). Hidden at API+UI: users, audit, settings write, reconcile.
- **Accountability** `[VERIFIED]`: manager money/delete actions are audited (create lease/payment, generate charge, charge/lease updates, any delete); manager operational creates/updates of property/unit/tenant/vendor/work order/application are **not** audited.
- **Sensitivity** `[INFERENCE]`: manager's boundary is purely administrative — nothing in the operational/financial plane is blocked. Delete + money + financial-export power is broad for a "manager" label.

## 7. Owner vs Admin Distinction

`[VERIFIED]` — the distinction is **explicit in code but narrow**, and it is the *only* owner-exclusive surface:

1. `DELETE /api/users/:id` — owner only (`caller.role !== "owner"` → 403).
2. `POST /api/users` with `role="owner"` — owner only.
3. `PUT /api/users/:id` on an owner target — owner only ("Cannot modify owner account").
4. `PUT /api/users/:id` assigning `role="owner"` — owner only.

For every other operation — settings, reconcile, audit, all operational CRUD, exports — Owner and Admin are **functionally identical**; the hierarchy value `owner:2` only *derives* these four privileges. Owner is therefore a **higher RBAC level with user-roster sovereignty, not an oversight identity**: the owner account remains a full operator (it can record payments, edit leases, delete charges, and do everything a manager does), with no differentiated oversight mode. `[INFERENCE]` Would a real organization understand the distinction from the UI? Partially: the Users tab delete/owner-role affordances appear only for owner accounts (`tests` + `users-tab.tsx:132,179`), and the audit/users tabs are shared with admin — nothing in the shell communicates "this account is the owner." The distinction is code-enforced, UI-indicated only marginally. `[VERIFIED]/[INFERENCE]`

**No overlooked owner-only surface exists** (complete `c.get("user")` inventory, §2).

## 8. Manager Operational Boundary

`[VERIFIED]` — Manager is effectively a **full CRUD operator with a few protected administrative areas**, not a scoped operator:

- **Open to manager:** every operational resource with full C/R/U/D, money creation/recording/deletion, dashboard, settings read, exports.
- **Blocked:** users (any), settings write, reconcile-occupancy, audit read — all API-enforced, all except the policy form also UI-hidden.
- **No scoping:** there is no per-property, per-unit, per-domain, or per-portfolio restriction anywhere; every manager sees and mutates the entire portfolio. `[VERIFIED]` (no record-level filtering in any handler/query).
- **Boundary quality** `[INFERENCE]`: "manager" maps more accurately to a **staff operator / department lead with administrative blinders** than to a constrained manager. Its operational breadth (waive charges, delete leases/payments/properties, export the rent ledger) exceeds what the label implies.

## 9. Resource/Action Matrix

R = read, C = create, U = update, D = delete, G = generate, — = no access. Owner/Admin/Manager columns; per-resource actions kept explicit because they differ.

| Resource | Owner | Admin | Manager |
|---|---|---|---|
| Dashboard (summary) | R | R | R |
| Properties | R C U D | R C U D | R C U D |
| Units | R C U D | R C U D | R C U D |
| Tenants | R C U D | R C U D | R C U D |
| Leases | R C U D | R C U D | R C U D |
| Rent Charges | R C U D G | R C U D G | R C U D G |
| Payments | R C D (no U endpoint) | R C D | R C D |
| Vendors | R C U D | R C U D | R C U D |
| Work Orders | R C U D | R C U D | R C U D |
| Applications | R C U D | R C U D | R C U D |
| CSV Exports (rent ledger / tenants / properties) | R | R | R |
| Settings read | R | R | R |
| Settings write | U | U | — |
| Reconcile occupancy | U | U | — |
| Users list/create/edit | R C U (full) | R C U (no owner targets/role) | — |
| Users delete | D (not self) | — | — |
| Audit | R | R | — |
| Auth/session ops | public: login/logout/session/status (any role) | same | same |
| Bootstrap (first user) | public while 0 users → creates owner | — | — |

## 10. Operational Journeys

Grounding numbers from the injected dataset: 11 properties, 23 units, 16 tenants, 19 leases (13 active), 43 charges, 43 payments, 10 vendors, 10 work orders (5 open), 8 applications, 85 audit rows, 6 users. `[VERIFIED]`

**Journey A — Owner oversees the organization** (e.g., `obs.owner@example.com` "Dalia Merabet"):
- Objective: supervise portfolio health and govern the account roster.
- Records touched: dashboard summary (triggers `markOverdue` refresh), audit log, users, settings.
- Actions: review audit (admin+), set policy/currency/locale, create users (including a second owner), delete users, re-role anyone.
- Sensitive: deleting an owner account (no last-owner guard), assigning owner.
- Handoffs: delegates operations to admin/managers; retains roster sovereignty.
- Boundary: none that restrict the owner — the owner can also perform every Journey-C action.

**Journey B — Admin operates the administrative layer** (e.g., `obs.admin@example.com` "Yacine Haddad"):
- Objective: run administration without owner sovereignty.
- Records touched: users (non-owner), settings, audit, occupancy.
- Actions: create/edit admins and managers, force occupancy reconciliation, edit policy, review audit, plus full operational CRUD.
- Sensitive: policy changes (currency/late fee) affect money; manager/admins can be re-rolled by admin but never owners.
- Handoffs: escalates owner-restricted actions (owner create/delete, owner modifications) to the owner.
- Boundary: owner accounts are read-only to admin (API-enforced, no UI affordance).

**Journey C — Manager operates daily property operations** (e.g., `obs.finance@example.com` "Nadia Cherif", `obs.maintenance@example.com` "Sofiane Belkacem"):
- Objective: run rent collection and maintenance day-to-day.
- Records touched: charges, payments, leases, work orders, tenants, exports.
- Actions (all audited where applicable): record a payment (audited `create payment`), generate monthly charges (audited `generate rent_charge`), waive/edit a charge (audited `update rent_charge`), create/edit a lease (audited), create a work order (**not** audited), delete an incorrect payment (audited), export the rent ledger.
- Sensitive: payment recording/deletion, charge generation/waiving, financial export — identical to owner/admin.
- Boundaries hit: Settings→Save (403), Users/Audit tabs absent, reconcile absent.
- Accountability: money and delete actions attributable; routine operational creates (work orders, tenants, vendors, applications, properties, units) are not recorded anywhere.

## 11. Segregation of Duties

`[VERIFIED]` from the `writeAudit` inventory (`app.ts:268,348,430,521,632,693,710,794,823,879,895,937,957,1013,1119,1198,1344,1463`):

- **Where separation exists:** user management (admin+/owner-only delete), settings writes (admin+), audit read (admin+), reconcile (admin+) — the four guarded surfaces. Audit is **append-only** (no update/delete endpoint for `audit_logs`), so the log itself is tamper-resistant at the API level. `[VERIFIED]`
- **Where roles overlap (full):** every operational resource, including money — charge creation/generation/waiving and payment recording/deletion are available to all roles with no separation between "who creates the charge" and "who records/absolves payment". Operational deletions of any entity are available to all roles. The full financial rent-ledger export is available to all roles. `[VERIFIED]`
- **Broad-authority shape:** the only meaningful authority split is at the *administrative* plane; the *operational* plane is deliberately flat — a deliberate P5 design choice ("all roles read/write operations", plan §P5.4), but it means the model does **not** separate money stewardship from money recording, nor deletion from creation.
- **Where there is no separation at all:** operational create-vs-delete, charge-create vs payment-record, export access vs operative need, owner-as-operator (owner can record its own payments — no audit of owner-vs-operator money flow, no "approver" concept).

## 12. Dataset-Based Evidence

`[VERIFIED]` — local D1, Commercial Observation Dataset, read-only:

- **Users/roles:** 6 users — owner ×2 (`owner@example.com` bootstrap-era "Owner", id 1; `obs.owner@example.com` "Dalia Merabet", id 4), admin ×1 (`obs.admin@example.com` "Yacine Haddad", id 5), manager ×3 (`sara@gmail.com` "Sara", id 2; `obs.finance@example.com` "Nadia Cherif", id 6; `obs.maintenance@example.com` "Sofiane Belkacem", id 7). All three roles are exercised in the dataset.
- **Settings:** `AUTH_ENABLED=true` (live role enforcement), `locale=ar`, `currency=DZD`, due day 1, late fee 50, grace 5.
- **Operational volume:** 11/23/16/19(13 active)/43/43/10/10(5 open)/8 — properties/units/tenants/leases/charges/payments/vendors/work orders/applications; 4 open charges, DZD 102 000 overdue outstanding.
- **Audit trail (85 rows):** create lease 20, create payment 15, delete lease 1, delete property 1, generate rent_charge 3, update settings 45. **Actor roles:** owner 37, manager 34, admin 7, deleted users 7 — managers demonstrably executed audited money operations, and audit rows survive actor deletion (accountability preserved).
- **Operational fit:** a manager in this dataset can reach every daily item (open charges, overdue DZD 102 000, open work orders) and is blocked only at users/audit/settings-write/reconcile (verified by code + tests; the live session is admin, so no dataset mutation was performed to re-test manager 403s — covered by `tests/auth.test.ts`: "manager cannot list users", "manager cannot create users", owner-only delete, admin-cannot-modify-owner). `[VERIFIED]/[INFERENCE]`

## 13. Semantic Gaps

- **"manager"** — `[VERIFIED]` behavior: full CRUD operator (money, delete, export). `[INFERENCE]` semantics: could mean day-to-day operations manager; in many orgs a "manager" is not expected to waive charges or export the financial ledger. Ambiguous.
- **"settings" under the "admin" eyebrow** — `[VERIFIED]` nav is static and Settings is visible to all roles, because it hosts operational vendor management; `[INFERENCE]` the group label overstates what is actually admin-gated within the page.
- **"owner"** — `[VERIFIED]` a role level (2) with roster sovereignty; `[INFERENCE]` a real owner identity is an oversight/principal role; the current owner is also a full operator. The name implies ownership identity; behavior implies "super-admin."
- **"admin"** — `[VERIFIED]` behavior: administrator that may not touch owners; `[INFERENCE]` label is consistent with behavior.
- **Not represented:** `[VERIFIED]` no concept of approver, accountant, bookkeeper, leasing agent, or property-level manager; no per-domain manager scoping despite the dataset modeling "finance" and "maintenance" managers; no record-level ownership; no separation between operational and financial roles. `[UNKNOWN]` whether the future Commercial Layer intends these.

## 14. Gap Classification

- **A. Security gap:** `[VERIFIED]` read-only endpoints trigger writes — `GET /api/dashboard/summary` and `GET /api/export/rent-ledger` both call `markOverdue()` (`app.ts:1210,1547`); any role can force state refresh via a read. `[VERIFIED]` `PUT /api/settings` gate is inside `if (authEnabled …)` (`app.ts:1320`) — when `AUTH_ENABLED=false`, settings writes reopen to anonymous callers while users/audit/reconcile remain always-gated (asymmetry in the rollback mode). `[INFERENCE]` no separation between charge creation and payment recording enables single-actor money manipulation; full financial export to any session role widens data exposure.
- **B. Responsibility gap:** `[VERIFIED]` manager responsibilities are fully satisfied by current permissions (no operational blocker encountered); `[INFERENCE]` none of the three roles lacks access needed for its stated operational work — the gaps are breadth, not absence.
- **C. Semantic gap:** `[VERIFIED]` "manager" authority exceeds its label; "settings" is broader than admin-only; `[INFERENCE]` "owner" behaves as super-admin rather than principal.
- **D. UI visibility gap:** `[VERIFIED]` the Policy tab (due day, late fee, grace, currency, locale) renders as an editable form with an active Save button for **all** roles, but a manager's save returns 403 server-side and surfaces only as an error toast — the restriction is not communicated by the UI (no disabled state, no lock hint). Users/Audit tabs, by contrast, are correctly hidden. `[VERIFIED]` no self-role indicator exists in the app shell (name/email only), so a manager has no in-shell cue of which capabilities they hold.
- **E. Commercial modeling gap:** `[VERIFIED]` the dataset org (owner + admin + finance manager + maintenance manager + legacy owner) implies domain division that the permission model cannot express — all managers are identical full-CRUD operators; `[INFERENCE]` for a growing single-org property business the current trio supports "principal + administrator + generalist staff," not differentiated operations.

## 15. Unknowns

- `[UNKNOWN]` Whether the future Commercial Layer re-scopes operational permissions (e.g., manager-domain, per-property, financial vs operational separation) — the current code has **no hooks** (no permission table, no route-level permission map beyond the five gates). `[UNKNOWN]` Intended semantics of "manager" beyond P5's minimal description. `[UNKNOWN]` Dataset logins for manager fixtures (passwords not relevant to API authorization, which is covered by tests). `[UNKNOWN]` Whether `AUTH_ENABLED=false` remains an intended support mode and whether the settings-PUT asymmetry is deliberate. `[UNKNOWN]` The exact origin of the "deleted" actors' 7 audit rows and the 45 settings-wave updates (seed/setup-time writes; no impact on the role model). `[UNKNOWN]` Whether owner accounts are ever intended to be denied operational mutations (no such flag exists).

## 16. Conclusions

1. **The hierarchy is cumulative and understandable**: owner ⊇ admin ⊇ manager in reach; every guard is explicit and code-enforced; UI mirrors the guards for users/audit. `[VERIFIED]`
2. **The operational plane is flat**: all roles share identical operational CRUD including money and deletions. This is the single largest structural fact and the source of most observations. `[VERIFIED]`
3. **Owner ≠ Admin today, but only at the user roster**: four owner-exclusive privileges (delete users; create/modify owners; assign owner). Everything else is identical. `[VERIFIED]`
4. **Manager is bounded only at the administrative plane**: users/audit/settings-write/reconcile are blocked (API + mostly UI); operationally the manager is a full CRUD operator with financial powers. `[VERIFIED]`
5. **Accountability is partial**: money and delete actions and settings/lease/charge updates are attributed; routine operational creates (work orders, tenants, vendors, properties, units, applications) leave no audit trace. `[VERIFIED]`
6. **One UI/backend mismatch**: the editable Policy form for managers (403 only on save). `[VERIFIED]`
7. **No invented distinctions**: any owner/admin difference stated here traces to explicit `caller.role === "owner"` branches or the hierarchy helper. `[VERIFIED]`

### CURRENT ROLE MODEL STATUS: **COHERENT WITH GAPS**

1. **Can the current three roles support a realistic single-organization property-management workflow?** Yes — end-to-end. Owner governs the roster and policy, admin runs administration, managers run daily operations; the dataset contains working accounts in all three roles; every operational journey is completable. `[VERIFIED]`
2. **Is Owner meaningfully different from Admin today?** Only narrowly — user-roster sovereignty (delete users; create/modify owner accounts; assign owner role). For every operational and most administrative actions Owner and Admin are identical. The distinction is explicit in code, marginally visible in UI. `[VERIFIED]`
3. **Is Manager meaningfully bounded today?** Bounded at the administrative layer (users, audit, settings write, reconcile — API-enforced, Users/Audit tabs hidden); **not** bounded operationally (full CRUD, money, delete, financial export). `[VERIFIED]`
4. **Which permission boundaries are clear?** User management (admin+ / owner-only delete), audit read (admin+), settings write (admin+), occupancy reconciliation (admin+), and the general session wall (any role for operations). `[VERIFIED]`
5. **Which boundaries remain ambiguous?** The manager's exact role (name vs authority breadth); the Settings page's mixed operational/admin content under an "admin" eyebrow; the emit-vs-record money flow (no separation); the owner's operator-vs-principal identity; the Policy-tab UI affordance for managers. `[VERIFIED]/[INFERENCE]`
6. **What should NOT be changed before Commercial Layer design?** (a) Do not split or narrow the shared operational CRUD — any change to money/delete/export reach is a Commercial-Layer permission decision, not a patch; (b) do not add per-manager domain or record-level scoping before the Commercial permission model exists (no scaffolding exists); (c) do not rework the audit coverage set before the Commercial actor model pins who/what is attributable (P12 dependency per P5 doc); (d) do not alter bootstrap/owner-first semantics while the dataset and rollback path (`AUTH_ENABLED`) are load-bearing guarantees. `[INFERENCE]`

## 17. Recommendations for a FUTURE PHASE only

Separated from verified behavior above — **not implemented.**

1. Define a declarative resource-action-role permission map in the Commercial Layer (replace the scattered five gates with one table), keeping the current five gates' behavior as the baseline truth.
2. Decide the owner role's commercial shape: either keep full-operator owner and document it, or introduce an oversight (view-led) mode for owners; do not remove current owner-only roster powers without a replacement governance model.
3. Close the D-gap now or later with the Commercial design: disable the Policy form for non-admin/managers (or hide Save) so the UI matches the enforced 403.
4. Consider separating charge-creation from payment-recording duties and adding an approval concept for waives/deletes — only once the Commercial money-flow model is agreed.
5. Extend audit coverage to all operational creates/updates (work orders, tenants, vendors, properties, units, applications) if accountability parity is desired.
6. Gate or side-effect-free the `markOverdue()` calls on read endpoints (move to a scheduled/actioned refresh) as part of the Commercial security hardening.
7. If the org pattern in the dataset (finance/maintenance managers) is real, model manager domains explicitly in the permission map.
8. Keep `AUTH_ENABLED`-mode asymmetry documented; decide whether settings writes should stay open in the disabled regime.

---

### Verification performed (read-only)

- Source inventory: `src/server/auth.ts`, `src/server/app.ts` (complete `c.get("user")` / `hasMinimumRole` sweep), `src/server/index.ts`, `tests/auth.test.ts`, P5 execution doc, plan §P5, settings/users/audit/vendors client components.
- Live API behavior: session model and 401/403 paths evidenced by code + tests; the running app was observed (admin session), no session mutation performed.
- Dataset: read-only D1 queries (role counts, operational counts, audit breakdown by action/entity and by actor role, settings). No record created/modified/deleted.

### Evidence queries (read-only) — dataset numbers

Executed against local D1 (`open-property-db`, Commercial Observation Dataset) with `wrangler d1 execute --local`; no data changed. Results reproduced in §12 and §10.

```sql
-- Users / roles
SELECT id, email, display_name, role, created_at FROM users ORDER BY id;
SELECT role, COUNT(*) AS users FROM users GROUP BY role ORDER BY role;

-- Operational + audit + support counts (scalar subqueries)
SELECT (SELECT COUNT(*) FROM properties) props, (SELECT COUNT(*) FROM units) units,
       (SELECT COUNT(*) FROM tenants) tenants, (SELECT COUNT(*) FROM leases) leases,
       (SELECT COUNT(*) FROM rent_charges) rent_charges, (SELECT COUNT(*) FROM payments) payments,
       (SELECT COUNT(*) FROM vendors) vendors, (SELECT COUNT(*) FROM work_orders) work_orders,
       (SELECT COUNT(*) FROM applications) applications, (SELECT COUNT(*) FROM audit_logs) audit_logs,
       (SELECT COUNT(*) FROM sessions) sessions, (SELECT COUNT(*) FROM settings) settings_rows;

-- Audit trail by action/entity and by actor role
SELECT action, entity, COUNT(*) AS n FROM audit_logs GROUP BY action, entity ORDER BY action, entity;
SELECT COALESCE(u.role, '(deleted)') AS actor_role, COUNT(*) AS n
  FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
 GROUP BY u.role ORDER BY n DESC;

-- Settings
SELECT key, value FROM settings ORDER BY key;

-- Journey grounding (open charges, overdue, open work orders, pending apps, active leases)
SELECT (SELECT COUNT(*) FROM rent_charges WHERE status NOT IN ('paid','waived')) AS open_charges,
       (SELECT COALESCE(SUM(amount - amount_paid),0) FROM rent_charges
         WHERE due_date < date('now') AND amount_paid < amount AND status != 'waived') AS overdue_total,
       (SELECT COUNT(*) FROM work_orders WHERE status NOT IN ('completed','cancelled')) AS open_wo,
       (SELECT COUNT(*) FROM applications WHERE status = 'pending') AS pending_apps,
       (SELECT COUNT(*) FROM leases WHERE status = 'active') AS active_leases;
```

### Commit hygiene

Documentation-only, exactly one commit, no amend, no push; only the new governance report staged; inherited working-tree exceptions untouched.