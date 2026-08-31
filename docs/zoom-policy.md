# Zoom policy

> Provenance: adapted on 2026-06-10 from `zoom-behavior.md` in the kek-monorepo.
> The source dates from 2026-04-23 and includes updates through 2026-05-05.

## Camera model: implemented

Zoom is camera state. The DOM layer does not scale a container to implement zoom.

One orthographic camera stores `camera.center` and `camera.zoom`. The same `camera.zoom` value controls both
render layers. The DOM window layer derives screen rectangles from that camera. The viewport size defines the
orthographic frustum.

The camera change updates the projection matrix.

## Zoom behavior: implemented

1. Pointer zoom keeps the world point below the pointer fixed.
   The reducer calculates a new center from the old zoom, new zoom, and pointer.
2. Keyboard zoom uses the viewport center.
   `Shift+0` resets zoom. The page cannot cancel the browser accelerator `Mod+0`. Fit commands use the camera
   reducer.
3. Trackpad pinch uses the pointer zoom path.
   Continuous pinch zoom is implemented.
4. Future touch pinch must use the same path.

## Input ownership

### Wheel: implemented

- Wheel input over the desktop or backdrop controls canvas pan and zoom.
- Two-finger input pans by default.
- `zoomPolicy` selects the zoom gesture.
- Wheel input over window chrome controls the canvas.
- Wheel input over a window body controls the canvas by default.
- `wheelBehavior: "native-scroll"` gives plain wheel input to that body.
- Keyboard zoom requires desktop focus and a non-editable target.

### Pinch: policy decided, browser evidence partial

Pinch input controls the canvas over window bodies. Plain wheel input can still belong to a native-scroll
body. Editable controls keep their input. A non-passive listener on the viewport root prevents browser page
zoom.

The project still needs direct Safari evidence. It also needs direct evidence for pinch input over window
bodies in each supported engine.

## Decisions from 2026-07-08

### Wheel normalization

`getWheelScreenDelta` reads `event.deltaMode`. It converts line units and page units to screen pixels.

Line mode uses `WHEEL_LINE_HEIGHT_PX`. Page mode uses the viewport size. `zoomPolicy.wheelMaxExponent` limits
the exponent after normalization. There is no second limit.

`WHEEL_LINE_HEIGHT_PX` is 40. The prior value was 16. This value is a browser calibration and not a text line
height.

Firefox reports approximately `deltaMode = 1, deltaY ≈ 3` for one notch. Chrome reports approximately 100
pixels for one notch. The old value produced 48 pixels in Firefox and approximately 100 pixels in Chrome. The
value 40 produces approximately 120 pixels in Firefox.

The `normalize-wheel` package uses the same value for
this problem.

Change WHEEL_LINE_HEIGHT_PX to adjust the physical response. Do not change the normalization formula for
response tuning.

### Modifier zoom over native-scroll bodies

A plain wheel over a `native-scroll` body scrolls that body. A modifier zoom gesture over the same body zooms
the canvas. The editable-target guard still applies. The viewport root captures zoom gestures.

This behavior existed before the decision became explicit.

### Pinch representation

On macOS, a trackpad pinch arrives as a wheel event with a synthesized `ctrlKey`. Pinch and `Ctrl+wheel` use
one code path. The implementation also accepts `metaKey` for `Cmd+wheel`. This path prevents browser page zoom
on macOS.

Both paths call `preventDefault` from a non-passive root listener.

## Open evidence

Safari pinch representation has no measured evidence in this project. Chromium and Gecko behavior comes from
their documented event models. This evidence task requires a browser and does not require a code change.

## Routing rule

Pointer input uses the single `zoomAtScreenPoint` entry. Keyboard input uses the viewport-center entry. Each
new zoom gesture must use one of these entries.
