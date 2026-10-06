# Snapping rules and extensions

> Provenance: This document adapts `04_snapping_and_guides.md` from the kek-monorepo windowing corpus.
> The adaptation occurred on 2026-06-10. A review examined the source on 2026-04-23.
> `snap-candidates.ts` and `snap-resolver.ts` implement the core design.
> FEATURE_TRACKER recorded hysteresis as a `risk`. It is done as of 2026-07-08.

Behavior references: tldraw, interact.js `snapEdges` and `snapSize`, and Moveable.

## Design rules

1. Express snap thresholds in screen pixels, then map them through the camera.
2. Use only nearby, visible geometry as snap input.
3. Keep docking previews separate from alignment guides.

## Snap types

| Type                                              | Status                                                  |
| ------------------------------------------------- | ------------------------------------------------------- |
| Bounds: left, center, right, top, middle, bottom  | Implemented                                             |
| Gap and equal spacing                             | Implemented                                             |
| Resize edge: only the changed edge                | Implemented                                             |
| Viewport and safe area through `snapPolicy`       | Implemented and optional                                |
| Docking region: side splits and center merge      | Open, requires groups                                   |
| Grid and user guides                              | Open and optional. Semantic types must retain priority. |
| Command and recipe placement through the resolver | Open                                                    |

## Hysteresis (done 2026-07-08)

One threshold causes a guide to engage and release at the same pointer distance.
Movement across this boundary can snap and release the window again and again.
The guide can also change state each frame while the pointer remains near the boundary.
Thus, a one-pixel movement can move the window onto the guide and then release it.

`policy.threshold` and `policy.gapThreshold` acquire a guide.
`policy.releaseThreshold` releases it.
All thresholds use screen pixels, so zoom does not change their screen distance.
The default acquisition threshold is 10 px. The default release threshold is 18 px.

`Math.max(acquire, release)` enforces the threshold order.
A `releaseThreshold` less than `threshold` inverts the hysteresis behavior.

The specification proposed state per axis.
The implementation stores state per guide.
It uses the existing `state.snapPreview` field and the candidate ID.
The resolver asks "was this candidate engaged last frame?" for each guide.
Thus, two guides on one axis can release independently.
This implementation does not require a new state field.

Move and resize operations both use hysteresis.
`releaseThreshold` existed in `InfiniteCanvasSnapPolicy` and in defaults before this change, but no code read it.

## Docking intent (open, requires groups)

Do not trigger docking from edge distance alone.
Use shell overlap, stable pointer dwell, the approached target region, the source type, and modifier keys.
Source types include tab drag, window drag, and group drag.
If docking becomes the active intent, hide alignment guides.
Then show region overlays and preview the layout after the drop.

Reference screen values:

- Alignment threshold: 8 px
- Gap threshold: 10 px
- Docking activation inset: 24 px from target edges
- Tab merge: Center strip
- Reorder dead zone: 4 px
- Hysteresis release: 14 px.

## Candidate generation at scale (open)

The current implementation gets candidates from all windows for each interaction.
This method is sufficient at the current scale.

For larger layouts, use a dynamic spatial index for nearby windows and groups.
RBush fits dynamic data. Flatbush fits read-mostly snapshots.
d3-quadtree is optional for corner and center points.

At the start of a drag, capture the source rectangle.
Query an expanded area and freeze those candidates for the drag.
After the pointer leaves that area, refresh the candidates.

The current score uses priority groups and then the smallest screen distance.
It resolves the X and Y axes independently.
Groups add this priority order: docking regions, contextual groups, nearby geometry, gaps, and grid or user guides.

## Organization commands (open)

Organization actions belong in the command layer.
Snap behavior remains unchanged.
Alignment covers left, right, top, bottom, and both centers.
Distribution covers horizontal and vertical placement.

Other commands pack or stack the selection.
They can also convert the selection to tabs or accordion layout, or create a group shell.
FEATURE_TRACKER already includes alignment and distribution on selection bounds.

## Resize rules (implemented)

- A resize operation changes one or two edges.
  The opposite edges remain anchored.
- Snapping applies only to changed edges.
- Min-max limits apply before commit.
- Future group resize operations update split weights.
  They leave DOM widths unchanged.
