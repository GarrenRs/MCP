# Execution Log — P11: CSV Export

Records the execution of phase P11 from `Docs/13c-v1-implementation-plan.md` (section "## P11 — CSV export",
order step 11). Executed as a multi-agent workflow (explorer → builder → tester → reviewer) on 2026-09-22,
followed by a closure pass (Content-Disposition filename hardening + git/documentation reconciliation) and
a corrective closure on 2026-09-23 (Export button visibility in empty datasets; see "Corrective closure"
below — same phase, amended into the same single commit).

## Status

[COMPLETE] — landed on `main` as the P11 phase commit ("feat: add CSV export"), 2026-09-22, as a single
commit whose parent is `4a42eaf` ("fix: make Builder routing explicit and reliable"). The commit was
amended in place — once to fold in this execution log, and once more during the closure reconciliation
pass — so **no commit hash is hard-coded in this log**: a commit's hash changes whenever the commit is
amended, and any hard-coded value would become stale or self-referential by construction. The live commit
identity is verified with `git rev-parse HEAD` and `git log -1` (parent: `4a42eaf`).

The single-commit-per-phase rule is preserved: history contains exactly one P11 commit.

Historical note (audit reference only, NOT the current hash): the pre-log implementation tree was first
committed as `01fa658`; that commit was rewritten by the amendments above.

## Starting baseline

- HEAD before P11: `4a42eaf` — "fix: make Builder routing explicit and reliable" (Builder routing
  infrastructure).
- Previous commit: `5d2a394` — "feat: add applications management UI" (P10).
- Working tree contained pre-existing unrelated noise (excluded from P11; see "Files changed").

## Objective

Provide read-only CSV export for (1) the period rent ledger, (2) the tenant directory, and
(3) the property directory, as additive `GET /api/export/*` endpoints with CSV responses,
correct Content-Type/Content-Disposition, reused existing data model/joins, P5 authentication,
and P8 rent/overdue parity. Client: Export buttons on the three list pages with localized
download filenames. No DB changes, no migrations, no P12 work, no unrelated refactoring.

## Scope

- Server: three additive read-only GET endpoints + small local CSV helpers in `src/server/index.ts`.
- Client: `downloadCsv()` sibling helper in `src/client/api.ts`; Export buttons on Rent page
  (uses the currently selected/displayed period), Tenants list, Properties list.
- i18n: new `export.*` namespace in en/fr/ar.
- Tests: new `tests/export-csv.test.ts` (23 tests).
- Dependencies honored: P3 (i18n architecture: dotted keys via `tf`, fallback chain, fr-DZ → fr.json)
  and P8 (period/overdue parity: shared `markOverdue()` + persisted `status`).
- Closure pass (same phase, amended into the same commit): hardened `csvDisposition()` against
  header-breaking input and added focused filename tests; reconciled this execution log.

## Endpoints added

- `GET /api/export/rent-ledger?period=YYYY-MM[&filename=...]` — 400 `period_required` when missing,
  400 `validation` when malformed (existing error convention via `err(ErrorCode...)`).
- `GET /api/export/tenants[&filename=...]`
- `GET /api/export/properties[&filename=...]`

All responses: `Content-Type: text/csv; charset=utf-8` and
`Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<encoded>`.

## UI changes

- `src/client/api.ts` — new `downloadCsv(path, filename)` (blob + object URL + anchor click;
  `credentials: "include"`; mirrors `api<T>` error handling incl. `onUnauthorized()` on 401).
  `api<T>()` untouched.
- `src/client/components/rent/rent-page.tsx` — Export button (secondary variant, Download icon)
  beside Generate; URL and filename derived from the page's current `period` state via
  `tf("export.rent_filename", period)`.
- `src/client/components/tenants/tenants-list.tsx` — Export button (secondary variant).
- `src/client/components/properties/properties-list.tsx` — Export button (secondary variant).
- Existing Button/PageShell design-system patterns preserved; no new screens/filters.

## Files changed

Modified:

- `src/server/index.ts` (+121/−0 vs `4a42eaf`) — CSV helpers (`csvCell`, `csvNumber`,
  `csvDisposition`, `csvResponse`) + three export GET handlers.
- `src/client/api.ts` (+27) — `downloadCsv()`.
- `src/client/components/rent/rent-page.tsx` (+11/−5).
- `src/client/components/tenants/tenants-list.tsx` (+10/−4).
- `src/client/components/properties/properties-list.tsx` (+11/−5).
- `src/client/i18n/en.json`, `fr.json`, `ar.json` (+6 each) — `export.*` namespace.

New:

- `tests/export-csv.test.ts` (326 lines, 23 tests).
- `Docs/execution/p11-csv-export.md` (this log).

10 files changed in the P11 commit (implementation + tests + execution log); all additive/read-only.

NOT changed: `src/server/schema.sql`, `migrations/*`, `scripts/builder-run.ps1` (Builder routing
infrastructure), P10 files. The working-tree modifications to
`.opencode/agent/orkestrix-explorer.md` and `.opencode/agent/orkestrix-tester.md` pre-date this
phase (agent-configuration tasks) and were deliberately excluded from the P11 commit, as were
untracked `Docs.zip`, `Docs/Docs.zip`, and `Docs/execution/p5..p8*.md`.

## Database changes

NONE. No tables, columns, or indexes touched. [VERIFIED]

## Migration changes

NONE. No migration files added or modified. [VERIFIED]

## Authorization behavior

- Export routes are registered under `/api/*` and inherit the existing P5 session middleware
  (cookie `session_token`). The public allowlist at the top of `src/server/index.ts` was NOT
  modified — `/api/export/*` is not public. [VERIFIED]
- With `AUTH_ENABLED`, unauthenticated requests to all three export routes are rejected (401);
  authenticated requests succeed. [VERIFIED]
- GET-only; no mutating methods exposed (POST → 404). No new role gates added (consistent with the
  existing session-only read endpoints).

## CSV design / columns actually implemented

RFC-4180-style quoting via `csvCell()` (quote when value contains `,`, `"`, `\r`, or `\n`; escape
embedded quotes by doubling). CRLF line endings; header-only body for empty datasets (valid CSV).
`csvNumber()` renders canonical numeric values (trailing-zero trimmed via `toFixed(10)` strip), so
DZD amounts export as plain numbers (e.g. `1200`, not `1,200` or float artifacts). [VERIFIED]

Headers and stable column order:

- **rent-ledger**: `period,due_date,property_id,property_name,unit_id,unit_name,tenant_id,tenant_first_name,tenant_last_name,amount,amount_paid,balance,status`
- **tenants**: `id,first_name,last_name,email,phone,active_property_name,active_unit_name`
- **properties**: `id,name,type,address,commune,wilaya,country,city,state,zip,unit_count,occupied_count`

All columns derive from existing response contracts (types.ts `RentCharge`/`Tenant`/`Property` and
the list endpoints); no new business schema was invented.

## Content-Disposition filename hardening (closure pass)

`csvDisposition()` (in `src/server/index.ts`) was hardened in the closure pass [VERIFIED]:

- Header-breaking control characters (including CR/LF, `\u0000`–`\u001f`, `\u007f`) are neutralized
  to `_` before either encoding path.
- The ASCII `filename="..."` fallback keeps only printable ASCII and now escapes `"` and `\`
  (`\"` / `\\`), so unusual filename values cannot produce a malformed header.
- The RFC 5987 `filename*=UTF-8''...` variant is preserved (percent-encoded UTF-8 via
  `encodeURIComponent` with the stray-`%` guard), with control characters neutralized first.
- Normal localized filenames (e.g. `loyers-2026-05.csv`) pass through unchanged on both variants;
  endpoint behavior is otherwise unchanged.

This resolves the MEDIUM finding recorded by the Reviewer (see Known limitations).

## P8 parity behavior

- Rent export reuses the exact query/joins/order of the Rent page via `CHARGE_SELECT` filtered by
  `WHERE c.period = ?` and runs the shared `markOverdue()` first — the same idempotent P8 freshness
  path used by `GET /api/rent-charges`. No second/independent overdue calculation exists in the
  export path; the persisted `status` column is the authoritative overdue value. [VERIFIED]
- Balance = `max(0, amount - amount_paid)`, computed exactly as the Rent page does. [VERIFIED]
- Parity test confirms exported rows for a period match `GET /api/rent-charges?period=` (count and
  key fields including `status`), and overdue status appears after due-date refresh.

## i18n changes

`export.*` namespace added to all three catalogs (6 keys, present and non-empty):

- `export.button` — en "Export CSV", fr "Exporter CSV", ar "تصدير CSV"
- `export.rent_filename` — en `rents-{0}.csv`, fr `loyers-{0}.csv`, ar `إيجارات-{0}.csv`
- `export.tenants_filename` — en `tenants.csv`, fr `locataires.csv`, ar `مستأجرون.csv`
- `export.properties_filename` — en `properties.csv`, fr `biens.csv`, ar `عقارات.csv`

The known French Rent filename convention `loyers-YYYY-MM.csv` is honored (period substituted into
the template); tenant/property filenames follow the same localized convention. [VERIFIED]

## Tests added

`tests/export-csv.test.ts` (new, **23 tests**):

Implementation pass (18):

1. properties export returns CSV; 2. tenants export returns CSV; 3. rent-ledger export returns CSV;
4. no mutating methods on export routes (POST → 404); 5. rent requires a period (400); 6. rent
rejects invalid period format (400); 7–9. stable column order for each export; 10. quotes values
containing commas; 11. quotes values containing double quotes; 12. empty dataset → valid header-only
CSV; 13. DZD amounts as plain numbers (no thousands separators/float artifacts); 14. rent parity with
`GET /api/rent-charges` for the same period; 15. overdue state reflects P8 `markOverdue()` refresh;
16. unauthenticated rejected when auth enabled; 17. authenticated allowed when auth enabled;
18. Content-Disposition honors the requested filename.

Closure pass (5) — `content-disposition filename hardening`:

19. normal localized filename preserved on both `filename=` and `filename*=`;
20. double quote in filename escaped in the ASCII fallback (`a\"b.csv`);
21. backslash in filename escaped (`a\\b.csv`);
22. CR/LF and control characters neutralized (no raw CR/LF anywhere in the header);
23. RFC 5987 `filename*` stays valid for Unicode localized names (printable-ASCII header, percent-
    encoded ext-value, non-ASCII neutralized to `_` in the ASCII fallback).

## Verification evidence

- [VERIFIED] `pnpm typecheck` exits 0 — run by Builder during implementation and re-run by Tester
  and in the closure pass.
- [VERIFIED] `pnpm test` runs green: **14 files, 188/188 tests passed** — `export-csv` (23),
  `auth` (31), `finance` (27), `settings-i18n-errors` (21), `localization-p4` (18), `work-orders` (12),
  `charge-admin` (12), `applications` (8), `overdue-freshness` (7), `charges` (7),
  `lease-occupancy` (6), `migrations` (6), `payments` (5), `dashboard` (5). No P1–P10 regressions;
  the 5 new hardening tests are green.
- [VERIFIED] Tester verdict (implementation pass): PASS — functional, CSV correctness, rent/P8 parity,
  authorization (401 when auth enabled; export routes not on the public allowlist), download semantics
  (Content-Type + Content-Disposition + localized filenames), no scope violations, no code changes.
- [VERIFIED] Reviewer verdict (implementation pass): **PASS** — CRITICAL: none; HIGH: none;
  MEDIUM: 1 (filename header escaping — resolved by the closure pass, see above); LOW: 2 (see Known
  limitations). No code edits by Reviewer.
- [VERIFIED] Builder routing: executed via `scripts/builder-run.ps1`; observed runtime model
  `opencode-go/kimi-k2.7-code` (turn header `> orkestrix-builder · kimi-k2.7-code`); wrapper exit
  code 0; no stderr-caused false failure.
- [INFERENCE] Tester's first `pnpm test` run piped through a PowerShell `Select-Object` reported
  exit 1 as a pipeline artifact; a clean re-run exited 0 with 183/183 passing at the time. Recorded
  as a tooling note only; final closure re-run: exit 0, 188/188.

## Known limitations

- [LOW] Tests do not explicitly cover `\n` embedded inside CSV cell values (cell quoting covers
  commas, quotes, and CRLF line endings at the header/row level) or the exact `charset=utf-8` header
  string. Behavior is implemented and observed correct; coverage is a future nicety.
- [LOW] The tenants/properties export queries duplicate the join logic of their list endpoints
  instead of sharing a query helper; behavior is consistent. No refactor was performed (out of scope).
- [RESOLVED] MEDIUM (Senior review, implementation pass): ASCII `filename="..."` fallback did not
  escape `"` or `\`. Fixed by the closure-pass hardening; regression-tested (new tests 20–23).

## Rollback path

`git revert <P11 commit>` (or hard-reset to `4a42eaf`). The phase is additive: new GET routes, a
client-side helper + buttons, i18n keys, and one test file; removal is clean and touches no schema,
migrations, P8 rule, or authentication architecture.

## Explicit confirmations

- [VERIFIED] NO P12 work (no audit trail) was performed.
- [VERIFIED] NO database schema change was made.
- [VERIFIED] NO migration was added or modified.
- [VERIFIED] NO unrelated refactoring occurred (helper/wiring changes are P11-scoped; the closure
  pass touched only `csvDisposition()` and its tests).
- [VERIFIED] NO Builder routing changes — `scripts/builder-run.ps1` untouched; model pinned and
  frozen at `opencode-go/kimi-k2.7-code`.
- [VERIFIED] NO P10 changes — `5d2a394` unchanged; P10 files untouched.
- [VERIFIED] NO separate closure commit — the closure pass was amended into the single P11 commit.

## Corrective closure (2026-09-23)

A read-only smoke test of the seeded app (vite `[::1]:5173`, workerd `127.0.0.1:8787`) showed that
the Export CSV button was hidden whenever a dataset was empty: on Tenants and Rent (both seeded empty)
the button was absent, so CSV export was undiscoverable in exactly the state where a user would
produce a header-only CSV. This was a UI-discoverability defect in the original P11 implementation.

Scope of the correction (original implementation stays in scope; correction = UI discoverability):

- `src/client/components/tenants/tenants-list.tsx` — Export button now renders unconditionally;
  "Nouveau locataire" stays gated on dataset length (so the inline empty-state action isn't duplicated).
- `src/client/components/properties/properties-list.tsx` — Export button now renders unconditionally;
  "Nouveau bien" stays gated the same way.
- `src/client/components/rent/rent-page.tsx` — period stepper + Export button always render; the
  primary "Générer" action stays gated on `charges.length > 0`. Stepper state/behavior untouched.

Explicitly unchanged:

- No backend, API, DB/migration, auth, i18n-key, `src/client/api.ts`, Builder-routing, or P10 change.
  Export handlers, URLs, `tf()` keys, and localized filenames are byte-identical to the original
  implementation; the Rent export still uses the selected `period` state.
- Empty-dataset behavior: an empty list still downloads a valid header-only CSV (server behavior
  unchanged; covered by `tests/export-csv.test.ts` test 12).
- All 23 P11 export tests preserved (none modified or removed).

Verification for the correction:

- [VERIFIED] `pnpm typecheck` exit 0 (Builder re-run; independently re-run by Tester).
- [VERIFIED] `pnpm test` — 14 files, 188/188 passing, incl. `export-csv` 23/23 (Tester independent
  re-run).
- [VERIFIED] Working-tree diff scoped to exactly the three component files plus pre-existing baseline
  noise (`.opencode/agent/*`, `Docs.zip`, `Docs/Docs.zip`, `Docs/execution/p5..p8*.md`).
- No component-render test added: the repo has no jsdom/@testing-library, and adding test
  infrastructure was judged out of scope for a presentational JSX-only change; server-side
  empty-dataset coverage exists. The Reviewer assessed this as acceptable proportionate coverage.

Workflow record: Explorer brief (read-only root-cause scan) → Builder brief via
`scripts/builder-run.ps1` (`opencode-go/kimi-k2.7-code`, wrapper exit 0, no commit) → Tester
verification (`opencode-go/glm-5.3-flash`, PASS) → Reviewer (`opencode-go/gpt-5.6-luna`, read-only):

- [VERIFIED] Reviewer verdict (corrective closure): **PASS — corrective closure is safe and
  appropriately scoped.** CRITICAL: none; HIGH: none; MEDIUM: none; LOW: 1 (exact porcelain
  `git diff` could not be executed in the review environment; repository inventory and this
  documentation corroborate only the three target files plus pre-existing noise changed — no
  unauthorized source changes observed). Reviewer confirmed: Export buttons render unconditionally
  on all three pages; New/Generate remain dataset-gated (no duplicate empty-state controls); rent
  stepper remains state-driven and the export URL still uses the selected `period` with unchanged
  localized filename keys/URLs; server routes, CSV behavior, auth middleware, schema, migrations,
  i18n, `api.ts`, and scripts unchanged; header-only empty CSV still verified by
  `tests/export-csv.test.ts`; no new attack surface or data-exposure change (export endpoints remain
  behind the existing `/api/*` session middleware); no P1–P10 dependency on these presentational
  changes; baseline HEAD confirmed as `fbb2f3c` (the pre-amend review-time baseline, recorded as an
  audit reference only — the live identity is verified with `git rev-parse HEAD` and `git log -1`).

The correction was folded into the existing single P11 commit via `git commit --amend --no-edit`
(no second P11 commit). No P12 work; no DB/API changes.

## Commit identity

The P11 commit is the current phase HEAD: a single commit "feat: add CSV export" whose parent is
`4a42eaf`. Because the commit was amended in place (execution log fold + closure reconciliation),
no hash is hard-coded here; verify the live identity with `git rev-parse HEAD` and `git log -1`.
Historical pre-amend implementation-tree hash (audit reference only): `01fa658`.