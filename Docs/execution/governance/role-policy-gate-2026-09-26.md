# Role Policy Gate — Validate the Intended Commercial Permission Model

**Date:** 2026-09-26
**Prerequisite:** `Docs/execution/governance/role-operational-responsibility-mapping-2026-09-25.md` (role/responsibility mapping, commit `e323fe3`) — this report classifies *policy intent* on top of that verified inventory.
**Scope:** Governance/policy analysis ONLY. No changes to source, migrations, schema, API contracts, authentication logic, role enforcement, UI authorization behavior, database, dataset, or seed logic. No roles added/removed. No RBAC redesign. No recommendations implemented.
**Evidence tags:** `[VERIFIED]` = observed in current code/tests/live data · `[INFERENCE]` = logical interpretation of verified behavior · `[POLICY DECISION REQUIRED]` = a product/ownership decision, not a fact · `[UNKNOWN]` = not determinable from the current system.

---

## 1. Executive Summary

The V1 permission model is a **deliberate but deliberately minimal** P5 construct: a cumulative hierarchy (`manager` < `admin` < `owner`, `auth.ts:154-158`) whose guards reach only four surfaces — settings write, occupancy reconciliation, user management (owner-only sub-rules), and audit read (`app.ts:1320,1357,1368,1386,1418,1453,1472`). Everything operational — properties, units, tenants, leases, rent charges (create/generate/waive/edit/delete), payments (record/delete), vendors, work orders, applications, dashboard, and CSV exports — is **session-only and flat across all roles**. `[VERIFIED]`

Classification outcome: the **hierarchy mechanism, the administrative boundary, and owner's user-roster sovereignty are INTENTIONAL** (they match plan `13-v1-implementation-plan.md` §P5 and the delivered P5 log). The **flat operational plane — including money changes, operational deletes, and financial CSV export for manager — is TEMPORARY**: it is the P5 "all roles read/write operations" expedient, with no commercial policy behind it, and it is the primary candidate for **COMMERCIAL REALIGNMENT** once the product owner answers the §11 decisions. The owner/admin operational identity is TEMPORARY (functionally identical by inheritance, distinguished only at the user roster). A set of implementation-level issues (`markOverdue()` read-endpoint writes, Policy-tab UI vs 403, `AUTH_ENABLED=false` asymmetry) are classified mostly **SECURITY IMPLEMENTATION / DEPLOYMENT**, not role policy.

**ROLE POLICY STATUS: READY WITH POLICY DECISIONS** — the permission model is fully verified and documented, and it is sufficiently defined to *enter* Commercial Layer design, **provided** the product owner resolves the §11 decisions (manager's money/delete/export reach, owner's operator-vs-principal identity, audit/export visibility, SoD expectations). If those answers are not available before design, the status is NOT READY.

---

## 2. Current Permission Reality

Re-verified against `src/server/auth.ts`, `src/server/app.ts`, `tests/auth.test.ts`, the P5 log (`Docs/execution/P5/p5-auth-single-tenant-roles.md`), plan §P5 (`Docs/plans/13-v1-implementation-plan.md:98-117`), and the local Commercial Observation Dataset. `[VERIFIED]`

### 2.1 Enforcement layers

- **Middleware** (`app.ts:90-121`): public allowlist = `/api/health`, `/api/auth/login|logout|session|bootstrap|status`. `AUTH_ENABLED=true` → every other `/api/*` requires a session (401). `AUTH_ENABLED=false` → no enforcement (session still resolved if a cookie exists; operational routes reopen). No role filtering at the middleware.
- **Seven role-gated handlers** (complete inventory of every handler that reads the session user for authorization): `PUT /api/settings`, `POST /api/admin/reconcile-occupancy`, `GET/POST/PUT/DELETE /api/users...`, `GET /api/audit`. All other handlers are session-only.
- **UI**: nav is static for all roles; Settings page is visible to all; Users/Audit tabs render only for owner/admin (`settings-page.tsx:55-60`); Vendors and Policy tabs render for all roles (`settings-page.tsx:51-68`); Policy form Save is not disabled for manager though the API answers 403.

### 2.2 Exact action matrix

R=read · C=create · U=update · D=delete · G=generate · — = no access. Owner/Admin/Manager per resource, actions kept explicit where they differ.

| Resource | Owner | Admin | Manager | Enforcement layer |
|---|---|---|---|---|
| Dashboard (summary) | R | R | R | session (GET triggers `markOverdue()`, `app.ts:1210`) |
| Properties | R C U D | R C U D | R C U D | session only |
| Units | R C U D | R C U D | R C U D | session only |
| Tenants | R C U D | R C U D | R C U D | session only |
| Leases | R C U D | R C U D | R C U D | session only |
| Rent charges | R C U D G | R C U D G | R C U D G | session only (create/update/generate audited) |
| Payments | R C D (no U endpoint) | R C D | R C D | session only (create/delete audited) |
| Vendors | R C U D | R C U D | R C U D | session only |
| Work orders | R C U D | R C U D | R C U D | session only |
| Applications | R C U D | R C U D | R C U D | session only |
| CSV exports (rent ledger / tenants / properties) | R | R | R | session only (rent ledger GET triggers `markOverdue()`, `app.ts:1547`) |
| Settings — read | R | R | R | session only |
| Settings — write (policy) | U | U | — (403) | API (gate conditional on `authEnabled`, `app.ts:1320`); UI shows editable form to all |
| Reconcile occupancy | U | U | — | API, always (`app.ts:1357`) |
| Users — list | R | R | — | API (`app.ts:1368`) + tab hidden |
| Users — create | C (non-owner + owner) | C (non-owner only) | — | API (`app.ts:1386,1393`); owner option hidden from admin in dialog (`users-tab.tsx:132-133`) |
| Users — update | U (any incl. owner) | U (non-owner targets/roles only) | — | API (`app.ts:1418,1426,1433`) |
| Users — delete | D (not self) | — | — | API, owner only (`app.ts:1453,1458`); button owner-only (`users-tab.tsx:179`) |
| Audit — read | R | R | — | API (`app.ts:1472`) + tab hidden |
| Auth/session ops | public (any role) | public | public | middleware allowlist |
| Bootstrap (first user) | public while 0 users → creates owner | — | — | API (`app.ts:175-199`) |

### 2.3 Mode asymmetry (`AUTH_ENABLED=false`)

When the flag is off, the settings-write gate is skipped entirely (`app.ts:1320` — the check is inside `if (authEnabled …)`), while users/audit/reconcile remain always-gated (`app.ts:1357,1368,1386,1418,1453,1472`). The "open API" rollback is therefore partial: it reopens operations **and settings writes**, but not user management, audit, or reconcile. `[VERIFIED]`

---

## 3. Permission Boundary Classification

Each meaningful boundary: current behavior → evidence → reasoning → confidence → product-owner decision needed. Tags per classification.

| Boundary | Classification | Current behavior | Evidence | Reasoning | Confidence |
|---|---|---|---|---|---|
| Session wall (authenticated operations) | **INTENTIONAL** | Every non-public API requires a session when auth is on | `app.ts:90-121`; P5 log; plan §P5 | P5's explicit security objective (close open-API blocker R1) | High |
| Cumulative hierarchy (`hasMinimumRole`) | **INTENTIONAL** | owner ⊇ admin ⊇ manager reach | `auth.ts:154-165`; P5 log | P5 design; matches delivered semantics | High |
| Settings write → admin+ | **INTENTIONAL** (with TEMPORARY mode coupling) | admin+/owner only when auth on; open when off | `app.ts:1316-1322` | Deliberate gate; but the `authEnabled` coupling makes it deployment-dependent | High (gate) / Medium (mode coupling) |
| Reconcile occupancy → admin+ | **INTENTIONAL** | admin+ always | `app.ts:1355-1361` | Admin console action (P9-era) | High |
| User list/create/update → admin+, owner-only sub-rules | **INTENTIONAL** | admins manage non-owners; owners alone manage owners | `app.ts:1366-1449`; plan §P5.4; `users-tab.tsx:132-133` | Plan: "owner/admin manage users" | High |
| User delete → owner only | **INTENTIONAL** (delivered stricter than plan) | owner only, no self-delete | `app.ts:1451-1464`; tests; P5 log | Delivered tightening of plan's "deletions admin+" — deliberate | High |
| Audit read → admin+ | **INTENTIONAL** | owner/admin only | `app.ts:1470-1497` | Audit as admin-layer surface | High |
| Settings read → all roles | **INTENTIONAL** | any session role | `app.ts:1307-1314` | Runtime locale/currency needed across the app | High |
| Operational CRUD (non-monetary: properties, units, tenants, leases, vendors, work orders, applications) → all roles | **TEMPORARY** | flat session-only | plan §P5.4 "all roles read/write operations"; P5 log | No commercial policy; expedient V1 default. Likely survives for manager, but reads/writes scope is undecided | High that it's a default, not a policy |
| Financial operations (charge create/generate/waive/edit, payment record/delete) → all roles | **TEMPORARY** → **REQUIRES COMMERCIAL REALIGNMENT candidate** | manager has full money powers | route list `app.ts:767-975`; audit (create payment 15, generate 3, create lease 20); dataset managers 3 | "all roles read/write" was not a money-policy statement; manager label fits an operator, not an uncontrolled money actor | Medium-High |
| Operational deletes (any entity) → all roles | **TEMPORARY** → **REQUIRES COMMERCIAL REALIGNMENT candidate** | destructive power flat | `app.ts:342,424,515,698,887,945,1013,1119,1198` | Deliberately absent role gating; destructive breadth for manager is undecided | Medium-High |
| CSV export (full rent ledger) → all roles | **TEMPORARY** → **REQUIRES COMMERCIAL REALIGNMENT candidate** | any session role can export financial data | `app.ts:1543-1567` | No export policy; financial data exposure to manager is a policy question | Medium-High |
| Owner operational identity = admin = manager | **TEMPORARY** | owner is a full operator | §2 matrix; `app.ts` (no owner-specific operational checks) | Hierarchy only adds roster sovereignty; principal-vs-operator identity undecided | High |
| Users/Audit tabs hidden for manager | **INTENTIONAL** | UI mirrors API | `settings-page.tsx:55-60` | Matches API gates | High |
| Policy tab editable for all roles (403 on save for manager) | **TEMPORARY** (UI-policy communication gap) | form enabled; save → 403 error | `settings-page.tsx:66-68` + PolicyTab save → `PUT /api/settings` | Boundary is enforced, but not communicated — needs UI policy once decided | High |
| `AUTH_ENABLED=false` partial reopen (settings write) | **TEMPORARY** (deployment mode) | settings gate skipped when flag off | `app.ts:1320` vs `app.ts:1357,1368,...` | Rollback convenience, asymmetrical | Medium |
| Bootstrap → first owner | **INTENTIONAL** | first user is owner, atomic, auto-login | `app.ts:175-199`; tests | Ownership bootstrapping design | High |

---

## 4. Owner Policy

- **Ownership identity, administrator, or both?** Both, in the current behavior. `[VERIFIED]` Owner is role level 2 (highest RBAC level) AND a full operational operator. `[INFERENCE]` In a real small property business the owner is usually a principal with oversight authority; the current system gives the owner no oversight-only mode — the label and the behavior diverge.
- **Actions that should logically be unique to Owner** — `[POLICY DECISION REQUIRED]`. Currently unique: user deletion, owner-account creation/modification, owner-role assignment (`app.ts:1393,1426,1433,1453`). Candidates for future uniqueness: nothing else today; a product owner may want oversight-reads (audit already shared with admin), last-owner protection, or exclusive settings authority.
- **Inherited (not owner-specific) permissions:** settings write, reconcile, audit read, and every operational action are inherited purely from the hierarchy — nothing distinguishes Owner there. `[VERIFIED]`
- **Meaningful difference today:** yes, but only at the user roster — four owner-exclusive privileges (`[VERIFIED]`). **Nominal differences:** none — there is no other owner-only surface anywhere (full `c.get("user")` inventory, §2).
- **Classification of the differences:**
  - User-roster sovereignty (4 privileges): **INTENTIONAL** — explicitly implemented in P5 and tightened in delivery (plan said "deletions admin+"; delivered = owner-only). `[VERIFIED]`
  - Operational equality owner=admin=manager: **TEMPORARY** — inherited by design, but the commercial question (should an owner record payments, delete leases, export the ledger, or stay oversight-oriented?) is `[POLICY DECISION REQUIRED]`.

---

## 5. Admin Policy

- **Administrative authority today:** user list/create/update (non-owner targets and non-owner role assignments only), settings write, reconcile, audit read. `[VERIFIED]` (`app.ts:1320,1357,1366-1449,1470-1497`)
- **User-management scope:** full for non-owners (create admin/manager, re-role, reset password), **none** on the user-delete axis (owner-only), **read-only** on owner accounts. `[VERIFIED]`
- **Settings scope:** read (any role) + write (admin+). `[VERIFIED]`
- **Audit access:** read full log (owner/admin only). `[VERIFIED]`
- **Reconciliation:** admin+ trigger. `[VERIFIED]`
- **Deletion authority:** never deletes users (`[VERIFIED]` owner-only), but **full destructive power on operational records** — identical to manager. `[VERIFIED]`
- **Operational authority:** identical to Manager (`[VERIFIED]`), including money and exports.
- **Should Admin remain operationally equivalent to Manager?** `[POLICY DECISION REQUIRED]` — not answerable by generic RBAC convention, and the current code makes no operational distinction. Two legitimate commercial shapes: (a) Admin-as-ops-lead (operational equality retained), or (b) Admin-as-system-administrator (operational powers narrowed/dropped). Classification: the *administrative layer* is **INTENTIONAL**; the *operational identity* is **TEMPORARY** (undecided).

---

## 6. Manager Policy

Evidence basis: `[VERIFIED]` full operational CRUD incl. money/delete/export; administratively blocked at users/audit/settings-write/reconcile (API + tab gating); dataset contains three managers (`obs.finance@example.com`, `obs.maintenance@example.com`, `sara@gmail.com`) and 34 of 85 audit rows were authored by managers (money operations were demonstrably performed by managers).

Which model does the evidence support?

- **(A) Deliberate operational-manager model** — partial. The *mechanism* works and matches plan §P5 ("all roles read/write operations"). But plan §P5 is an implementation convenience statement, not a commercial policy (`[VERIFIED]` plan text; `[INFERENCE]` no policy document defines manager's commercial envelope).
- **(B) Incomplete temporary boundary** — strong. No documented manager policy exists; the boundary is "everything except admin layer," which is the residual of the guard set rather than a designed envelope.
- **(C) Overbroad authority requiring realignment** — true for the **money, delete, and export** subset specifically: `[INFERENCE]` a "manager" who can waive charges, delete leases/payments/properties, and export the full rent ledger exceeds what the label implies, and the dataset's finance/maintenance manager names imply domain intent the model cannot express.

**Conclusion:** the manager boundary is a **TEMPORARY/transitional V1 boundary** whose money/destructive/export subset is the highest-priority **REQUIRES COMMERCIAL REALIGNMENT** candidate. The administrative restriction itself is **INTENTIONAL** (deliberately excluded). `[VERIFIED]` mechanism / `[INFERENCE]` intent / `[POLICY DECISION REQUIRED]` envelope.

---

## 7. Sensitive Action Analysis

Belongs-to: **Commercial Policy** (role design) vs **Security Hardening** (later layer).

| Category | Actions | Current role access | Separation appears intentional? | Boundary sufficient? | Belongs to |
|---|---|---|---|---|---|
| **A. Operational** | property/unit maintenance, tenants, leases, work orders, applications | R/C/U/D for all three roles | No separation; flat by design but undecided as policy | Adequate as an operator layer, if manager is the operator | Commercial Policy (who is the operator); Security Hardening (baseline) |
| **B. Financial** | charge edits, generate/waive, payment record/delete | R/C/U/D/G for all three roles; no SoD between charge-creation and payment-recording | No | Insufficient if money stewardship is to be separated | Commercial Policy (SoD intent), then Security Hardening (enforcement) |
| **C. Administrative** | users, roles, settings, audit | admin+/owner-only tiers; audit read admin+ | Yes (the one well-separated layer) | Sufficient for V1 | Already policy-decided; hardening later |
| **D. Destructive** | deletes (all entities) | operational deletes: all roles; user delete: owner only | Only at the user plane | Insufficient on the operational plane (delete-vs-create by same role) | Commercial Policy (delete authority), Security Hardening (guards/confirmations) |
| **E. Information export** | CSV (rent ledger, tenants, properties) | all roles | No | Questionable for financial data | Commercial Policy (export visibility), Security Hardening (side-effect on rent-ledger GET) |

---

## 8. Known Gaps Classification

| Observed issue | Verification | Classification |
|---|---|---|
| Read-endpoint `markOverdue()` writes (`GET /api/dashboard/summary` `app.ts:1210`, `GET /api/export/rent-ledger` `app.ts:1547`) | `[VERIFIED]` | **SECURITY IMPLEMENTATION** (defense-in-depth/idempotency concern — not a role-permission matter) |
| Policy UI shows editable form to managers; save → 403 | `[VERIFIED]` | **ROLE POLICY** (the *boundary* is settings-write admin+, which is policy; the *communication gap* is a UI-policy alignment defect to fix once decided — not a new permission) |
| No charge-create/payment-record separation | `[VERIFIED]` | **ROLE POLICY** (SoD question) with a **BUSINESS RULE** facet (money-movement policy) |
| Unaudited operational creates (property/unit/tenant/vendor/work order/application) and most updates | `[VERIFIED]` (writeAudit inventory — only deletes + lease/charge/payment/settings writes + generate are recorded) | **AUDIT/ACCOUNTABILITY** |
| `AUTH_ENABLED=false` asymmetry (settings write reopens; users/audit/reconcile stay gated) | `[VERIFIED]` | **DEPLOYMENT** (rollback-mode semantics) with a **SECURITY IMPLEMENTATION** facet |
| Owner/admin operational identity (README: functionally identical operationally) | `[VERIFIED]` | **ROLE POLICY** (principal-vs-administrator identity decision) |

---

## 9. Commercial Organizational Model

Mapping the three concrete roles to business concepts — current fact vs inference vs decision, per role. `[VERIFIED]` behavior is repeated here as the baseline; the semantic layer is `[INFERENCE]`; the resolution is `[POLICY DECISION REQUIRED]`.

| Concept | Current authority (fact) | Intended operational responsibility (inference) | Mismatch |
|---|---|---|---|
| **OWNER** — business owner / principal authority | Full operator + user-roster sovereignty + admin layer | Principal: oversight, ownership, ultimate accountability | Owner can do everything a manager does (record payments, delete leases, export ledger) — no oversight-only mode. If a real owner is non-operational, realignment needed |
| **ADMIN** — administrative/system operator | Admin layer (users non-owner, settings, reconcile, audit) + full operational CRUD | "System operator" fits the admin layer; "also full operator" is a choice | Whether admin stays an operator is an open policy question (§5) |
| **MANAGER** — operational/day-to-day property operator | Full operational CRUD incl. money/delete/export; admin layer blocked | Day-to-day operator fits; money/delete/export breadth is the open question | Dataset's finance/maintenance managers imply domain specialization the model can't express |

The mapping documents **CURRENT FACT**, marks the semantic layer **INFERENCE**, and flags the commercial envelope as **POLICY DECISION REQUIRED** — nothing is assumed to be pre-implemented.

---

## 10. Policy Alternatives

Plausible commercial permission models grounded in the current three-role topology. Described without ranking; each states what changes / stays and its effects.

### MODEL A — Operationally broad Manager (current default, codified)
- **Changes:** none to reach; document the flat operational plane as the commercial policy; add UI-policy alignment (disable Policy Save for non-admin).
- **Stays:** full manager CRUD incl. money, deletes, exports; owner/admin as-is; admin layer as-is.
- **Operational effect:** least disruption; manager is a trusted generalist operator.
- **Security effect:** single-actor money manipulation and destructive breadth remain; relies on audit + trust model.
- **Complexity:** minimal (documentation + UI alignment).
- **Migration implications:** none technical; policy documentation only.

### MODEL B — Manager operationally broad, financially restricted
- **Changes:** gate financial actions to admin+ (charge create/generate/waive/edit; payment record/delete); manager retains all non-money operations (properties, units, tenants, leases, work orders, applications, dashboard, settings read) and loses financial exports (or gains read-only).
- **Stays:** hierarchy, admin layer, user-roster sovereignty, audit admin+.
- **Operational effect:** money flows funnel through admin/owner; manager handles leasing/maintenance/tenancy day-to-day.
- **Security effect:** introduces the first real SoD (charge-create vs payment-record separation possible between manager and admin).
- **Complexity:** medium — new role checks on the financial handler set; audit already covers these actions; UI gating needed.
- **Migration implications:** existing manager sessions/roles unchanged; managers lose a capability (must be communicated); recipient process (model M fully replaces this loss) or manager jobs re-scoped.

### MODEL C — Manager operational + financial, no destructive operations
- **Changes:** gate all deletes (operational entities) to admin+; manager keeps create/update incl. financial record (payment recording OK, charge waive/edit maybe restricted), loses deletes and possibly export.
- **Stays:** hierarchy, admin layer, audit visibility admin+ (or grant manager limited audit on own actions — policy choice).
- **Operational effect:** manager runs operations but cannot destroy records; corrections escalate to admin.
- **Security effect:** containment of destructive authority; money entry still possible (created-payment mistakes need admin deletion).
- **Complexity:** medium — delete-gate checks + UI affordance removal; delete is already fully audited, easing migration.
- **Migration implications:** manager capabilities change (delete removed); existing delete workflows escalate to admin/owner.

Allowed variant axes (described inside the models, not ranked): export visibility for manager (full / none / admin+ only), audit visibility for manager (none / own-actions), and whether Owner stays a full operator or becomes oversight-oriented (`[POLICY DECISION REQUIRED]` in all three).

---

## 11. Product Owner Decisions Required

Explicit policy questions (not implementation tasks) that gate Commercial Layer design:

1. **Should Manager be allowed to record payments?** (affects §7-B, Model A vs B/C)
2. **Should Manager edit rent charges** (create/generate/waive/edit)? 
3. **Should Manager delete operational records** (leases, payments, charges, properties)? (Model C)
4. **Should Manager export CSV** — in particular the full rent ledger?
5. **Should Admin and Owner remain operationally identical** (flat operator plane)?
6. **Which actions, if any, must be Owner-only** — beyond the current user-roster four?
7. **Should audit visibility remain owner/admin only**, or should Manager see their own actions?
8. **Should settings remain admin-level**, or should any setting be owner-exclusive?
9. **Should user-role assignment be owner-only**, or may Admin assign admin/manager? (current: admin may assign admin/manager — decide if that stands)
10. **Should financial actions require stronger separation** (charge-creation ≠ payment-recording)?
11. **Which current gaps are acceptable for V1** (policy form UI gap, flat operational deletes, read-endpoint `markOverdue()`, unaudited operational creates)?
12. **Which gaps must be closed before commercial release** (and which may ship as documented risks)?

Each question maps to the §3 boundaries flagged `[POLICY DECISION REQUIRED]`; the answers determine which §10 model (if any of A/B/C, or a documented variant) becomes the Commercial Layer permission policy.

---

## 12. Final Role Policy Matrix

| Role | Purpose | Operational authority | Financial authority | Administrative authority | Destructive authority | Audit visibility | User-management authority | Current status |
|---|---|---|---|---|---|---|---|---|
| **Owner** | Business principal + highest role | Full operational CRUD (all resources) | Full (charge create/generate/waive/edit; payment record/delete) | Full (settings write, reconcile, audit read) | Operational deletes: full; user delete: full (not self) | Full (admin+) | Full — list/create/update incl. owners; delete users; assign owner | **INTENTIONAL** (roster sovereignty + hierarchy) / **TEMPORARY** (operational identity = admin = manager) |
| **Admin** | Administrative/system operator | Full operational CRUD (identical to manager) | Full (identical to manager) | Full (users non-owner, settings write, reconcile, audit read) | Operational deletes: full; user delete: — | Full (admin+) | List/create/update non-owners; cannot touch owners; cannot delete users; cannot assign owner | **INTENTIONAL** (admin layer) / **TEMPORARY** (operational identity undecided) |
| **Manager** | Operational operator | Full operational CRUD incl. all resources | Full (money changes incl. waive, generate, payment record/delete) | None (settings write 403, reconcile 403, users 403, audit 403) | Operational deletes: full; user delete: — | None | None | **INTENTIONAL** (admin-layer restriction) / **TEMPORARY→REALIGNMENT candidate** (money, delete, export breadth) |

Status legend: a role can carry both an INTENTIONAL core and a TEMPORARY/REALIGNMENT facet — the classification is per boundary, not per role (no rankings).

---

## 13. Commercial Release Gate

**ROLE POLICY STATUS: READY WITH POLICY DECISIONS**

Criterion (per task): whether the permission model is *sufficiently defined to enter Commercial Layer design*. The V1 model is **fully verified and fully documented** (exact matrix §2, boundary classification §3, sensitive-action split §7) — there is no unknown in *current behavior*. What is missing is not evidence but **policy intent**: the §11 answers. Commercial Layer design can therefore begin, **conditional on** the product owner resolving those decisions; the current flat operational plane must not be treated as a confirmed commercial policy. If the decisions cannot be produced before design, the honest status is **NOT READY**. This is not a quality score.

---

## 14. Non-goals / Deferred Items

Explicitly out of scope for this gate; deferred to future phases (per the mapping report's recommendations, not implemented here):

- RBAC redesign, permission tables, or any new role mechanics.
- Behavioral changes to any permission (no gate added/removed/relaxed).
- SoD implementation (charge-create vs payment-record separation).
- Audit-coverage expansion (unaudited operational creates).
- UI-policy communication fixes (Policy form disabled state; self-role indication).
- Export authorization policy and rent-ledger `markOverdue()` side-effect removal.
- `AUTH_ENABLED` rollback-mode semantics decision.
- Last-owner protection / owner-account guardrails.
- Any dataset, schema, migration, seed, or authentication change (explicitly prohibited).
- Pushing commits (origin/main intentionally behind local history).

---

### Evidence sources

- `src/server/auth.ts:154-165` (ROLE_HIERARCHY, hasMinimumRole), `:167-181` (AUTH_ENABLED cache).
- `src/server/app.ts:90-121` (middleware + allowlist), `:1316-1322` (settings PUT), `:1355-1361` (reconcile), `:1366-1465` (users), `:1470-1497` (audit), `:1543-1567` (exports; `markOverdue` at `:1547`), `:1210` (dashboard `markOverdue`), writeAudit inventory (`:268,348,430,521,632,693,710,794,823,879,895,937,957,1013,1119,1198,1344,1463`).
- `src/client/components/settings/settings-page.tsx:51-68` (tab gating), `users-tab.tsx:55,132-133,179` (user UI gating).
- `Docs/execution/P5/p5-auth-single-tenant-roles.md`; `Docs/plans/13-v1-implementation-plan.md:98-117`; `tests/auth.test.ts` (role-matrix coverage).
- Dataset (read-only, re-verified 2026-09-26): 6 users (2 owner / 1 admin / 3 manager), 85 audit rows (owner 37 / manager 34 / admin 7 / deleted 7; create lease 20, create payment 15, delete lease 1, delete property 1, generate 3, update settings 45), `AUTH_ENABLED=true`, locale ar, currency DZD; operational counts 11/23/16/19/43/43/10/10/8 (properties/units/tenants/leases/charges/payments/vendors/work orders/applications), open charges 4, overdue DZD 102 000, open work orders 5.

### Commit hygiene

Documentation only — exactly one commit, no amend, no push; only this report staged; inherited working-tree exceptions untouched.