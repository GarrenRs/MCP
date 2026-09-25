# Disposable Commercial Observation Dataset — Injection Execution Report (2026-09-25)

**Contract:** `Docs/execution/governance/disposable-commercial-observation-dataset-design-2026-09-24.md`
**Scope:** Local D1 dev database only (`wrangler dev` `env.DB`). No remote/production database was touched, no schema/migration/source/seed/Core/Profile/UI change was made. The only non-pushed repository change is the loader/fixture under `scripts/obs-dataset/` plus this report.
**Environment:** Windows 10, Node v24.12.0 (native `node:sqlite`), Pnpm dev stack (`wrangler 4.86.0` + `vite 6.4.2`).

---

## 1. Pre-injection gates (all green)

| Gate | Expected | Observed |
|---|---|---|
| `HEAD` | `d0d905f` | `d0d905f` ✓ (unchanged through execution) |
| `origin/main` | `b46168a` | `b46168a` ✓ — **not pushed** |
| Working tree | inherited exceptions only | inherited only (see §8) |
| Schema version | migrations 0001…0005 applied | `schema_migrations = 5` ✓ |
| Baseline counts | properties 3 · units 5 · tenants 0 · leases 0 · lease_tenants 0 · charges 0 · payments 0 · vendors 3 · WOs 0 · apps 0 · users 2 · sessions 24 · audit 42 · settings 6 | exact ✓ |
| Austin seed | present | Oakwood Estate / Honeybee Hideaway / 308 Mission Apartments (3 props, 5 units, 3 vendors, 2 users) ✓ |
| Settings | read-only, untouched | unchanged (see §6) ✓ |
| Restorable snapshot | before any mutation | `.wrangler/obs-snapshots/pre-injection-2026-09-25T08-22-59-322Z/` + `manifest.json` (gitignored) ✓ |

Snapshot contains the consistent `VACUUM INTO` copy (`d1-pre-injection.sqlite`, 200 704 B, `sha256 9CE2686F…`, `PRAGMA integrity_check` ok), raw `-wal`/`-shm` copies, and a manifest with the restore procedure (stop wrangler → replace file → delete `-wal`/`-shm` → restart).

## 2. Loader mechanism (deviation from design §7)

The design’s write path (`wrangler d1 execute`) was replaced by **direct `node:sqlite` writes against the verified local D1 file** — the same read path proven reliable in this environment while dev-wrangler holds the WAL database. Load, verify, reset, clone, verify-only are the five modes of `scripts/obs-dataset/load.ts`:

- **Single transaction**: sentinel checks → baseline gate → inserts → **in-transaction verification with the product’s own SQL** → `COMMIT`; any mismatch throws → `ROLLBACK` (DB untouched). Executions observed: the first load run failed and rolled back (expected-total bug, §5); a second run rolled back again during the clone-reset proof (`ids.*` property-access bug, §7) — both prove the guard works.
- **Env gate**: `OBS_DATASET_ALLOW=1` required for load/reset. Local-file-only guard on `--db` (must be a `.sqlite` file on disk — a remote binding or directory is rejected).
- **Hard baseline gate**: load refuses unless the target is exactly the known seed state (all 14 counts + seed unit-status split). A completed journal refuses a second load until a reset.
- **Sentinel = journal file** (deviation): a JSON journal under `.wrangler/obs-journals/<dbfile>.json` records `run_id`, `anchor`, `baseline_counts`, `baseline_unit_status`, `inserted_ids` per table, `audit_ids`, captured `settings`, `state`. The design’s settings-key sentinel was **dropped** because settings must remain read-only (nothing may write them), and the OBS-marker presence check (`properties.name LIKE 'OBS:%'`) guards double-loading. Belt-and-braces: journal-driven reverse-FK deletes **and** OBS-marker cleanup (`properties.name LIKE 'OBS:%'`, `users.email`/`vendors.email LIKE 'obs.%@example.com'`).

## 3. Fixture (scripts/obs-dataset/fixture.ts, 374 lines)

Full 16-scenario commercial dataset, anchor `T = 2026-09-25` (UTC), `M0 = 2026-09`, periods `M-1..M-4` via `shiftPeriod`. Handle-based references (`@unit:u-a1`, `@lease:L-a1` …) resolved and substituted by the loader; users hashed inline with **PBKDF2-SHA256** (`pbkdf2:100000:<salt>:<hash>`, 100k iterations — byte-identical format to `src/server/auth.ts`), password `Obs!Commercial2026` for the four `obs.*@example.com` accounts (owner/admin/manager/manager; created T-90/-60/-45/-30).

Injected aggregates: **8 properties · 18 units · 16 tenants · 19 leases · 43 rent charges · 43 payments · 7 vendors · 10 work orders · 8 applications · 4 users · 39 audit rows** (lease_tenants stays empty — no API write path; sessions stay runtime-only).

Fixture mechanics that make the product’s math exact at anchor:
- Due dates chosen so `markOverdue` is a **no-op** at anchor (O1 M0 due T-20, C2 M0 due T-25, O2 M0 due T+6; all M-1 charges already paid or explicitly `overdue`). Empirically proven: the dev stack restarted across load/verify multiple times and the status distribution never changed (38 paid / 1 partial / 3 overdue / 1 waived).
- Occupancy ⇔ lease truth (P9) holds on the OBS subset; the product’s own overlap guard at `POST /api/leases` returns 409 (verified, §6).
- Multi-payment reconciliation: C1 M0 = 15 000 + 17 000 + 5 000 (cash/check/ach + credit on A3 M0, other on A1 M-2); O2 M0 partial 20 000; C2 M0 partial 15 000; O3 M-1 split 15 000 + 13 000.

## 4. Expected end-state (seed-aware)

The design’s per-table targets are the **injected** counts; the live dashboard additionally contains the demo seed. Post-load numbers (recorded identically by load-time in-tx verify, standalone `--verify`, and the product’s own dashboard/API):

| Table | Total | Composition |
|---|---|---|
| properties | 11 | 3 seed + 8 OBS |
| units | 23 | 5 seed + 18 OBS |
| tenants / leases / rent_charges / payments / work_orders / applications | 16 / 19 / 43 / 43 / 10 / 8 | all OBS |
| lease_tenants | 0 | — |
| vendors | 10 | 3 seed + 7 OBS |
| users | 6 | 2 seed + 4 OBS |
| sessions | 24 → 34 | 24 baseline; +10 runtime logins from verification (all OBS users) |
| audit_logs | 81 | 42 seed + 39 OBS |
| settings | 6 | seed, untouched |
| schema_migrations | 5 | untouched |

Dashboard tiles (product SQL): properties 11 · units 23 · occupied 17 · vacant 4 · occupancy rate 74 % · active leases 13 · upcoming move-outs 2 (C1 T+21, E1 T+24) · month outstanding 75 000 · month collected 453 000 · overdue total 102 000 / 3 charges · open WOs 5 · urgent 1 · upcoming expirations 3 (C1, E1, A2 T+55) · recent WOs 5, urgent first.
**Seed artifact documented:** the Austin demo seed marks 4 of its 5 units `occupied` with zero leases (a pre-existing demo condition, not caused by this injection); the occupancy-truth check is therefore scoped to OBS properties, and the loader asserts the seed split (occupied 4 / vacant 1) as part of its gate.

## 5. Execution log (what actually happened)

1. Schema column lists re-confirmed against `schema.sql` + `app.ts` insert statements (§10 of the plan PDFs were out of date for tenants — `employer` is not a column; the fixture omits it).
2. Loader bugs fixed pre-flight: refs normalized to plural groups (`@leases:`/`@units:`/`@charges:`/`@payments:`), expected sessions removed (baseline-aware), verify-mode baseline read from journal, dead clone branch removed, reset uses `audit_ids`.
3. **First load attempt — guarded rollback:** verification caught `count properties: expected 8, got 11` (expected totals had forgotten the seed); transaction rolled back; baseline intact. Loader corrected to seed-aware totals; load re-ran → **LOAD OK** + journal written.
4. `--verify` → **VERIFY PASS** (counts, dashboard, statuses all exact).
5. API suite (54 assertions) → **ALL PASS** (§6).
6. UI sweep via Playwright (§6).
7. **Clone-reset proof** (§7) — two guarded rollbacks along the way proved the reset guard, then **RESET OK**.
8. Final `--verify` on the live DB → **VERIFY PASS** (post-reset-proof; live DB untouched by the clone proof).

## 6. Runtime / commercial surface verification

### API (read-only except one rejected write; 54/54 PASS)
`scripts/obs-dataset/load.ts` is DB-only; the runtime checks below were executed against the product over HTTP with session cookies:

- **Dashboard summary** (GET `/api/dashboard/summary`): every tile matches §4 exactly, including `recent_work_orders` = 5 with the urgent roof-leak WO first.
- **Lists**: `/api/leases` 19 (upcoming 2 · ended 3 · cancelled 1 · active 13); `/api/rent-charges` 43 (M0 13; overdue 3; waived 1; M0 paid 9; M0 partial 1); `/api/work-orders` 10; `/api/applications` 8; `/api/vendors` 10; `/api/tenants` 16; `/api/units` 23; `/api/properties` 11; `/api/users` 6 (4 OBS).
- **Reconciliation**: C1 M0 charge — 3 payments, sum 37 000, status `paid`.
- **P9 runtime guard**: `POST /api/leases` with an active lease overlapping O4’s upcoming lease → **409**; lease count unchanged (rejected before write).
- **Role gates** (obs.finance, manager): `GET /api/audit` → 403, `GET /api/users` → 403, `PUT /api/settings` → 403; admin → 200/200.
- **Exports** (CSV): properties header `id,name,type,address,commune,wilaya,country,city,state,zip,unit_count,occupied_count` — `commune,wilaya` present, in order. Rent-ledger (period 2026-09): 13 rows; header has **no** commune/wilaya columns (deviation, §8).
- **Settings** (GET `/api/settings`): `currency=DZD`, `locale=ar`, `AUTH_ENABLED=true` — the seed contract, read-only.
- **Audit** (GET `/api/audit`): 81 total. Ours: `lease` create 19 · `payment` create 15 · `rent_charge` generate 3 · `settings` update 2. Seed trail: `settings` update 41 + `property` delete 1 (so `entity=settings` = 43). All 39 OBS rows resolve an actor name; the 7 null-actor rows are seed artifacts.

### UI smoke (Playwright, RAM-friendly; evidence screenshots in `%TEMP%\opencode\obs-ui-evidence\`)
Logged in as `obs.admin@example.com` on `/login` → dashboard with exact tiles; `/properties` (OBS properties with commune/wilaya addresses — “El Madania, Alger”, “Tizi Ouzou”, “El Eulma, Sétif”); `/rent` (M0 ledger 45 000/42 000/39 000/37 000/35 000…); `/maintenance` (urgent roof leak first); `/applications` (Ines Boulifa on Appartement 202); `/tenants` (Fares Cherif, Amine Benali with `obs.*` e-mails); `/leases` (Yasmine Khelifi active); `/settings` → Vendors tab (incl. “Maintenance Générale DH”) / Users tab (obs.owner, obs.finance with roles) / **Audit log tab** (full trail: the 15 payment creates incl. the 3-way split on charge 12, the 3 rent-charge generates, the 19 lease creates, actors “Nadia Cherif”/“Yacine Haddad”). `/users` and `/audit` are **not** UI routes (404) — admin API-only surfaces, consistent with the role gates.

## 7. Clone-reset proof (live DB keeps the dataset)

- `load.ts --clone <tmp>/clone.sqlite` — consistent `VACUUM INTO` copy of the live DB carrying the full injected dataset (+ runtime sessions from verification).
- `OBS_DATASET_ALLOW=1 load.ts --reset --db <clone> --journal <live journal>` — surgical reverse-FK deletes (audit → payments → charges → lease_tenants → leases → WOs → **vendors** → applications → tenants → units → properties → sessions → users) + OBS-marker belt-and-braces, then **in-transaction verification against `baseline_counts`** before COMMIT.
- Result: `RESET OK — restored to baseline: {properties:3, units:5, tenants:0, leases:0, lease_tenants:0, rent_charges:0, payments:0, vendors:3, work_orders:0, applications:0, users:2, sessions:24, audit_logs:42, settings:6}` — byte-for-byte the pre-injection row counts.
- The live DB was re-verified afterwards (`VERIFY PASS`) — the proof ran on the clone only, as required.
- **Journal state nuance:** the journal is shared between the live DB and its clones, and the clone proof therefore advanced its `state` to `reset`. The live DB intentionally *keeps* the dataset; the journal guards against a second load (reset-first semantics) and records that the disposable-reset proof was executed on 2026-09-25.

## 8. Deviations vs. the design document

| # | Design said | Reality (documented, deliberate) |
|---|---|---|
| D1 | Audit manifest included user/vendor/tenant/application creates | **Unrealizable** — `src/server/app.ts` has no `writeAudit` for those creates. Actual 39: 19 lease creates + 3 rent_charge generates + 15 payment creates + 2 settings updates. |
| D2 | Charge statuses “33 paid” etc. | 43 = **38 paid · 1 partial · 3 overdue · 1 waived** (design arithmetic slip; loader/API/dashboard all agree). |
| D3 | Rent-ledger CSV export includes commune/wilaya (§9.6) | Export has **no** geo columns (verified header: `period,due_date,property_id,property_name,unit_id,unit_name,tenant_id,tenant_first_name,tenant_last_name,amount,amount_paid,balance,status`); properties export does include `commune,wilaya`. |
| D4 | `recent_work_orders` shows 6 | Returns **5** — only 5 non-terminal WOs exist; 10 total. |
| D5 | Loader via `wrangler d1 execute` | **`node:sqlite` direct writes** on the verified local D1 file (single transaction, verify-inside-transaction before COMMIT, rollback on mismatch; busy_timeout 30 s). |
| D6 | Sentinel = settings key | **Journal file** sentinel + OBS-marker row check (settings left read-only). |
| D7 | Dashboard totals “8 properties / 18 units / 13 occupied / 72 %” | Totals are seed-aware: **11 / 23 / 17 (13 OBS + 4 seed artifact) / 74 %**; OBS contributions match the design’s tiles exactly (occupied 13, vacancy 3, active 13, move-outs 2, outstanding 75 000, collected 453 000, overdue 102 000/3, WOs 5/1, expirations 3). |
| D8 | Seed audit trail presumed absent | Seed carries 41 settings updates + 1 property delete (42 rows), so `entity=settings` = 43, actor-resolving = 74 (7 null-actor seed rows). |
| D9 | Fixture tenants `employer` column | Column does not exist in `schema.sql`; omitted. |

## 9. Repository state

- **Exactly one commit will be produced** (this execution): `scripts/obs-dataset/` (loader + fixture) and this report under `Docs/execution/governance/`. **Not pushed** (`origin/main` remains `b46168a`).
- Inherited modifications preserved untouched: `Docs/execution/ui-finalization/ui-finalization.md`, `Docs/execution/ui-finalization/ui-post-closure-corrections-2026-09-24.md`, `tests/audit.test.ts`.
- Inherited untracked files preserved untouched: `Docs.zip`, `Docs/Docs.zip`, `Docs/execution/P5/…P8/`, `Docs/execution/governance/core-profile-separation-gate-2026-09-24.md`, `tc.txt`/`tc3.txt`/`vt.txt`/`vt3.txt`.
- Evidence outside the repo: `%TEMP%\opencode\obs-api-verify.ps1` (API suite), `%TEMP%\opencode\obs-ui-evidence\` (3 UI screenshots), `.wrangler/obs-snapshots/pre-injection-2026-09-25T08-22-59-322Z/` (restorable snapshot), `.wrangler/obs-journals/` (journal). All gitignored.
- Live DB final state (post-proof): `sha256 C7FB6462B3DBA467833FB6B0971FBD39E890006EA0CC8B381FECC5B7AA8CC0E6`, `VERIFY PASS` (sessions 34 with 24 baseline; all other counts exact).

## 10. Reset / disposal instructions

- **Quick disposal of the injected dataset on any environment DB:** `OBS_DATASET_ALLOW=1 node scripts/obs-dataset/load.ts --reset` (uses the journal for that DB file). Because the journal’s state is already `reset` from the clone proof, a first-step reset on the live file is a no-op; run `--reset` after a fresh load, or restore from the snapshot: stop `wrangler dev`, replace the `.sqlite` file with `d1-pre-injection.sqlite`, delete the `-wal`/`-shm` sidecars, restart.
- A second load of this dataset on the same DB file is refused until a reset (double-load guard).