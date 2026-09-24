# Execution Log — P12: Audit Trail

Records the execution of phase P12 from `Docs/plans/13-v1-implementation-plan.md` (P12 section) —
an immutable accountability record of sensitive writes and destructive actions, tied to the P5
authenticated user. Authored by the execution coordinator.

## Status

[COMPLETE] — landed as a single commit `feat: add audit trail` on top of `79441f2` (P11
"feat: add CSV export"). Parent confirmed `79441f2`; `4a42eaf` (Builder routing) and the P10
commit `5d2a394` untouched. Commit hash recorded by the coordinator in the final report
(created concurrently with its own commit, so it is not self-referential here).

## Baseline

- HEAD before P12: `79441f2` ("feat: add CSV export", P11).
- Parent of P11: `4a42eaf` ("fix: make Builder routing explicit and reliable").
- P10: `5d2a394` ("feat: add applications management UI").
- Only pre-existing working-tree noise before P12: `.opencode/agent/*` model-routing edits and
  untracked `.playwright-mcp/`, `Docs.zip`, `Docs/Docs.zip`, `Docs/execution/p5..p8*.md`.

## Objective vs. delivered

Plan objective: an immutable, append-only operational record of sensitive changes and
destructive actions answering WHO (actor_user_id), DID WHAT (action), TO WHICH ENTITY (entity),
WHICH RECORD (record_id), WHEN (created_at), and WHAT CHANGED (old_value/new_value) — a small
additive accountability layer, nothing more.

Delivered:

- **Exactly one additive migration** `migrations/0005_audit_logs.sql` — `audit_logs` table
  (`id`, `actor_user_id` FK to `users` **ON DELETE SET NULL**, `action`, `entity`, `record_id`,
  `old_value`, `new_value`, `created_at`) plus `created_at`/`entity` indexes. Registered purely
  by filename via the existing `scripts/migrate.ts` directory scan. `schema.sql` (frozen 0001
  baseline) and migrations 0002–0004 untouched.
- **Centralized best-effort `writeAudit` helper** (`src/server/index.ts`): actor only from
  `c.get("user")?.userId ?? null`; values JSON-stringified (null stored as SQL NULL); wrapped in
  try/catch with `console.error` on failure — audit failure never alters the business operation
  or its response (no transaction mechanism exists in the codebase and one was not invented).
  Audit rows are written strictly AFTER the business mutation succeeds and after the existing
  not-found guards return.
- **17 handlers instrumented** (see below) with the 11-entity × 4-action vocabulary
  (`create/update/delete/generate`).
- **Read API** `GET /api/audit?entity=&limit=` — owner/admin only, GET-only, bound entity
  filter, default limit 50, server-side cap 200, deterministic newest-first.
- **UI** — Settings → Audit read-only tab gated exactly like the Users tab (owner/admin only),
  localized, with loading and empty states.
- **i18n** — `audit.*` namespace in en/fr/ar with full key parity.
- **Tests** — `tests/audit.test.ts` (28 tests: 3 migration, 11 write, 10 read-API, 4
  business-stability) covering all 18 required behaviors; migration tests (additive, re-run
  no-op, fresh-vs-existing converge); generate summary-row test; and the two post-review
  regression tests (actor-injection, notes-exclusion). No existing test modified.

## Audited operations (17 handlers)

| Handler | action / entity | old_value / new_value |
|---|---|---|
| `POST /api/rent-charges` | create / rent_charge | null → `{lease_id, period, amount, due_date}` |
| `POST /api/rent-charges/generate` | generate / rent_charge | one summary row per run with ≥1 created: `{period, created}`; none when 0 (idempotent no-op) |
| `PUT /api/rent-charges/:id` | update / rent_charge | old **exactly** `{amount, due_date, status}`; new = sent patch fields only (`{amount?, due_date?, status?, notes?}`) — `notes` only when the client sends it |
| `DELETE /api/rent-charges/:id` | delete / rent_charge | `{lease_id, period, amount, status}` → null |
| `POST /api/payments` | create / payment | null → `{charge_id, amount, method}` (no reference/notes) |
| `DELETE /api/payments/:id` | delete / payment | `{charge_id, amount, method}` → null |
| `POST /api/leases` | create / lease | null → `{unit_id, start_date, end_date, monthly_rent, status}` |
| `PUT /api/leases/:id` | update / lease | pre-read `{unit_id, primary_tenant_id, start_date, end_date, monthly_rent, rent_due_day, status}` → sent patch fields |
| `DELETE /api/leases/:id` | delete / lease | `{unit_id, primary_tenant_id, start_date, end_date, monthly_rent, status}` → null |
| `DELETE /api/properties/:id` | delete / property | `{name}` → null |
| `DELETE /api/units/:id` | delete / unit | `{property_id, name, status}` → null |
| `DELETE /api/tenants/:id` | delete / tenant | `{first_name, last_name}` only → null |
| `DELETE /api/vendors/:id` | delete / vendor | `{name}` → null |
| `DELETE /api/work-orders/:id` | delete / work_order | `{title, status}` → null |
| `DELETE /api/applications/:id` | delete / application | `{first_name, last_name, status}` → null |
| `DELETE /api/users/:id` | delete / user | `{email, role}` ONLY → null |
| `PUT /api/settings` | update / settings | one row per changed key: `{key, value: old}` → `{key, value: new}`; unchanged keys skipped |

NOT audited (deliberate): `markOverdue()`, unit occupancy reconciliation, login/session
creation, and the create/update paths of properties/units/tenants/vendors/work-orders/
applications/users (out of the P12 required list — known limitation).

## Actor model

- Actor comes ONLY from the P5 session context (`c.get("user")?.userId ?? null`); never from
  request payloads. Zod schemas (`parseJson` → `schema.safeParse`) strip unknown keys, so a
  forged `actor_user_id` in any payload can never reach the INSERT — verified by the dedicated
  actor-injection regression test.
- `ON DELETE SET NULL` on the FK keeps the existing owner-only `DELETE /api/users/:id` working
  when the deleted user has audit history: sessions are deleted first, audit rows persist with
  actor nulled, never cascade away, never block the delete.
- Owner/admin/manager model untouched; no new identity system.

## Old/new value strategy (data minimization)

- Minimal purpose-built objects only; never `SELECT *`, never raw bodies.
- NEVER stored: password hashes, token hashes, session tokens, cookies, secrets, tenant PII
  (`date_of_birth`, `emergency_contact`, `monthly_income`, `email`, `phone`), payment
  `reference`/`notes`.
- **Blocker fix (review-HIGH, closed)**: the first review pass found the rent-charge PUT audit
  `old_value` included `notes` unconditionally. Fixed so `old_value` is EXACTLY
  `{amount, due_date, status}` (pre-read no longer selects `notes`); `notes` appears in
  `new_value` only when the client actually sends it (the audited change). Two regression tests
  lock this in: a strict `toEqual` on old_value (a leaked notes key fails) and a notes-only edit
  recording. Unrelated free-text notes are never copied into the audit trail.

## API — GET /api/audit

- Authorization mirrors the existing owner/admin guard (`hasMinimumRole(user.role, "admin")`);
  manager = 403, unauthenticated = 401 when auth enabled (not on the public allowlist).
- GET-only; POST/PUT/DELETE `/api/audit` → 404.
- `entity` optional, bound `WHERE entity = ?` parameter (junk values → empty list, no error).
- `limit` optional: default 50 (`AUDIT_DEFAULT_LIMIT`), clamped to 200 (`AUDIT_MAX_LIMIT`),
  invalid value → 400. No pagination, no extra parameters.
- Ordering `ORDER BY created_at DESC, id DESC` (deterministic newest-first).
- Response rows join `actor_name` via `LEFT JOIN users` selecting only
  `COALESCE(u.display_name, u.email)`; no auth columns ever selected.

## UI — Settings → Audit

- `settings-page.tsx` adds the Audit `TabsTrigger`/`TabsContent` with the SAME gate as the
  Users tab (`currentUserRole === "owner" || currentUserRole === "admin"`); managers never see
  it.
- New `audit-tab.tsx`: read-only Card + Table, fetches `GET /api/audit?limit=100`, loading and
  empty states, localized action/entity labels, actor name with "-" fallback, record id, and a
  concise old→new change summary (field names are content; surrounding chrome is localized).
  No edit/delete controls. No Settings redesign.

## i18n, retention, security

- `audit.*` keys added to en/fr/ar with identical key sets (parity enforced by the P4
  localization test); no hard-coded user-facing strings.
- [UNKNOWN] No retention/rotation policy exists in any authoritative doc; none invented. The API
  only enforces the limit/cap. The plan's conditional retention test is therefore not written.
- [VERIFIED] No password/token/cookie leakage: the raw audit response JSON is asserted free of
  `password_hash`, `token_hash`, `session_token`, `cookie`; user-delete old_value is exactly
  `{email, role}`.

## Verification evidence

- [VERIFIED] `pnpm typecheck` exit 0 (twice: initial build and post-fix).
- [VERIFIED] `pnpm test` green — **15 files / 216/216 tests** (188 baseline + 26 P12 + 2
  post-review regression tests; `tests/audit.test.ts` = 28). All P1–P12 suites pass; no
  existing test modified or weakened.
- [VERIFIED] Explorer (read-only): PASS — 17 instrument points, actor source, bounded-value
  strategy, migration requirements, retention UNKNOWN.
- [VERIFIED] Builder (via `scripts/builder-run.ps1`, two runs: initial implementation, then the
  blocker fix): PASS both times; both typecheck and test green; scope confined to the 8 P12
  files.
- [VERIFIED] Tester (independent, read-only): PASS before the fix and PASS on the fix
  verification (fresh run) — old_value exact shape, notes-only-when-sent, forged
  `actor_user_id` ignored (session actor recorded), all P1–P12 tests green, exact P12 scope
  clean, no execution log existed during testing.
- [VERIFIED] Reviewer (independent, read-only): first verdict **BLOCK** (HIGH: rent-charge
  `old_value` included `notes`). After the Builder fix and re-verification: **PASS** — no
  CRITICAL/HIGH/MEDIUM findings; only LOWs (legacy-test stderr noise from missing 0005 —
  expected best-effort evidence; audit tab uses limit=100 within cap; working-tree noise to be
  excluded from the commit).
- [VERIFIED] Git diff/status audit: the committed change set is exactly the 8 P12 files plus
  this execution log. `.opencode/agent/*`, `.playwright-mcp/`, `Docs.zip`, `Docs/Docs.zip`,
  `Docs/execution/p5..p8*.md`, and P10/P11 files were never staged.

## Files changed (single commit `feat: add audit trail`)

`migrations/0005_audit_logs.sql` (new), `src/server/index.ts`,
`src/client/components/settings/settings-page.tsx`,
`src/client/components/settings/audit-tab.tsx` (new),
`src/client/i18n/{en,fr,ar}.json`, `tests/audit.test.ts` (new), and this execution log.

## Known limitations

- Best-effort writes: if the `audit_logs` table is absent (e.g. legacy DBs/tests that never ran
  0005), the write fails silently with a console error and the business operation is unaffected
  — proven by the many `audit write failed { ... no such table: audit_logs }` stderr lines in
  legacy test files, all suites staying green.
- No transaction mechanism: an audit write can never be atomic with the business mutation; audit
  rows are written only after the mutation succeeds, which bounds the gap to audit-loss (never
  audit-corruption of a failed business op).
- Deliberately not audited: create/update of properties/units/tenants/vendors/work-orders/
  applications/users, markOverdue, occupancy reconciliation, logins.
- [UNKNOWN] Retention/rotation policy — none authoritative; no mechanism implemented.

## Rollback

`git revert <P12 commit hash>` (recorded by the coordinator). This removes the migration file,
the `writeAudit` helper, all 17 instrumented handlers' audit lines, `GET /api/audit`, the
Audit tab, the i18n additions, and `tests/audit.test.ts`. Business APIs keep their P11 shapes
and behavior; existing audit rows (if any were written in production) are simply no longer
exposed. If the migration already ran against a production DB, the table may be dropped or left
dormant per operator choice — reverting the code alone is safe either way.

## Out of scope (unchanged)

P8/P9/P11 behavior, P5 auth architecture, roles, multi-tenancy, cloud, notifications, Arabic
RTL, responsive redesign, desktop/LAN packaging, installer, update channel, licensing, and any
unrelated refactoring.