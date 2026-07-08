# Zoom Policy

> Provenance: adapted 2026-06-10 from kek-monorepo's `zoom-behavior.md`
> (authored 2026-04-23, updated 2026-05-05). Most of this policy is
> implemented; statuses below mark what remains.

## Core Model — implemented

Zoom is camera state, not DOM scale. One authoritative orthographic camera
(`camera.center`, `camera.zoom`); the DOM window layer derives screen rects
from it and never implements zoom by scaling a DOM container. Viewport size
sets the ortho frustum; zoom is expressed through `camera.zoom`; projection
matrix updates follow every camera change.

## Zoom Semantics — implemented

1. pointer-anchored zoom on the desktop surface (the world point under the
   pointer stays fixed; camera center recomputed from old zoom, new zoom, and
   the anchor)
2. keyboard zoom around the viewport center (`Shift+0` reset — **not** `Mod+0`,
   whose browser accelerator the page cannot cancel; fit commands share the
   camera reducer)
3. trackpad pinch reuses the pointer-anchored path (continuous pinch zoom is
   implemented)
4. future touch pinch reuses the same path

## Surface Ownership — implemented (wheel), policy open (pinch detail)

Default wheel policy, as built:

- wheel over empty desktop/backdrop: zoom/pan desktop (two-finger pan is
  default; zoom per `zoomPolicy`)
- wheel over window chrome: desktop-owned
- wheel over window body: desktop-owned by default; bodies opt back into
  native scrolling with `wheelBehavior: "native-scroll"`
- keyboard zoom only when focus is at the desktop layer and not editable

Pinch policy (intended, partially verified): pinch should zoom the desktop
even over window bodies — unlike wheel — but not over editable/control
surfaces, and browser page zoom must stay suppressed inside the desktop root
(non-passive listeners at the root). Verify the over-body and macOS
Safari/Chromium pinch representation cases explicitly.

## Decided (2026-07-08)

1. ✅ **Wheel normalization.** `getWheelScreenDelta` reads `event.deltaMode` and
   converts to screen pixels: line mode by `WHEEL_LINE_HEIGHT_PX`, page mode by
   the viewport. Magnitude is clamped downstream by
   `zoomPolicy.wheelMaxExponent`, so a page-mode notch saturates to one maximum
   zoom step rather than teleporting; there is no second clamp.

   `WHEEL_LINE_HEIGHT_PX` is **40**, not the 16 it was. It is not a text line
   height — it is a calibration between browsers that disagree about what a notch
   is. Firefox reports `deltaMode = 1, deltaY ≈ 3` per notch; Chrome reports
   pixels at roughly 100. At 16, one notch moved the canvas 48px in Firefox and
   ~100px in Chrome: the same physical gesture, half the travel. 40 is the value
   `normalize-wheel` settled on for this exact problem (3 × 40 = 120). If the feel
   is wrong, change this number — not the arithmetic around it.

2. ✅ **Modifier zoom outranks a scrollable body.** An unmodified wheel over a
   `native-scroll` body scrolls the body; a zoom gesture over that same body zooms
   the desktop. Anything else strands the user — pinch inside a long list, nothing
   zooms, and no affordance says why. The body still owns the plain wheel, which is
   the gesture it is actually for. Editable controls are unaffected: the guard runs
   on the wheel target, and zoom gestures are captured at the viewport root.

   This was already the behaviour. It was a side effect; it is now a decision, and
   the code says so where it happens.

3. ✅ **Pinch is Ctrl+wheel.** A macOS trackpad pinch arrives as a wheel event with
   `ctrlKey` synthesized, so pinch and `Ctrl+wheel` are one code path and always
   were. `metaKey` is folded in to catch `Cmd+wheel` on macOS, where the browser
   would otherwise page-zoom the whole document out from under the canvas. Both
   paths `preventDefault` on a non-passive root listener, which is what suppresses
   browser page zoom.

## Open Work

- **Per-engine verification of pinch representation.** The rules above are
  reasoned from the specification and from how Chromium and Gecko are documented to
  synthesise pinch; they have not been measured in Safari. That is a browser task,
  not a code one.

Keep `zoomAtScreenPoint`-style single entry for pointer-driven zoom and the
viewport-center path for keyboard zoom; route any new gesture into one of
those two, never a third path.
