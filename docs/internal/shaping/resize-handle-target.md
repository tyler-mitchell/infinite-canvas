---
shaping: true
---

# Window resize handle target — Shaping

## Source

> I can barely hover over them to drag to resize.

A user report about window resize handles, carried in the backlog with a diagnosis and no fix.

## Problem

The backlog's diagnosis says the handle is too small, and that its target "extends 8px outside the
window and 8px inside it".

**Measured on 2026-09-08, that is wrong.** The handle is not too small. It is 16px wide drawn and
16px wide hittable, but the two bands are **offset from each other by 8px**, and the outer half of
what is drawn resolves to empty canvas.

Probing `resolveInfiniteCanvasSpatialTarget` against a 360×240 window at zoom 1, along the west
edge, with the framework's default chrome:

| World x relative to the edge | Drawn                    | Resolves to          |
| ---------------------------- | ------------------------ | -------------------- |
| −8                           | inside the handle        | `empty-world`        |
| −4                           | inside the handle        | `empty-world`        |
| −1                           | inside the handle        | `empty-world`        |
| +0.5                         | inside the handle        | `resize-handle:west` |
| +8                           | edge of the drawn handle | `resize-handle:west` |
| +16                          | outside the drawn handle | `resize-handle:west` |
| +20                          |                          | `body`               |

The mechanism, from reading:

- `RESIZE_HANDLE_OVERHANG` is `calc(extent / -2)`, so the drawn handle **straddles** the frame edge:
  8px out, 8px in at the default extent of 16.
- `getTopmostWindowAtWorldPoint` gates on `rectContainsPoint(window.rect, worldPoint)` — strict
  containment. A point outside the rect is never attributed to the window.
- So the outer half never reaches `getWindowAreaAtPoint` at all. It is drawn, and it is not a target.
- `getResizeHandleAxis` itself would accept a negative coordinate (`-4 <= 0 + 16`). The classifier is
  not the problem; the containment gate upstream is.

A pointer approaches an edge from outside. The user aims at the visible handle, lands in its outer
half, and hits nothing.

Two further measured facts:

- Corners claim `hitSize` on **both** axes: at (4, 4) the result is `north-west`, at (4, 20) it is
  `west`. The first 16px of every edge is corner.
- `getWindowAreaAtPoint` tests resize before header, and the header is 32–40px tall, so widening the
  band symmetrically takes area directly from the header drag region.

## Outcome

Pressing where a resize handle appears starts a resize.

---

## Requirements (R)

| ID     | Requirement                                                                        | Status    |
| ------ | ---------------------------------------------------------------------------------- | --------- |
| **R0** | **Pressing anywhere inside the drawn handle starts a resize**                      | Core goal |
| **R1** | **Drawn and hittable are the same region**                                         | Must-have |
| R1.1   | Every point inside the drawn handle resolves to that handle                        | Must-have |
| R1.2   | No point outside the drawn handle resolves to it — no invisible target             | Must-have |
| **R2** | **A pointer arriving from outside the window can grab the edge**                   | Must-have |
| **R3** | **No other area loses ground**                                                     | Must-have |
| R3.1   | The header drag region keeps its area                                              | Must-have |
| R3.2   | The body keeps its area                                                            | Must-have |
| R3.3   | `before-windows` resolvers still win — a connector over a window stays reachable   | Must-have |
| R3.4   | An expanded target does not steal from an adjacent or overlapping window           | Must-have |
| **R4** | **Corners are reachable without consuming the edge**                               | Must-have |
| **R5** | **One definition owns both the rendered geometry and the hit geometry**            | Must-have |
| **R6** | **The target holds a constant screen size at every zoom**                          | Must-have |
| **R7** | **The fix is generic — groups carry the same pair and presumably the same defect** | Must-have |
| **R8** | **No framework capability is added that a second consumer would not want**         | Must-have |

Note on R6: drawn size is `resizeHandleSize / screenTransform.scale` and hit size is
`resizeHandleSize / zoom`. These already agree. Scale is not the defect; offset is.

---

## Shapes

### A: Increase `resizeHandleSize`

| Part | Mechanism                       | Flag |
| ---- | ------------------------------- | ---- |
| A1   | Raise the chrome metric from 16 |      |

### B: Expand the containment gate by the handle overhang

| Part | Mechanism                                                              | Flag             |
| ---- | ---------------------------------------------------------------------- | ---------------- |
| B1   | `getTopmostWindowAtWorldPoint` tests an outset rect, not `window.rect` |                  |
| B2   | Outset equals the drawn overhang, so the gate matches what is drawn    |                  |
| B3   | Ordering against `before-windows` resolvers and overlapping windows    | ⚠️ unestablished |

### C: Draw the handle inside-only

| Part | Mechanism                                                              | Flag |
| ---- | ---------------------------------------------------------------------- | ---- |
| C1   | Drop `RESIZE_HANDLE_OVERHANG`; the handle sits fully inside the frame  |      |
| C2   | Drawn region then equals the existing hit band with no hit-test change |      |

### D: One geometry owner, gate derived from it

| Part | Mechanism                                                            | Flag                             |
| ---- | -------------------------------------------------------------------- | -------------------------------- |
| D1   | One function returns the handle bands for a rect and chrome          |                                  |
| D2   | The CSS descriptors and the hit classifier both read it              |                                  |
| D3   | The containment gate outsets by the same function's overhang         |                                  |
| D4   | Corner band narrower than edge band, so corners stop eating the edge | ⚠️ needs a chosen ratio          |
| D5   | Same treatment for the group shell pair                              | ⚠️ group defect not yet measured |

---

## Fit Check

| Req | Requirement                                                            | Status    | A   | B   | C   | D   |
| --- | ---------------------------------------------------------------------- | --------- | --- | --- | --- | --- |
| R0  | Pressing anywhere inside the drawn handle starts a resize              | Core goal | ❌  | ✅  | ✅  | ✅  |
| R1  | Drawn and hittable are the same region                                 | Must-have | ❌  | ❌  | ✅  | ✅  |
| R2  | A pointer arriving from outside the window can grab the edge           | Must-have | ❌  | ✅  | ❌  | ✅  |
| R3  | No other area loses ground                                             | Must-have | ❌  | ❌  | ✅  | ❌  |
| R4  | Corners are reachable without consuming the edge                       | Must-have | ❌  | ❌  | ❌  | ❌  |
| R5  | One definition owns both the rendered geometry and the hit geometry    | Must-have | ❌  | ❌  | ❌  | ✅  |
| R6  | The target holds a constant screen size at every zoom                  | Must-have | ✅  | ✅  | ✅  | ✅  |
| R7  | The fix is generic — groups carry the same pair                        | Must-have | ❌  | ❌  | ❌  | ❌  |
| R8  | No framework capability is added that a second consumer would not want | Must-have | ✅  | ✅  | ✅  | ✅  |

**Notes**

- **A fails the core goal.** Widening a misaligned band moves both of its edges outward; the outer
  drawn half is still outside the containment gate and still dead. It also takes from the header
  (R3.1), because resize is tested before header. This is the fix the backlog's diagnosis implies,
  and the measurement says it does not work.
- **B fails R1.2**: outsetting the gate makes points _outside_ the drawn handle resolve to the
  window too, which is an invisible target in the other direction. B3 is flagged — whether an
  outset gate steals from `before-windows` resolvers or an adjacent window is not established.
- **C is the smallest change and the only one that passes R3 cleanly**, because it moves drawing
  rather than hit-testing and touches no other area. It fails R2: you can no longer catch the edge
  from outside, which is where a pointer comes from. It makes the handle honest but not easier.
- **D fails R3 and R7 on flags, not on merit** — D3 inherits B's unestablished ordering, and D5
  names the group shell without having measured it.
- **Every shape fails R4.** None proposes a corner-versus-edge ratio, so all four leave the first
  16px of each edge claimed by the corner. R4 needs a decision nobody has made.
- **Every shape fails R7.** `SHELL_RESIZE_HANDLE_DESCRIPTORS` and `SHELL_RESIZE_HANDLE_OUTSET` are
  the group equivalents and the group hit path has not been probed. Claiming a generic fix without
  that measurement would be the same error as the backlog's diagnosis.

---

## What is needed before selecting

1. **Probe the group shell path** the way the window path was probed. R7 cannot be answered by
   reading alone, and asserting it would repeat the mistake this document corrects.
2. **Establish the ordering effect of an outset gate** — against `before-windows` resolvers, and
   against a second window whose rect is within the outset. This decides B3 and D3.
3. **Decide the corner ratio.** How much of a short edge may the corner claim? On a 240px edge, 16px
   at each end is reasonable; on a 60px edge it is more than half. A ratio, a cap, or both.

Item 3 is a product call about pointer ergonomics. Items 1 and 2 are measurements.

## Correction to the backlog

`BACKLOG.md`, `bug: resize handle hit area is too small`, states: "The target extends 8px outside
the window and 8px inside it. This size is at the lower limit for reliable pointer input."

The first sentence is false — the outer 8px is drawn, not targetable. The second follows from it
and is therefore unsupported: the usable band is 16px, not 8px, and it is misplaced rather than
undersized. The title's "too small" is also wrong; "offset from what is drawn" is the defect.
