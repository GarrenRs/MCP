# Execution Log — P2: Migration Ledger

Records the execution of phase P2 from `Docs/plans/13-v1-implementation-plan.md` (P2 section) and
`Docs/plans/13c-v1-implementation-plan.md` (order step 2). Authored by the execution agent
(systemorkestrix-pixel) on 2026-09-20.

## Status

[COMPLETE] — landed as git commit `7e97091` ("feat: versioned D1 migrations with
schema_migrations ledger") on `main`, 2026-09-20 12:05 +0100.

## Objective vs. delivered

Plan objective (13, P2): replace the unversioned DDL-only model (R3) before any future schema
change — versioned additive migrations, reconcilable with `schema.sql` for fresh DBs.

Delivered:

- Additive `schema_migrations(version, applied_at)` ledger.
- Pure, framework-free runner core in `src/server/migrate.ts` (types `Migration`,
  `MigrationDriver`; functions `appliedVersions`, `planPending`, `applyMigration`,
  `runMigrations`). Never re-runs an applied version; sorts pending by version.
- CLI runner `scripts/migrate.ts` (Node 24 native TypeScript) driving
  `wrangler d1 execute --local`: applies base `src/server/schema.sql` as version `0001`, then
  `migrations/*.sql` in filename order.
- `migrations/` directory (seeded with `.gitkeep`) for future additive migrations.
- `package.json` `"db:migrate"` now runs the runner (`node scripts/migrate.ts`).

## Design decisions

- Base DDL (the existing idempotent `schema.sql`) IS the v1 migration, recorded as `0001`.
  Fresh DBs and pre-existing DBs therefore converge to the same schema + ledger state.
- First real additive migration must start at version `0002` and be additive-only, per the
  safe-change rules from `Docs/references/10-evolution.md` (no drops, no column removals).

## Verification evidence

- [VERIFIED] `pnpm typecheck` exits 0.
- [VERIFIED] `pnpm test` runs green: 5 files, 50/50 tests passed — 44 from P1 plus 6 new
  migration tests (`tests/migrations.test.ts`).
- [VERIFIED] Runner tests cover the plan's required cases (13, P2 §6):
  - applies pending migrations in order;
  - idempotent re-run is a no-op;
  - never mutates an already-applied version (mutated SQL is skipped, no side effects);
  - fresh DB vs. pre-existing schema.sql-only DB converge to identical table set and ledger.
- [VERIFIED] Live run against local D1: `node scripts/migrate.ts` printed
  `migrations: applied [0001], skipped [none]`; second run printed
  `migrations: applied [none], skipped [0001]`.
- [VERIFIED] Ledger contents confirmed via `wrangler d1 execute --json --command
  "SELECT version, applied_at FROM schema_migrations"` → single row `version: 0001`.
- [VERIFIED] `pnpm db:migrate` uses the runner and is idempotent (`applied [none], skipped
  [0001]`); `/api/health` 200 and dashboard summary unchanged after the phase.

## Files changed (commit stat)

`migrations/.gitkeep` (new), `package.json`, `scripts/migrate.ts` (new),
`src/server/migrate.ts` (new), `tests/helpers/d1.ts` (started loading schema optionally,
added `exec`), `tests/migrations.test.ts` (new). 6 files, +310/−4.

## Risks / notes

- [INFERENCE] Because the local dev DB was created pre-ledger by the old DDL-only flow, its
  first runner invocation re-applied `schema.sql` idempotently and recorded `0001`; no data
  change occurred.
- Rollback per plan P2 §8: revert `7e97091`; fresh DBs still clone via DDL until the first
  real additive migration is authored.
- This phase unblocks additive schema changes for P4 (property address columns), P5 (`users`
  table), P12 (`audit_logs`), per 13c dependencies.
- Note: `Docs.zip` (audit archive) remains untracked in the repo and is never staged.