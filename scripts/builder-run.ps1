<#
.SYNOPSIS
  Invoke the primary orkestrix-builder agent with its intended model pinned.

.DESCRIPTION
  In OpenCode V2, `opencode run --agent <id>` selects a primary agent by ID but does
  NOT set the session model (frontmatter `model:` on a Markdown agent only governs
  subagent sessions). Without an explicit model the session falls back to the
  environment default (e.g. opencode/mimo-v2.6-flash-free).

  This wrapper pins `--model opencode-go/kimi-k2.7-code` on every Builder
  invocation so sessions always run the configured model.

.PARAMETER Prompt
  The builder brief to submit. Required, positional.

.EXAMPLE
  .\scripts\builder-run.ps1 "Implement the current V1 phase per the docs."

.NOTES
  Read-only smoke test command used during the routing fix:
  .\scripts\builder-run.ps1 "Inspect the project root and report the names of the
  top-level files/directories. Do not edit, create, delete, or execute anything."
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Prompt
)

# Keep default ErrorActionPreference: opencode writes progress/status text to
# stderr, and under "Stop" the merged stream would abort this wrapper.
$output = & opencode run "--agent" "orkestrix-builder" "--auto" "--model" "opencode-go/kimi-k2.7-code" $Prompt 2>&1
$code = $LASTEXITCODE
foreach ($line in $output) { Write-Host $line }
exit $code