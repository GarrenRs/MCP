# Commercial Architecture Gate — ORKESTRIX Property System (2026-09-26)

**Gate type**: read-only architecture / documentation gate. **No implementation authorized.**
**Scope**: define the target commercial architecture of ORKESTRIX Property System V1 — layer
boundaries (core / profile / configuration / authorization / deployment / data / license /
update / installer / connectivity), the V1 commercial product shape, the source-aligned
future direction, and the explicit "Commercial Architecture Ready" gate with its conditions.
**No permission model change, no new role, no schema/API/UI/runtime change.**

Evidence discipline. Two vocabularies are used together:

- **Evidence tags** (same as the Role Policy Gate): `[VERIFIED]` = observed directly in this repo
  or in fetched upstream evidence; `[INFERENCE]` = reasoned conclusion from verified facts;
  `[POLICY DECISION REQUIRED]` = belongs to the ORKESTRIX product owner; `[UNKNOWN]` = not established.
- **Classification labels** (per the source-truth principle): `SOURCE FACT` (documented or
  implemented upstream), `CURRENT STATE` (this repo), `POLICY DECISION` (product-owner),
  `ARCHITECTURAL INFERENCE` (derived), `FUTURE OPTION` (later direction, not V1 scope).
- **Decision-matrix statuses** (§10): DEFINED · DEFINED WITH CONDITION · OPEN POLICY DECISION ·
  DEFERRED · OUTSIDE V1.

A single claim may combine a classification label and an evidence tag; a claim that is a current
product-owner decision is always marked `[POLICY DECISION REQUIRED]`.

---

## 1. Purpose

This document fixes the *architecture posture* the ORKESTRIX Property System will carry into the
commercial phase, before any Permissions / Deployment / LAN / Backup / License / Installer /
Release design starts. It:

1. Records the upstream architectural sources (OpenProperty, property-os) and their exact signals.
2. States the current product state after Core/Profile separation, P1–P12, UI finalization, the
   Role Mapping and Role Policy Gate work, and the Disposable Commercial Observation Dataset.
3. Defines ten layer boundaries (A–J) and who owns what.
4. Answers the twelve Commercial V1 questions with explicit classification.
5. Designates the smallest clean V1 commercial package and separates it from optional future
   modules, customer configuration, external integrations, and the future agent layer.
6. Produces a Commercial Decision Matrix with explicit statuses.
7. Ends with the "Commercial Architecture Ready" gate, its per-area preconditions, and the
   list of product-owner decisions that currently **block** the first downstream designs.

This document is architecture and governance only. It implements nothing.

---

## 2. Baseline

- HEAD: `49832fd` — "docs: role policy gate - validate intended commercial permission model".
  [VERIFIED — git log]
- Prior closed workstreams (each with its own gate/commit):
  1. **Core/Profile Separation** — gate + implementation landed; `Core + Algeria Profile ≡ current
     product behavior` verified; seam = two deployment entries + one profile package. [VERIFIED —
     `core-profile-separation-{gate,implementation}-2026-09-24.md`]
  2. **Disposable Commercial Observation Dataset (OBS)** — design + injection landed; deterministic,
     resettable dataset exercising the Core+Profile system; **disposable, not customer data**.
     [VERIFIED — `disposable-commercial-observation-dataset-{design,injection}-2026-09-2*.md`]
  3. **Role Mapping** — verified Owner/Admin/Manager operational responsibility inventory
     (commit `e323fe3`). [VERIFIED]
  4. **Role Policy Gate** — boundary classifications INTENTIONAL / TEMPORARY / REQUIRES COMMERCIAL
     REALIGNMENT; status READY WITH POLICY DECISIONS; §11 answers outstanding (commit `49832fd`).
     [VERIFIED — `role-policy-gate-2026-09-26.md`]
- Phases P1–P12 all COMPLETE (V1 functional/operational V1 index). [VERIFIED — `V1-PHASE-INDEX.md`]
- Post-P12 UI finalization per its master plan; Phase B (Commercial/Deployment Closure) is a
  **planning boundary only, NOT implemented, NOT scheduled** inside that plan. [VERIFIED —
  `UI-FINALIZATION-MASTER-PLAN.md` §F/§G/§I]
- Working tree = inherited exceptions only (`Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5–P8/`,
  tc/tc3/vt/vt3.txt, modified ui-finalization docs, `tests/audit.test.ts`); they were **not touched**
  by this gate. [VERIFIED — git status]
- Observation dataset (injected): 6 users (2 owner / 1 admin / 3 manager), 85 audit rows,
  `AUTH_ENABLED=true`. [VERIFIED — dataset phase]

---

## 3. Source Tracking

Upstream references fetched live on 2026-09-26 (raw READMEs, AGENTS.md, GETTING-STARTED.md,
GitHub commits API). Claims below are traceable to those fetches; upstream text is paraphrased,
not copied.

| # | Source | Date / ref / commit | Exact architectural signal | Relevance to ORKESTRIX | Adoption |
|---|---|---|---|---|---|
| S1 | OpenProperty README | fetched 2026-09-26; repo branch `master`; tip `a493028a` (2026-09-09) | Self-hosted / cloud-based open-source rental property management (properties & units, tenants & leases, rent ledger, work orders, vendors); alternative to TenantCloud/AppFolio/Buildium/Propertyware for landlords & small property managers; MIT | Confirms the upstream foundation's identity, feature surface, and market framing that ORKESTRIX's V1 core descends from | ADOPTED (foundation) |
| S2 | OpenProperty README — "What's intentionally not included" | same ref as S1 | Deliberately out: listing syndication, real credit/background screening, 2-way SMS/email automation, online card/ACH payments, public tenant/owner portals. "These can all be layered on top once you fork the template." | Matches ORKESTRIX plan-13 V1 out-of-scope list; confirms the "core first, integrations later, layered on top" pattern | ADOPTED (as deferred/outside-V1 direction) |
| S3 | OpenProperty commits #6/#7/#8 | `0b7e46fc` (2026-09-09), `58dc1b52` (2026-09-09), `a493028a` (2026-09-09) | OpenProperty adopts the platform design system and `<AppNav>` from `@clawnify/app`; "the bundle drops five apps into one dashboard sidebar"; unbundles duplicate `@clawnify/db`; adds `@phosphor-icons/react` (SDK peer) | ORKESTRIX runs the same SDK posture: local `app.tsx:2,194-202` imports `AppNav/embedded/reportLocation` from `@clawnify/app/client`; pins `@clawnify/app ^0.2.1` + `@clawnify/db ^0.4.1` (single copy) | ADOPTED (inherited SDK posture) |
| S4 | property-os README | fetched 2026-09-26; tip `3fba3c22` (2026-09-21) | "AI property management software… one install": five connected apps (Property=OpenProperty, CRM, Inbox, Data room, Renders) + one sales agent; the loop List → Sell → Hand over → Run → Stage; "The agent files, drafts and stages; a person always sends the message, signs the contract and records the payment" | Blueprint for ORKESTRIX's future module/agent expansion: separate connected members around a strong property core, never a monolith; human-in-the-loop agents never touch the ledger | ADOPTED as direction; DEFERRED as scope (not V1) |
| S5 | property-os README — Members | same ref as S4 | Members referenced by repo as git submodules pinned to verified commits; changes go upstream to member repos ("never into this one"); each member keeps its own verification pin and update path; weekly pin-sync workflow | Defines the "one member" release/update posture a commercial product should preserve: the property app is a durable unit with its own verified revision and update path | ADAPTED (ORKESTRIX is a fork-with-work, not a bundle submodule; the unit/pin/update-path discipline is adopted for the release model) |
| S6 | property-os README — Agents | same ref as S4 | Sales agent required, hired at install, works on the smallest paid plan; Resident and Studio optional, shown as "not hired yet", one click to hire when plan has room — "one agent on every plan, more when you grow" | Licensing/entitlement pattern for a future agent layer: base product + optional paid extensions; optional items are visible-but-locked in product UI | ADAPTED as future licensing reference; DEFERRED (no agents in V1) |
| S7 | property-os README — "Not wired yet" | same ref as S4 | Not wired: deal-to-unit link from CRM into Property (hand-over today = agent proposes + person enters), resident portal, bookings member (hospitality) | Explicit upstream "documented future" list; ORKESTRIX must treat these as future options, not V1 requirements | DEFERRED / OUTSIDE V1 |
| S8 | property-os README — Connect | same ref as S4 | External connectivity: WhatsApp Business via Clawnify, Gmail/Google Calendar via Clawnify connections, OpenRouter key for Renders | Confirms external connectivity is a **layered, customer-wired** concern that belongs to a future layer, not the property core | DEFERRED / OUTSIDE V1 |
| S9 | property-os AGENTS.md | fetched 2026-09-26 | Bundle layout: `clawnify.json` root manifest (`bundle.apps[]`, `bundle.agents[]` with `required` flag); agents in `agents/<name>/` (AGENT.md, skills/, flows/); apps as read-only submodules; install = one command + answer four questions | Describes how modules/agents attach to a core product at install — future entitlement/install reference for ORKESTRIX's Phase B | DEFERRED (installer/agents are Phase B+) |
| S10 | property-os docs/GETTING-STARTED.md | fetched 2026-09-26 | Onboarding narrative: Property is "the ledger" — first thing is the property and its units, "so every other app has something to point at" | Reinforces that the property core is the load-bearing first member; everything else (CRM/Inbox/Data/Renders) hangs off the core | ADOPTED as direction |
| S11 | property-os commits | `3fba3c22` (2026-09-21, pin sync: open-crm@9c7c1b1, open-channels@b0c2170, open-dataroom@ff6a35a, open-render-studio@32860c1); `7a88853c` (2026-09-15, inbox→CRM connect); `1af9d55` (2026-09-14, pin sync incl. **open-property@a493028**); `3f447896` (initial five-members-three-agents) | Bundle evolves by re-pinning member commits; OpenProperty's recorded verified pin = `a493028a` | ORKESTRIX V1 sits behind current upstream tips (baseline audit `98bfc4a`, local HEAD `49832fd`); upstream continues independently — no automatic dependency | DEFERRED (no upstream re-sync now) |

**Fact / inference / policy / future note**: S1–S3, S9–S11 are SOURCE FACTS. S4–S8 mix SOURCE
FACTS (what upstream documents) with FUTURE OPTIONS for ORKESTRIX (what we would do with them).
Nothing in this table converts an upstream idea into a current ORKESTRIX requirement, and no
signal becomes a binding ORKESTRIX rule by being listed here: ADOPTED/ADAPTED in the table mean
*source-aligned direction proposed for ORKESTRIX*; formal adoption by the product owner is a
POLICY DECISION that this gate does not make.

---

## 4. Current Product State

What exists in this repository today [VERIFIED unless noted]:

- **Identity**: ORKESTRIX Property System = commercial localized product; OpenProperty = upstream
  MIT foundation; the two are **not the same identity** (brand doc `Docs/current/14`).
  `package.json` still carries the upstream package name `@clawnify/open-property` (unrenamed —
  package naming is a release concern, untouched here). [INFERENCE: rename is a Phase B/release decision]
- **Architecture**: Global Core + Algeria Profile implemented. `src/server/index.ts` and
  `src/client/main.tsx` are the only composition entries; `createApp(profile)` /
  `App({ profile })` are core; `src/profile/algeria/` carries settingsDefaults (DZD, fr-DZ),
  the 58-wilaya dataset, geo columns (`commune`/`wilaya` contract), locale catalogs, shell
  theme, styles. First-run seeding = settings only (no demo portfolio).
- **Roles**: Owner/Admin/Manager over single-tenant auth; `ROLE_HIERARCHY` (manager=0/admin=1/
  owner=2) + `hasMinimumRole` (`auth.ts:154-165`); middleware + public allowlist + `AUTH_ENABLED`
  (`app.ts:90-121`); settings PUT gate `app.ts:1320` is authEnabled-conditional; users/audit/
  reconcile gates are unconditional (`app.ts:1357-1497`); bootstrap creates the first owner.
- **Role policy stand**: Role Policy Gate is READY WITH POLICY DECISIONS — V1 model verified and
  documented, but the §11 product-owner answers are outstanding.
- **Data**: Disposable OBS dataset is live in the local D1 (6 users, 85 audit rows,
  `AUTH_ENABLED=true`); deterministic/resettable; **not customer data**.
- **Client**: FR (`fr-DZ`) primary; AR (`ar`) catalog complete with RTL shell per UI finalization;
  sidebar from platform `<AppNav>` contract with ORKESTRIX brand shell.
- **Phase B (commercial closure)**: NOT started — local web-app runtime, desktop-shell packaging,
  local server, LAN topology, multi-device access, deployment user/session/role model, local data
  ownership, backup/restore, upgrade/versioning, secure update channel, installation/setup,
  recovery/support, release packaging, clean-machine QA, final RC are all boundary-only items.

---

## 5. Upstream Architectural Signals

The upstream sources send four clear signals:

1. **A strong, standalone property core is the product's foundation.**
   OpenProperty is a complete, self-hostable rental property-management app (S1). In property-os it
   is called "the ledger" — "Property is the ledger… so every other app has something to point at"
   (S10). ORKESTRIX already inherits this: the Core + Profile separation produced a market-neutral
   property core that is fully functional on its own.

2. **Additional operational modules are separate connected members, not monolith extensions.**
   property-os ships CRM, Inbox, Data room and Renders as distinct member repos, pinned as
   submodules, updated upstream, dropped into one dashboard sidebar (S4, S5, S3). The explicit
   bundle principle is "members referenced by repo, never copied here" (S9). The implication for
   ORKESTRIX (**proposed direction, adoption pending**): future modules (CRM, Communication,
   Documents, Media/Studio, Bookings) should arrive as separate apps/members connected to the
   core — not be folded into `src/` as monolith boltons.
   [ARCHITECTURAL INFERENCE from S4/S5/S9 — the upstream *does* implement separate member repos;
   the "don't fold in" consequence for ORKESTRIX is a reasoned conclusion, and applying it is a
   PRODUCT-OWNER policy decision when those modules are ever scoped]

3. **Agents (future) work across members but never commit state.**
   "The agent files, drafts and stages; a person always sends the message, signs the contract and
   records the payment"; "the agent proposes … a person confirms; nothing is written to the ledger
   by the agent" (S4). Entitlement pattern: one required agent on the base plan, optional agents
   visible as "not hired yet" (S6). For ORKESTRIX this is a *future* layer; V1 has no agents.
   [FUTURE OPTION]

4. **Everything not in the core is intentionally layered on top, later, when demand justifies it.**
   OpenProperty's "intentionally not included" list (S2) and property-os's "not wired yet" list
   (S7) are explicit, documented deferrals — the canonical upstream way of keeping the core small.
   ORKESTRIX's plan-13 V1 out-of-scope list is the same discipline. [SOURCE FACT, matched in CURRENT STATE]

**Evaluation of the preserved principle.** The principle *"build a strong property-management core
first, then allow additional operational modules/members and agents to exist around it rather than
turning the property core into a monolith"* is **supported by source evidence** (S3, S4, S5, S9,
S10) and is appropriately labeled **ADOPTED-AS-PROPOSAL / DEFERRED-AS-SCOPE**: the core stays a
durable standalone unit and expansion is external-member-based *if the ORKESTRIX product owner
adopts this direction* — that adoption is a policy decision this gate does not make. Until then
this is direction/analysis only, and V1 scope includes zero modules and zero agents. The
implication chain *Property Core + CRM + Communication + Documents + Media/Studio + Agents +
Future integrations* becomes: each of those is a *future member or layer*, connecting to the core
through defined interfaces (data hand-over, agent-propose/human-confirm, connectors), never a
monolith fold. [ARCHITECTURAL INFERENCE — direction only, proposed, not adopted by owner]

---

## 6. Commercial Architecture Model

The target architecture is a **local-first, single-tenant, instance-shipped property-management
product whose market-neutral core is wrapped by one market profile, one instance configuration,
one authorization envelope, and a series of deferred commercial/deployment layers**.

Compact form:

```
         ORKESTRIX Property System instance (one company / one database)
   ┌─────────────────────────────────────────────────────────────────┐
   │  C. Instance configuration (settings, users/roles, naming)      │
   │  D. Authorization envelope (Owner/Admin/Manager - V1 stable)    │
   │  A. Product Core (market-neutral property domain + UI shell)    │
   │  B. Product Profile (Algeria: DZD, fr-DZ, wilayas, geo, theme)  │
   ├─────────────────────────────────────────────────────────────────┤
   │  E. Deployment model   (local server + browser clients)         │
   │  F. Data ownership     (customer-local DB + backup lifecycle)   │
   │  G. License layer      (instance entitlement; model = OPEN)     │
   │  H. Update layer       (verified on-demand channel; Phase B)    │
   │  I. Installer/package  (install/setup/QA; Phase B)              │
   │  J. External connectivity (integrations; OUTSIDE V1)            │
   └─────────────────────────────────────────────────────────────────┘
   Future members/agents attach around the core (see §8), never inside §A.
```

### 6.1 The twelve Commercial V1 questions — answers with classification

The answers describe the **target commercial architecture** (the posture ORKESTRIX should carry
into the commercial phase), derived from current state (§4) and upstream direction (§5). Where
the target is not yet implemented (packaged deployment, backup, license, updates, LAN), that is
stated per answer; current state lives in §4.

1. **What exactly is the V1 commercial product?**
   ORKESTRIX Property System: a locally installed, single-tenant property-management application —
   Global Property Core + Algeria Profile (DZD, fr-DZ, wilayas) — sold under the ORKESTRIX identity
   (never as OpenProperty), for an Algerian landlord / small property manager running one business
   with owner/admin/manager staff, full rent ledger, maintenance, applications, exports, and audit.
   [CURRENT STATE: the implemented Core+Profile feature set; POLICY DECISION: sale identity (fixed by
   brand doc 14) and market/pricing posture (open)]

2. **What remains part of the reusable global Core?**
   The market-neutral domain: core schema/entities and migrations, server factory
   (`createApp(profile)`), UI shell (`App({profile})`), i18n infrastructure, auth/role model,
   rent-ledger/finance logic, maintenance, applications, audit, exports, dashboard, error codes.
   The feature surface of the product does not change when the profile changes. [VERIFIED / DEFINED]

3. **What belongs specifically to the Algeria Profile?**
   Market-static data and defaults: `DZD` + `fr-DZ` settings defaults, country default `DZ`,
   the 58-wilaya dataset (`wilayas.ts`), geo columns `commune`/`wilaya` (contractual order),
   locale catalogs (`fr.json`, `ar.json`, `en-fragment.json`), shell theme/styles. [VERIFIED / DEFINED
   — five-island seam per Core/Profile gate]

4. **What must remain instance/customer configuration rather than Profile?**
   Settings values (rent policy: due day, late fee, grace days, currency), the portfolio
   (properties/units/tenants/leases/charges/payments/work orders/applications), per-install user
   and role assignment, `AUTH_ENABLED` toggles, branding/naming per install, language choice.
   Profile = static market data shipped in code; configuration = per-customer data in the DB.
   [DEFINED — the settings store is already database-backed]

5. **What is the intended deployment unit?**
   One instance = one codebase build (server process + static client) + one local database,
   installed on one machine as the primary operating point. The V1 deployment unit is the
   self-contained local web application (master plan §G "Local Web-Application runtime").
   [DEFINED WITH CONDITION — packaging/installer mechanics are Phase B]

6. **What is the intended relationship between Server, Client devices, users and roles?**
   One server hosts the single-tenant database and API; browsers (client devices) reach it; users
   authenticate with roles (owner/admin/manager) enforced server-side (hasMinimumRole); bootstrap
   creates the first owner; sessions are per-user. Local-first: server + primary client on the
   operating machine; LAN extension (server reachable on the local network, clients on other
   devices) is a later, gated step. [DEFINED WITH CONDITION: single-machine defined; LAN posture =
   OPEN POLICY DECISION]

7. **Is the product fundamentally local-first, LAN-first, cloud-first, or hybrid?**
   **LOCAL-FIRST.** Master plan §G orders Phase B as local runtime → local server → LAN topology →
   multi-device access; upstream OpenProperty is self-hostable/self-hosted by design (S1); no
   ORKESTRIX dependency on a vendor cloud exists. Cloud (Cloudflare Workers/D1) is the template's
   optional deployment path, not the commercial posture. [DEFINED]

8. **Where does customer data live?**
   In the customer's own local database (local D1/SQLite on the installation machine), under the
   customer's control. The OBS dataset is disposable/deterministic/resettable and is **not**
   customer data. Backup/restore ownership and recovery-path scope are Phase B items.
   [DEFINED WITH CONDITION: residence defined; backup = OPEN POLICY DECISION]

9. **What is the intended update model?**
   Boundary: "upgrade/versioning strategy; secure on-demand update channel" (master plan §G) —
   Phase B, not started. Direction: instance-local, on-demand, with integrity/verification and
   rollback path (per upstream member "verification pin and update path" discipline, S5).
   Exact mechanism and trust model: OPEN POLICY. [DEFERRED (Phase B)]

10. **Where should the license boundary live?**
    In a dedicated License layer (G) operating at the **instance/entitlement** level in the
    packaged release — not inside the authorization/permission model and not inside the core.
    Entitlement gates what is installed/used (base product, later optional modules/agents), while
    the permission model stays a pure role→capability concern. ORKESTRIX identity with upstream MIT
    attribution preserved (brand doc). Enforcement model/mechanism: OPEN POLICY DECISION.
     [DEFINED WITH CONDITION: layer-G boundary fixed; enforcement model open]

11. **What must remain outside the commercial core until there is demonstrated demand?**
    Everything in plan-13's V1 out-of-scope list plus upstream "not wired yet" items: tenant/owner
    portals, online/remote payment processing, listing syndication, real screening integrations,
    SMS/email automation, multi-company SaaS tenancy, real-time sync, PWA/offline, analytics
    dashboards, and the optional modules/agents layer (CRM/Inbox/Data room/Renders, sales/resident/
    studio agents, bookings/hospitality, deal-to-unit link, resident portal). [DEFERRED / OUTSIDE V1]

12. **What must be treated as future integration/external connectivity rather than V1 architecture?**
    All of layer J: payment processors, screening providers, listing syndication, SMS/email
    providers, WhatsApp/email/calendar connectors, media/rendering services. V1 architecture must
    not depend on any of them; they are layered on top when demand is demonstrated (S2/S8), and
    external-connectivity study starts only after the first commercial cycle closes.
    [OUTSIDE V1, per task constraint]

---

## 7. Layer Boundaries

Who owns which responsibility [status in brackets]:

| Layer | Owns | Does NOT own | Status |
|---|---|---|---|
| A. Product Core | Market-neutral domain: schema/migrations, server factory, UI shell, finance/ledger logic, maintenance, applications, audit, exports, i18n infra, auth/role model | Profile data; instance config; entitlement; connectivity | IMPLEMENTED |
| B. Product Profile | Market-static data: market-settings defaults (DZD / fr-DZ), wilayas, geo columns, locale catalogs, shell theme | Business rules; instance config | IMPLEMENTED (Algeria) |
| C. Commercial/Product configuration | Per-instance settings, users/role assignment, naming/branding, language pick | Profile-data authorship; license decisions | IMPLEMENTED (DB-backed settings) |
| D. Authorization / permission model | Role → capability enforcement (hasMinimumRole gates) | License/entitlement; new roles | IMPLEMENTED V1; envelope refinement GATED (see §9) |
| E. Deployment model | How an instance is packaged/run/updated (local runtime; one server + browser clients; LAN later) | Runtime internals; schema | DEFINED (target posture); packaging NOT implemented (Phase B) |
| F. Data ownership | Where customer data lives (customer-local DB, target); backup/restore lifecycle | Storing OBS dataset as customer data | RESIDENCE: target defined (§6Q8); backup scope = OPEN POLICY DECISION, not implemented |
| G. License layer | Instance-level entitlement; identity rules; upstream attribution | Permission model; role hierarchy | DEFINED WITH CONDITION: boundary fixed; model = OPEN POLICY DECISION |
| H. Update layer | Versioning; integrity-verified on-demand update channel; rollback | Feature content | DEFERRED (Phase B) |
| I. Installer/package layer | Install/setup/uninstall; release packaging; clean-machine QA | DB schema; business logic | DEFERRED (Phase B) |
| J. Future external connectivity | Integration contracts/connectors (payments, screening, syndication, messaging, calendars) | Core domain rules | OUTSIDE V1 |

**Boundary rule**: a responsibility belongs to exactly one layer. The moment a commercial concern
(license, entitlement, connectivity, packaging) tries to live inside the permission model or the
core, that is a defect — e.g., "financial authority" is a D-permission concern; "who may pay for
the extra module" is a G-license concern.

---

## 8. Product/Module Boundary

Operational/system language; no marketing terms.

- **CORE PRODUCT (V1, in scope to ship)**
  Global Core + Algeria Profile, single-tenant local instance: properties/units, tenants, leases,
  rent ledger (charges/payments/waives/overdue), maintenance & vendors, applications, rent policy
  settings, users+roles (owner/admin/manager), audit trail, CSV exports, dashboard, FR(+AR) UI,
  DZD. This is the smallest clean V1 commercial **product-content** scope. Package readiness
  (installer, clean-machine QA, release closure) is a separate gate (§12.1-6/-7) and is not
  claimed by this document. [DEFINED]

- **OPTIONAL FUTURE MODULES (deferred; to arrive as separate connected members, not monolith folds)**
  CRM (deals-to-unit pipeline), Communication/Inbox (WhatsApp/email conversations and templates),
  Documents/Data room (tracked links, passcodes, visit analytics), Media/Renders (virtual staging),
  Bookings/hospitality, tenant/owner portal. Per S4/S5/S9 each would be its own app with its own
  verification pin and update path, connected to the core — **proposed direction, adoption
  pending (policy decision); none are scoped**. [FUTURE OPTION]

- **CUSTOMER CONFIGURATION (instance data, never Profile code)**
  Rent-policy settings, portfolio records, users and their role assignments, per-install naming/
  branding, language choice. Lives in the customer DB (§4/§6Q4). [DEFINED]

- **EXTERNAL INTEGRATIONS (deferred, layered)**
  Payment processing, screening, listing syndication, SMS/email automation, WhatsApp/email/
  calendar connectors. Layer J; V1 has no runtime dependency on them (S2, S8). [OUTSIDE V1]

- **FUTURE AGENT LAYER (deferred)**
  Agents that draft/propose/stage but **never send, sign, or record payments** (S4); human
  confirmation is the write boundary. Entitlement reference: required agent on base plan, optional
  agents shown-but-locked as "not hired yet" (S6). No agents in V1. [FUTURE OPTION]

---

## 9. Role/Permission Dependency

The Role Policy Gate (`role-policy-gate-2026-09-26.md`) is the authority here; this section only
extracts its commercial consequences. No permission redesign is attempted.

- **Commercial decisions blocked by unresolved role policy** (the §11 answers): the financial
  authority envelope (who may create/generate/waive/edit charges, record/delete payments), the
  export exposure boundary (full rent-ledger CSV available to any session role), owner-as-operator
  vs owner-as-principal, and audit-visibility scope. [POLICY DECISION REQUIRED]

- **Decisions that must be answered before Permission Model design**: the financial subset,
  the destructive subset (manager operational deletes), and the export subset — the three
  "REQUIRES COMMERCIAL REALIGNMENT" candidates in the Role Policy Gate — decide the *envelope* the
  Permission Model refines. Without them, Permission Model design would invent authority that was
  never granted. [POLICY DECISION REQUIRED — BLOCKER for Permission Model]

- **Owner/Admin/Manager can remain structurally unchanged while their permission envelope is
  refined later**: yes. The role hierarchy and `hasMinimumRole` semantics are verified and
  intentional; refinement is additive (feature-level gates), not a role-model change. The Role
  Policy Gate classified the session wall, the cumulative hierarchy, settings-write admin+,
  user admin+ with owner-only sub-rules, owner-only user deletion, audit read admin+, and
  bootstrap-first-owner as INTENTIONAL. [VERIFIED]

- **Separation of Duties commercial effect**: the candidates that implicate SoD are the financial
  authority envelope (e.g., who records vs who waives) and audit-read dominance (audit readable
  only by admin+/owner). These refine the envelope in the Permission Model phase; they do not
  change the architecture. [INFERENCE from Role Policy Gate]

- **Domains that may become permission scopes without becoming roles**: finance, export, audit,
  settings, users, reconcile. The V1 gate structure already treats these as endpoint-level gates;
  the Permission Model may later express them as named scopes (e.g., `finance:record`,
  `finance:waive`, `export:rent-ledger`) **without adding roles**. [INFERENCE — future, non-role scopes]

---

## 10. Commercial Decision Matrix

Statuses: DEFINED · DEFINED WITH CONDITION · OPEN POLICY DECISION · DEFERRED · OUTSIDE V1.

| Area | Current Evidence | Commercial Target | Status | Decision Needed | Depends On |
|---|---|---|---|---|---|
| Product identity | Brand doc 14: ORKESTRIX Property System; OpenProperty = upstream | Sell under ORKESTRIX; never as OpenProperty; MIT attribution preserved | DEFINED | — | — |
| Core/Profile | Separation implemented & verified (seam = 2 entries + 1 profile) | Global Core + Algeria Profile ≡ product; profiles swappable | DEFINED | — | — |
| Roles | Owner/Admin/Manager hierarchy verified + intentional | Roles unchanged structurally | DEFINED | — | — |
| Permissions | V1 gates verified; envelope candidates listed | Envelope refined via additive feature-scope gates | DEFINED WITH CONDITION | §11 financial/export/destructive answers | §11 (role-policy gate) |
| Financial authority | Flat CRUD today; charge/payment ops available to manager roles in practice | Scoped by envelope (finance subset) | OPEN POLICY DECISION | Who may create/waive/edit charges; record/delete payments | Role-policy §11 |
| Data ownership | Local D1 DB at runtime (dev/local); OBS disposable (not customer data) | Customer data resides customer-local (target); backup lifecycle defined | DEFINED WITH CONDITION | Backup/responsibility scope (Phase B) | Phase B opening |
| Deployment | Local web-app runtime boundary (§G); wrangler local D1 | One instance = one server + one local DB + browser clients | DEFINED | — | — |
| LAN | Phase B boundary only; not started | LAN topology + multi-device access after deployment model | DEFERRED | Concurrent-user/device policy | D7 + Deployment model |
| Clients | Browser clients against local server | Single-machine browser clients now; LAN devices later under the LAN gate | DEFINED | — | LAN gate |
| Backup | Phase B boundary only; recovery path unbuilt | Customer-owned backup/restore + documented recovery | OPEN POLICY DECISION | Who owns backup duty; retention | Phase B |
| License | No license code; upstream MIT | Instance-level entitlement in packaged release | OPEN POLICY DECISION | Licensing model (per-install/seats/modules/agents) | §11 open + Phase B |
| Updates | Phase B boundary only | Verified on-demand update channel + rollback | DEFERRED | Trust/integrity model | Phase B |
| Installer | Phase B boundary only | Install/setup/clean-machine QA/release packaging | DEFERRED | Target platforms; packaging | License + Update |
| External connectivity | Plan-13 out-of-scope list; upstream "layered on top" | Nothing in V1 depends on it | OUTSIDE V1 | — | After first commercial cycle |
| Modules | None beyond core; upstream member pattern verified | Optional future members connect around core | DEFERRED | — | Demand + core closure |
| Agents | None; upstream draft-only/human-confirm pattern verified | Future agent layer (never writes ledger) | DEFERRED | — | License model + demand |
| Integrations | None wired; connectors deferred upstream (S8) | Layer J, customer-wired, after V1 | OUTSIDE V1 | — | Connectivity phase |

---

## 11. Open Product-Owner Decisions

The architecture shape is fixed; these product-owner answers are not. They are classified
**blocker** (must be answered before the named design phase starts) or **non-blocker** (does not
affect the architecture). Grounding: D1–D3 are **previously documented candidates** from the Role
Policy Gate §11. D4–D7 are **surfaced by this gate** from the Phase B scope boundary — master plan
§G/§I name backup/restore, upgrade/versioning/update channel, LAN topology and multi-device access
as Phase B scope items — but their detailed parameters (entitlement object, trust/integrity model,
retention/SLA, concurrent-user/device policy) are **new open questions raised here**, not
previously documented decisions. Nothing in the list is treated as already granted: every item is
explicitly `[POLICY DECISION REQUIRED]`.

### Blockers (block start of a downstream gate)

| # | Decision | Architectural impact | Blocks |
|---|---|---|---|
| D1 | Financial authority envelope: which roles may create/generate/waive/edit charges and record/delete payments | Fixes the scope set the Permission Model implements; changes authorization semantics if wrong | Permission Model (§12.1) |
| D2 | Export exposure: may every session role receive the full rent-ledger CSV, or is export scoped? | Determines an authorization boundary on a full-data channel (data exfiltration surface) | Permission Model + Release acceptance |
| D3 | Owner-as-operator vs owner-as-principal: is the owner an active daily operator or a delegating principal? | Fixes whether "owner" is a working session role or an escalation/audit identity; affects client/device model | Permission Model + LAN/Client Model |
| D4 | Licensing model: per-install, per-seat, or module/agent-based entitlement (upstream pattern S6); what the base purchase is | Defines the License layer's object model, the Installer's packaging, and Release's acceptance | License, Installer, Release |
| D5 | Update trust model: channel, integrity verification, rollback policy for installed instances | Defines the H. Update layer contract (mirrors upstream "verification pin" discipline, S5) | Update layer, Installer |
| D6 | Backup scope & duty: who owns backup/restore for customer-local data; retention; recovery SLA | Fixes F. Data ownership's lifecycle side and Release acceptance criteria | Backup model, Release |
| D7 | Deployment multi-operator usage target: simultaneous users per install; device policy on the LAN | Fixes the LAN/Client Model's topologies (single-device vs multi-workstation) | LAN/Client Model |

### Non-blockers (may stay open; they do not change architecture)

| # | Item | Why non-blocking |
|---|---|---|
| N1 | Exact installer target-platform list (Windows/macOS/Linux set) | Layer I is permissive today; the local web-app runtime posture fits all; platform list is packaging detail |
| N2 | Arabic/RTL delivery pacing (after FR) | Sequencing decision, not architecture |
| N3 | OBS dataset size/retention policy | Dataset is disposable by design; affects observations, not architecture |
| N4 | Visual/brand polish beyond identity rule (brand doc already fixed identity) | Presentation only |
| N5 | UI copy/tone stewardship | Content, not structure |

**Standing constraint (task-level)**: the first commercial cycle must close before any
external-connectivity study; V1 proceeds without it.

---

## 12. Commercial Architecture Ready Gate

**Gate status: NOT READY.**

The commercial architecture *posture* (layers A–J, the V1 product-content scope, the core-first
direction as a proposal) is defined by this document — but the seven blocker decisions (D1–D7)
materially affect authorization semantics (D1–D3) and the licensing / update / backup / LAN /
release architecture (D4–D7). Per the gate rule — *do not claim READY while unresolved policy
decisions materially affect architecture* — the commercial architecture is **not ready** until
they are answered. The preconditions below define exactly what must be true before each downstream
phase may begin; today none are met.

### 12.1 What has to be true before proceeding to… (preconditions — none met today)

1. **Permission Model** — D1, D2, D3 answered and recorded; Owner/Admin/Manager +
   `hasMinimumRole` semantics preserved; only additive feature-scope gates (finance/export/audit/
   settings/users/reconcile) may be introduced; no new roles; no narrowing outside the recorded
   envelope.
2. **Deployment Model** — the base purchase boundary (D4's object) fixed; local-first posture
   confirmed (already defined); server+client+DB ownership asserted (E/F).
3. **LAN / Client Model** — D7 answered (concurrent users, device policy); D3 answered (owner
   operating identity); deployment model accepted.
4. **Backup** — D6 answered (duty, retention, recovery path); data-residence assertion (F) recorded.
5. **License** — D4 answered (entitlement object & model); brand/attribution rules (layer G) fixed.
6. **Installer** — D4 + D5 answered; target-platform list confirmed (N1).
7. **Release** — preconditions 1–6 met; UI-finalization Done (UI master plan §H) and Commercial
   Closure Done (master plan §I) satisfied; clean-machine QA defined.

### 12.2 What must NOT be touched before these gates

- Roles list, `hasMinimumRole`, session wall, `AUTH_ENABLED` semantics — no role/permission change.
- Settings/users/audit/reconcile gate code and their endpoint semantics.
- Schema, migrations, API contracts, authorization logic (D layer).
- The Core/Profile seam: `src/profile/algeria/` package, `createApp(profile)`,
  `App({ profile })`, the two deployment entries.
- Brand identity document, this report, and all prior governance/execution reports (no rewrites,
  no moves). `Docs.zip` / `Docs/Docs.zip` and all inherited worktree exceptions stay untouched.
- Master plan — not to be modified unless explicitly instructed later.
- No implementation may start for: LAN, backup, license enforcement, update channel, installer,
  external connectivity, new modules, agents, or permission-envelope refinement — until the
  corresponding gate condition is met.

---

## 13. Deferred Scope

Not started and not scheduled inside this gate (each with its gate condition):
LAN topology & multi-device access (§12.1-3) · backup/restore (§12.1-4) · license enforcement
(§12.1-5) · installer/package (12.1-6) · update channel (D5/License) · external connectivity
(after first commercial cycle) · tenant/owner portals · online/remote payment processing ·
listing syndication · real screening · SMS/email automation · multi-company SaaS tenancy ·
real-time sync · PWA/offline · analytics dashboards · optional modules (CRM, Inbox/Communication,
Data room/Documents, Renders/Media, Bookings/hospitality) · agent layer (Sales/Resident/Studio
pattern) · deal-to-unit link · resident portal · Arabic RTL delivery pacing.

---

## 14. Evidence / References

**Upstream (fetched 2026-09-26):** [VERIFIED]
- OpenProperty README — raw.githubusercontent.com/clawnify/OpenProperty/master/README.md
  (repo tip `a493028a`, 2026-09-09).
- OpenProperty commits `a493028a` (#8), `58dc1b52` (#7), `0b7e46fc` (#6), `0a495aa3` (#5),
  `a72eb47f` (#4), `24c4e59c` (#3) — api.github.com/repos/clawnify/OpenProperty/commits.
- property-os README, AGENTS.md, docs/GETTING-STARTED.md — raw.githubusercontent.com/
  clawnify/property-os/main/…
- property-os commits `3fba3c22` (2026-09-21 pin sync: open-crm@9c7c1b1, open-channels@b0c2170,
  open-dataroom@ff6a35a, open-render-studio@32860c1), `7a88853c` (2026-09-15 inbox→CRM),
  `1af9d55` (2026-09-14 pin sync incl. open-property@a493028), `3f447896` (five members /
  three agents).
- Not fetched / not verified: the Clawnify platform DESIGN.md (referenced inside upstream commit
  messages) — platform-spec details beyond the signed signals are [UNKNOWN] / out of scope here.

**Repository current state:** [VERIFIED]
- `Docs/current/14-brand-architecture.md` (identity split; OpenProperty upstream, ORKESTRIX product).
- `Docs/references/01-overview.md` (foundation description, framework, out-of-scope framing).
- `Docs/plans/13{,b,c}-v1-implementation-plan.md` (P1–P12 plans; V1 out-of-scope list).
- `Docs/V1-PHASE-INDEX.md` (P1–P12 complete).
- `Docs/current/UI-FINALIZATION-MASTER-PLAN.md` §F (non-goals), §G (Phase B boundary scope),
  §H/§I (DoD).
- `Docs/execution/governance/core-profile-separation-{gate,implementation}-2026-09-24.md`
  (seam inventory; core+profile ≡ product).
- `Docs/execution/governance/role-policy-gate-2026-09-26.md` and
  `role-operational-responsibility-mapping-2026-09-25.md` (INTENTIONAL/TEMPORARY/REALIGNMENT
  classifications; §11 decisions).
- `Docs/execution/governance/disposable-commercial-observation-dataset-{design,injection}-*.md`
  (OBS disposable semantics; AUTH_ENABLED=true, 6 users, 85 audit rows).
- `package.json` (name `@clawnify/open-property`; `@clawnify/app ^0.2.1`, `@clawnify/db ^0.4.1`),
  `wrangler.toml` (name `open-property`; binding `DB` = `open-property-db`, id `local`),
  `manifest.json` (Clawnify app manifest).
- `src/server/auth.ts:154-181` (ROLE_HIERARCHY, hasMinimumRole, AUTH_ENABLED settings check),
  `src/server/app.ts:90-121` (middleware/allowlist/AUTH_ENABLED), `:1320-1497` (settings/users/
  audit/reconcile gates), `src/client/app.tsx:2,194-202` (AppNav from `@clawnify/app/client`),
  `src/client/components/settings/settings-page.tsx:51-68` (tab gating),
  `src/profile/algeria/*` (profile seam) — line refs as previously verified during P5/P12/
  role-mapping/role-policy phases.

---

## 15. Conclusion

- **Status**: Commercial Architecture **NOT READY** — posture defined; blockers D1–D7 open.
- **Architecture**: local-first, single-tenant ORKESTRIX Property System = Global Core + Algeria
  Profile + instance configuration + stable Owner/Admin/Manager authorization envelope, deployed
  as one instance (server + customer-local DB + browser clients), with license, update, installer,
  backup, LAN and connectivity as separate deferred layers; future modules and agents attach
  around the core as separate members (upstream pattern, **proposed**), never folded into the
  monolith.
- **V1 package (smallest clean product-content scope)**: the Core+Profile feature set as it exists
  today — no modules, no agents, no integrations, no portals, no online payments. (Package
  readiness — installer, clean-machine QA, release closure — is a separate gate, §12.1-6/-7.)
- **Blocking product-owner decisions** before the first downstream design: D1 financial-authority
  envelope, D2 export exposure, D3 owner-as-operator-or-principal (→ Permission Model); D4 license
  model, D5 update trust model, D6 backup scope/duty, D7 LAN concurrent-user/device policy
  (→ License/Installer/Update/Backup/Release gates). All `[POLICY DECISION REQUIRED]`.
- **Direction**: the core-first, members-around-it principle is **supported by upstream evidence**
  (S3/S4/S5/S9/S10) and is recorded here as a **proposed** direction, deferred as scope; formal
  adoption by the product owner is a policy decision this gate does not make.
- **Discipline**: this report implements nothing; the working tree carries only the inherited
  exceptions; exactly one new file was committed for this gate; no source, schema, API, auth, UI,
  database, or dataset behavior was changed.