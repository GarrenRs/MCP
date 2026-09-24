# Execution Report — Work Engine: Audit & Controlled Evolution (2026-09-24)

Purpose: audit the **working system** that builds this product (agents, model routing, tooling,
evidence, resume/checkpoint behavior) — **not** the product itself — and evolve the proven
workflow with the smallest changes that materially improve reliability, speed, resumability and
repeatability. No redesign. No application source, database, migration, or product feature was
touched. Approved and closed via a **single governance commit** (see **Final closure**); the
commit hash is recorded post-commit by the coordinator (a document cannot contain its own hash).

Method applied: Baseline → Audit → Plan → Controlled Execution → Verify → Review → Document →
Close → Hygiene → Next Baseline.

## Baseline (verified)

- HEAD: `5176431` ("docs: record final documentation reorganization verification"). Parent `97354b4`
  (docs reorg). `origin/main` = `5176431` (pushed on 2026-09-24; GitHub is the shared Source of Truth).
- opencode CLI **v2.0.13**; node **v24.12.0**; pnpm **11.1.2**; Git Credential Manager (HTTPS).
- Playwright MCP configured **globally** (`~/.config/opencode/opencode.jsonc` → local server
  `npx -y @playwright/mcp@latest --extension`, extension-mode token). Tokens are environment-scoped
  and must **never** be versioned in this repository. [VERIFIED — config read; token redacted here]
- Committed (GitHub `main`) agent config: builder `opencode-go/kimi-k2.7-code`, explorer
  `opencode/mimo-v2.5-free`, tester `opencode/ling-3.0-flash-fin-free`, reviewer
  `opencode-go/gpt-5.6-luna`.
- Local proven drift (pre-existing, uncommitted, documented since the post-P12 gate and UI log):
  explorer **and** tester → `opencode-go/glm-5.3-flash`.
- Working-tree noise at baseline (untouched, never staged): uncommitted Phase A UI implementation
  (`src/client/**`, `index.html`, `tests/audit.test.ts`), `.opencode/agent/*` drift (above),
  `.playwright-mcp/`, `Docs.zip` + `Docs/Docs.zip`, untracked `Docs/execution/P5…P8/` logs,
  `Docs/execution/ui-finalization/`, `tc.txt`/`tc3.txt`/`vt.txt`/`vt3.txt`. [VERIFIED — git status]

## Audit

### 1. Agent roles and model routing

| Agent | Mode | Permissions | Committed model | Local model | Registry status |
|---|---|---|---|---|---|
| orkestrix-builder | primary | read/edit/bash/grep/glob/list | `opencode-go/kimi-k2.7-code` | same | **active** |
| orkestrix-explorer | subagent | read-only (edit+deny, bash deny) | `opencode/mimo-v2.5-free` | `opencode-go/glm-5.3-flash` | committed model **does not exist**; local **active** |
| orkestrix-tester | subagent | read/grep/glob/list + bash/edit (narrow fixes) | `opencode/ling-3.0-flash-fin-free` | `opencode-go/glm-5.3-flash` | committed model exists; local **active** (deliberate) |
| orkestrix-reviewer | subagent | read-only (edit+deny, bash deny) | `opencode-go/gpt-5.6-luna` | same | **active** |

- In OpenCode V2, agent frontmatter `model:` governs **subagent** sessions; the primary session
  needs an explicit `--model`. `scripts/builder-run.ps1` pins `kimi-k2.7-code` on every Builder
  invocation — this is the correct, proven pattern. [VERIFIED — script read; registry check]
- **Defect found:** the committed explorer model `opencode/mimo-v2.5-free` is **not in the model
  registry** — a fresh clone from GitHub would fail to route explorer. The local drift is a real
  fix, not an experiment. [VERIFIED — model registry query]

### 2. Builder reliability

- Single controlled entry point (`scripts/builder-run.ps1`), model pinned, `--auto`, exit-code
  propagated. Rules: stay in active phase, never implement future phases, run tests+typecheck
  before completion, inspect diff before commit, never commit unless instructed, never touch
  `Docs.zip`. Proven across P1–P12 and both UI-finalization rounds. [VERIFIED — UI log §Builder execution]
- Gap: no written **resume** rule — the UI Round-1 session ended abnormally (ECONNRESET) and
  recovery relied on the coordinator re-verifying rather than the agent self-checking. [VERIFIED — UI log L54–59]

### 3. Explorer / Tester / Reviewer separation

- Sound and proven: explorer = read-only evidence gathering; tester = run/verify/diagnose + narrow
  corrective changes; reviewer = final read-only gate with severity tiers CRITICAL…PASS. No
  overlap in destructive capability. KEEP as-is. [VERIFIED — agent files]

### 4. Safe parallelism vs required sequencing

- Vitest configured `pool: "forks"`; this machine has ~7.8 GB RAM. A parallel vitest worker crash
  ("1 file incomplete / 215+1") was observed during UI work and attributed to memory pressure, not
  code. Standard discipline: **sequential** runs (`pnpm vitest run --no-file-parallelism`) before
  any FAIL conclusion; every rerun was green. [VERIFIED/INFERENCE — UI log L135–141]
- Workflow sequencing is linear and correct: explorer (pre) → builder → tester → reviewer (post),
  with safe read-only parallelism available at each exploration step.

### 5. Interruption / resume / checkpoint behavior

- Proven reality: ECONNRESET mid-session in UI Round 1; implementation survived; coordinator
  re-verified; an in-isolation rerun (28/28) cleared a transient test sighting. [VERIFIED — UI log]
- Checkpoints today are the **execution logs + `V1-PHASE-INDEX.md` + `00-README.md`** (per-phase
  commit anchors) plus evidence tags. Agent rules do not yet instruct a restore-on-resume step.
- Gap: builder/tester should restore state (`git status`, last log section) before acting on a
  resumed session, and record a checkpoint when a session must end early.

### 6. Evidence and closure handling

- Evidence tags `[VERIFIED] / [INFERENCE] / [RECOMMENDATION] / [UNKNOWN]` are used consistently
  across P1–P12 and UI logs — a proven convention that makes claims auditable. KEEP.
- Closure pattern: single phase commit → log updated with final hash post-commit → index/README
  cross-check → governance report. P9 stale hash handled by index correction (evidence kept intact).
  KEEP.
- Interrupted UI work shows the counterpart: fields left `(pending)`, one commit pending — resuming
  is manual. This motivates I2.

### 7. MCP / tool readiness

- Playwright MCP server is globally configured and was exercised heavily (`.playwright-mcp/` page
  snapshots + console logs; browser QA across FR/AR × widths and 14 routes in the UI phase).
  [VERIFIED — artifacts + UI log §Browser QA]
- Dev stack: Vite :5173 + Wrangler :8787 (D1), probed healthy during UI work. `pnpm` scripts
  standard (`dev`, `db:migrate`, `build`, `typecheck`, `test`). [VERIFIED]
- Readiness: **READY**. No repo-side MCP config needed; keep secrets out of the repo.

### 8. What should be versioned in the repository

| Item | State | Verdict |
|---|---|---|
| `.opencode/agent/*` (4 agents) | tracked | KEEP versioned (proven workflow) |
| `scripts/builder-run.ps1` | tracked | KEEP (sole Builder entry) |
| `Docs/**` | tracked (structure) | KEEP (authority + evidence) |
| Global MCP config + tokens | outside repo | KEEP out (environment) |
| `.opencode/package.json` (plugin dep) | ignored | Suspicious: no plugin source exists — either drop or add future plugin; EXPERIMENT (E4) |
| `.playwright-mcp/` | untracked | add to `.gitignore` (hygiene; logs already ignored via `*.log`) |
| `tc*.txt` / `vt*.txt` scratch | untracked | keep untracked (transient evidence); leave visible (referenced by logs) |
| `Docs.zip` / `Docs/Docs.zip` | untracked | KEEP out (existing rule, unchanged) |
| `p5–p8` + `ui-finalization` logs | untracked | deferred decision, unchanged (E1) |

### 9. What was proven successful in P1–P12 and UI work

- Governed per-phase loop (baseline → explorer evidence → builder via pinned wrapper → tester
  sequential → reviewer → single commit → log/index update).
- Model pinning per role (one wrapper for primary, frontmatter for subagents).
- Evidence tags + index-anchored checkpoints + preservation of historical records.
- Sequential test discipline on a constrained machine; browser QA via Playwright MCP when UI
  semantics matter.
- Documentation governance (post-P12, reorg, push-based Source of Truth on GitHub).

## VERIFIED — current architecture (summary)

A **single primary agent** (builder) driven through one model-pinned wrapper, supported by three
role-separated subagents (explorer/tester/reviewer), governed by a tracked documentation
authority, with environment-scoped MCP/Playwright tooling ready. History and remote are in sync
(`main` = `5176431`). The only broken link is the **committed** explorer model, already fixed
locally.

## KEEP — proven patterns

1. Role separation (explorer/tester/reviewer) with least-privilege permissions.
2. Single pinned builder entry point (`scripts/builder-run.ps1` + `kimi-k2.7-code`).
3. Evidence tags and audit trail in execution logs.
4. Index-anchored checkpoints (`V1-PHASE-INDEX.md`, `00-README.md`).
5. Sequential verifier discipline (typecheck + sequential vitest) on this machine.
6. Phase-scoped single commits with post-commit log/index update.
7. Historical evidence preserved (never rewritten); corrections live in the index.
8. Documentation governance structure from the reorg pass.
9. Versioning agent+script workflow files in the repository.

## IMPROVE — justified changes

- **I1 — Sync committed agent models to the proven local set** (explorer + tester →
  `opencode-go/glm-5.3-flash`). Fixes the defunct committed model so a fresh clone routes
  correctly. Already present in the working tree; needs review + commit.
- **I2 — Resume/checkpoint rules for builder and tester** (see Controlled Execution).
- **I3 — `.gitignore`: ignore `.playwright-mcp/`** (status hygiene; no file changes).

## REMOVE

- Committed explorer model reference `opencode/mimo-v2.5-free` (defunct) — replaced by I1.
- `.playwright-mcp/` page-snapshot noise from `git status` — covered by I3.

## EXPERIMENTS (deferred, NOT this pass)

- E1: commit-or-archive decision for `p5–p8` + `ui-finalization` logs (inherited gate).
- E2: parallel test execution once a ≥16 GB machine or CI runner exists; keep sequential default.
- E3: machine-readable resume checkpoint (auto-appended to the active log) to make interrupts
  self-healing rather than coordinator-mediated.
- E4: add an actual opencode plugin (then version `.opencode/package.json`) or drop the unused
  dependency.
- E5: GitHub Actions gate (typecheck + sequential test) on `main` push; PR-based review cadence.

## Final change set (approved, closed)

Exactly the approved changes — no other workflow, agent, model, MCP, CI, parallel-test, or
checkpoint-system change was introduced:

1. **NEW** `Docs/execution/governance/work-engine-self-improvement.md` — this report.
2. **EDIT** `.gitignore` — add `.playwright-mcp` (hygiene only; files untouched).
3. **EDIT** `.opencode/agent/orkestrix-builder.md` — resume/checkpoint rules (+4 lines); model,
   permissions, and routing unchanged (`opencode-go/kimi-k2.7-code` pinned via
   `scripts/builder-run.ps1`).
4. **EDIT** `.opencode/agent/orkestrix-explorer.md` — model sync to proven active
   `opencode-go/glm-5.3-flash`; read-only permissions unchanged.
5. **EDIT** `.opencode/agent/orkestrix-tester.md` — model sync to proven active
   `opencode-go/glm-5.3-flash`; sequential-run + resume rules; permissions unchanged.
6. Reviewer **not modified** (`opencode-go/gpt-5.6-luna`, read-only).

## Controlled execution (what was changed)

- `orkestrix-builder.md`: appended (goal/boundary style, no scripting) —
  "On resume after an interruption: first inspect `git status`, `git diff --stat`, and the active
  execution log's last checkpoint before continuing." and
  "If a session must end before completion, record a resume checkpoint in the active execution log:
  what was done, what remains, exact next step."
- `orkestrix-tester.md`: appended —
  "Prefer sequential runs (`pnpm vitest run --no-file-parallelism`) on this machine; treat a
  parallel-run failure as suspect until rerun sequentially." and
  "On resume, rerun the previously failing check before touching code."
- `.gitignore`: added `.playwright-mcp`.
- Agents keep autonomy: additions are boundary/evidence rules, not scripts.

## Verify / Review (final)

- This-pass diff is exactly 4 tracked files: `.gitignore` (+1 line), `orkestrix-builder.md`
  (+4 lines), `orkestrix-explorer.md` (model line), `orkestrix-tester.md` (model line + 4 rules),
  plus this new report. **No application source, test, migration, or runtime file modified by
  this pass.** [VERIFIED — `git diff --stat`]
- Agent model routing (all registry-active): builder `opencode-go/kimi-k2.7-code` (pinned by the
  untouched `scripts/builder-run.ps1`), explorer `opencode-go/glm-5.3-flash`, tester
  `opencode-go/glm-5.3-flash`, reviewer `opencode-go/gpt-5.6-luna`. Committed defunct
  `opencode/mimo-v2.5-free` reference removed by the explorer sync. [VERIFIED — model registry]
- Least-privilege permissions intact: explorer/reviewer `edit`+`bash` deny; tester narrow
  bash/edit; builder unchanged. [VERIFIED — agent frontmatter]
- Agent autonomy intact: only boundary/evidence rules added; no scripts, no new systems.
  [VERIFIED — diff content]
- No MCP, CI, parallel-test, or checkpoint-system configuration changes. [VERIFIED — diff scope]
- Inherited exceptions preserved exactly (see **Inherited exceptions**). [VERIFIED — git status]

## Final closure

- Committed as **exactly one** governance commit with message
  `docs: audit and refine work-engine agent workflow`. No prior commit amended; no additional
  commit created. The commit hash is recorded post-commit by the coordinator (self-reference
  not possible; precedent: post-P12 governance report).
- **Final model routing** (all registry-active): builder `opencode-go/kimi-k2.7-code` (pinned via
  `scripts/builder-run.ps1`), explorer `opencode-go/glm-5.3-flash`, tester
  `opencode-go/glm-5.3-flash`, reviewer `opencode-go/gpt-5.6-luna`.
- Post-commit HEAD/status and remote baseline consistency are recorded by the coordinator in the
  final gate output.

## Inherited exceptions (preserved — never staged in this pass)

- Uncommitted Phase A UI-Finalization implementation: `src/client/**`, `index.html`,
  `tests/audit.test.ts`, `src/client/components/empty-state.tsx`.
- `.playwright-mcp/` (now gitignored; contents untouched).
- `tc*.txt`, `vt*.txt` scratch.
- Untracked docs: `Docs/execution/P5…P8/` logs, `Docs/execution/ui-finalization/` log.
- `Docs.zip`, `Docs/Docs.zip` (never stage/modify).
- (The explorer/tester model-sync drift is an *approved part* of this commit's change set, not an
  exception.)

## Hygiene

- `.playwright-mcp/` no longer pollutes `git status`. Scratch `tc/vt` files remain untracked and
  visible (evidence references). Global MCP tokens remain environment-only.

## Next Baseline

Post-commit state (HEAD on top of `5176431`); re-audit after the next UI (Phase A) or Phase B
workstream to measure resume reliability, time-to-green, and closure completeness against this
baseline.

— GATE CLOSED. Next workstream not started.