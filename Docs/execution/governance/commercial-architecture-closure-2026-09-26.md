# Commercial Architecture Closure — ORKESTRIX Property System (2026-09-26)

**Document type**: commercial architecture closure (governance). **Documentation only — no
implementation authorized.**
**What this closes**: the Commercial Architecture Gate
(`Docs/execution/governance/commercial-architecture-gate-2026-09-26.md`, previously status
**NOT READY** because of seven unanswered blocker decisions D1–D7).
**What this does**: records the final commercial architecture for V1 after those decisions were
answered by the product owner and recorded in the Product Owner Decision Register
(`Docs/execution/governance/product-owner-decision-register-2026-09-26.md`, all seven entries
`DECIDED`), and states the next gate.

Source-tracking discipline (unchanged from the gate and register): `SOURCE FACT` (implemented or
documented upstream), `CURRENT STATE` (this repo), `POLICY DECISION` (an owner answer),
`ARCHITECTURAL INFERENCE` (derived), `FUTURE OPTION` (out of V1 scope). Tags `[VERIFIED]`
(directly observed) and `[INFERENCE]` (reasoned from verified facts) are used as before. Upstream
(clawnify/OpenProperty, clawnify/property-os) is referenced only as architectural evidence; no
upstream choice becomes an ORKESTRIX decision by itself.

---

## 1. Purpose

This document closes the Commercial Architecture Gate for ORKESTRIX Property System V1. The gate
was NOT READY because seven blocker decisions (D1–D7) materially affected authorization semantics
(D1–D3), the LAN/client relationship (D7), and the licensing / update / backup / release
architecture (D4–D6). The product owner has now answered all seven; the answers are recorded in
the Product Owner Decision Register (§3). This closure:

1. references the recorded decisions (§3, §4);
2. states the final commercial architecture for V1 (§5);
3. restates the layer boundaries with their resolved statuses (§6);
4. fixes the boundaries handed to the next phases — Permission Model (§7), Deployment/LAN (§8),
   License/Update/Backup (§9);
5. lists what remains deferred (§10);
6. verifies the closure criteria (§11);
7. declares the closure status (§12).

This document explicitly does **not** claim that any future implementation work (permission
enforcement, deployment, LAN/client validation, backup, license, update, installer, release) has
been performed. Those remain future phases with their own gates.

---

## 2. Baseline

- HEAD before this delivery: `a5f98d3` — "docs: create product owner decision register".
  Git chain: `a5f98d3` → `3671716` (Commercial Architecture Gate) → `49832fd` (Role Policy Gate).
  [VERIFIED — git log]
- The Commercial Architecture Gate (`3671716`) defined layers A–J, the V1 product-content scope,
  the core-first direction as a proposal, and §12 gate preconditions — status **NOT READY** until
  D1–D7 were answered.
- The Role Policy Gate (`49832fd`) ended READY WITH POLICY DECISIONS; its §11 questions 1–10/12
  fed D1–D3 and are now answered by the same recorded decisions (register §13).
- This delivery: (1) the Product Owner Decision Register is updated — D1–D7 changed from `OPEN`
  to `DECIDED` with populated `Product Owner Decision` and `Final Rule` fields; (2) this closure
  document is created.
- Working tree = inherited exceptions only (`Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5–P8/`,
  tc/tc3/vt/vt3.txt, modified ui-finalization docs, `tests/audit.test.ts`) — untouched.
  [VERIFIED — git status]
- Nothing in this delivery changes source, schema, migrations, auth, permissions, UI,
  deployment, installer, license, update, or backup behavior. [POLICY DECISION — recorded, not
  implemented]

---

## 3. Decision Register Reference

All seven blockers are answered in the register and are `DECIDED` with Final Rules.

| Register section | Decision | Status | Register Final Rule (summary) |
|---|---|---|---|
| §5 | D1 Financial Authority | `DECIDED` 2026-09-26 | Manager: generate/create charges ✓, record payments ✓, waive ✗, sensitive charge edits ✗, delete payments ✗; Admin: sensitive financial ops + managerial envelope; Owner: full envelope + final Principal authority; enforcement deferred to Permission Model |
| §6 | D2 Export Exposure | `DECIDED` 2026-09-26 | Operational CSVs per current operational scope; financial CSVs incl. rent ledger — Admin/Owner only; no implementation now |
| §7 | D3 Owner Identity | `DECIDED` 2026-09-26 | Hybrid role: operational + Principal authority; capable of normal operational work; highest governance/administrative authority; no new role |
| §8 | D4 Licensing Model | `DECIDED` 2026-09-26 | V1 license = one installation, associated with licensed server/installation; client/browser count not separately licensed; modules/agents = future entitlement dimensions; no implementation now |
| §9 | D5 Update Trust Model | `DECIDED` 2026-09-26 | Controlled outbound update; no inbound public application port; authenticated/authorized retrieval, integrity/authenticity verification, backup-before-migration, versioned migration handling, rollback capability; no implementation now |
| §10 | D6 Backup Responsibility | `DECIDED` 2026-09-26 | Hybrid: ORKESTRIX provides backup/restore mechanism; customer owns retention policy + external/off-server copy; no implementation now |
| §11 | D7 LAN / Concurrent Client Policy | `DECIDED` 2026-09-26 | V1 = one local server/installation + browser clients over local network; no artificial numeric client limit; future limit only from real load/concurrency testing; no implementation now |

The register also reconciles all cross-decision dependencies (§12), confirming the answers are
mutually consistent — including D4×D7 (no seat-number coupling in V1) and D5×D6
(backup-before-migration consistent with hybrid duty). [VERIFIED — register §12]

---

## 4. D1–D7 Final Decisions

Recorded verbatim below **as approved by the product owner** (register §5–§11; no reinterpretation).
[POLICY DECISION]

1. **D1 — Financial Authority**
   - Manager may generate/create rent charges.
   - Manager may record payments.
   - Manager may NOT waive charges.
   - Manager may NOT perform sensitive charge edits.
   - Manager may NOT delete payments.
   - Admin may perform the sensitive financial operations.
   - Owner retains final Principal authority.
   - Exact permission enforcement belongs to the next Permission Model phase.
2. **D2 — Export Exposure**
   - Operational CSV exports remain available to operational roles according to current
     operational scope.
   - Financial exports, including the rent ledger, are restricted to Admin and Owner.
   - No financial-export implementation is to be performed now.
3. **D3 — Owner Identity**
   - Owner is a Hybrid role: operational authority + Principal authority.
   - Owner remains capable of normal operational work.
   - Owner additionally holds the highest governance/administrative authority.
   - This does not require a new role.
4. **D4 — Licensing Model**
   - V1 commercial license = one installation.
   - License is associated with the licensed server/installation.
   - Client/browser count is not separately licensed in V1.
   - Modules and agents may become future entitlement dimensions.
   - Do not implement licensing now.
5. **D5 — Update Trust Model**
   - Future update model = controlled outbound update.
   - No inbound public application port.
   - Future update flow must include authenticated/authorized retrieval, package
     integrity/authenticity verification, backup before migration, versioned migration handling,
     and rollback capability.
   - Do not implement update infrastructure now.
6. **D6 — Backup Responsibility**
   - Hybrid responsibility.
   - ORKESTRIX provides the backup/restore mechanism.
   - Customer remains responsible for retention policy and maintaining an external/off-server copy.
   - Do not implement backup now.
7. **D7 — LAN / Concurrent Client Policy**
   - V1 deployment model remains one local server/installation with browser clients over the
     local network.
   - No artificial commercial numeric client limit is defined in V1.
   - A future supported concurrency limit must be based on real load/concurrency testing.
   - Do not invent a capacity number.
   - Do not implement LAN support now.

---

## 5. Final Commercial Architecture

**ORKESTRIX Property System V1** (fixed by these decisions; [POLICY DECISION] + [DEFINED]):

```
V1 =
  Global Core
  + Algeria Profile
  + Instance Configuration
  + Owner/Admin/Manager authorization model (roles unchanged; envelopes per D1–D3)
  + Local-first single-tenant deployment
  + One licensed server installation (D4: per-installation license)
  + Browser clients over LAN (D7: multi-device browser clients; no numeric limit)
```

**Future expansion** (recorded here so it is never folded into V1 scope; `[FUTURE OPTION]`):

```
Future =
  Property Core (upstream architecture reference; not an ORKESTRIX V1 layer)
  + Future Modules/Members (CRM, Inbox/Communication, Documents/Data room, Renders/Media,
    Bookings/hospitality, portals — as separate connected members per upstream verification-pin
    discipline; none scoped)
  + Future Agents (draft/propose only; never record payments; human-confirm write boundary)
  + External Integrations (payments, screening, syndication, messaging, calendars — Layer J,
    after first commercial cycle)
```

These future layers are architectural references, not current V1 scope, and are not scheduled by
this closure. [SOURCE FACT for upstream member/agent patterns; FUTURE OPTION for ORKESTRIX]

---

## 6. Layer Boundaries

Boundaries A–J as fixed by the Commercial Architecture Gate §7; statuses below reflect the
resolution of the D1–D7 decisions. **Status means architectural definition — never implementation
claim** (implementation remains behind each phase gate).

| Layer | Owns | Does NOT own | Status after closure |
|---|---|---|---|
| A. Product Core | Market-neutral domain: schema/migrations, server factory, UI shell, finance/ledger logic, maintenance, applications, audit, exports, i18n infra, auth/role model | Profile data; instance config; entitlement; connectivity | IMPLEMENTED |
| B. Product Profile | Market-static data: market-settings defaults (DZD / fr-DZ), wilayas, geo columns, locale catalogs, shell theme | Business rules; instance config | IMPLEMENTED (Algeria) |
| C. Commercial/Product configuration | Per-instance settings, users/role assignment, naming/branding, language pick | Profile-data authorship; license decisions | IMPLEMENTED (DB-backed settings) |
| D. Authorization / permission model | Role → capability enforcement (`hasMinimumRole` gates); envelope per D1–D3 | License/entitlement; new roles | V1 gates IMPLEMENTED; envelope DEFINED (D1–D3, register §5–§7); refinement = next phase, NOT implemented |
| E. Deployment model | How an instance is packaged/run/updated; one local server/installation; browser clients over LAN | Runtime internals; schema | DEFINED — posture + D7 answer fixed; packaging NOT implemented (Phase B) |
| F. Data ownership | Where customer data lives (customer-local DB); backup/restore lifecycle | Storing OBS dataset as customer data | RESIDENCE: target defined; backup duty DEFINED (hybrid, D6); mechanism NOT implemented |
| G. License layer | Instance-level entitlement; identity rules; upstream attribution | Permission model; role hierarchy | DEFINED — entitlement object = installation (D4); implementation deferred (Phase B) |
| H. Update layer | Versioning; controlled outbound update; integrity verification; rollback | Feature content | DEFINED — trust model fixed (D5); DEFERRED (Phase B), not implemented |
| I. Installer/package layer | Install/setup/uninstall; release packaging; clean-machine QA | DB schema; business logic | DEFERRED (Phase B) |
| J. Future external connectivity | Integration contracts/connectors (payments, screening, syndication, messaging, calendars) | Core domain rules | OUTSIDE V1 |

**Boundary rule** (unchanged from the gate): a responsibility belongs to exactly one layer.
"Financial authority" is a D-permission concern; "who may pay for an extra module" is a
G-license concern; the license layer must not live inside the permission model or the core.

---

## 7. Role/Permission Boundary for Next Phase

Handed to the **Permission Model** phase (gate §12.1-1). [POLICY DECISION — input contract]

- Roles stay `owner` > `admin` > `manager` with `hasMinimumRole` semantics; **no new roles**
  (D3: hybrid Owner is a role posture on the existing Owner, not a new role).
- The permission envelope is defined by D1–D3:
  - **Finance scope**: Manager — generate/create charges ✓, record payments ✓, waive ✗, sensitive
    charge edits ✗, delete payments ✗; Admin — sensitive financial ops + managerial envelope;
    Owner — full envelope + final Principal authority (include `finance:record`, `finance:waive`
    as candidate non-role scopes).
  - **Export scope**: operational CSVs (tenants/properties) per current operational scope for
    operational roles; financial CSVs incl. rent ledger — Admin/Owner only (candidate scope
    `export:rent-ledger`).
  - **Owner scope**: user-roster sovereignty and owner-only controls remain; owner retains full
    operational capability plus highest governance/administrative authority.
- Refinement is **additive feature-scope gates only**; no narrowing outside the recorded
  envelope; no permission redesign; current runtime gates and `AUTH_ENABLED` semantics untouched.
- The Role Policy Gate §11 items not covered by D1–D3 (user-role assignment scope; V1 gap list;
  pre-release closure list) enter as Permission Model / Release inputs, not blockers
  (register §13).

---

## 8. Deployment/LAN Boundary

Handed to the **Deployment Model** and **LAN/Client Model** phases (gate §12.1-2/-3).
[POLICY DECISION + CURRENT STATE]

- V1 deployment posture: **local-first, single-tenant**; one local server = one licensed
  installation (D4) = one customer-local database (F residence target).
- Clients: browser clients over the **local network** (D7). No artificial commercial numeric
  client limit in V1; no capacity number is invented by any decision or artifact.
- Any future supported concurrency limit must be derived from real load/concurrency testing in
  the LAN/Client phase before a number is set (test-before-number rule, register §11).
- Current state unchanged: `wrangler dev` serving the Vite client on one machine; sessions are
  server-side and DB-backed (sessions table, hashed token, TTL — `auth.ts:65-103`); no LAN
  binding configured. [VERIFIED — CURRENT STATE]
- Nothing in this closure enables, opens, or implements LAN access. [POLICY DECISION — deferred]

---

## 9. License/Update/Backup Boundary

Handed to the **License**, **Installer**, **Update**, and **Backup** phases (gate §12.1-4/-5/-6/-7).
[POLICY DECISION — input contracts; implementation deferred]

- **License (G)**: V1 entitlement object = the installation (per-installation license),
  associated with the licensed server/installation; browser-client count is NOT a licensed
  dimension in V1; modules and agents are potential future entitlement dimensions (out of V1).
  Upstream MIT attribution and brand rules preserved (gate layer G). No license code.
- **Update (H)**: controlled outbound update; no inbound public application port; future flow =
  authenticated/authorized retrieval + package integrity/authenticity verification + backup
  before migration + versioned migration handling (schema_migrations ledger) + rollback
  capability. No update infrastructure.
- **Backup (F)**: hybrid responsibility — ORKESTRIX provides the backup/restore mechanism;
  customer owns retention policy and an external/off-server copy; pre-update backup required by
  D5. No backup implementation.
- **Installer/Release (I / §I DoD)**: not started; blocked on their §12.1-6/-7 preconditions
  (D4+D5 answered — now satisfied; N1 target-platform list; UI-finalization and Commercial
  Closure Done; clean-machine QA) but **not claimed complete** by this document.

---

## 10. Deferred Scope

The following remain **future implementation work** and are **not claimed as implemented** by
this closure (each waits on its gate condition):

- **Permission enforcement** — next phase (D1–D3 envelopes).
- **Deployment** (packaging/run posture of the local instance) — Deployment Model phase.
- **LAN/client validation** (LAN topology, multi-device access, any future numeric limit from
  real testing) — LAN/Client Model phase.
- **Backup** (mechanism, retention, restore) — Backup phase (D6 duty recorded).
- **License** (entitlement enforcement) — License phase (D4 object recorded).
- **Update** (channel, integrity, rollback) — Update phase (D5 trust model recorded).
- **Installer** (install/setup/uninstall, release packaging, clean-machine QA) — Installer phase.
- **Release** (acceptance closure) — Release gate.

Also deferred from the Commercial Architecture Gate §13, unchanged: external connectivity (after
first commercial cycle), tenant/owner portals, online/remote payment processing, listing
syndication, real screening, SMS/email automation, multi-company SaaS tenancy, real-time sync,
PWA/offline, analytics dashboards, optional modules (CRM, Inbox/Communication, Data
room/Documents, Renders/Media, Bookings/hospitality), the agent layer (Sales/Resident/Studio
pattern), deal-to-unit link, resident portal, and Arabic RTL delivery pacing. None is scheduled
by this closure. `[FUTURE OPTION]`

---

## 11. Architecture Closure Criteria

The Commercial Architecture Gate §12.1 preconditions, mapped to their satisfaction:

| Gate §12.1 precondition | Satisfied by | Status |
|---|---|---|
| 1. Permission Model — D1, D2, D3 answered and recorded; Owner/Admin/Manager + `hasMinimumRole` preserved; only additive feature-scope gates; no new roles; no narrowing outside the envelope | Register §5–§7 (`DECIDED`); §7 above | SATISFIED |
| 2. Deployment Model — base purchase boundary (D4 object) fixed; local-first posture confirmed; server+client+DB ownership asserted (E/F) | D4 (per-installation), D7 (one local server + LAN browser clients), gate §7 E/F | SATISFIED |
| 3. LAN/Client Model — D7 answered (concurrent users, device policy); D3 answered (owner operating identity); deployment model accepted | D7 (no numeric limit; real-testing rule), D3 (hybrid owner) | SATISFIED |
| 4. Backup — D6 answered (duty, retention, recovery path); data-residence assertion (F) recorded | D6 (hybrid duty), §9 above | SATISFIED |
| 5. License — D4 answered (entitlement object & model); brand/attribution rules (G) fixed | D4, gate §7 G | SATISFIED |
| 6. Installer — D4 + D5 answered; N1 target-platform list confirmed | D4, D5 recorded; N1 remains a non-blocking confirm in the Installer phase | SATISFIED (N1 non-blocking) |
| 7. Release — preconditions 1–6 met; UI-finalization Done (§H) and Commercial Closure Done (§I) satisfied; clean-machine QA defined | 1–6 now met; §H/§I Done and clean-machine QA are Release-gate activities, not claimed here | SATISFIED FOR ENTRY — release closure itself remains future work |

Register §14 conditions 1–7 (statuses `DECIDED` with dated Final Rules; cross-dependency and
Role Policy Gate consistency) are all satisfied; the register's conclusion marks it COMPLETE.
Consistency check against the gate's own rule — no material policy decision remains open. [VERIFIED]

---

## 12. Closure Status

**CLOSED**

**Commercial Architecture V1 is now closed and may proceed to: Permission Model.**

The seven blocker decisions D1–D7 are answered and recorded (register §5–§11, all `DECIDED`).
The final commercial architecture for V1 is fixed (§5), layer boundaries restated (§6), and the
input contracts for the next phases are recorded (§7–§9). None of the deferred work is claimed as
implemented (§10); every deferred item remains behind its own gate and is future implementation
work:

- Permission enforcement · Deployment · LAN/client validation · Backup · License · Update ·
  Installer · Release.

The next phase to open is the **Permission Model** (gate §12.1-1) — design of additive
feature-scope gates on the recorded D1–D3 envelopes, with the existing Owner/Admin/Manager roles
unchanged.

---

## 13. Evidence / References

- Commercial Architecture Gate — `Docs/execution/governance/commercial-architecture-gate-2026-09-26.md`
  (§7 layers A–J, §8 product/module boundary, §9 role/permission dependency, §10 decision matrix,
  §11 D1–D7, §12/§12.1 gate + preconditions, §13 deferred scope) [VERIFIED].
- Product Owner Decision Register — `Docs/execution/governance/product-owner-decision-register-2026-09-26.md`
  (D1–D7 all `DECIDED` with Final Rules; §12 cross-decision reconciliation; §13 carried-forward
  items; §14 satisfaction; conclusion COMPLETE) [VERIFIED — this delivery].
- Role Policy Gate — `Docs/execution/governance/role-policy-gate-2026-09-26.md` (§3
  TEMPORARY/REALIGNMENT candidates, §10 Models A/B/C + variant axes, §11 questions 1–12,
  §12 final matrix) [VERIFIED].
- Role mapping — `Docs/execution/governance/role-operational-responsibility-mapping-2026-09-25.md`
  [VERIFIED].
- Core/Profile separation — `Docs/execution/governance/core-profile-separation-{gate,implementation}-2026-09-24.md`
  [VERIFIED].
- Observation dataset — `Docs/execution/governance/disposable-commercial-observation-dataset-{design,injection}-*.md`
  (6 users, 85 audit rows; managers authored 34 rows incl. money ops) [VERIFIED].
- Master plan — `Docs/current/UI-FINALIZATION-MASTER-PLAN.md` §G (Phase B boundary) and §I
  (Commercial Closure DoD) [VERIFIED].
- Plans — `Docs/plans/13{,b,c}-v1-implementation-plan.md` (P1–P12; V1 out-of-scope list; P5 role
  semantics) [VERIFIED].
- Source refs — `src/server/auth.ts:65-103,154-181`, `src/server/app.ts:90-121,1316-1497,1543-1567`
  (session/session gates, exports + `markOverdue`), P2 schema_migrations ledger, `package.json`
  (version 1.0.0; `@clawnify/app ^0.2.1` / `@clawnify/db ^0.4.1`) [VERIFIED].
- Upstream — clawnify/OpenProperty README (tip `a493028a`; MIT; self-hosted; no role model; no
  CSV export in feature set); clawnify/property-os README + AGENTS.md (tip `3fba3c22`; members
  referenced-by-repo with verification pins; agents draft but never record payments; optional
  agents "not hired yet"; connect = WhatsApp/Gmail/Calendar/OpenRouter) — used as architectural
  evidence only; no upstream choice is auto-adopted [VERIFIED — fetched 2026-09-26; SOURCE FACT /
  ARCHITECTURAL INFERENCE].