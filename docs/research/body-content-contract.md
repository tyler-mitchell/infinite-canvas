# Window Body Content Contract (and Low-Zoom Representation)

> Provenance: distilled 2026-06-10 from kek-monorepo's
> `window-content-strategy.md` and `window-scaling-plan.md` (2026-04-23,
> updated 2026-05-05). The rasterization lanes those docs proposed are now
> owned by the in-tree `RASTERIZATION_PLAN.md` (authoritative for LOD/raster
> work); what survives here is the **body content contract** — unbuilt, and
> load-bearing for FR-8 (input unification) and FR-9 (accessibility) — plus
> the low-zoom chrome findings.

## Browser constraints this all rests on

- `transform` changes coordinate space without relayout, and a transformed
  wrapper becomes its own **stacking context and containing block** —
  `position: fixed` descendants stop behaving viewport-fixed
- CSS `zoom` rescales layout (unlike `transform`) but changes coordinate
  behavior and is not a snapshot mechanism
- deeply zoomed-out live DOM is unusable regardless of technique — text and
  hit targets collapse; mode transitions are an architectural requirement,
  not an enhancement

## The contract to define (open)

### Body root

- every window body mounts into a framework-owned body root
- the body root is clipped to the body rect
- the body root is the scroll container unless the window kind explicitly
  overrides (today: `overflowY` and `wheelBehavior: "native-scroll"` exist;
  the root/clipping rule is implicit and should become documented contract)

### Portal roots

- a **window-local portal root** for menus, tooltips, popovers that should
  track the window
- a **desktop-level portal root** for overlays that must escape window bounds
- ✅ **both shipped 2026-07-08** and this bullet said "neither exists today" for
  a month afterwards. `portal.tsx` provides exactly the two roots described
  above: a desktop-level one on the viewport, and a window-local one tracking
  the window's _screen_ rect. `<InfiniteCanvasPortal scope="window" | "desktop">`
  mounts into them, opt-in per kind via `portalRoot: true` — a root for every
  window would cost a style write per window per camera tick, which is what the
  frame's memoization exists to avoid. `/portals` demonstrates both.

### Positioning semantics

- app content must not assume viewport-global `position: fixed` inside the
  transformed window subtree
- the framework documents which portal root to use for viewport-like overlays

### Input ownership

- desktop pan/zoom owns empty space and desktop-level gestures
- body content owns app-local pointer and scroll behavior
- modifier-based desktop zoom from body content stays a policy decision (see
  [../zoom-policy.md](../zoom-policy.md))

### Focus and accessibility

- body content keeps normal DOM accessibility behavior
- desktop focus management must not break IME, text selection, or keyboard
  navigation inside bodies (the shortcut guard covers part of this; focus
  restoration rules are unwritten)

## DOM structure rule (implemented — keep invariant)

Outer/inner shell split: an outer shell that is screen-positioned and owns
`z-index` + `transform`; an inner shell with intrinsic frame size owning
chrome and body layout. This is how the window layer is built; it's the reason
stacking and local geometry stay sane. Don't regress it during the headless
extraction.

## Low-zoom chrome findings (partially addressed)

- thin frame strokes alias away at low scale (fractional-pixel strokes
  disappear) — the framework's zoom-aware chrome metrics
  (minimum-world-length clamping) address the hit-area half; a deliberate
  **minimum screen-space stroke policy or simplified low-zoom chrome style**
  is still open and belongs to the theme/headless track
- resize handles must never scale with content; they need screen-space
  sizing or inverse scaling with a minimum hit area (implemented via chrome
  metrics; preserve under any restyle)

## Mode model (owned by RASTERIZATION_PLAN; restated for orientation)

**Live** (near working scale, full interactivity) → **Scaled** (same DOM,
transform-scaled, still legible) → **Preview/semantic** (too small for live
interaction; summary/icon/snapshot representation). Readability at far zoom is
solved by semantic substitution, not by scaling fidelity.
