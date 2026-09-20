# OpenProperty — Technical & Business Documentation

Long-term reference for understanding, preserving, localizing, and evolving OpenProperty.
This is a READ-ONLY audit baseline; it does not modify application code.

## How to use this documentation

1. **Fast orientation** — `01-overview.md` (what the product is, the stack, and a system map).
2. **Codebase reference** — `02-architecture.md`, `03-database.md`, `04-api.md`, `05-frontend.md`.
3. **Business knowledge** — `06-business-logic.md` (workflows and rules) and `07-modules.md` (per-module deep dives).
4. **Localization** — `08-localization.md` (everything needed to produce a localized commercial version).
5. **Decision material** — `09-risks.md`, `10-evolution.md` (scope + effort), `11-audit-verification.md` (facts vs. inferences).
6. **Terms** — `12-glossary.md`.

## Evidence discipline (used throughout)

Every document separates:

- **VERIFIED FACTS** — observed directly in the source, the running application, or the local
  database during the audit (baseline: 2026-09-20, working tree at commit `baseline`).
- **INFERENCES** — reasonable conclusions drawn from verified facts that were not directly exercised.
- **RECOMMENDATIONS** — suggested actions; these are advisory, not implemented.
- **UNKNOWN / NOT VERIFIED** — explicitly not confirmed.

Labels appear inline as `[VERIFIED]`, `[INFERENCE]`, `[RECOMMENDATION]`, `[UNKNOWN]`.

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
| `08-localization.md` | i18n assessment and path to a localized commercial version |
| `09-risks.md` | Technical and operational risks |
| `10-evolution.md` | Recommended V1 scope, what NOT to add, safe changes, effort matrix |
| `11-audit-verification.md` | Consolidated verified facts / inferences / recommendations / unknowns |
| `12-glossary.md` | Domain + technical terms |