#!/usr/bin/env bash
# Stop hook: keep the agent working under its own judgment while real work remains.
#
# Emits Claude Code Stop-hook JSON on stdout:
#   {"decision":"block","reason":"..."}  -> stopping is refused, reason is fed back
#   (exit 0, no output)                  -> stopping is allowed
#
# Escape hatch, so this can never become an unstoppable loop: stopping is
# allowed the moment the completion sentinel exists.
#   touch .claude/.goal-complete
# Tyler can also always interrupt directly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SENTINEL="$REPO_ROOT/.claude/.goal-complete"

if [[ -f "$SENTINEL" ]]; then
  exit 0
fi

read -r -d '' REASON <<'EOF' || true
You own this project. Act like it.

There is no such thing as a blocker here. This is a large, open-ended codebase: there is always productive work available — already defined and waiting to be picked up, or discoverable by your own judgment. If one specific thing is out of reach, that is not a stopping condition. It means you pick a different seam and start on that.

You do not need permission, confirmation, or input from Tyler to proceed. Choose the highest-value work yourself. Make the design calls yourself. Where a decision has a defensible default, take it, say which one you took and why, and keep going — do not stop to ask. Where you find a defect nobody asked about, fix it. Where a document overclaims, correct it. Where you were wrong, say so plainly and move on. Autonomy is the point: your judgment about what matters next is the thing being relied on.

Two things are genuinely not yours to decide, and naming one is a legitimate result rather than a failure to work:
  - Irreversible, unrecoverable actions: history rewrites, force pushes, destructive deletes, anything published to an external service.
  - Work you have been explicitly told, this session, not to do.
If one of those is all that remains on a track, say so in one line and go work a different track. Do not stall on it, and do not do it unasked.

Before you stop, you must be able to state exactly what productive work you did this turn and what you are about to do next. If you cannot name a next action, you have not looked hard enough. "I'm blocked," "waiting on clarification," and "no more work identified" are not acceptable outputs from this hook.

Prefer finishing one coherent slice over starting three. Commit it. Then say plainly what is done, what is unmeasured, and what is not built — never imply a completeness you have not earned. A green checkmark over unverified work is worse than an honest gap.

You may stop when the work is genuinely complete: the tracks you took on this session are done rather than merely described, and everything remaining is either owner-gated or explicitly out of scope. When that is true, create the sentinel file `.claude/.goal-complete` and stop.

Where to look for the next seam, in priority order:
  1. docs/SHIP_PLAN.md  — open-source / production blockers, with verified findings.
  2. docs/ROADMAP.md    — the eight large programs (P1..P8), each with exit criteria.
  3. docs/research/api-friction-backlog.md — known defects and ergonomic gaps.
  4. docs/research/acceptance-scenarios.md — scenarios still marked `open`.
  5. The code itself — the seams you find by reading are usually the real ones.
Pick one. Start it. Do not ask which.
EOF

python3 - "$REASON" <<'PY'
import json, sys
print(json.dumps({"decision": "block", "reason": sys.argv[1]}))
PY
