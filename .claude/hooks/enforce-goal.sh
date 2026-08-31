#!/usr/bin/env bash
# This hook blocks a stop until .claude/.goal-complete exists.
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

There is no state in which you disarm this hook. `.claude/.goal-complete` is Tyler's switch and only Tyler's: never create it, never restore it, never work around it. If you believe the work is genuinely complete — every track done rather than described, everything remaining owner-gated or out of scope — say so plainly in your reply and keep going. Saying it costs a sentence; silencing the hook costs every turn after it, and it will be days before anyone notices the agent stopped being pushed.

The mission is apps/polkadot: a production-grade, exceptionally polished open-source spatial
workbench that is simultaneously the framework's incubator. Design is a first-class axis, not a
finishing pass — the bar is software people open because it feels good to look at.

A gap Polkadot finds is fixed in the framework GENERICALLY or not in the framework at all. If the
design needs the word "Polkadot" to justify itself, it is the wrong design.

Where to look for the next seam, in priority order:
  1. apps/polkadot/ROADMAP.md — the bar, the order, and the framework gaps found so far.
  2. apps/polkadot/AGENTS.md  — the rules that are not negotiable (tv slots, library-first,
     framework-first). Violations of these are defects even when nothing is broken.
  3. The running app itself — open the preview and look at it. This is a design-led product and
     a passing typecheck says nothing about whether the thing is good.
  4. packages/infinite-canvas — affordances Polkadot needs and the framework lacks.
  5. The code itself — the seams you find by reading are usually the real ones.
Pick one. Start it. Do not ask which.
EOF

python3 - "$REASON" <<'PY'
import json, sys
print(json.dumps({"decision": "block", "reason": sys.argv[1]}))
PY
