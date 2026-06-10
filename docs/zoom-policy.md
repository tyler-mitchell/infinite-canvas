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
2. keyboard zoom around the viewport center (`Mod+0` reset; fit commands share
   the camera reducer)
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

## Open Work

1. **Wheel normalization utility** — read `event.deltaMode`, convert line/page
   units to pixel-like units, clamp per-event magnitude, then apply
   exponential scaling. The current exponential shape is directionally right
   but assumes pixel deltas; wheel delta units are not guaranteed to be
   pixels (`WheelEvent.deltaMode`).
2. **Modifier-based desktop zoom over bodies** — decide whether `Mod+wheel`
   over scrollable window bodies (but not editable controls) should zoom the
   desktop. Must be an explicit policy decision, not a side effect.
3. **Pinch edge cases** — the over-body pinch rule and page-zoom suppression
   need a dedicated verification pass per browser engine.

Keep `zoomAtScreenPoint`-style single entry for pointer-driven zoom and the
viewport-center path for keyboard zoom; route any new gesture into one of
those two, never a third path.
