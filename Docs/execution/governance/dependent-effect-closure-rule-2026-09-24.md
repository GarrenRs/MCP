# Execution Report — Governance: Dependent-Effect Closure Rule (2026-09-24)

Purpose: make explicit and versioned the permanent project execution rule that a workstream is
**CLOSED only when its structural change and every directly dependent effect in another layer**
are implemented, verified, reviewed, and closed **within the same layer workstream**.

This pass changes **governance only**: one agent rule + this report. No product source, test,
migration, deployment artifact, UI, or `Docs.zip` / `Docs/Docs.zip` was touched.

## The permanent rule (added verbatim)

Added to the **Builder rules** in `.opencode/agent/orkestrix-builder.md` (the versioned home of
work-engine agent rules; same location where the resume/checkpoint rules were established):

> A structural change in this layer, and every directly dependent effect it requires in another
> layer, must be implemented, verified, reviewed, and closed within this same layer workstream
> before that workstream is declared CLOSED. Verification covers tests, plus browser/runtime
> verification when the dependent effect is user-visible or runtime-visible. Never defer a
> directly dependent effect to a later phase; unrelated improvements stay out of scope; a
> verification limitation stays recorded as a limitation and is never converted into PASS by
> inference.

Operational sequence this rule enforces:
**Structural change → dependent effects → tests → runtime/browser verification where applicable →
reviewer → layer closure → next layer.**

## Rationale

- **Why Builder, not a new document**: the Work Engine governance audit
  (`work-engine-self-improvement.md`) established that the permanent, enforceable rules live in
  the agent files (versioned, loaded on every session); execution reports are the records, not
  the rules. This keeps the change to the **smallest** permanent mechanism that every future
  workstream actually loads.
- **Why one rule**: the closure requirement already exists implicitly ("run relevant tests and
  typecheck before declaring completion") but does not cover **cross-layer dependent effects**.
  The 2026-09-24 layers (Core / Profile / Jurisdiction / Deployment) make cross-layer effects the
  normal case, so the rule must be explicit and tied to the act of declaring a workstream CLOSED.
- **Scope guard**: the rule explicitly forbids deferring dependent effects and forbids scope
  expansion or unrelated cleanup, so it tightens closure semantics without creating new scope.

## What was NOT changed (unchanged by design)

- Role separation (explorer read-only / tester narrow / reviewer read-only) — untouched.
- Pinned Builder routing (`scripts/builder-run.ps1` + `opencode-go/kimi-k2.7-code`) — untouched.
- Resume/checkpoint behavior, sequential test discipline, evidence tags — untouched.
- Existing governance documents, `Docs/00-README.md`, `V1-PHASE-INDEX.md` — untouched.
- Product source, tests, migrations, deployment, UI — untouched.
- `Docs.zip` / `Docs/Docs.zip` — untouched.

## Files changed (this pass — governance only)

1. **EDIT** `.opencode/agent/orkestrix-builder.md` — one new rule (7 rule lines); frontmatter,
   model, permissions, and routing unchanged.
2. **NEW** `Docs/execution/governance/dependent-effect-closure-rule-2026-09-24.md` — this report.

No other file was modified or staged. Pre-existing working-tree state (Phase A UI log edits,
`tests/audit.test.ts`, P5–P8 logs, core-profile-separation gate doc, `tc*/vt*` scratch,
`Docs.zip` / `Docs/Docs.zip`) remains exactly as found, unstaged and untouched.

[VERIFIED — `git status --short` before and after; staged diff contains only the two files above]

## Verification / Review

- Diff scope verified: exactly the two files listed above; no product/UI/test/migration change.
  [VERIFIED — `git diff --cached --stat`]
- This pass has **no user-visible or runtime-visible dependent effect** (governance text only), so
  no browser/runtime verification applies; this is recorded as a **limitation**, not converted
  into a runtime PASS by inference.
- Reviewer (`orkestrix-reviewer`, read-only) reviewed the change set and returned **PASS**
  (findings: no CRITICAL/HIGH; the two findings it raised — premature commit/PASS wording and a
  rule-line count — are corrected above in this revision). [VERIFIED — reviewer gate output]

## Final closure

- This pass is to be committed as **exactly one** governance commit (message
  `docs: establish dependent-effect closure rule`). No prior commit amended; no additional
  commit created. The commit hash is recorded post-commit by the coordinator (a document cannot
  contain its own hash; precedent: post-P12 and work-engine governance reports).
- **Not pushed**; remote baseline (`origin/main`) remains unchanged by this pass.

## Limitation

- No runtime/browser verification was performed: the change is governance documentation only and
  has no runtime surface. This limitation is recorded explicitly and is **not** claimed as a
  runtime PASS.

— GATE CLOSED. Next workstream proceeds under the newly explicit closure rule.