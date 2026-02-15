#!/bin/bash
# stop-guard.sh — Prevents Claude Code from stopping mid-game-build
#
# This hook fires on the "Stop" event. If a game build is in progress
# (indicated by .claude/.build_in_progress), it blocks Claude from
# finishing until the build is complete or the user explicitly cancels.
#
# The godot-director skill creates .build_in_progress at Phase 0
# and removes it at Phase 6 (or on explicit cancel).

set -euo pipefail

INPUT=$(cat)

# Extract fields from hook input
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
CWD=$(echo "$INPUT" | jq -r '.cwd // "."')

# If we're already in a stop-hook retry, allow exit to prevent infinite loop
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
    exit 0
fi

# Check if a build is in progress
BUILD_FLAG="$CWD/.claude/.build_in_progress"

if [ ! -f "$BUILD_FLAG" ]; then
    # No build in progress — allow Claude to stop normally
    exit 0
fi

# Build is in progress — read the phase info
PHASE=$(cat "$BUILD_FLAG" 2>/dev/null || echo "unknown")

# Block the stop and tell Claude to keep going
cat <<EOF
{
    "decision": "block",
    "reason": "Game build in progress (${PHASE}). Complete all Director phases before stopping. If the user wants to cancel, remove .claude/.build_in_progress first."
}
EOF
exit 0
