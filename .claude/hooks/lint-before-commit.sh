#!/usr/bin/env bash
# PreToolUse hook, gated to `git commit *` via settings.json's "if" filter.
# Runs lint-staged against the staged diff and blocks the commit if it fails.
#
# This deliberately mirrors .husky/pre-commit (same `npx lint-staged` call) so
# there is one convention, enforced the same way whether a commit comes from
# Claude Code, another agent, or a teammate typing `git commit` directly —
# husky's git hook is the real enforcement for everyone, this hook just gives
# Claude Code a friendlier denial message before the commit is attempted.
#
# Scoped to staged files only (via lint-staged's own git-diff detection), not
# a full `pnpm lint`/`pnpm format:check` sweep across every package — that
# used to mean any pre-existing, unrelated lint debt elsewhere in the repo
# could block an unrelated commit and burn tokens fixing it. lint-staged also
# auto-fixes what it can and re-stages the result, so most formatting issues
# never even reach this as a failure.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

lint_output="$(npx lint-staged 2>&1)"
lint_status=$?

if [ "$lint_status" -eq 0 ]; then
  exit 0
fi

# Truncate so one bad run doesn't dump thousands of lines into context;
# `npx lint-staged` can always be rerun directly for the full list.
truncated="${lint_output:0:4000}"

node -e '
const reason = "lint-staged failed on the staged files — fix the errors below, then re-stage and retry the commit (output truncated to 4000 chars; rerun `npx lint-staged` for the full list):\n\n" + process.argv[1];
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: reason
  }
}));
' "$truncated"
exit 0
