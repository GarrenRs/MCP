# OpenProperty — Technical & Business Documentation

Authoritative documentation map for the repository. Kept current by the
documentation-governance process; see `Docs/execution/documentation-governance-post-p12.md`.

---

## Current status

```
SOURCE AUDIT                 → complete (Docs/01–12, baseline 98bfc4a)
DOCUMENTATION BASELINE       → complete (Docs/13–13c V1 plan, executed)
COMMERCIAL BRAND ARCH.       → complete (Docs/14 — ORKESTRIX Property System)
FUNCTIONAL / OPERATIONAL V1  → COMPLETE (P1–P12; see Docs/V1-PHASE-INDEX.md)
UI FINALIZATION              → PLANNED (Phase A; Docs/UI-FINALIZATION-MASTER-PLAN.md)
COMMERCIAL / DEPLOYMENT      → PLANNED ONLY (Phase B boundary; NOT implemented)
```

HEAD at last governance pass: `4b7177d` ("feat: add audit trail", P12). Parent of P12: `79441f2`.
Per-phase status and commits: **`Docs/V1-PHASE-INDEX.md`** (authoritative).

## Documentation map

Categories: **A** CURRENT AUTHORITY · **B** PHASE EXECUTION LOGS · **C** TECHNICAL REFERENCES ·
**D** UI FINALIZATION MASTER PLAN · **E** COMMERCIAL / DEPLOYMENT CLOSURE ·
**F** ARCHIVE / HISTORICAL MATERIAL.

| Cat | File | Covers / current as of |
|---|---|---|
| A | `00-README.md` (this file) | Authoritative documentation map and status |
| A | `14-brand-architecture.md` | Master brand ORKESTRIX, product naming, upstream vs commercial identity — `[PROJECT DECISION]` |
| A | `V1-PHASE-INDEX.md` | P1–P12 status, execution-log path, final commit per phase |
| B | `execution/p1-…p12-*.md` | Execution logs P1–P12 (see V1-PHASE-INDEX for mapping; p5–p8 logs are untracked working-tree files) |
| D | `UI-FINALIZATION-MASTER-PLAN.md` | Authoritative plan for Phase A (Arabic, RTL, typography, responsive, visual, browser QA) |
| C | `01-overview.md` | Identity, scope, stack, quick start, system map |
| C | `02-architecture.md` | Components, data flow, dev vs production topology, build/run pipeline |
| C | `03-database.md` | Schema, tables, relationships, enums, integrity, seeding, backup |
| C | `04-api.md` | Endpoint catalog, contracts, error handling, auth status |
| C | `05-frontend.md` | Routing, screens, global state, API client, design system |
| C | `06-business-logic.md` | Business workflows and rules end-to-end |
| C | `07-modules.md` / `07b-modules.md` | Per-module dives (M1–M7 / M8–M13) |
| C | `08-localization.md` | Localization assessment & path (P4 executed the fr-DZ/DZD path; AR/RTL deferred to Phase A) |
| C | `09-risks.md` | Technical/operational risks register (several entries resolved by P5–P12) |
| C | `10-evolution.md` | Scope/safe-change guidance and effort matrix (advisory) |
| C | `12-glossary.md` | Domain + technical terms |
| F | `11-audit-verification.md` | Baseline audit evidence register (facts vs inferences @ `98bfc4a`) |
| F | `13-v1-implementation-plan.md` | Executed plan P1–P6 (historical; superseded as future guidance) |
| F | `13b-v1-implementation-plan.md` | Executed plan P7–P9 (historical) |
| F | `13c-v1-implementation-plan.md` | Executed plan P10–P12 + order (historical; superseded by UI-FINALIZATION-MASTER-PLAN) |
| E | — (no file yet) | Commercial/Deployment Closure: planning boundary only in `UI-FINALIZATION-MASTER-PLAN.md` §G |
| F | `Docs.zip`, `Docs/Docs.zip` | Untracked archive artifacts — **do not stage, delete, rename, or modify** |

> **Baseline-snapshot warning (01–12):** files `01–12` are the pre-V1 audit baseline
> (working tree @ `98bfc4a`, 2026-09-20). Several statements there are **no longer current**
> (e.g. "no auth/roles" — resolved by P5; missing features — implemented across P6–P12;
> localization path — executed as P4). Treat `01–12` as historical reference for *architecture
> and business knowledge*; verify **current behavior** in `src/`, `migrations/`, and the phase
> execution logs before acting.

## How to use this documentation

1. **Fast orientation** — `01-overview.md` (what the product is, the stack, and a system map).
2. **Current phase status** — `V1-PHASE-INDEX.md` (P1–P12) and
   `UI-FINALIZATION-MASTER-PLAN.md` (Phase A).
3. **Codebase reference** — `02-architecture.md`, `03-database.md`, `04-api.md`, `05-frontend.md`.
4. **Business knowledge** — `06-business-logic.md` (workflows/rules) and `07-modules.md` /
   `07b-modules.md` (per-module deep dives).
5. **Localization** — `08-localization.md` (assessment) + Phase A plan for the Arabic/RTL pass.
6. **Decision material** — `09-risks.md`, `10-evolution.md` (scope + effort),
   `11-audit-verification.md` (facts vs. inferences).
7. **Terms** — `12-glossary.md`.
8. **Executed V1 road map** — `13-v1-implementation-plan.md` (+ `13b`, `13c`): historical record
   of how P1–P12 were planned and executed.
9. **Brand** — `14-brand-architecture.md`: master brand ORKESTRIX, current product ORKESTRIX
   Property System, upstream (OpenProperty) vs commercial distinction.

## Evidence discipline (used throughout)

Every document separates:

- **VERIFIED FACTS** — observed directly in the source, the running application, or the local
  database during the audit (baseline: 2026-09-20, working tree at commit `98bfc4a`).
- **INFERENCES** — reasonable conclusions drawn from verified facts that were not directly exercised.
- **RECOMMENDATIONS** — suggested actions; these are advisory, not implemented.
- **UNKNOWN / NOT VERIFIED** — explicitly not confirmed.

Labels appear inline as `[VERIFIED]`, `[INFERENCE]`, `[RECOMMENDATION]`, `[UNKNOWN]`.

Authoritative project/business decisions (e.g., the ORKESTRIX brand in `14-brand-architecture.md`)
are tagged `[PROJECT DECISION]` and are **directives, not source-code observations**.

## Convention for "workflow" descriptions

Workflows are written as **state → action → result** chains from a manager's point of view
(property owner/landlord admin), matching the single-actor model of the application.