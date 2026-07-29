#!/usr/bin/env bash
# PreToolUse hook, gated to `npm *` / `yarn *` via settings.json's "if" filter.
# This repo pins pnpm (packageManager field in package.json) as the single
# package manager for the workspace; npm/yarn would write a competing
# lockfile and desync pnpm-workspace.yaml. Asks for confirmation rather than
# hard-denying, since some npm/yarn subcommands (e.g. read-only ones) are
# harmless.

printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"This repo pins pnpm via the packageManager field in package.json. Use the pnpm equivalent of this command to keep pnpm-lock.yaml and pnpm-workspace.yaml consistent."}}'
