# Snapping: Hardening and Extensions

> Provenance: adapted 2026-06-10 from the kek-monorepo windowing corpus
> (`04_snapping_and_guides.md`, verified 2026-04-23). The framework's snap
> subsystem (`snap-candidates.ts` / `snap-resolver.ts`) already implements the
> core of this design; this doc keeps the spec for what's missing —
> **hysteresis is flagged as a `risk` in FEATURE_TRACKER and its spec lives
> here.** Behavioral references: tldraw's snapping taxonomy, interact.js
> `snapEdges`/`snapSize`, Moveable's guidelines.

## Design principle

Snapping must feel predictable, screen-space stable, and locally relevant:

1. thresholds specified in **screen pixels**, mapped through the camera
2. only nearby visible geometry becomes snapping input
3. docking previews are a different interaction class than alignment guides

## Snap types

| Type                                                             | Status                                             |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| Bounds (left/center/right, top/middle/bottom)                    | implemented                                        |
| Gap / equal-spacing                                              | implemented                                        |
| Resize-edge (snap the manipulated edge only)                     | implemented                                        |
| Viewport / safe-area (opt-in via `snapPolicy`)                   | implemented                                        |
| Docking-region (drop-region previews: side splits, center merge) | open — needs groups                                |
| Grid / user guides                                               | open, optional; must never dominate semantic types |
| Command/recipe placement through the same resolver               | open                                               |

## Hysteresis — open (tracked risk)

Without hysteresis, guides flicker near dense geometry. Spec:

- once an axis is snapped, keep it snapped until the pointer exceeds a larger
  release threshold
- separate acquire/release thresholds — e.g. **acquire 8 px, release 14 px**
- hysteresis state is **per axis**, stored in the interaction snapshot
- invariant across zoom (screen-space, like all thresholds)

## Docking-intent detection — open (with groups)

Never trigger docking purely from edge proximity. Combine: overlap with the
target shell, pointer dwell/stable hover, which part of the target is being
approached, source kind (tab drag vs window drag vs group drag), and modifier
keys. When docking intent becomes dominant: suppress ordinary line guides,
show region overlays, preview the post-drop layout.

Reference screen-space constants: alignment 8 px, gap 10 px, docking
activation inset 24 px from target edges, tab-merge = center strip, reorder
deadzone 4 px, hysteresis release 14 px.

## Candidate generation at scale — open

Today candidates are extracted from all windows each interaction; fine at
current scale. When layouts grow:

- dynamic spatial index for nearby windows/groups (**RBush**; Flatbush for
  read-mostly snapshots; d3-quadtree optional for corner/center points)
- on drag start: capture source rect, query an expanded neighborhood, freeze
  the candidate snapshot for the drag, refresh only when leaving the
  neighborhood

The existing scoring model (priority buckets, then smallest screen distance,
X/Y resolved independently) matches the corpus recommendation; the priority
order extends when groups land: explicit docking regions → active contextual
group → nearby geometry → gaps → grid/user guides.

## Organization commands — open

Not every organization action should be solved by more aggressive snapping.
Keep explicit commands (same command layer as keyboard/contextual commands):
align left/right/top/bottom, align centers, distribute horizontally/
vertically, pack selection, stack selection, convert selection to tabs/
accordion, wrap selection in a group shell. FEATURE_TRACKER already
anticipates align/distribute on selection bounds.

## Resize rules (implemented; keep invariant)

- resize modifies one or two edges; opposing edges stay anchored
- snapping applies to manipulated edges only
- min/max clamps before commit
- future: group children resize by updating split weights, never DOM widths
