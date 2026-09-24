# Environment / Work-Environment Baseline

**Date:** 2026-09-24
**Scope:** READ-ONLY environment audit before opening the Commercial Layer.
**Commit:** <recorded post-commit>
**Gate:** GO-WITH-PRECONDITIONS

Evidence classes used throughout: `[VERIFIED]` (observed directly), `[INFERENCE]` (derived from verified facts), `[UNKNOWN]` (not testable in this audit), `[RECOMMENDATION]` (advisory, out of scope to implement).

---

## 1. Baseline

Operational baseline established for the local development and execution environment. The audit is read-only: no `src/**`, `migrations/**`, `tests/**`, `package.json`/lockfiles, database schema/data, Core/Profile architecture, UI, or deployment behavior were modified. No demo/commercial data was injected.

Verified capabilities in one line: repository healthy at `45a9fd4` (`main`), full toolchain present, dev stack live (UI + API), local D1 migratable and deterministic at seed level, typecheck/build/223 tests green, no secrets in the repo, and the architecture can safely host a disposable observation dataset.

---

## 2. Repository state

| Item | Value | Evidence |
|---|---|---|
| Current HEAD | `45a9fd4` `fix: resolve profile locale option label in settings picker` | `git log` `[VERIFIED]` |
| Parent | `f1c1a99` `docs: establish dependent-effect closure rule` | `git rev-parse HEAD^` `[VERIFIED]` |
| Local chain | `b46168a → f1c1a99 → 45a9fd4` (main) | `[VERIFIED]` |
| origin/main | `b46168a` `Separate global core from Algeria profile` | `git rev-parse origin/main` `[VERIFIED]` |
| origin/master | `aab9081` (separate, unrelated branch) | `git branch -a` `[VERIFIED]` |
| Branch | `main` | `[VERIFIED]` |
| Remote | `origin → https://github.com/GarrenRs/MCP` (plain HTTPS, no embedded credentials) | `git remote -v` `[VERIFIED]` |
| Push state | `origin/main` intentionally behind local HEAD by 2 commits (`f1c1a99`, `45a9fd4`); nothing pushed in this audit | `[VERIFIED]` |

**Working-tree status (uncommitted):** exactly the inherited exceptions, no unexpected drift.

- Modified (tracked): `Docs/execution/ui-finalization/ui-finalization.md`, `Docs/execution/ui-finalization/ui-post-closure-corrections-2026-09-24.md`, `tests/audit.test.ts`.
- Untracked: `Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5/`, `Docs/execution/P6/`, `Docs/execution/P7/`, `Docs/execution/P8/`, `Docs/execution/governance/core-profile-separation-gate-2026-09-24.md`, `tc.txt`, `tc3.txt`, `vt.txt`, `vt3.txt`.
- 3 modified files, 20 insertions / 6 deletions in total. `src/server/index.ts` is **not** modified in the current tree (an earlier report referenced it as an exception; it is clean now). `[VERIFIED]`
- `dist/` (build output from this audit) is gitignored; it does not appear in status. `[VERIFIED]`

---

## 3. Toolchain

| Tool | Version | Source | Evidence |
|---|---|---|---|
| Node.js | v24.12.0 | system | `node --version` `[VERIFIED]` |
| pnpm | 11.1.2 | system | `pnpm --version` `[VERIFIED]` |
| Git | 2.52.0.windows.1 | system | `git --version` `[VERIFIED]` |
| OpenCode CLI | v2.0.13 | `%APPDATA%\npm\opencode` | `opencode --version` `[VERIFIED]` |
| Wrangler | 4.86.0 | project-local (`pnpm exec`) | `[VERIFIED]` |
| TypeScript | 5.9.3 | project-local (`pnpm exec tsc`) | `[VERIFIED]` |
| Vite | 6.4.2 | project-local (lockfile/build output) | `[VERIFIED]` |
| React | 19.2.5 | project-local (lockfile) | `[VERIFIED]` |
| Hono | 4.12.15 | project-local (lockfile) | `[VERIFIED]` |
| Playwright / browser | harness-provided via MCP relay + Chrome extension | not a repo dependency (`pnpm list playwright` empty) | `[VERIFIED]` |

**Browser integration notes:**
- Desktop browser-MCP ("browser" tools): `[UNKNOWN]` — reports "No desktop browser is connected"; unusable in this environment.
- Playwright MCP: `[VERIFIED]` functional (used previously for UI QA; Chrome extension bridge on a local relay). Playwright is supplied by the harness, not by `package.json` — the repo carries no Playwright dependency.

**Node-version constraints:** `scripts/migrate.ts` executes TypeScript natively and helper/test tooling uses `node:sqlite` (experimental warning observed at runtime). Both require Node ≥ 24. There is **no `engines` field** in `package.json` to enforce this. `[VERIFIED]` / `[RECOMMENDATION: add engines + a preinstall Node check for clean machines]`

---

## 4. Machine resources

| Resource | Value | Evidence |
|---|---|---|
| OS | Windows 10 Pro 19045 (22H2), 64-bit | `[VERIFIED]` |
| CPU | Intel Core i5-6300U @ 2.40 GHz — 2 cores / 4 threads | `[VERIFIED]` |
| RAM | 7.8 GB total | `[VERIFIED]` |
| RAM free during audit | **~0.5 GB** (dev stack + Chrome + harness resident) | `[VERIFIED]` |
| Disk C: | 4.1 GB free (system drive — tight) | `[VERIFIED]` |
| Disk F: | 15.9 GB free (project drive) | `[VERIFIED]` |

**Practical constraints:**
1. **Low RAM headroom** — builds/tests/browser QA must run sequentially; parallelizing heavy jobs risks OOM. `[INFERENCE]`
2. **4-thread CPU** — Vite build 27 s, vitest 31 s; acceptable but slow for large parallel test suites. `[VERIFIED]`
3. **C: is tight (4.1 GB)** — avoid writing large artifacts to `%LOCALAPPDATA%`-heavy toolchains; repo lives on F: which is comfortable. `[INFERENCE]`

---

## 5. Development runtime

**Live processes (already running from prior session, verified now):**

| Service | Endpoint | State | Evidence |
|---|---|---|---|
| Vite UI | `:5173` | listening, PID 5580 | `Get-NetTCPConnection` `[VERIFIED]` |
| Wrangler API | `:8787` | listening, PID 20780 | `Get-NetTCPConnection` `[VERIFIED]` |
| API health | `GET /api/health` | `{"ok":true}` | `curl` `[VERIFIED]` |
| UI root | `GET /` over `[::1]:5173` | HTTP 200, 986 B HTML (`<title>OpenProperty</title>`) | `curl` `[VERIFIED]` |

**Binding note (unexpected finding):** Vite listens on `::1` (IPv6 loopback) **only**; `curl 127.0.0.1:5173` returns 000, `curl [::1]:5173` returns 200. The Vite → API proxy (`/api` → `http://localhost:8787`) works from the browser. Implication: any LAN/client access needs an explicit `host` (`server.host`) in `vite.config.ts`. `[VERIFIED]` / `[RECOMMENDATION for Commercial Layer: set server.host when LAN access is required]`

**Commands (all verified):**

| Command | Result | Evidence |
|---|---|---|
| `pnpm typecheck` | PASS (exit 0) | `[VERIFIED]` |
| `pnpm build` | PASS, 27.4 s; 6415 modules; warning: single 691 kB JS chunk (192.6 kB gzip) | `[VERIFIED]` |
| `pnpm vitest run --no-file-parallelism` | 16 files / **223 tests PASS**, exit 0, 31.2 s | `[VERIFIED]` |
| `pnpm db:migrate` | versioned, idempotent (no-op at head — verified by inspection of runner + ledger, not executed to honor read-only) | `[VERIFIED by inspection]` |
| `pnpm dev` | `db:migrate` + `concurrently` Vite + `wrangler dev --port 8787`; components verified individually; stack currently up | `[VERIFIED components]` |
| `pnpm test` (default) | exists (vitest run); **must run with `--no-file-parallelism`** (module-singleton seeding; a plain run can surface pipeline artifacts) | `[VERIFIED]` / `[RECOMMENDATION: change default test script to sequential for parity with CI]` |

**Migration command internals** (`scripts/migrate.ts` → `wrangler d1 execute --local`): base migration `0001` (`src/server/schema.sql`, 11 `CREATE TABLE`) + `migrations/0002_property_geography.sql` … `0005_audit_logs.sql`; ledger `schema_migrations(version, applied_at)`; `planPending` filters applied versions — re-running at head is a strict no-op (additive-only, never re-runs). `[VERIFIED]`

---

## 6. Database environment

**Location/runtime:** Miniflare local D1 as SQLite (WAL mode) at
`.wrangler/state/v3/d1/miniflare-D1DatabaseObject/2b35d4d42e3c9f6b5ad5b5579a7b1470c66e69f6b33a31e3f5a0095cc6d18656.sqlite` (+ `-wal`/`-shm`, `metadata.sqlite`). Binding `DB`, database `open-property-db`, `database_id = "local"` (`wrangler.toml`). `[VERIFIED]`

**Schema version:** ledger complete at HEAD = `0005` (0001, 0002_property_geography, 0003_auth_users, 0004_lease_unit_occupancy, 0005_audit_logs). 16 app tables + `sqlite_sequence` + `_cf_METADATA`. `[VERIFIED]`

**Row counts (read-only, `node:sqlite`):**

| Table | Rows |
|---|---|
| users | 2 |
| properties | 3 |
| units | 5 |
| vendors | 3 |
| tenants / leases / lease_tenants / rent_charges / payments / work_orders / applications | 0 |
| sessions | 24 |
| audit_logs | 42 |
| settings | 6 |

**Settings/profile state:**

| Key | Value |
|---|---|
| AUTH_ENABLED | true |
| currency | DZD |
| locale | **ar** ⚠️ |
| default_rent_due_day | 1 |
| late_fee_amount | 50 |
| late_fee_grace_days | 5 |

**⚠️ Unexpected finding:** `settings.locale = "ar"`, while the prior dependent-effect report recorded the DB as "restored to found state (locale=en)". This is runtime user data (not schema/migration drift), most likely the residue of the final browser locale-switching verification pass. Left untouched (read-only audit). `[VERIFIED current=ar]` / flag for the next session to normalize if a canonical locale is preferred.

**Reset/reseed capability:**
- Seed = `src/server/schema.sql` (3 properties / 5 units / 3 vendors; row counts match the seed exactly) + idempotent `ensureSeeded` settings writes — deterministic. `[VERIFIED]`
- QA fixture helper exists at `tests/helpers/demo-fixture.ts` (direct SQL, used by tests only). `[VERIFIED]`
- `users` (2), `sessions` (24), `audit_logs` (42) accumulate with runtime use → **not** deterministic. `[VERIFIED]`
- Reset option: replace the sqlite file with a pristine copy (WAL assets included) or re-apply migrations on a fresh file. `[INFERENCE]`

---

## 7. Secrets / environment

- No `.env` / `.dev.vars` present anywhere (repo root, temp dir) and **none tracked** (`git ls-files` match: none). `[VERIFIED]`
- `.gitignore` covers `node_modules`, `dist`, `.wrangler`, `.clawnify`, `*.log`, `.dev.vars`, `.playwright-mcp`. `[VERIFIED]`
- HEAD-wide scan for key-material patterns (`sk-…`, `ghp_…`, `AKIA…`, `AIza…`, `BEGIN … PRIVATE KEY`, Slack `xox…`): **zero matches** in tracked files. `[VERIFIED]`
- No `.npmrc` (repo or user) → default public registry for installs. `[VERIFIED]`
- Local operation needs **no secrets and no deployment credentials**: auth is PBKDF2-SHA256 (100k iterations) with passwords in the `users` table; feature flags (`AUTH_ENABLED`) live in the `settings` table. `[VERIFIED]`
- Remote deploy (Clawnify CLI/Cloudflare) would require its own tokens — out of local scope, none present locally. `[VERIFIED]`

---

## 8. Verification results (build/test reality)

| Check | Result | Evidence |
|---|---|---|
| `pnpm typecheck` | PASS | `[VERIFIED]` |
| `pnpm vitest run --no-file-parallelism` | 16 files / 223 tests PASS, exit 0, 31.2 s | `[VERIFIED]` |
| `pnpm build` | PASS, 27.4 s, 6415 modules; 1 chunk-size warning | `[VERIFIED]` |
| API health probe | `{"ok":true}` | `[VERIFIED]` |
| UI probe | 200 over `[::1]:5173` | `[VERIFIED]` |

---

## 9. Clean-machine readiness

**Required to reproduce on a clean machine:**
1. Install **Node ≥ 24** (native TS execution + `node:sqlite` are used by tooling) and **pnpm ≥ 11** (via corepack or standalone). `[VERIFIED]` / `[RECOMMENDATION: add engines field]`
2. `pnpm install` — lockfile-pinned; `@clawnify/app@0.2.1`, `@clawnify/db@0.4.1`, `@clawnify/routes@0.2.2` resolve from the public registry with integrity hashes (no private registry/GitHub needed); `workerd`/`esbuild` built via `pnpm.onlyBuiltDependencies`. `[VERIFIED]`
3. `pnpm dev` (applies schema/migrations to local D1 automatically) or explicit `pnpm db:migrate`. `[VERIFIED]`
4. Verify with `pnpm typecheck`, `pnpm build`, `pnpm vitest run --no-file-parallelism`. `[VERIFIED]`
5. No secrets/credentials are needed for local run. `[VERIFIED]`
6. Internet access required at install time for registry deps and `workerd` binary download. `[INFERENCE]`

README documents `install/dev/typecheck/build` (missing `db:migrate` description detail and the test command — minor doc gap). `[VERIFIED]`

---

## 10. Commercial-layer constraints (verify-only; no design/implementation)

- **Local runtime:** Hono worker + D1 is single-process and light, but the machine's ~0.5 GB RAM headroom means commercial-heavy parallel jobs must be serialized. `[INFERENCE]`
- **Desktop packaging:** `dist/` is a static SPA (index.html + 691 kB single JS chunk + 40.8 kB CSS); packaging would additionally need to embed the worker runtime (`workerd`) or a Node shim for the API + the SQLite (D1) store. Chunk splitting is currently absent (build warning). `[INFERENCE]` / `[RECOMMENDATION: lazy-load routes before desktop packaging]`
- **LAN:** Vite binds IPv6 loopback only (`server.host` unset); API binds `127.0.0.1` (wrangler default). LAN access requires explicit host/`--ip` config — a precondition for any networked use. `[VERIFIED]` / `[RECOMMENDATION]`
- **Backup/restore:** D1 is a single SQLite file (WAL) — file-copy backup is feasible; restore = replace file + clear `-wal`/`-shm`. `[INFERENCE]`
- **Update mechanism:** `git pull` + `pnpm install` + `pnpm db:migrate`; migration design is additive-only and versioned, so in-place upgrades are safe. `[VERIFIED]` / `[RECOMMENDATION]`
- **Installer/support/recovery:** no installer exists; `audit_logs` (currently 42 rows, `0005` migration) gives a partial first-party audit trail for support/recovery scenarios. `[VERIFIED]`

---

## 11. Disposable dataset readiness

**Answer: YES — the architecture can safely support a temporary, deterministic, resettable commercial-observation dataset**, with conditions:

- `[VERIFIED]` Seed data (3 properties / 5 units / 3 vendors) is deterministic (schema.sql) and settings seeding is idempotent.
- `[VERIFIED]` A test-only fixture precedent exists (`tests/helpers/demo-fixture.ts`, direct SQL, tests-only), and app APIs accept arbitrary rows — no hardcoded domain assumptions observed.
- Safest insertion point `[RECOMMENDATION]`: a dedicated, env-flag-gated fixture path mirroring `demo-fixture.ts` (or a separate D1 database id for the observation dataset), applied **after** migrations, never touching `schema.sql`/`migrations/**`.
- Watch items `[VERIFIED]`: `sessions` and `audit_logs` grow nondeterministically with runtime traffic; `sqlite_sequence` (autoincrement) shifts with inserts/deletes; reset = restore a pristine sqlite snapshot (file copy) or re-seed on a fresh DB.
- No schema or data was mutated in this audit to establish any of the above. `[VERIFIED]`

---

## 12. Gate

## **GO-WITH-PRECONDITIONS**

**Why GO:** the environment is fully operational and verified end-to-end — repository at expected commit chain (no push), complete toolchain, live dev stack (UI 200 over `[::1]:5173`, API `/api/health` `{"ok":true}`), local D1 healthy at schema `0005` with deterministic seed baseline, typecheck/build/223 tests green, no secrets in the repo, disposable-dataset capability confirmed.

**Preconditions before heavy Commercial-Layer work:**
1. Memory: only ~0.5 GB RAM free when the stack + browser are resident → run builds/tests sequentially; close idle applications/browsers before heavy work (shortcut: most pressure comes from Chrome + harness).
2. LAN/client access requires explicit host (`server.host`) + wrangler `--ip`; not configured today.
3. Normalize `settings.locale` (currently `ar`, divergent from the prior report's recorded `en`) if a canonical runtime locale matters for observation data.
4. Clean machines need Node ≥ 24 + pnpm ≥ 11 (add an `engines` field to enforce); `@clawnify/*` deps require registry internet access at install time.

**NO-GO reasons:** none found.

---

## 13. Unexpected findings (short list)

1. **Vite binds IPv6 loopback only** — `127.0.0.1:5173` probe fails (000); `[::1]:5173` returns 200. Not an outage; a LAN/host-config prerequisite.
2. **`settings.locale = "ar"`** in the live D1, while the prior dependent-effect report recorded the DB restored to `locale=en`. Runtime user-data drift (not schema); left untouched.
3. **`@clawnify/app|db|routes` are external registry packages** (integrity-pinned, versions ahead of `package.json` ranges) — clean machines need registry access at install; no private source is required.
4. **Single 691 kB JS chunk** build warning — relevant to desktop packaging/lazy-loading later.
5. **`pnpm test` default needs `--no-file-parallelism`** to match the proven-green suite configuration (module-singleton seeding).