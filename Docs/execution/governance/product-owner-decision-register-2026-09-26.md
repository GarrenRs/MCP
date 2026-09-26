# Product Owner Decision Register — ORKESTRIX Property System (2026-09-26)

**Document type**: product-owner decision register (governance). **No implementation authorized.**
**Scope**: formalize the seven commercial architecture blocker decisions (D1–D7) identified by
`Docs/execution/governance/commercial-architecture-gate-2026-09-26.md`, so that the ORKESTRIX
product owner can answer them with full evidence and stated consequences.
**This register does not make, infer, or silently resolve any product-owner decision.** Every
decision was left explicitly OPEN until the product owner answered it — the owner's recorded
answers (2026-09-26) populate §5–§11 as `DECIDED`; this document only records them.

Evidence discipline (same tags as the Commercial Architecture Gate and Role Policy Gate):
`[VERIFIED]` = observed directly in the repo or in fetched upstream evidence;
`[INFERENCE]` = reasoned conclusion from verified facts; `[POLICY DECISION REQUIRED]` = belongs
to the ORKESTRIX product owner; `[UNKNOWN]` = not established. Classification labels:
`SOURCE FACT` (documented or implemented upstream), `CURRENT STATE` (this repo),
`PRODUCT OWNER DECISION` (the answer owed by the owner), `ARCHITECTURAL INFERENCE` (derived).

---

## 1. Purpose

The Commercial Architecture Gate ended **NOT READY** because seven blocker decisions (D1–D7) must
be answered before the downstream design phases (Permission Model, License, Installer, Update,
Backup, LAN/Client Model, Release) may begin. This register is the formal instrument for those
answers. For each decision it records, in one place:

1. the decision to be made (the exact question);
2. the current evidence (verified repo state + relevant upstream source facts);
3. the current state (what exists today, so the owner knows the baseline being decided);
4. the available options (documented alternatives — **not selected here**);
5. the architectural impact of the choice;
6. the downstream layers/phases that depend on the answer;
7. an explicit **Product Owner Decision** field, recorded by the owner;
8. a **Final Rule** field, recorded when decided;
9. a status, restricted to `OPEN` / `DECIDED` / `BLOCKED` — all seven are now `DECIDED`
   (recorded 2026-09-26).

This document is the single point of record. On 2026-09-26 the product owner answered all seven
decisions: each entry is updated to `DECIDED` with its `Final Rule` populated (§5–§11), which
satisfies the conditions for closing the Commercial Architecture Gate (§14) and is executed in
`commercial-architecture-closure-2026-09-26.md`. Until those answers existed, no decision was
treated as made, and the current flat behaviors were **not** confirmed commercial policy (Role
Policy Gate §13); they remain unchanged as runtime state — no enforcement is implemented by any
answer.

---

## 2. Baseline

- HEAD at register creation: `a5f98d3` — "docs: create product owner decision register". This
  follow-up update records the owner's D1–D7 answers; chain `a5f98d3` → `3671716` (Commercial
  Architecture Gate) → `49832fd` (Role Policy Gate). [VERIFIED — git log]
- Prior closed workstreams: Core/Profile Separation; Disposable Commercial Observation Dataset;
  Role Mapping; Role Policy Gate (`49832fd`, READY WITH POLICY DECISIONS — answers now recorded
  here); Commercial Architecture Gate (`3671716`, NOT READY — closed by the closure document).
- Working tree = inherited exceptions only (`Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5–P8/`,
  tc/tc3/vt/vt3.txt, modified ui-finalization docs, `tests/audit.test.ts`) — untouched by this
  register or its closure. [VERIFIED — git status]
- Nothing in this register (or its closure) changes source, schema, migrations, auth,
  permissions, UI, deployment, installer, license, update, or backup behavior.

---

## 3. Relationship to Commercial Architecture Gate

This register operationalizes §11 (`Open Product-Owner Decisions`) of the Commercial Architecture
Gate — it turns the blocker table into answerable decision records. Mapping:

| Register decision | Gate §11 ID | Gate-recorded impact | Blocks |
|---|---|---|---|
| D1 Financial Authority | D1 | Scope set the Permission Model implements; authorization semantics | Permission Model (§12.1-1) |
| D2 Export Exposure | D2 | Authorization boundary on a full-data channel (data exfiltration surface) | Permission Model + Release acceptance |
| D3 Owner Identity | D3 | Owner = working session role vs escalation/audit identity; client/device model | Permission Model + LAN/Client Model |
| D4 Licensing Model | D4 | License layer object model; Installer packaging; Release acceptance | License, Installer, Release |
| D5 Update Trust Model | D5 | Update layer (H) contract | Update layer, Installer |
| D6 Backup Responsibility | D6 | Data ownership (F) lifecycle side; Release acceptance | Backup model, Release |
| D7 LAN / Concurrent Client Policy | D7 | LAN/Client Model topologies (single-device vs multi-workstation) | LAN/Client Model |

Grounding note repeated from the gate §11: D1–D3 are **previously documented candidates** from the
Role Policy Gate §11; D4–D7 were **surfaced by the gate** from the Phase B scope boundary (master
plan §G/§I), and their detailed parameters are **new open questions**, not previously documented
decisions. This register preserves that distinction and does not upgrade any option into a
decision.

---

## 4. Decision Status Legend

| Status | Meaning | Guidance |
|---|---|---|
| `OPEN` | The decision is not yet answered; the Product Owner Decision and Final Rule fields are blank | Default when not yet answered; no longer the state of D1–D7 (all are now `DECIDED`) |
| `DECIDED` | A product owner answer is recorded; Final Rule is populated and dated | Set only by an explicit owner answer — not by inference |
| `BLOCKED` | The decision cannot be progressed because evidence or a prerequisite is missing | Not used today: the register's evidence is sufficient to *answer* each decision; ownership of the answer is what is missing |

Rules: a decision stays `OPEN` until the product owner explicitly decides. No option in this
register was a recommendation. If a decision becomes `BLOCKED`, the blocker and its unblocking
condition are recorded in §13. As of 2026-09-26 all seven decisions are `DECIDED` (answers and
Final Rules in §5–§11); `BLOCKED` is unused.

---

## 5. D1 — Financial Authority

- **Decision**: who may (a) create/generate rent charges, (b) edit rent charges, (c) waive rent
  charges, (d) record payments, (e) delete payments.
- **Current Evidence**
  - Financial operations are flat across all session roles: charge create/generate/waive/edit and
    payment record/delete carry no role gate (routes `app.ts:767-975`); payments have R/C/D only,
    no update endpoint. Payment/charge writes are audited (writeAudit inventory per Role Policy
    Gate §14 evidence list). `[VERIFIED]`
  - Observation dataset: 34 of 85 audit rows authored by managers; money operations demonstrably
    performed by managers (create payment 15, generate 3, create lease 20). `[VERIFIED]`
  - Role Policy Gate §3: the financial subset is classified **TEMPORARY → REQUIRES COMMERCIAL
    REALIGNMENT candidate** ("all roles read/write was not a money-policy statement"); §10 presents
    Model A (broad manager, current default codified), Model B (financial actions gated to admin+;
    manager loses money ops or gains read-only), Model C (no destructive ops), with unranked variant
    axes; §11 Q1/Q2/Q3/Q10 (payment recording; charge edit; delete; and whether charge-creation ≠
    payment-recording — Separation of Duties). `[VERIFIED]`
  - Upstream: OpenProperty's rent ledger supports recording payments and one-click removal with no
    role model (the foundation has no multi-role auth); property-os agents never record payments –
    "a person always … records the payment" (S4) – but that constrains a *future agent layer*, not
    staff-role authority. `[SOURCE FACT]` Nothing upstream is a transplantable money-authority
    policy: `[ARCHITECTURAL INFERENCE]` no upstream role-authority model exists to adopt.
- **Current State**: all five actions are open to all three roles (manager/admin/owner), flat, with
  audit coverage but no role gating and no Separation of Duties. `[CURRENT STATE]`
- **Available Options** (documented, not selected)
  1. Flat/codified (Model A): all operators keep full money powers; V1 behavior becomes explicit
     commercial policy.
  2. Financially restricted (Model B): charge create/generate/waive/edit and payment
     record/delete gated to admin+; manager keeps non-money operations.
  3. SoD split: separate charge-creation/generation from payment-recording authority (Role Policy
     Gate §11 Q10) so no single role both creates and settles without a second actor.
  4. Per-action mixtures: e.g., payment recording allowed for manager, waive/edit admin+, as a
     documented variant of B (§10 variant axes).
  - Any option may reserve an owner-only subset (couples to D3), and each has an audit-coverage
    stance (audit already covers these actions; gating is additive).
- **Architectural Impact**: fixes the exact scope set the Permission Model implements
  (feature-scope gates, no new roles — Commercial Architecture Gate §12.1-1); changes
  authorization semantics if recorded wrong; drives UI gating; does not touch the role hierarchy.
- **Downstream Dependencies**: Permission Model (§12.1-1 precondition D1); Release acceptance;
  auth test matrix (`tests/auth.test.ts`).
- **Product Owner Decision** (recorded 2026-09-26): Manager may generate/create rent charges and
  may record payments. Manager may NOT waive charges, may NOT perform sensitive charge edits, and
  may NOT delete payments. Admin may perform the sensitive financial operations (waive charges,
  sensitive charge edits, payment deletion). Owner retains final Principal authority. Exact
  permission enforcement belongs to the next Permission Model phase.
- **Final Rule** (dated 2026-09-26): Financial-authority envelope for the Permission Model input scope set (no
  enforcement now): Manager — generate/create charges ✓, record payments ✓, waive charges ✗,
  sensitive charge edits ✗, delete payments ✗; Admin — performs the sensitive financial
  operations (waive, sensitive charge edits, delete payments) in addition to the managerial
  envelope, per the verified cumulative hierarchy; Owner — retains the full envelope plus final
  Principal authority. The routine-vs-sensitive charge-edit boundary is defined by the Permission
  Model phase inside this envelope. Runtime behavior is unchanged until then.
- **Status**: `DECIDED`

---

## 6. D2 — Export Exposure

- **Decision**: who may export (a) operational CSV (tenants/properties directory), (b) the
  financial CSV (period rent ledger), (c) any export at all — i.e., whether the full rent-ledger
  export is scoped.
- **Current Evidence**
  - CSV exports (rent ledger / tenants / properties) are session-only across all roles
    (`app.ts:1543-1567`); the rent-ledger export triggers `markOverdue()` on read (`app.ts:1547`).
    `[VERIFIED]`
  - Role Policy Gate §3: "CSV export (full rent ledger) → all roles" classified **TEMPORARY →
    REQUIRES COMMERCIAL REALIGNMENT candidate** — "No export policy; financial data exposure to
    manager is a policy question" (Medium-High). §11 Q4: "Should Manager export CSV — in particular
    the full rent ledger?" `[VERIFIED]`
  - Upstream: OpenProperty's README feature set contains **no CSV export** at all — exports are an
    ORKESTRIX P11 addition; therefore there is no upstream export policy to inherit. `[VERIFIED]`
- **Current State**: any session role (manager/admin/owner) can download the full rent ledger,
  tenant directory, and property directory. `[CURRENT STATE]`
- **Available Options** (documented, not selected)
  1. Keep any-session-role export for all three (operational + financial flat).
  2. Scoped export: operational CSVs remain all roles; rent-ledger (financial) restricted to
     admin+ or owner-only.
  3. No CSV export in V1 (feature locked/removed) — note the foundation ships without exports by
     default.
  4. Role-filtered content: manager receives operational exports without financial columns
     (denormalized copy with payment/ledger columns removed) — highest implementation cost.
- **Architectural Impact**: determines an authorization boundary on a full-data channel (data
  exfiltration surface — gate D2 impact); affects Permission Model and Release acceptance; does not
  affect export mechanics (P11 implemented) beyond the read-side `markOverdue()` behavior.
- **Downstream Dependencies**: Permission Model; Release acceptance.
- **Product Owner Decision** (recorded 2026-09-26): Operational CSV exports remain available to
  operational roles according to current operational scope. Financial exports, including the rent
  ledger, are restricted to Admin and Owner. No financial-export implementation is to be
  performed now.
- **Final Rule** (dated 2026-09-26): Export scope for the Permission Model input scope set (no implementation now):
  operational CSVs (tenants/properties) — available to operational roles per current operational
  scope; financial CSVs including the rent ledger — Admin and Owner only. The current all-role
  export behavior stands until the Permission Model phase enforces the approved scope; no export
  code changes now.
- **Status**: `DECIDED`

---

## 7. D3 — Owner Identity

- **Decision**: is Owner primarily (a) the highest **operational** role — a working operator atop
  the cumulative hierarchy — or (b) a **Principal/sovereign** role above normal operational
  authority (oversight, escalation, ultimate accountability), or (c) a hybrid?
- **Current Evidence**
  - Role Policy Gate §5/§12: Owner is "business owner / principal authority"; roster sovereignty
    (user list/create/update/del, owner assignment, owner-only delete, bootstrap-created first
    owner) is **INTENTIONAL**; but Owner's *operational identity* is **TEMPORARY** — functionally
    identical to admin/manager by inheritance (money/delete/export flat): there is no
    oversight-only mode. `[VERIFIED]`
  - Role Policy Gate §11 Q5 (should admin and owner remain operationally identical), Q6 (which
    actions must be owner-only beyond the user-roster four), Q7 (audit visibility owner/admin-only
    vs manager own-actions). `[VERIFIED]`
  - Upstream: property-os lists the Property core's users as "Owner, property manager" — upstream
    treats owner and property manager as two personas of one app with **no role/permission model**;
    nothing to transplant. `[SOURCE FACT]` `[ARCHITECTURAL INFERENCE: upstream persona split is a
    positioning statement, not a privilege contract]`
- **Current State**: Owner = highest role, full operator powers identical to admin/manager, plus
  exclusive user-roster sovereignty and owner-only user deletion. `[CURRENT STATE]`
- **Available Options** (documented, not selected)
  1. Operator-owner (status quo codified): an owner is expected to operate daily with full powers.
  2. Principal-owner: owner identity is oversight/escalation/audit; operational duties delegate to
     admin/manager; the owner-only action set is expanded (answers Q6).
  3. Hybrid: owner has a principal default posture but may opt into operational sessions.
  - Variant axis (independent of D3's answer): audit visibility — owner/admin-only vs manager
    own-actions (Role Policy Gate §11 Q7).
- **Architectural Impact**: fixes whether "owner" is a working session role or an escalation/audit
  identity; changes the Permission Model's shape for the owner scope; couples to the LAN/Client
  Model (D7) via owner device/session expectations; touches user-management gates and
  bootstrap-first-owner semantics. Ownership of the answer also decides whether an owner "records
  payments, deletes leases, exports the ledger, or stays oversight-oriented" (Role Policy §3).
- **Downstream Dependencies**: Permission Model; LAN/Client Model (D7).
- **Product Owner Decision** (recorded 2026-09-26): Owner is a Hybrid role — operational
  authority plus Principal authority. Owner remains capable of normal operational work and
  additionally holds the highest governance/administrative authority. This does not require a new
  role.
- **Final Rule** (dated 2026-09-26): Owner identity within the existing three-role model (no new role): full
  operational capability (normal operational work, including the D1 financial envelope as
  recorded) combined with the highest governance/administrative authority (user-roster
  sovereignty and owner-only controls remain; final Principal authority per D1). The Permission
  Model phase records this as a role-posture statement on the existing Owner role — additive
  scope gates only; no new roles, no hierarchy change.
- **Status**: `DECIDED`

---

## 8. D4 — Licensing Model

- **Decision**: the commercial entitlement boundary for the installed product — per installation,
  per seat/user, per module, per agent, or hybrid.
- **Current Evidence**
  - No license code exists; upstream is MIT and self-hosted; one ORKESTRIX install == one
    company/database today (single-tenant). The License layer (G) is defined only as a boundary:
    instance-level entitlement, upstream attribution preserved (Commercial Architecture Gate §7 G).
    `[VERIFIED]`
  - Master plan §G Phase B scope: desktop-shell packaging; user/session/role model in deployment;
    release packaging; §I DoD. Licensing itself is not named as an implemented item — it is
    folded into the Phase B packaging boundary. `[VERIFIED]`
  - Upstream: OpenProperty ships feature-parity MIT with no tiers. property-os: "One agent on
    every plan, more when you grow" — Sales required on the smallest paid plan; Resident/Studio
    optional, shown as "not hired yet", hireable when the plan has room (S6). `[SOURCE FACT]`
    `[ARCHITECTURAL INFERENCE: property-os demonstrates a base + optional-extensions entitlement
    shape, but adopting any of it is a PRODUCT OWNER DECISION, not a default]`
- **Current State**: no entitlement system; installs are uncounted and unrestricted; licensing is
  a Phase B layer-G boundary only. `[CURRENT STATE]`
- **Available Options** (documented, not selected)
  1. Per-installation (one install = one entitlement; simplest; matches current single-tenant
     install; seat handling then lives in deployment policy, not licensing).
  2. Per-seat/user (entitlement scales with registered or concurrent users; couples to D7's
     numeric limit and to user administration).
  3. Per-module (optional future modules each separately entitled — a forward contract matching
     the upstream member pattern for when CRM/Inbox/Data room/Renders are ever scoped).
  4. Per-agent (future agent layer entitled per agent — property-os-style "agent on plan").
  5. Hybrid (base install + optional seat/module/agent extras).
- **Architectural Impact**: defines the License layer's object model (the licensed unit), the
  Installer's packaging (what is installed vs gated), and Release acceptance (what ships vs
  locks). It must **not** couple to the permission model (layer D) — entitlement and authorization
  stay separate (Commercial Architecture Gate §7 boundary rule).
- **Downstream Dependencies**: License → Installer → Release (pass-through of the dependency map).
- **Product Owner Decision** (recorded 2026-09-26): V1 commercial license = one installation.
  The license is associated with the licensed server/installation. Client/browser count is not
  separately licensed in V1. Modules and agents may become future entitlement dimensions. Do not
  implement licensing now.
- **Final Rule** (dated 2026-09-26): V1 entitlement object = the installation (per-installation license), associated
  with the licensed server/installation; browser-client count is NOT a licensed dimension in V1.
  Modules and agents are recorded as potential future entitlement dimensions (out of V1 scope).
  This rule is the input contract for the future License/Installer/Release gates (§12.1-5/-6/-7);
  no license implementation now.
- **Status**: `DECIDED`

---

## 9. D5 — Update Trust Model

- **Decision**: the update mechanism for installed instances — update channel, package
  integrity/authenticity, versioning scheme, rollback policy, and approval/control.
- **Current Evidence**
  - Master plan §G: "upgrade/versioning strategy; secure on-demand update channel" is a Phase B
    boundary item; §I DoD includes upgrade/versioning strategy and the update channel. Nothing is
    implemented. `[VERIFIED]`
  - Migration discipline exists and binds any update model: schema_migrations ledger (P2);
    additive-schema/COUNT-guarded-seed safe-change rules (`Docs/references/10-evolution.md`).
    `[VERIFIED]`
  - Upstream: each property-os member keeps its own verification pin and update path; pins advance
    via a sync workflow (S5) — a provenance discipline the update layer can mirror, but the
    delivery medium differs (ORKESTRIX is local-first; upstream Cloudflare deploy /
    `clawnify deploy`). `[SOURCE FACT]` `[ARCHITECTURAL INFERENCE: pin-and-verify discipline is
    adaptable; wholesale adoption is a PRODUCT OWNER DECISION]`
- **Current State**: no update channel, no packaging, no artifact signing; `package.json`
  declares version `1.0.0` (static); updates today would be manual replace of a codebase build.
  `[CURRENT STATE]`
- **Available Options** (documented, not selected)
  - Channel: (a) manual download/replace of a verified artifact; (b) in-app on-demand fetch from a
    designated source with verification; (c) vendor-pushed channel with transport security — each
    with manual or automatic approval tiers.
  - Integrity/authenticity: signed artifact (signature over the build); checksum beyond TLS;
    provenance bound to the ORKESTRIX build identity.
  - Versioning: application version aligned with a data-model version (schema_migrations); single
    vs multi-channel (stable/preview).
  - Rollback: data-preserving application rollback vs restore-from-snapshot (couples to D6).
  - Approval/control: auto-install vs notify-and-wait vs admin-gated approval (a deployment-user
    concept, not a role change).
- **Architectural Impact**: defines the Update layer (H) contract; adds an updater component to the
  Installer (I); Release acceptance includes the "secure on-demand update channel" §I DoD item;
  must respect the schema_migrations ledger so updates never free-run schema.
- **Downstream Dependencies**: Update → Installer → Release; rollback depends on Backup (D6).
- **Product Owner Decision** (recorded 2026-09-26): Future update model = controlled outbound
  update. No inbound public application port. The future update flow must include
  authenticated/authorized retrieval, package integrity/authenticity verification, backup before
  migration, versioned migration handling, and rollback capability. Do not implement update
  infrastructure now.
- **Final Rule** (dated 2026-09-26): Update posture for the Update/Installer/Release gates (§12.1-6/-7): updates are
  retrieved outbound under control (the instance reaches out; no inbound public application port
  is opened). Required future flow elements: authenticated/authorized retrieval; package
  integrity/authenticity verification; backup before migration (links to D6); versioned migration
  handling on the schema_migrations ledger; rollback capability. No update infrastructure is
  implemented now.
- **Status**: `DECIDED`

---

## 10. D6 — Backup Responsibility

- **Decision**: who owns backup responsibility (system-provided, customer-managed, or hybrid),
  backup scope, retention, restore responsibility, and the delivery mechanism.
- **Current Evidence**
  - Data residence target: customer-local DB on the installation machine (local D1 / SQLite-backed);
    no automatic cloud copy. The OBS dataset is disposable and is **not** customer data.
    `[VERIFIED]`
  - Master plan §G: "local data ownership; backup/restore; recovery/support model" — Phase B
    boundary; §I DoD: "Local data ownership with working backup/restore and documented recovery
    path." Nothing is implemented. `[VERIFIED]`
  - No backup, retention policy, or restore tooling exists today; recovery is manual (tooling only).
    `[CURRENT STATE]`
- **Current State**: no backup/restore implementation; no retention policy; recovery path
  undocumented; data lives with the install. `[CURRENT STATE]`
- **Available Options** (documented, not selected)
  1. System-provided: product automates backup/restore (scheduled, encrypted, local or to a
     customer-selected destination), with product-owned verification of restores.
  2. Customer-managed: product performs no backups; it documents procedures and the customer owns
     copying/safekeeping of the database.
  3. Hybrid: product takes scheduled local snapshots and supports restore; the customer owns
     off-machine retention (off-site or object-storage copy, encryption keys) — a common
     local-first posture.
  - Sub-questions: scope (database only vs DB + future media/attachments — none today), retention
    (rolling count-based vs time-based vs archival), restore responsibility and RTO/RPO
    expectations, and whether restore is an in-app feature or a documented recovery procedure
    (master plan §G recovery/support model).
- **Architectural Impact**: fixes the F. Data ownership lifecycle side; is a Release acceptance
  criterion (§I DoD); couples to D5 (pre-update snapshotting / rollback) and to the Installer
  (where backups live and how restores run).
- **Downstream Dependencies**: Backup → Release; informs Installer and Update gates.
- **Product Owner Decision** (recorded 2026-09-26): Hybrid responsibility. ORKESTRIX provides the
  backup/restore mechanism. The customer remains responsible for retention policy and for
  maintaining an external/off-server copy. Do not implement backup now.
- **Final Rule** (dated 2026-09-26): Division of backup duty for the Backup/Release gates (§12.1-4/-7): ORKESTRIX —
  provides the backup/restore mechanism (future Backup phase); Customer — owns the retention
  policy and maintains an external/off-server copy. Scope, retention and restore-verification
  detail belong to the Backup phase under this division of duty; pre-update backup is required by
  D5. No backup implementation now.
- **Status**: `DECIDED`

---

## 11. D7 — LAN / Concurrent Client Policy

- **Decision**: the intended client/server relationship in deployment (server bound to the
  operating machine only vs reachable on the LAN with multiple device clients); the
  concurrent-user/device policy; whether a commercial (numeric) limit exists; and what must be
  tested before any numeric limit is defined.
- **Current Evidence**
  - Master plan §G: "local server; LAN topology; multi-device access; user/session/role model in
    deployment" — Phase B boundary, not started; §I DoD: "LAN multi-device access verified with the
    deployment user/session/role model." `[VERIFIED]`
  - Current runtime: `wrangler dev` serves the Vite client on one machine; no LAN binding
    configured; sessions are server-side and DB-backed (sessions table, hashed token, TTL —
    `auth.ts:65-103`) with the role model per-install-global. `[VERIFIED]`
  - No concurrent-capacity testing exists; no numeric limit exists anywhere (no throttle, no seat
    counter, no entitlement counter). `[CURRENT STATE]` Defining a numeric cap today would be
    inventing tested capacity that does not exist.
  - Upstream: OpenProperty is self-hosted/cloud, no LAN path; property-os bundles apps into one
    dashboard (multi-app, not multi-client). `[SOURCE FACT]` No upstream LAN capacity guidance
    exists. `[UNKNOWN: capacity behavior of the local runtime under concurrent clients is
    unmeasured]`
- **Current State**: single-machine dev runtime; server on localhost; no concurrent-user test
  data; no commercial limit defined or enforced. `[CURRENT STATE]`
- **Available Options** (documented, not selected)
  1. Single-machine primary: server binds localhost only; LAN closed; one operator machine.
  2. LAN-open: server binds the LAN interface; multiple device clients (desktop/laptop) connect to
     the same instance under the existing role/session model.
  3. LAN-open with a commercial cap: a licensed seat/device ceiling (couples to D4 per-seat
     entitlement) — **only after measured capacity**, never before.
  - Test-before-number rule (recorded as a constraint on any answer): a numeric limit must be
    derived from measured evidence — concurrent-session load, request latency, and local-runtime
    behavior on a reference machine — not assumed. No tested capacity exists today.
- **Architectural Impact**: fixes the LAN/Client Model topologies (single-device vs
  multi-workstation) and whether seats are a license concept (D4) or a deployment concept; affects
  the session model and the Release QA environment.
- **Downstream Dependencies**: LAN / Client Model; pairs with Permission Model (D3) and License
  (D4).
- **Product Owner Decision** (recorded 2026-09-26): V1 deployment model remains one local
  server/installation with browser clients over the local network. No artificial commercial
  numeric client limit is defined for V1. A future supported concurrency limit must be based on
  real load/concurrency testing. Do not invent a capacity number. Do not implement LAN support
  now.
- **Final Rule** (dated 2026-09-26): V1 layout = one local server/installation; browser clients over the local
  network; no artificial commercial numeric client limit in V1. Any future supported concurrency
  limit must be derived from real load/concurrency testing — no capacity number is invented by
  this decision or by any earlier artifact. LAN support is deferred and never claimed implemented;
  no LAN implementation now.
- **Status**: `DECIDED`

---

## 12. Cross-Decision Dependencies

Interactions that must be reconciled when the owner answers (identifying them is not deciding):

- **D1 × D3** — the financial envelope sits relative to owner identity: a Principal-owner answer
  (D3) implies an owner-only financial subset; an Operator-owner answer keeps money on the shared
  operator plane (Role Policy Gate §11 Q6).
- **D2 × D1** — export is a financial channel; the export scope (D2) will likely track the
  financial authority decision (D1) or be decided independently; both feed the same Permission
  Model scope set.
- **D3 × D7** — a Principal-owner changes client/session expectations (owner may sign in rarely,
  for oversight), which informs LAN client policy.
- **D4 × D7** — per-seat entitlement (D4) is only meaningful with a concurrent-user policy (D7);
  D7 must be answered (with measured capacity) before any per-seat number is set.
- **D5 × D6** — rollback (D5) requires backup availability (D6); update-channel and backup-scope
  answers must be co-consistent.
- **D4 × D5 × D6 → Release** — License object, update channel, and backup/restore are all Release
  acceptance criteria (master plan §I); Release is their common consumer.
- **D1–D3 → Permission Model** — the permission scope set cannot be designed until these three
  are answered (Commercial Architecture Gate §12.1-1).
- **D1–D7 → Commercial Architecture Closure → Implementation sequence** — closure flips only when
  all seven are recorded as DECIDED with Final Rules; the implementation sequence then starts with
  Permission Model (Commercial Architecture Gate §12.1-1) and proceeds through the gated order.

Reconciliation status (2026-09-26): the recorded answers are mutually consistent — D1×D3: hybrid
Owner keeps full operational reach plus final Principal authority, so no owner-only financial
subset is forced; D2×D1: the financial-export restriction (Admin/Owner) tracks the admin+/owner
financial-envelope boundary; D3×D7: hybrid Owner is a working role over the local network like
other roles (principal posture is an authority statement, not a device statement); D4×D7: V1 has
per-installation licensing and no numeric client limit, so no seat-number coupling is active;
D5×D6: backup-before-migration is required by D5 and consistent with the hybrid D6 division of
duty; D4×D5×D6→Release: license object, update channel and backup/restore remain future
Release-gate inputs (never implemented here); D1–D3→Permission Model: the permission scope set is
now defined and Permission Model is the next gate; D1–D7→Closure: all seven are DECIDED and the
Commercial Architecture Gate is closed in the closure document.

### Dependency map (compact)

```
D1─┐
D2─┼→ Permission Model
D3─┘

D4 → License → Installer → Release
D5 → Update ──→ Installer → Release
D6 → Backup ────────────────→ Release
D7 → LAN / Client Model

D1–D7 → Commercial Architecture Closure → Implementation sequence
```

---

## 13. Product Owner Decisions Pending

As of 2026-09-26 all seven register decisions are `DECIDED` (product owner answers in §5–§11;
Final Rules populated). The Role Policy Gate §11 questions that map to D1–D3 were carried forward
here (they were the same answers, seen from the permission side) and are now covered by the
recorded decisions:

1. Payment recording authority (→ D1) 2. Charge edit/create/generate/waive authority (→ D1)
3. Operational delete authority (Model C; → D1/D2) 4. Rent-ledger CSV export (→ D2)
5. Admin/Owner operational identity (→ D3) 6. Owner-only action set beyond user roster (→ D3)
7. Audit visibility for manager (variant axis; → D3) 8. Settings level & owner-exclusive settings
   (→ D3, non-blocking refinement) 9. User-role assignment scope (stands per current behavior —
   confirm) 10. Financial Separation of Duties (→ D1) 11. V1-acceptable gaps list (→ Permission
   Model design input) 12. Pre-release closure list (→ Release gate).
Items 9, 11 and 12 remain Permission Model / Release gate inputs rather than blockers: user-role
assignment scope (9) stands per current behavior and is confirmed during Permission Model design;
the V1-acceptable-gaps list (11) and the pre-release closure list (12) belong to the Permission
Model and Release gates respectively.

Non-blocking items (N1–N5) from the gate remain open but do not block design: installer target
platform list (N1), Arabic/RTL pacing (N2), OBS dataset policy (N3), visual polish (N4), UI copy
stewardship (N5). They are recorded here so they are not forgotten, not because they gate the
architecture.

---

## 14. Conditions for Commercial Architecture Closure

The Commercial Architecture Gate (§12) flips from **NOT READY** when **all** of the following
hold — every condition was satisfied on 2026-09-26 (statuses `DECIDED` with dated Final Rules in
§5–§11):

1. D1, D2, D3 answered and recorded (`DECIDED` + `Final Rule`) → then Permission Model design may
   begin (§12.1-1); answers must preserve Owner/Admin/Manager + `hasMinimumRole` semantics and
   introduce only additive scope gates; no new roles.
2. D4 answered → License design may begin (entitlement object/model fixed).
3. D5 answered → Update layer design may begin (channel/integrity/rollback contract fixed).
4. D6 answered → Backup design may begin (duty/scope/retention/restore declared).
5. D7 answered → LAN/Client Model design may begin (topology + policy, with measured-capacity
   evidence where any numeric limit is set).
6. Every decision recorded above is internally consistent with the Cross-Decision Dependencies
   (§12) and with the Role Policy Gate §11 answers where they overlap.
7. The register status column for D1–D7 shows `DECIDED` with dated Final Rules.

Conditions 1–7 now hold. The gate's transition is executed in
`Docs/execution/governance/commercial-architecture-closure-2026-09-26.md` (Closure Status:
`CLOSED`). Permission Model is the first gated phase to open (§12.1-1); the other gated phases
(Deployment, LAN/Client, Backup, License, Installer, Update, Release) remain future work and must
not be claimed as implemented. The current flat operational plane and the current single-machine
runtime are **not** changed by these decisions — enforcement lands in the Permission Model phase.

The closure document (`commercial-architecture-closure-2026-09-26.md`) §11 additionally maps
every Commercial Architecture Gate §12.1 precondition (1–7) — including Deployment (2),
LAN/Client (3), Installer N1 target-platform confirm (6), and Release (7, UI-finalization /
clean-machine QA) — to its satisfaction status. Those non-decision preconditions are tracked in
the closure, which remains the reference for them; this register records the D1–D7 decisions and
their conditions only.

---

## 15. Next Gate

The product owner answered D1–D7 on 2026-09-26 (§5–§11; the carried-forward Role Policy Gate §11
items are covered by those same answers):

1. **Close the Commercial Architecture Gate**: executed in
   `commercial-architecture-closure-2026-09-26.md` (Closure Status: `CLOSED`) — the closure
   expressly states V1 may proceed to Permission Model.
2. **Begin Permission Model design** (gate §12.1-1) as the first downstream phase, using the
   recorded D1–D3 answers (Final Rules §5–§7) as its input scope set — additive feature-scope
   gates only; no new roles; no narrowing outside the recorded envelope.
3. Proceed in the gated order: Deployment Model → LAN/Client → Backup → License → Installer →
   Update → Release, each unlocked by its recorded decision (dependency map §12); none of these
   phases is open yet.
4. The register statuses are now `DECIDED` with populated `Product Owner Decision`/`Final Rule`
   fields (§5–§11) and §12 cross-dependencies reconciled.

---

## Evidence / References

- Commercial Architecture Gate — `Docs/execution/governance/commercial-architecture-gate-2026-09-26.md`
  (§7 layer boundaries, §10 decision matrix, §11 D1–D7 + N1–N5, §12 ready gate, §12.1 preconditions,
  §14 evidence) [VERIFIED].
- Commercial Architecture Closure — `Docs/execution/governance/commercial-architecture-closure-2026-09-26.md`
  (Closure Status: CLOSED; next gate: Permission Model) [VERIFIED — this delivery].
- Role Policy Gate — `Docs/execution/governance/role-policy-gate-2026-09-26.md` (§2 action matrix,
  §3 TEMPORARY/REALIGNMENT classifications, §7 sensitive action split, §10 Models A/B/C + variant
  axes, §11 questions 1–12, §12 final matrix, §13 status) [VERIFIED].
- Role mapping — `Docs/execution/governance/role-operational-responsibility-mapping-2026-09-25.md`
  [VERIFIED].
- Core/Profile separation — `Docs/execution/governance/core-profile-separation-{gate,implementation}-2026-09-24.md`
  [VERIFIED].
- Observation dataset — `Docs/execution/governance/disposable-commercial-observation-dataset-{design,injection}-*.md`
  (6 users, 85 audit rows, managers authored 34 rows incl. money ops) [VERIFIED].
- Master plan — `Docs/current/UI-FINALIZATION-MASTER-PLAN.md` §G (Phase B boundary scope) and §I
  (Commercial Closure DoD) [VERIFIED].
- Plans — `Docs/plans/13{,b,c}-v1-implementation-plan.md` (P1–P12; V1 out-of-scope list; P5 role
  semantics) [VERIFIED].
- Source refs — `src/server/auth.ts:154-181`, `src/server/app.ts:90-121,1316-1497,1543-1567`
  (gates/exports), P2 schema_migrations ledger, `package.json` (version 1.0.0; `@clawnify/app
  ^0.2.1` / `@clawnify/db ^0.4.1`) [VERIFIED].
- Upstream — clawnify/OpenProperty README (tip `a493028a`; MIT; self-hosted; no role model; no CSV
  export in feature set); clawnify/property-os README + AGENTS.md (tip `3fba3c22`; members
  referenced-by-repo with verification pins; agents draft but never record payments; optional
  agents "not hired yet"; connect = WhatsApp/Gmail/Calendar/OpenRouter) [VERIFIED — fetched
  2026-09-26].

---

## Conclusion

The product owner answered all seven commercial blocker decisions on 2026-09-26. Every entry in
this register is now `DECIDED` with a recorded `Product Owner Decision` and a populated
`Final Rule` (§5–§11); no decision was made by inference — each records the owner's explicit
answer. The register is **COMPLETE**: all seven commercial blockers are resolved, historical
evidence and source distinctions are preserved, and the register satisfies every condition
required to close the Commercial Architecture Gate (§14). The closure is executed in
`Docs/execution/governance/commercial-architecture-closure-2026-09-26.md` (Closure Status:
`CLOSED`), which expressly states V1 may proceed to Permission Model. Nothing in these decisions
changes source, schema, migrations, auth, permissions, UI, deployment, installer, license,
update, or backup behavior: the current flat money/delete/export behavior, the single-machine
runtime, and the install model remain exactly as they are today. Permission Model is the next
phase to open.