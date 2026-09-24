# OpenProperty — Technical & Business Documentation

Authoritative documentation map for the repository. Kept current by the
documentation-governance process; see `Docs/execution/governance/documentation-governance-post-p12.md`
and this pass's record `Docs/execution/governance/documentation-governance-reorg-2026-09-24.md`.

---

## Current status

```
SOURCE AUDIT                 → complete (baseline 98bfc4a; Docs/references/01–12 + Docs/archive/11)
DOCUMENTATION BASELINE       → complete (Docs/plans/13–13c V1 plan, executed)
COMMERCIAL BRAND ARCH.       → complete (Docs/current/14 — ORKESTRIX Property System)
FUNCTIONAL / OPERATIONAL V1  → COMPLETE (P1–P12; see Docs/V1-PHASE-INDEX.md)
UI FINALIZATION              → IN EXECUTION (Phase A; Docs/current/UI-FINALIZATION-MASTER-PLAN.md + Docs/execution/ui-finalization/)
COMMERCIAL / DEPLOYMENT      → PLANNED ONLY (Phase B boundary; NOT implemented)
```

HEAD at last governance pass: `26d023d` ("docs: establish post-P12 UI finalization governance").
Parent: `4b7177d` (P12). The UI-Finalization (Phase A) implementation currently exists only in the
working tree (uncommitted); see `Docs/execution/ui-finalization/ui-finalization.md`.
Per-phase status and commits: **`Docs/V1-PHASE-INDEX.md`** (authoritative).

## Documentation map

Structure:

- **`Docs/00-README.md`** — this map (authoritative entry point).
- **`Docs/current/`** — CURRENT AUTHORITY: active plans and project decisions.
- **`Docs/V1-PHASE-INDEX.md`** — authoritative P1–P12 status index (root level).
- **`Docs/plans/`** — CLOSED / EXECUTED PLANS (historical; superseded as future guidance).
- **`Docs/references/`** — BASELINE TECHNICAL REFERENCE (original audit `01`–`12`).
- **`Docs/execution/<AREA>/`** — EXECUTION RECORDS, one area per phase/plan (`P1`…`P12`,
  `ui-finalization`, `governance`).
- **`Docs/archive/`** — HISTORICAL EVIDENCE + untouchable archive artifacts (`Docs.zip`).

| Cat | File | Covers / current as of |
|---|---|---|
| A | `Docs/00-README.md` (this file) | Authoritative documentation map and status |
| A | `Docs/current/14-brand-architecture.md` | Master brand ORKESTRIX, product naming, upstream vs commercial identity — `[PROJECT DECISION]` |
| A | `Docs/V1-PHASE-INDEX.md` | P1–P12 status, execution-log path, final commit per phase |
| A | `Docs/current/UI-FINALIZATION-MASTER-PLAN.md` | Authoritative plan for Phase A (Arabic, RTL, typography, responsive, visual, browser QA) |
| B | `Docs/execution/P1/…P12/` | Execution logs P1–P12 (see V1-PHASE-INDEX for mapping; p5–p8 logs are untracked working-tree files) |
| B | `Docs/execution/ui-finalization/` | Phase A execution record (in progress) |
| B | `Docs/execution/governance/` | Documentation-governance execution records |
| C | `Docs/references/01-overview.md` | Identity, scope, stack, quick start, system map |
| C | `Docs/references/02-architecture.md` | Components, data flow, dev vs production topology, build/run pipeline |
| C | `Docs/references/03-database.md` | Schema, tables, relationships, enums, integrity, seeding, backup |
| C | `Docs/references/04-api.md` | Endpoint catalog, contracts, error handling, auth status |
| C | `Docs/references/05-frontend.md` | Routing, screens, global state, API client, design system |
| C | `Docs/references/06-business-logic.md` | Business workflows and rules end-to-end |
| C | `Docs/references/07-modules.md` / `07b-modules.md` | Per-module dives (M1–M7 / M8–M13) |
| C | `Docs/references/08-localization.md` | Localization assessment & path (P4 executed the fr-DZ/DZD path; AR/RTL deferred to Phase A) |
| C | `Docs/references/09-risks.md` | Technical/operational risks register (several entries resolved by P5–P12) |
| C | `Docs/references/10-evolution.md` | Scope/safe-change guidance and effort matrix (advisory) |
| C | `Docs/references/12-glossary.md` | Domain + technical terms |
| F | `Docs/archive/11-audit-verification.md` | Baseline audit evidence register (facts vs inferences @ `98bfc4a`) |
| D | `Docs/plans/13-v1-implementation-plan.md` | Executed plan P1–P6 (historical; superseded as future guidance) |
| D | `Docs/plans/13b-v1-implementation-plan.md` | Executed plan P7–P9 (historical) |
| D | `Docs/plans/13c-v1-implementation-plan.md` | Executed plan P10–P12 + order (historical; superseded by UI-FINALIZATION-MASTER-PLAN) |
| E | — (no file yet) | Commercial/Deployment Closure: planning boundary only in `Docs/current/UI-FINALIZATION-MASTER-PLAN.md` §G |
| F | `Docs.zip`, `Docs/Docs.zip` | Untracked archive artifacts — **do not stage, delete, rename, or modify** |

> **Baseline-snapshot warning (01–12):** files `01–12` are the pre-V1 audit baseline
> (working tree @ `98bfc4a`, 2026-09-20). Several statements there are **no longer current**
> (e.g. "no auth/roles" — resolved by P5; missing features — implemented across P6–P12;
> localization path — executed as P4). Treat `01–12` as historical reference for *architecture
> and business knowledge*; verify **current behavior** in `src/`, `migrations/`, and the phase
> execution logs before acting.

## Path migration index (2026-09-24 documentation reorganization)

The 2026-09-24 governance pass moved documentation into the areas above. Historical records
(past execution logs and governance reports) were **not** rewritten where a path mention is
itself evidence of the state at that time; use this table to resolve any pre-reorg path:

| Pre-reorg path | Post-reorg path |
|---|---|
| `Docs/00-README.md`, `Docs/V1-PHASE-INDEX.md` | unchanged (root level) |
| `Docs/14-brand-architecture.md` | `Docs/current/14-brand-architecture.md` |
| `Docs/UI-FINALIZATION-MASTER-PLAN.md` | `Docs/current/UI-FINALIZATION-MASTER-PLAN.md` |
| `Docs/13-v1-implementation-plan.md` | `Docs/plans/13-v1-implementation-plan.md` |
| `Docs/13b-v1-implementation-plan.md` | `Docs/plans/13b-v1-implementation-plan.md` |
| `Docs/13c-v1-implementation-plan.md` | `Docs/plans/13c-v1-implementation-plan.md` |
| `Docs/01-overview.md` … `Docs/10-evolution.md`, `Docs/12-glossary.md` | `Docs/references/<same-name>.md` |
| `Docs/11-audit-verification.md` | `Docs/archive/11-audit-verification.md` |
| `Docs/execution/p1-…p12-*.md` | `Docs/execution/P<N>/p<N>-*.md` (per-phase area) |
| `Docs/execution/documentation-governance-post-p12.md` | `Docs/execution/governance/documentation-governance-post-p12.md` |
| `Docs/execution/ui-finalization.md` | `Docs/execution/ui-finalization/ui-finalization.md` |
| `Docs.zip`, `Docs/Docs.zip` | unchanged (never moved; do not stage/delete/rename/modify) |

## How to use this documentation

1. **Fast orientation** — `Docs/references/01-overview.md` (what the product is, the stack,
   and a system map).
2. **Current phase status** — `Docs/V1-PHASE-INDEX.md` (P1–P12) and
   `Docs/current/UI-FINALIZATION-MASTER-PLAN.md` (Phase A).
3. **Codebase reference** — `Docs/references/02-architecture.md`, `Docs/references/03-database.md`,
   `Docs/references/04-api.md`, `Docs/references/05-frontend.md`.
4. **Business knowledge** — `Docs/references/06-business-logic.md` (workflows/rules) and
   `Docs/references/07-modules.md` / `Docs/references/07b-modules.md` (per-module deep dives).
5. **Localization** — `Docs/references/08-localization.md` (assessment) + Phase A plan for the
   Arabic/RTL pass.
6. **Decision material** — `Docs/references/09-risks.md`, `Docs/references/10-evolution.md`
   (scope + effort), `Docs/archive/11-audit-verification.md` (facts vs. inferences).
7. **Terms** — `Docs/references/12-glossary.md`.
8. **Executed V1 road map** — `Docs/plans/13-v1-implementation-plan.md` (+ `13b`, `13c`):
   historical record of how P1–P12 were planned and executed.
9. **Brand** — `Docs/current/14-brand-architecture.md`: master brand ORKESTRIX, current product
   ORKESTRIX Property System, upstream (OpenProperty) vs commercial distinction.

## Evidence discipline (used throughout)

Every document separates:

- **VERIFIED FACTS** — observed directly in the source, the running application, or the local
  database during the audit (baseline: 2026-09-20, working tree at commit `98bfc4a`).
- **INFERENCES** — reasonable conclusions drawn from verified facts that were not directly exercised.
- **RECOMMENDATIONS** — suggested actions; these are advisory, not implemented.
- **UNKNOWN / NOT VERIFIED** — explicitly not confirmed.

Labels appear inline as `[VERIFIED]`, `[INFERENCE]`, `[RECOMMENDATION]`, `[UNKNOWN]`.

Authoritative project/business decisions (e.g., the ORKESTRIX brand in `Docs/current/14-brand-architecture.md`)
are tagged `[PROJECT DECISION]` and are **directives, not source-code observations**.

## Convention for "workflow" descriptions

Workflows are written as **state → action → result** chains from a manager's point of view
(property owner/landlord admin), matching the single-actor model of the application.