#!/usr/bin/env bash
# PreToolUse hook, gated to `git commit *` via settings.json's "if" filter.
# Runs the workspace lint task and blocks the commit if it fails.
#
# Right now no package defines a `lint` script, so `pnpm lint` (turbo run
# lint) exits 0 with "no tasks executed" and this always passes. Once
# per-package lint scripts + packages/config are filled in, a real failure
# here will start blocking commits automatically — no change needed then.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Captured (not streamed) so a failure's stdout is a single clean JSON blob —
# mixing pnpm's own output in with our JSON would make the hook response
# unparseable and silently no-op the block.
lint_output="$(pnpm lint 2>&1)"
lint_status=$?

if [ "$lint_status" -eq 0 ]; then
  exit 0
fi

# Truncate so one bad lint run doesn't dump thousands of lines into context;
# `pnpm lint` can always be rerun directly for the full list.
truncated="${lint_output:0:4000}"

node -e '
const reason = "pnpm lint failed — fix the errors below, then retry the commit (output truncated to 4000 chars; rerun `pnpm lint` for the full list):\n\n" + process.argv[1];
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason
  }
}));
' "$truncated"
exit 0
