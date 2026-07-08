#!/usr/bin/env bash
# Stop hook: refuse to let the agent stop while productive work remains.
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
You are not permitted to stop because of a blocker. There is no such thing as a blocker on this project — it does not exist as a concept here. This is a sizeable, open-ended project: there is always productive work available, either already defined and waiting to be picked up, or discoverable by your own judgment. If you believe you cannot do a specific thing, that is not a stopping condition — it means you identify a different seam and start on that instead. You do not need permission, confirmation, or input from Tyler to proceed — his input is never required for you to keep working. Before you stop, you must be able to state exactly what productive work you did this turn and what you are about to do next. If you cannot state a next action, you have not looked hard enough — go find one. "I'm blocked," "waiting on clarification," "no more work identified," and similar phrasings are not acceptable outputs from this hook. Identify a seam and act.

Continuing is MANDATORY unless the task is fully, verifiably complete. "Verifiably complete" means: `vp run infinite-canvas-monorepo#ready` is green, the packaging gate (packages/infinite-canvas/scripts/verify-artifact.mjs) passes, and the work items in docs/SHIP_PLAN.md and docs/ROADMAP.md that you committed to this session are done — not merely described. When that is genuinely true, create the sentinel file `.claude/.goal-complete` and you may stop.

Where to find the next seam, in priority order:
  1. docs/SHIP_PLAN.md  — open-source / production blockers, with verified findings.
  2. docs/ROADMAP.md    — the eight large programs (P1..P8), each with exit criteria.
  3. docs/research/api-friction-backlog.md — known defects and ergonomic gaps.
  4. docs/research/acceptance-scenarios.md — scenarios still marked `open`.
  5. `pnpm exec vp run infinite-canvas-monorepo#ready` — fix whatever it surfaces.
Pick one. Start it. Do not ask which.
EOF

python3 - "$REASON" <<'PY'
import json, sys
print(json.dumps({"decision": "block", "reason": sys.argv[1]}))
PY
