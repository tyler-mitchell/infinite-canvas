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

**The number is right and the reason is wrong.** The target is 8px. There is no 8px outside — the
CSS asks for it, and it is clipped away before it can be drawn or pressed.

Measured on a live 360×240 window at zoom 1, with `document.elementFromPoint` along the west edge:

| Screen x relative to the edge | CSS asks for | Actually resolves to |
| ----------------------------- | ------------ | -------------------- |
| −6                            | handle       | `viewport`           |
| −4                            | handle       | `viewport`           |
| −1                            | handle       | `viewport`           |
| +1                            | handle       | `resize-handle:west` |
| +4                            | handle       | `resize-handle:west` |
| +7                            | handle       | `resize-handle:west` |
| +8                            | —            | `window-body`        |

**The mechanism.** `[data-slot="window"]` sets `contain: content`, which includes paint
containment, and paint containment clips descendants to the element's box. The handle is positioned
at `RESIZE_HANDLE_OVERHANG` = `calc(extent / -2)`, so its own bounding rect really is 1272–1288
against a window starting at 1280 — but the outer half is clipped and never painted or hit.

Proven by lifting the containment and re-probing the identical points: with `contain: content` the
outer band returns `viewport`; with `contain: none` those same points return `resize-handle:west`.

So there are **three different geometries for one handle**:

| Geometry   | Band                            | Where it comes from                                    |
| ---------- | ------------------------------- | ------------------------------------------------------ |
| Intended   | 16px straddling the edge, −8…+8 | `RESIZE_HANDLE_DESCRIPTORS` + `RESIZE_HANDLE_OVERHANG` |
| Real       | **8px, inside only, 0…+8**      | the above, clipped by `contain: content`               |
| Classifier | 16px inside, 0…+16              | `getWindowResizeHandleAtPoint`                         |

The user's report follows from the Real row: 8px is a small target, and a pointer approaching from
outside the window crosses nothing until it is already 1px inside the frame.

**Two hit paths exist and they disagree.** Starting a resize goes through the handle element's own
`onPointerDown` → `actions.startResize`, so the Real row governs it.
`resolveInfiniteCanvasSpatialTarget` is a separate consumer with the Classifier row, and it is
gated by `getTopmostWindowAtWorldPoint`'s strict `rectContainsPoint`, so it also refuses everything
outside the window rect. Both paths therefore fail outside the frame, for two unrelated reasons.

Two further measured facts:

- Corners claim `hitSize` on **both** axes in the classifier: at (4, 4) the result is `north-west`,
  at (4, 20) it is `west`. The first 16px of every edge is corner.
- `getWindowAreaAtPoint` tests resize before header, and the header is 32–40px tall, so widening the
  band symmetrically takes area directly from the header drag region.

### Correction to an earlier draft of this document

An earlier version of this section claimed the handle was "16px drawn and 16px hittable, offset by
8px", and blamed `getTopmostWindowAtWorldPoint`. That was measured against the classifier only, and
the classifier is not the path a resize actually takes. The DOM measurement above supersedes it.
The real target is 8px, and the cause is paint containment.

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

### B: Lift paint containment from the window

| Part | Mechanism                                                                     | Flag             |
| ---- | ----------------------------------------------------------------------------- | ---------------- |
| B1   | `[data-slot="window"]` drops `contain: content` for something without `paint` |                  |
| B2   | The overhang then paints and hits as the CSS already intends, restoring 16px  |                  |
| B3   | Effect on culling and render cost, which is why containment is there          | ⚠️ unestablished |

### C: Draw the handle inside-only

| Part | Mechanism                                                             | Flag |
| ---- | --------------------------------------------------------------------- | ---- |
| C1   | Drop `RESIZE_HANDLE_OVERHANG`; the handle sits fully inside the frame |      |
| C2   | Extent raised so the inside-only band is a usable size                |      |
| C3   | CSS then states what containment was going to enforce anyway          |      |

### D: Move the handles outside the contained element

| Part | Mechanism                                                             | Flag                                      |
| ---- | --------------------------------------------------------------------- | ----------------------------------------- |
| D1   | Handles render as a sibling layer of the window, not a child          |                                           |
| D2   | Containment stays on the window; the handles are simply not inside it |                                           |
| D3   | The layer follows the window rect and z-order                         | ⚠️ interaction with stacking and grouping |

### E: One geometry owner across both hit paths

| Part | Mechanism                                                            | Flag                             |
| ---- | -------------------------------------------------------------------- | -------------------------------- |
| E1   | One function returns the handle bands for a rect and chrome          |                                  |
| E2   | The CSS descriptors and `getWindowResizeHandleAtPoint` both read it  |                                  |
| E3   | Combined with B or D so the drawn band is not clipped away           |                                  |
| E4   | Corner band narrower than edge band, so corners stop eating the edge | ⚠️ needs a chosen ratio          |
| E5   | Same treatment for the group shell pair                              | ⚠️ group defect not yet measured |

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
