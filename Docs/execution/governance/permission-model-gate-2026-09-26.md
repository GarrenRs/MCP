# Permission Model Gate — ORKESTRIX Property System V1 (2026-09-26)

**Document type**: permission model gate (governance). **Read-only architecture — no
implementation authorized.**
**Scope**: design the final V1 Permission Model that can later be implemented safely, by
translating the approved commercial decisions **D1 (Financial Authority)**, **D2 (Export
Exposure)**, and **D3 (Owner Identity)** — recorded in the Product Owner Decision Register — into
a precise authorization structure: **Role → Domain → Resource → Action → Permission → Data Scope
→ Audit Requirement**.
**This document does not modify permissions, roles, auth, UI, API, schema, or runtime behavior.**
It is the input contract for the next implementation task ("Permission Model Implementation").

Source-tracking discipline (unchanged from the gate/register): `SOURCE FACT` (implemented or
documented upstream), `CURRENT STATE` (this repo), `POLICY DECISION` (an owner answer),
`ARCHITECTURAL INFERENCE` (derived), `FUTURE OPTION` (out of V1). Tags `[VERIFIED]` (directly
observed in this repo or fetched upstream evidence) and `[INFERENCE]` (reasoned from verified
facts) are used throughout.

---

## 1. Purpose

The Commercial Architecture Gate is **CLOSED**; all seven decisions (D1–D7) are recorded and
`DECIDED`. The next gated phase — per gate §12.1-1 and the closure §12 — is the **Permission
Model**: design of additive feature-scope gates on the recorded D1–D3 envelopes, with the
existing **Owner / Admin / Manager** roles unchanged and **no new role** (in particular, **no
Finance role**).

This gate defines:

1. the permission-model shape and principles (§5);
2. the V1 role hierarchy unchanged (§6);
3. a complete **Domain / Action matrix** with `ALLOW` / `DENY` / `CONDITIONAL` per role (§7);
4. per-role analyses for Owner, Admin, Manager (§8–§10);
5. the **sensitive-action** classification (§11) and **export** boundaries (§12);
6. the **data scope** decision (§13) and **audit requirements** (§14);
7. the classification of known gaps (§15); future extensibility (§16); the implementation
   boundary (§17); and the **Ready Gate** for the implementation task (§18).

It does **not** implement anything. It does **not** close or author the deferred gaps listed in
§15; those are classified and left to their own destinations.

---

## 2. Baseline

- HEAD: `15d6b73` — "docs: close commercial architecture decisions" (Commercial Architecture
  **CLOSED**; Decision Register **COMPLETE**, D1–D7 `DECIDED`). Chain: `15d6b73` →
  `a5f98d3` (register) → `3671716` (commercial architecture gate) → `49832fd` (role policy gate).
  [VERIFIED — git log]
- Roles in V1: **Owner / Admin / Manager** only (`ROLE_HIERARCHY = {manager:0, admin:1, owner:2}`,
  `hasMinimumRole` cumulative — `src/server/auth.ts:154-165`). [VERIFIED]
- Approval state: D1 (Financial Authority), D2 (Export Exposure), D3 (Owner Identity) recorded in
  `Docs/execution/governance/product-owner-decision-register-2026-09-26.md` §5–§7, all `DECIDED`
  2026-09-26; the routine-vs-sensitive charge-edit boundary was explicitly delegated to this gate
  by the register's D1 Final Rule. [POLICY DECISION]
- Current permission surface (verified in `src/server/app.ts`): exactly **four gated areas** —
  settings write (admin+, `:1320`), occupancy reconciliation (admin+, `:1357`), user management
  (admin+ with owner-only sub-rules, `:1368/1386/1418/1453`), audit read (admin+, `:1472`).
  Everything operational — properties, units, tenants, leases, rent charges, payments, vendors,
  work orders, applications, dashboard, CSV exports — is **session-only and flat across all
  roles**. [CURRENT STATE — VERIFIED]
- Auth middleware: public routes exempt (`/api/health`, `/api/auth/*`); `AUTH_ENABLED` flag gates
  enforcement; sessions are server-side, DB-backed (hashed token, TTL — `auth.ts:65-103`).
  [VERIFIED]
- Working tree = inherited exceptions only (`Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5–P8/`,
  tc/tc3/vt/vt3.txt, modified ui-finalization docs, `tests/audit.test.ts`) — untouched by this
  gate. [VERIFIED — git status]

---

## 3. Source Tracking

Upstream is evidence only; **no upstream role or permission is adopted automatically**. The V1
permission model derives exclusively from the approved ORKESTRIX decisions (D1–D3).

- **clawnify/OpenProperty** (README tip `a493028a`, fetched 2026-09-26): local-first, self-hosted,
  MIT; a single-user foundation with **no multi-role authorization model** — there is no upstream
  role/permission matrix to transplant. `[SOURCE FACT]`
- **clawnify/property-os** (README + AGENTS.md tip `3fba3c22`, fetched 2026-09-26): multi-app
  dashboard; the Property core targets **"Owner, property manager" as personas** of one app — a
  positioning statement, not a privilege contract; agents **draft but never record payments** and
  optional agents are "not hired yet" — write-boundary constraints on a *future agent layer*, not
  staff-role authority. `[SOURCE FACT]`
- **Architectural inference**: upstream offers no permission vocabulary that ORKESTRIX could copy;
  the agent "never records payments" rule is consistent with ORKESTRIX's own sensitivity posture
  but is **not** the source of D1 (D1 comes from the owner's recorded answers). `[ARCHITECTURAL
  INFERENCE]`
- Future modules/members/agents (`[FUTURE OPTION]`) may attach to the permission model as scope
  compositions (§16); they do not alter V1 roles.

---

## 4. Approved Commercial Decisions

Recorded verbatim as the model's policy input (register §5–§7; no reinterpretation).
[POLICY DECISION]

- **D1 — Financial Authority**
  - Manager may generate/create rent charges.
  - Manager may record payments.
  - Manager may NOT waive charges.
  - Manager may NOT perform sensitive charge edits.
  - Manager may NOT delete payments.
  - Admin may perform the sensitive financial operations.
  - Owner retains final Principal authority.
  - Exact permission enforcement belongs to the next Permission Model phase.
- **D2 — Export Exposure**
  - Operational CSV exports remain available to operational roles according to current
    operational scope.
  - Financial exports, including the rent ledger, are restricted to Admin and Owner.
  - No financial-export implementation is to be performed now.
- **D3 — Owner Identity**
  - Owner is a Hybrid role: operational authority + Principal authority.
  - Owner remains capable of normal operational work.
  - Owner additionally holds the highest governance/administrative authority.
  - This does not require a new role.

Carried into implementation unchanged. Items of the Role Policy Gate §11 not covered by D1–D3
(user-role assignment scope confirm; V1-acceptable gaps; pre-release closure list) are tracked as
permission-model/release inputs — not blockers (register §13).

---

## 5. Permission Model Principles

1. **Role → Domain → Resource → Action → Permission → Data Scope → Audit Requirement.** A
   permission is a grant tuple `(role, domain, resource, action)` evaluated to `ALLOW` /
   `DENY` / `CONDITIONAL`; every V1 action below is backed by a real endpoint (§7 mapping). No
   allow/deny-only owner/admin/manager reduction. `[ARCHITECTURAL INFERENCE]`
2. **No new roles — in particular no Finance role.** The Owner/Admin/Manager set and the
   `owner > admin > manager` cumulative hierarchy are preserved. A future Finance (or Leasing /
   Maintenance / Viewer-Auditor) responsibility is represented as a **permission/domain scope
   composition**, not as a new core role (§16). `[POLICY DECISION + ARCHITECTURAL INFERENCE]`
3. **Server-side authorization is authoritative.** Every request is decided by a centralized
   server authorization check. **UI gating is presentation, not security** — the UI may read a
   read-only capability view, but never decides. `[PRINCIPLE]`
4. **Centralized authorization logic.** One permission module owns the matrix, the sensitive-action
   registry, the hierarchy backbone, and the export restrictions. No scattered per-route role
   literals; no duplicated authorization rules in the UI. `[ARCHITECTURAL INFERENCE]`
5. **Hierarchy backbone + explicit overrides.** `hasMinimumRole` continues to decide ordinary
   operational grants; **sensitive actions** (waive, sensitive charge edits, delete payment,
   financial export, audit read, user management, owner-principal actions) are decided by an
   explicit **sensitive-action registry** that may override the hierarchy (DENY for Manager) or
   require a specific role (`role === "owner"` for user deletion / owner assignment).
   `[ARCHITECTURAL INFERENCE]`
6. **Additive refinement only.** V1 refinement introduces feature-scope gates (per the recorded
   envelope) and never narrows a grant outside the recorded D1–D3 decisions. Where the approved
   policy is silent, the model **preserves current behavior** and marks it explicitly (e.g.,
   charge delete — §7 rows 23, §15 gap 2). `[POLICY DECISION]`
7. **Single-tenant instance scope.** Data scope in V1 is the instance itself (global scope);
   no per-property or per-portfolio isolation is introduced (§13). `[ARCHITECTURAL INFERENCE]`
8. **Audit-sensitive actions are identified, not implemented.** The model states which actions
   must produce audit records after implementation; no audit schema change is invented here
   (§14). `[PRINCIPLE]`

---

## 6. Role Hierarchy

Preserved exactly:

| Role | Level | Semantics |
|---|---|---|
| `manager` | 0 | Base operational role (daily operations under the D1/D2 envelope) |
| `admin` | 1 | Manager + administrative layer (settings, reconcile, user mgmt within rules) + sensitive financial operations (D1) |
| `owner` | 2 | Admin + final Principal authority (D3): user-roster sovereignty, owner-only actions, full financial envelope |

- Hierarchy remains **cumulative** via `hasMinimumRole` (`auth.ts:154-165`) for the ordinary
  operational plane. `[CURRENT STATE — VERIFIED]`
- The hierarchy is **not sufficient** for sensitive actions: those go through the explicit
  sensitive-action registry (§11) so that, e.g., Manager's higher-level cumulativeness never
  grants waive, sensitive charge edits, payment deletion, or financial export. `[ARCHITECTURAL
  INFERENCE]`
- Owner-principal capabilities are role-equality checks (`caller.role === "owner"`), not
  minimum-level checks — matching today's `app.ts:1393,1426,1433,1453`. `[CURRENT STATE —
  VERIFIED]`

---

## 7. Domain / Action Matrix

Vocabulary — actions used in V1: **READ, CREATE, UPDATE, DELETE, EXPORT, WAIVE, RECORD, ASSIGN,
MANAGE.** `APPROVE` is **not used in V1**: the current system performs application status
transitions (including approval flow) through the generic application UPDATE (`app.ts:1171`); no
dedicated approval action exists. The action word remains reserved for future use.

Legend: **ALLOW** = permitted; **DENY** = refused; **CONDITIONAL** = permitted only under the
stated condition (always stated inline). Audit column: **REQUIRED** / **RECOMMENDED** / **NONE**
(target after implementation; current audit state in Notes).

| # | Domain | Resource | Action | Owner | Admin | Manager | Audit | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | Properties | property | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/properties` (287), `GET /:id` (297) |
| 2 | Properties | property | CREATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `POST /api/properties` (305); create currently unaudited |
| 3 | Properties | property | UPDATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `PUT /:id` (328); update currently unaudited |
| 4 | Properties | property | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (342); audited today; destructive — gap 2 (§15) |
| 5 | Units | unit | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/units` (377), `GET /:id` (389) |
| 6 | Units | unit | CREATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `POST /api/units` (397) |
| 7 | Units | unit | UPDATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `PUT /:id` (410) |
| 8 | Units | unit | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (424); audited; destructive — gap 2 |
| 9 | Tenants | tenant | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/tenants` (448), `GET /:id` (480) |
| 10 | Tenants | tenant | CREATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `POST /api/tenants` (488) |
| 11 | Tenants | tenant | UPDATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `PUT /:id` (501) |
| 12 | Tenants | tenant | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (515); audited; destructive — gap 2 |
| 13 | Leases | lease | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/leases` (584), `GET /:id` (598) |
| 14 | Leases | lease | CREATE | ALLOW | ALLOW | ALLOW | REQUIRED | `POST /api/leases` (606); audited today (preserved) |
| 15 | Leases | lease | UPDATE | ALLOW | ALLOW | ALLOW | REQUIRED | `PUT /:id` (642); audited today (preserved) |
| 16 | Leases | lease | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (698); audited; destructive — gap 2 |
| 17 | RentCharges | rentCharge | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/rent-charges` (767); endpoint runs `markOverdue()` — gap 7 |
| 18 | RentCharges | rentCharge | CREATE | ALLOW | ALLOW | ALLOW | REQUIRED | `POST /api/rent-charges` (780); audited; D1 Manager ✓ |
| 19 | RentCharges | rentCharge | GENERATE | ALLOW | ALLOW | ALLOW | REQUIRED | `POST /api/rent-charges/generate` (804); audited; D1 Manager ✓ |
| 20 | RentCharges | rentCharge | UPDATE (routine) | ALLOW | ALLOW | ALLOW | REQUIRED | `PUT /:id` (828) notes-only patch; audited |
| 21 | RentCharges | rentCharge | UPDATE (sensitive) | ALLOW | ALLOW | DENY | REQUIRED | `PUT /:id` with `amount` / `due_date` / `status` fields; D1 sensitive-edit boundary (§11 #2) |
| 22 | RentCharges | rentCharge | WAIVE | ALLOW | ALLOW | DENY | REQUIRED | `PUT /:id` status=`'waived'` (sub-case of #21); D1 Manager ✗ |
| 23 | RentCharges | rentCharge | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (887); audited; D1 silent on charge delete → preserved; destructive — gap 2 |
| 24 | Payments | payment | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/rent-charges/:id/payments` (913) |
| 25 | Payments | payment | RECORD | ALLOW | ALLOW | ALLOW | REQUIRED | `POST /api/payments` (920); audited; D1 Manager ✓ |
| 26 | Payments | payment | DELETE | ALLOW | ALLOW | DENY | REQUIRED | `DELETE /api/payments/:id` (945); audited; D1 Manager ✗ |
| 27 | Vendors | vendor | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/vendors` (976) |
| 28 | Vendors | vendor | CREATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `POST /api/vendors` (981) |
| 29 | Vendors | vendor | UPDATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `PUT /:id` (993) |
| 30 | Vendors | vendor | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (1007); audited |
| 31 | Maintenance | workOrder | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/work-orders` (1047) |
| 32 | Maintenance | workOrder | CREATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `POST /api/work-orders` (1061) |
| 33 | Maintenance | workOrder | UPDATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `PUT /:id` (1085) |
| 34 | Maintenance | workOrder | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (1113); audited |
| 35 | Applications | application | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/applications` (1138) |
| 36 | Applications | application | CREATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `POST /api/applications` (1149) |
| 37 | Applications | application | UPDATE | ALLOW | ALLOW | ALLOW | RECOMMENDED | `PUT /:id` (1171); status/approval transitions ride UPDATE (no separate APPROVE in V1) |
| 38 | Applications | application | DELETE | ALLOW | ALLOW | ALLOW | REQUIRED | `DELETE /:id` (1190); audited |
| 39 | Dashboard | dashboardSummary | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/dashboard/summary` (1208); endpoint runs `markOverdue()` — gap 7 |
| 40 | Settings | settings | READ | ALLOW | ALLOW | ALLOW | NONE | `GET /api/settings` (1307) |
| 41 | Settings | settings | UPDATE | ALLOW | ALLOW | DENY | REQUIRED | `PUT /api/settings` (1316); admin+ gate preserved (INTENTIONAL); audited |
| 42 | Reconcile | occupancy | MANAGE | ALLOW | ALLOW | DENY | RECOMMENDED | `POST /api/admin/reconcile-occupancy` (1355); admin+ gate preserved |
| 43 | Users | user | READ | ALLOW | ALLOW | DENY | NONE | `GET /api/users` (1366); admin+ gate preserved |
| 44 | Users | user | CREATE | ALLOW | CONDITIONAL: manager/admin accounts only — cannot create owner | DENY | REQUIRED | `POST /api/users` (1384); admin+; owner-creation owner-only (1393); create currently unaudited → add audit |
| 45 | Users | user | UPDATE | ALLOW | CONDITIONAL: may not modify owner accounts | DENY | REQUIRED | `PUT /:id` (1416); admin+; owner-account mods owner-only (1426); currently unaudited → add audit |
| 46 | Users | user | ASSIGN | ALLOW | CONDITIONAL: may assign manager/admin; may NOT assign owner role | DENY | REQUIRED | role field in `PUT /:id`; owner-role assignment owner-only (1433); add audit |
| 47 | Users | user | DELETE | ALLOW | DENY | DENY | REQUIRED | `DELETE /:id` (1451); owner-only (1453) — INTENTIONAL; audited |
| 48 | Audit | auditLog | READ | ALLOW | ALLOW | DENY | NONE | `GET /api/audit` (1470); admin+ gate preserved; Manager own-actions variant NOT adopted (register §13 item 7) |
| 49 | Export | rentLedger | EXPORT | ALLOW | ALLOW | DENY | REQUIRED | `GET /api/export/rent-ledger` (1543); D2 financial → Admin/Owner only; add export audit; endpoint runs `markOverdue()` — gap 7 |
| 50 | Export | tenants | EXPORT | ALLOW | ALLOW | ALLOW | RECOMMENDED | `GET /api/export/tenants` (1569); operational scope per D2 |
| 51 | Export | properties | EXPORT | ALLOW | ALLOW | ALLOW | RECOMMENDED | `GET /api/export/properties` (1594); operational scope per D2 |

Line references are to `src/server/app.ts` (verified on HEAD `15d6b73`). All 52 endpoints
inventoried; the auth/session routes (`/api/auth/*`, `/api/health`, bootstrap) remain public /
exempt and are outside the matrix. [CURRENT STATE — VERIFIED]

**Notes on the financial rows (17–26):** CREATE/GENERATE and routine UPDATE stay granted to all
three roles per D1 (Manager ✓ for generate/create and record). WAIVE and sensitive UPDATE are the
two surfaces where Manager is **DENY; Admin and Owner** perform them (D1). DELETE payment is
DENY for Manager. Charge DELETE (row 23) is **not restricted by the approved D1** (the envelope is
silent); it is preserved flat and flagged under §15 gap 2 (destructive deletes).

---

## 8. Owner Model

Owner is a **Hybrid role** (D3): ordinary **operator** plus **Principal**. No new role; the
existing `owner` role carries both postures.

- **Ordinary operational capability (operator posture)** — identical manager/admin operational
  plane, rows 1–39: all operational READ/CREATE/UPDATE/DELETE for properties, units, tenants,
  leases, charges (incl. generate), payments (incl. record), vendors, work orders, applications,
  dashboard; operational exports (rows 50–51). Owner may perform normal operational work.
  `[POLICY DECISION D3]`
- **Principal capability** — the highest governance/administrative authority:
  - user-roster sovereignty: user READ/CREATE/UPDATE/ASSIGN/DELETE unrestricted (rows 43–47);
  - owner-only capabilities: user deletion (`role === "owner"`, `app.ts:1453`), owner account
    creation (`:1393`), owner role assignment (`:1433`), owner-account modification (`:1426`);
  - full financial envelope per D1: WAIVE, sensitive charge edits, payment deletion (rows
    21, 22, 26) plus everything in the base envelope;
  - audit visibility: audit READ (row 48);
  - settings and reconcile (rows 41–42). `[POLICY DECISION D3 + CURRENT STATE — VERIFIED]`
- **Separation**: the operator posture is the shared plane; the Principal posture is the
  owner-exclusive governance/accountability set. The model keeps both in one role (hybrid), not
  two roles. `[ARCHITECTURAL INFERENCE]`

Target authorization summary — Owner: **ALLOW on all 51 rows**; Principal-only restrictions apply
to *other* roles, not to Owner. Audit: all REQUIRED rows apply to Owner's financial/destructive/
user/settings activity identically.

---

## 9. Admin Model

Admin is the **administrative layer without artificial operational weakening** (approved policy
does not restrict Admin's operational work — D1 explicitly grants Admin the sensitive financial
operations).

- **Operational**: full manager plane (rows 1–39) — all operational CRUD, charges (incl. WAIVE,
  sensitive edits — rows 21–22), payments record + **delete** (row 26). `[POLICY DECISION D1]`
- **Administrative**: settings UPDATE (41), reconcile MANAGE (42), user READ/CREATE/UPDATE/ASSIGN
  with **CONDITIONAL** limits (rows 43–46: may manage manager/admin accounts; **cannot** create,
  assign, or modify owner accounts), audit READ (48). `[CURRENT STATE preserved — VERIFIED]`
- **Financial**: the sensitive financial operations the approved decision grants Admin (waive,
  sensitive charge edits, delete payments). `[POLICY DECISION D1]`
- **Destructive**: all operational deletes as on the manager plane (rows 4/8/12/16/23/30/34/38);
  payment delete ALLOW (26); **user delete DENY** (47 — owner-only). `[POLICY DECISION +
  CURRENT STATE]`
- **Export**: operational exports ALLOW (50–51); **financial export ALLOW** (49 — Admin may
  export the rent ledger per D2). `[POLICY DECISION D2]`
- **User management**: yes within CONDITIONAL rules; **audit visibility: yes** (own/global audit
  log). `[CURRENT STATE]`

Admin is not weakened: it keeps full operational authority plus the administrative layer and the
D1-sensitive financial operations. No administrative-only "lockout" posture is invented.
`[ARCHITECTURAL INFERENCE]`

---

## 10. Manager Model

Manager remains a **full day-to-day operator** with an explicit financial/export boundary per
D1–D2.

- **Remains allowed day-to-day (operational)**: rows 1–39 — properties, units, tenants, leases,
  rent-charge CREATE/GENERATE and routine UPDATE, payment RECORD, vendors, work orders,
  applications, dashboard; operational exports tenants/properties (50–51). `[POLICY DECISION D1 +
  D2]`
- **Remains allowed financially**: generate/create rent charges (18–19), record payments (25),
  routine (notes-only) charge updates (20). `[POLICY DECISION D1]`
- **Prohibited financially**: waive charges (22), sensitive charge edits — any patch containing
  `amount` / `due_date` / `status` (21), delete payments (26). `[POLICY DECISION D1]`
- **Destructive actions denied**: delete payments (26) is the destructive action **denied** by
  the approved policy. All other operational deletes (properties/units/tenants/leases/charges/
  vendors/work orders/applications) remain granted per current behavior and are **flagged** —
  not restricted by any approved decision (gap 2, §15). `[POLICY DECISION D1 + CURRENT STATE]`
- **Exports denied**: financial CSV — the rent-ledger export (49) is **DENY** for Manager;
  operational CSVs remain allowed (50–51). `[POLICY DECISION D2]`
- **Administrative denied**: settings (41), reconcile (42), user management & audit (43–48).
  `[CURRENT STATE preserved]`
- **Audit visibility**: DENY (48) — Manager does not read the audit log in V1; the
  manager-own-actions variant from the Role Policy Gate §11 Q7 was not adopted (register §13
  item 7). `[CURRENT STATE]`

---

## 11. Sensitive Actions

Explicit classification of the thirteen sensitive actions. "Current behavior" and "Target
authorization" reference the matrix (§7); line refs are `src/server/app.ts`. [CURRENT STATE —
VERIFIED; POLICY DECISION D1–D3]

| # | Sensitive action | Current behavior | Approved policy | Target authorization | Audit requirement |
|---|---|---|---|---|---|
| 1 | create/generate charge | Flat, all roles (`:780/:804`) | D1: Manager may generate/create | ALLOW Owner/Admin/Manager | REQUIRED (audited today) |
| 2 | edit charge (sensitive) | Flat, all roles (`PUT /:id`, `:828`) | D1: Manager may NOT sensitive edits; boundary delegated here | **Sensitive = patch containing `amount`, `due_date`, or `status`** (incl. any status transition). Notes-only = routine (ALLOW all). Sensitive: Owner ALLOW, Admin ALLOW, **Manager DENY** | REQUIRED (audited today) |
| 3 | waive charge | Flat via status=`waived` (`:834/:857`) | D1: Manager may NOT waive | Owner ALLOW, Admin ALLOW, Manager DENY | REQUIRED |
| 4 | record payment | Flat (`:920`) | D1: Manager may record | ALLOW Owner/Admin/Manager | REQUIRED (audited today) |
| 5 | delete payment | Flat (`:945`) | D1: Manager may NOT delete payments | Owner ALLOW, Admin ALLOW, Manager DENY | REQUIRED (audited today) |
| 6 | delete lease | Flat (`:698`) | Silent (D1 restricted only payment delete) | ALLOW Owner/Admin/Manager (preserved); destructive — §15 gap 2 | REQUIRED (audited today) |
| 7 | delete property | Flat (`:342`) | Silent | ALLOW Owner/Admin/Manager (preserved); §15 gap 2 | REQUIRED (audited today) |
| 8 | delete unit | Flat (`:424`) | Silent | ALLOW Owner/Admin/Manager (preserved); §15 gap 2 | REQUIRED (audited today) |
| 9 | delete tenant | Flat (`:515`) | Silent | ALLOW Owner/Admin/Manager (preserved); §15 gap 2 | REQUIRED (audited today) |
| 10 | financial CSV export (rent ledger) | Flat (`:1543`) | D2: Admin and Owner only | Owner ALLOW, Admin ALLOW, Manager DENY | REQUIRED (add export audit) |
| 11 | audit access | Admin+ read (`:1472`) | No change (D3; Q7 variant not adopted) | Owner ALLOW, Admin ALLOW, Manager DENY | NONE (access service) |
| 12 | user role assignment | Admin+; owner-only owner-assign (`:1384/:1416/:1433`) | Register item 9 stands; confirmed here | Owner ALLOW; Admin CONDITIONAL (manager/admin only, never owner); Manager DENY | REQUIRED (add audit) |
| 13 | user deletion | Owner-only (`:1453`) | INTENTIONAL preserve | Owner ALLOW; Admin DENY; Manager DENY | REQUIRED (audited today) |

The **sensitive charge-edit boundary (#2) is defined here** as the register's D1 Final Rule
delegated: any charge update touching `amount`, `due_date`, or `status` is sensitive (financial
impact on the ledger); `status='waived'` is the WAIVE sub-case (#3); notes-only updates are
routine. In the implementation, the sensitive-action registry shall evaluate the requested field
set against this boundary. `[ARCHITECTURAL INFERENCE + POLICY DECISION D1]`

---

## 12. Export Permissions

Principle: export authorization is enforced **server-side** on the export endpoints; a
download is a full-data channel and follows the approved exposure policy (D2).

| Export | Data class | Owner | Admin | Manager | Audit | Endpoint |
|---|---|---|---|---|---|---|
| Rent ledger (financial) | amount/amount_paid/balance/status per charge period | ALLOW | ALLOW | **DENY** | REQUIRED (add) | `GET /api/export/rent-ledger` (`:1543`) |
| Tenants (operational) | tenant directory | ALLOW | ALLOW | ALLOW | RECOMMENDED | `GET /api/export/tenants` (`:1569`) |
| Properties (operational) | property directory | ALLOW | ALLOW | ALLOW | RECOMMENDED | `GET /api/export/properties` (`:1594`) |

- The financial export is the D2 boundary: current flat availability to all roles is replaced by
  the recorded Admin/Owner-only restriction; Manager is DENY. `[POLICY DECISION D2]`
- Operational exports remain available to operational roles "according to current operational
  scope" (D2 phrasing) — i.e., all three roles, unchanged. `[POLICY DECISION D2]`
- Existing behavioral note: `GET /api/export/rent-ledger` runs `markOverdue()` before streaming
  (`:1547`) — the write-on-read defect (gap 7, §15) is classified OUTSIDE the permission model
  but must be addressed during implementation review.

---

## 13. Data Scope

**Decision: V1 uses the instance/global scope — no additional data-scope dimension.**

- All roles operate across the entire installation (single-tenant, one local database per
  installation — D4 per-installation license; closure §5/§8). [POLICY DECISION D4 + CURRENT STATE]
- No property-level, portfolio-level, or self-scope restriction is introduced. Justification:
  (a) the current product has no per-property authorization and no role is scoped today;
  (b) no approved decision (D1–D3) implies property scoping; (c) introducing one would be new
  policy plus new data-model concepts — out of scope for V1. `[ARCHITECTURAL INFERENCE]`
- The Data Scope slot of the model is therefore instantiated as **`global` (instance)** for every
  grant. `[ARCHITECTURAL INFERENCE]`
- Future option: if multi-company SaaS tenancy or portfolio-per-role operation ever arrives, the
  same slot can carry a `property` / `portfolio` scope without changing the matrix shape.
  `[FUTURE OPTION]`

---

## 14. Audit Requirements

Target audit requirements after the permission-model implementation (the live audit system and
its rows are unchanged by this gate; nothing here invents a schema change):

| Action class | Actions | Requirement | Current state |
|---|---|---|---|
| Sensitive financial changes | charge CREATE/GENERATE/UPDATE (routine+sensitive)/WAIVE/DELETE | REQUIRED | Already audited (app.ts:794,823,879,895) — preserved |
| Payment operations | payment RECORD, payment DELETE | REQUIRED | Already audited (:937, :957) — preserved |
| Destructive operations | all DELETE actions (property, unit, tenant, lease, charge, payment, vendor, work-order, application, user) | REQUIRED | Already audited — preserved |
| Role/user changes | user CREATE, user UPDATE, user ASSIGN, user DELETE | REQUIRED | user DELETE audited (:1463); CREATE/UPDATE/ASSIGN **not audited today → add audit records at implementation** |
| Settings changes | settings UPDATE | REQUIRED | Audited (:1344) — preserved |
| Exports | rent-ledger (financial) EXPORT; tenants/properties EXPORT | REQUIRED for financial; RECOMMENDED for operational | Not audited today → add export audit (financial) |
| Operational creates/updates | property/unit/tenant/vendor/work-order/application CREATE and UPDATE; reconcile MANAGE | RECOMMENDED (not in minimum set; may be added) | Not audited today — preserved |
| Read services | all READ actions, audit READ, dashboard READ | NONE | n/a |

Rationale: the minimum mandatory set is financial changes, payments, destructive operations,
role/user changes, settings changes, and (financial) exports — per the approved posture. Adding
audit for operational creates/updates is optional and preserved as RECOMMENDED. `[ARCHITECTURAL
INFERENCE]`

---

## 15. Known Gaps Classification

All seven known issues from the Role Policy Gate, classified explicitly. **Nothing here fixes
them.**

| Gap | Description (verified) | Classification | Rationale / destination |
|---|---|---|---|
| 1. Flat operational CRUD | No granular operational gates; only four gated surfaces exist | **CLOSE IN THIS PERMISSION MODEL** | The §7 matrix defines explicit per-role grants for every operational action; implementation gates per matrix |
| 2. Destructive operational deletes | Lease/property/unit/tenant/charge deletes remain all-role (`app.ts:342–902`) | **DEFER** | Approved decisions restricted only payment delete (D1). Behavior is preserved as the documented V1 baseline; a destructive-op refinement would need a new commercial decision — tracked, non-blocking |
| 3. Financial operation breadth | Money ops flat; no SoD | **CLOSE IN THIS PERMISSION MODEL** | D1 envelope implemented: manager DENY on waive, sensitive edit, payment delete (rows 21/22/26) |
| 4. Financial exports | Rent ledger exportable by any role (`:1543`) | **CLOSE IN THIS PERMISSION MODEL** | D2 implemented server-side (row 49): Admin/Owner only |
| 5. Policy-tab UI vs API 403 communication | Policy-tab UI surfaces differs from server 403 behavior | **OUTSIDE PERMISSION MODEL** | Presentation-layer communication; server authorization is authoritative and unchanged; separate UI work item |
| 6. AUTH_ENABLED=false asymmetry | When disabled, middleware resolves sessions but enforces nothing (`app.ts:98-107`) | **REQUIRES SEPARATE GOVERNANCE** | Deployment/environment semantics (dev/test vs production); not permission policy; a separate decision is required on whether auth-off remains a supported posture |
| 7. markOverdue() write-on-read | GET /rent-charges (:768), GET /dashboard/summary (:1210), GET /export/rent-ledger (:1547) and generate (:821) mutate `overdue` status on read/trigger | **OUTSIDE PERMISSION MODEL** | Runtime behavior defect; flagged as a mandatory implementation review item alongside the permission work — not a policy matter |

Classification guide: **CLOSE IN THIS PERMISSION MODEL** = the §7 matrix + sensitive-action
registry resolves it; **DEFER** = requires future commercial decision, non-blocking;
**OUTSIDE PERMISSION MODEL** = different concern layer; **REQUIRES SEPARATE GOVERNANCE** =
decision needed elsewhere. Gaps 2/5/6/7 do **not** block implementation of the approved D1–D3
envelope; none is an unresolved *permission-policy* blocker (§18).

---

## 16. Future Extensibility

Future responsibilities are **permission/domain scope compositions — not V1 role additions**.
The model keeps a flat capability vocabulary (`domain:resource:action`, aligned with the gate's
candidate scope naming such as `finance:record`, `finance:waive`, `export:rent-ledger`) so a
future responsibility can be assembled as a set of grants and, if ever needed, attached to a
persona — without reworking the role hierarchy or the matrix.

| Future responsibility | Would compose | V1 marker |
|---|---|---|
| Finance responsibility | `rent-charges:create|generate`, `payments:record`; plus (if entitled) `waive`, `charge-edit-sensitive`, `payment-delete` | Not a role; scope set (drafts the D1 admin+/sovereign carve-outs as optional) |
| Leasing responsibility | `leases:*`, `applications:*`, `units:read`, `properties:read` | Not a role; scope set |
| Maintenance responsibility | `maintenance:*`, `vendors:read` | Not a role; scope set |
| Viewer/Auditor responsibility | read-only composition: `*:read`, `audit:read` (manager-level, no financial write) | Not a role; scope set |

**Future responsibilities may become permission scopes or role compositions; this does not
authorize their implementation in V1.**

The extensibility mechanisms (scope naming, grant tuples, composition) are the only V1
constructs that anticipate these futures; no future responsibility, module, or agent is
implemented, licensed, or authorized by this document. `[FUTURE OPTION]`

---

## 17. Implementation Boundary

The next task ("Permission Model Implementation") is authorized to translate this gate into code,
**only** as follows:

- **Will do**: implement the §7 matrix and §11 sensitive-action registry in a single
  server-side authorization module; wire existing endpoints so the module decides (enforcing
  D1–D3); add the audit-record calls required by §14 (user create/update/assign, financial
  export); surface a read-only capability view to the UI for presentation (never enforcement).
- **Will not do**: introduce any new role (explicitly **no Finance role**); change
  `ROLE_HIERARCHY` or `hasMinimumRole` semantics; modify schema/migrations; modify the auth
  session mechanism or `AUTH_ENABLED` handling; implement the deferred gaps (§15).
- **Enforcement remains server-side and authoritative**; the UI never decides.
- Scope names follow the gate's `domain:resource:action` naming (e.g., `rent-charges:waive`,
  `export:rent-ledger`, `users:assign`, `audit:read`).
- Data scope is `global` (instance) for every grant in V1 (§13).

---

## 18. Permission Model Ready Gate

**Gate status: READY FOR IMPLEMENTATION.**

The exact conditions required before the "Permission Model Implementation" task begins, and their
satisfaction:

| # | Condition | Status |
|---|---|---|
| 1 | All V1 permissions explicitly mapped | SATISFIED — §7 maps all 52 endpoints across 51 grant rows |
| 2 | D1–D3 reflected correctly | SATISFIED — financial envelope (§7 rows 17–26), export boundary (§12), hybrid Owner (§8); no deviation |
| 3 | No unresolved permission policy blockers | SATISFIED — every approved decision is representable; silent-policy items preserved and flagged (§15 gaps 2/5/6/7 are deferred/outside/separate-governance, not permission-policy blockers) |
| 4 | Server-side authority clearly defined | SATISFIED — §5.3/§5.4/§17: centralized module, server authoritative |
| 5 | Audit-sensitive actions identified | SATISFIED — §11/§14 |
| 6 | No role expansion required | SATISFIED — Owner/Admin/Manager only; no Finance role (§5.2) |
| 7 | Boundary for sensitive charge edits stated | SATISFIED — §11 #2 (patch fields `amount`/`due_date`/`status` ⇒ sensitive) |
| 8 | Deferred/outside items classified, not silently closed | SATISFIED — §15 |

Because every condition is met, the Permission Model Implementation task may proceed pursuant to
§17. If any condition regresses during implementation planning, this gate re-opens to NOT READY.

---

## 19. Evidence / References

- Permission Model Gate — this document; runtime facts re-verified on HEAD `15d6b73`.
  `src/server/app.ts` line refs: auth middleware `:90-121`; properties `:287-342`; units
  `:377-424`; tenants `:448-515`; leases `:584-698`; rent-charges `:767-902` (incl. waive
  `status='waived'` `:834`, waive handling `:857`); payments `:913-957`; vendors `:976-1007`;
  work-orders `:1047-1113`; applications `:1138-1190`; dashboard `:1208-1210`; settings
  `:1307-1348`; reconcile `:1355-1362`; users `:1366-1465`; audit `:1470+`; exports
  `:1543-1619`. `src/server/auth.ts`: sessions `:65-103`; hierarchy `:154-165`; AUTH_ENABLED
  `:172-185`. [VERIFIED]
- Product Owner Decision Register — `Docs/execution/governance/product-owner-decision-register-2026-09-26.md`
  (§5 D1, §6 D2, §7 D3 — DECIDED 2026-09-26; §12 reconciliation; §13 carried-forward items).
  [VERIFIED]
- Commercial Architecture Closure — `Docs/execution/governance/commercial-architecture-closure-2026-09-26.md`
  (status CLOSED; §7 role/permission boundary; §8 deployment/LAN). [VERIFIED]
- Commercial Architecture Gate — `Docs/execution/governance/commercial-architecture-gate-2026-09-26.md`
  (§9 role/permission dependency incl. scope naming; §12.1-1 Permission Model precondition).
  [VERIFIED]
- Role Policy Gate — `Docs/execution/governance/role-policy-gate-2026-09-26.md` (§2 action
  matrix; §3 TEMPORARY/REALIGNMENT candidates; §10 Models A/B/C; §11 questions 1–12; §12 final
  matrix). [VERIFIED]
- Observation dataset — `Docs/execution/governance/disposable-commercial-observation-dataset-{design,injection}-*.md`
  (6 users: 2 owner/1 admin/3 manager; 85 audit rows; manager money ops observed). [VERIFIED]
- Upstream — clawnify/OpenProperty README (tip `a493028a`; no role model) and clawnify/property-os
  README + AGENTS.md (tip `3fba3c22`; personas; agents never record payments) — evidence only,
  fetched 2026-09-26. [SOURCE FACT — VERIFIED]

---

## 20. Conclusion

This gate translates the approved decisions **D1–D3** into a precise, endpoint-backed V1
authorization model: **Role → Domain → Resource → Action → Permission → Data Scope → Audit
Requirement**. The existing **Owner / Admin / Manager** hierarchy is preserved; **no Finance
role — or any new role — is introduced**; a future Finance responsibility is expressible as a
permission/domain scope composition without a role change. The matrix (§7) covers all 52
endpoints with `ALLOW` / `DENY` / `CONDITIONAL` only; sensitive actions (§11), exports (§12),
data scope (§13), and audit requirements (§14) are explicit; known gaps are classified, not
silently closed (§15). Advanced authorization is centralized and server-authoritative (§5, §17).
The **Permission Model Ready Gate is READY FOR IMPLEMENTATION** (§18); implementation may begin
under the §17 boundary when the next gate opens. No source, schema, migration, auth, permission,
UI, API, deployment, or runtime behavior was changed by this document.