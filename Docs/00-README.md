# OpenProperty — Technical & Business Documentation

Long-term reference for understanding, preserving, localizing, and evolving OpenProperty.
This is a READ-ONLY audit baseline; it does not modify application code.

## Strategic path (current position)

```
SOURCE AUDIT            → complete (Docs/00–12, baseline 98bfc4a)
DOCUMENTATION BASELINE  → complete (Docs/13–13c V1 plan)
COMMERCIAL BRAND ARCH.  → complete (Docs/14 — ORKESTRIX Property System)
V1 IMPLEMENTATION PLAN  → defined (P1–P12, order in Docs/13c)
P1 TEST FOUNDATION      → complete (Docs/execution/p1-test-foundation.md, commit b1b3b55)
P2 MIGRATION LEDGER     → complete (Docs/execution/p2-migration-ledger.md, commit 7e97091)
P3 I18N / SETTINGS / ERROR CODES → complete (Docs/execution/p3-i18n-settings-error-codes.md, commit d431909)
P4 LOCALIZATION         → pending
P5 AUTH                 → pending
P6–P12                  → pending
COMMERCIAL VALIDATION   → pending
```

Execution order is governed by the V1 plan (`Docs/13`, `13b`, `13c`).

## How to use this documentation

1. **Fast orientation** — `01-overview.md` (what the product is, the stack, and a system map).
2. **Codebase reference** — `02-architecture.md`, `03-database.md`, `04-api.md`, `05-frontend.md`.
3. **Business knowledge** — `06-business-logic.md` (workflows and rules) and `07-modules.md` (per-module deep dives).
4. **Localization** — `08-localization.md` (everything needed to produce the localized commercial ORKESTRIX Property System).
5. **Decision material** — `09-risks.md`, `10-evolution.md` (scope + effort), `11-audit-verification.md` (facts vs. inferences).
6. **Terms** — `12-glossary.md`.
7. **V1 execution roadmap** — `13-v1-implementation-plan.md` (+ `13b`, `13c`): phased plan for the Algerian local V1.
8. **Brand** — `14-brand-architecture.md`: master brand ORKESTRIX, current product ORKESTRIX Property System, upstream (OpenProperty) vs commercial distinction.

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

## Doc map

| File | Covers |
|---|---|
| `01-overview.md` | Identity, scope, stack, quick start, system map (final report section A) |
| `02-architecture.md` | Components, data flow, dev vs. production topology, build/run pipeline |
| `03-database.md` | Schema, tables, relationships, enums, integrity, seeding, backup |
| `04-api.md` | Endpoint catalog, request/response contracts, error handling, auth status |
| `05-frontend.md` | Routing, screens, global state, API client, design system |
| `06-business-logic.md` | Business workflows and rules end-to-end |
| `07-modules.md` | Per-module dives: purpose, workflow, screens, endpoints, tables, logic, gaps, deps, difficulty |
| `08-localization.md` | i18n assessment and path to the localized commercial ORKESTRIX Property System |
| `09-risks.md` | Technical and operational risks |
| `10-evolution.md` | Recommended V1 scope, what NOT to add, safe changes, effort matrix |
| `11-audit-verification.md` | Consolidated verified facts / inferences / recommendations / unknowns |
| `12-glossary.md` | Domain + technical terms |
| `13-v1-implementation-plan.md` | V1 plan: prerequisites, out-of-scope, phases P1–P6 (Algerian local V1) |
| `13b-v1-implementation-plan.md` | V1 plan: phases P7–P9 |
| `13c-v1-implementation-plan.md` | V1 plan: phases P10–P12, dependencies, recommended order, deliverables |
| `14-brand-architecture.md` | Master brand ORKESTRIX, product naming pattern, ORKESTRIX Property System, upstream OpenProperty vs commercial identity |
| `execution/p1-test-foundation.md` | Execution log for P1 (test foundation) — commit `b1b3b55` |
| `execution/p2-migration-ledger.md` | Execution log for P2 (migration ledger) — commit `7e97091` |
| `execution/p3-i18n-settings-error-codes.md` | Execution log for P3 (i18n / settings / error codes) — commit `d431909` |