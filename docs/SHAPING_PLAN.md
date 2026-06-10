# Framework Shaping Plan

> Adopted 2026-06-10. Two drivers: (1) the owner directive that
> **html-in-canvas is a Chrome-first, first-class design constraint**
> (feature-detected; lagging browsers are not a blocker; primary capture
> lane with snapdom as fallback — see
> [research/html-in-canvas.md](research/html-in-canvas.md) and risk R12);
> (2) the **headless objective** — extract the as-is-ported styling into an
> opt-in stylesheet over a stable data-attribute contract, satisfying FR-6
> and unblocking the styled distribution.

## Locked design decisions

- `data-slot` part attributes + boolean state attributes (`data-active`,
  `data-selected`, `data-pinned`); exclusive enums get their own attribute
  (`data-action`, `data-handle`, `data-axis`, `data-mode`). The behavioral
  `data-infinite-canvas-*` attributes are a separate, untouched contract.
- One optional `theme.css` (subpath export `infinite-canvas/theme.css`),
  wrapped in `@layer infinite-canvas`, tokens prefixed `--icx-*`. Structure
  stays inline — unstyled is ugly but fully functional.
- Grid backdrop colors become `var(--icx-*)` inside JS-computed gradients;
  scene layers keep the typed `InfiniteCanvasTheme` object; the `theme`
  prop becomes `Partial<...>` emitting inline `--icx-*` vars when passed.
  No `getComputedStyle`.
- Built-in inline-SVG icons with an `icons` component-map override;
  lucide-react removed from framework deps.
- `hud?: boolean | { statusCard?, minimizedDock?, pointerModeControls?,
cameraControls?, zoomControls? }`.
- Devtools overlays style themselves inline (must render without the
  stylesheet).

## Phases

0. **Housekeeping + directive persistence** — editor tsconfigs; R12 flip;
   this document.
1. **Pin html-in-canvas reality** — live probe (unflagged availability,
   descendant constraint, invalidation, taint) →
   `research/html-in-canvas.md`.
2. **Split the monolith** — `infinite-canvas.tsx` (2,858 lines) into
   frame-slots / window-frame / canvas-overlays / canvas-hud /
   grid-backdrop / webgpu-surface modules. Pure moves; fixes NFR-2;
   de-risks R13 and makes the render path legible for the perf work.
3. **Data-attribute contract** — additive emission + contract test (the
   public selector API spec, and the styled distribution's slots map).
4. **theme.css + wiring** — tokens verbatim from current values; subpath
   export (dev src / publish dist); token-sync test. Inert until imported.
5. **Playground adoption + baselines** — import above tailwind; screenshot
   all routes + scripted interaction states.
6. **Delete Tailwind + lucide slot-by-slot** — five commit groups, each
   screenshot-diffed and live-driven (the silent killer is a dropped
   structural class like `pointer-events-none`).
7. **Cut the cord** — remove the framework `@source` scan + lucide dep;
   `headless-boundary.test.ts` enforces no framework `className` literals
   and no lucide imports, durably.
8. **Backlog ergonomics** — `getInfiniteCanvasWindowData` helper, sync
   drop-listener attach, `createInfiniteCanvasHandle` experimental export,
   `hitRadius` docs, docs sweep.

## Subsequent tracks (defined, not scheduled here)

- **Performance deep-dive (R15)** — profile /stress at 20/40/80 first
  (window re-renders per camera frame, snap rebuild cost), then prototype
  **texture-mode-during-camera-motion via html-in-canvas capture** (cached
  window textures on the WebGPU plane during pan/zoom; live DOM swaps back
  on settle) against subscription narrowing — decide with numbers.
- **Styled distribution** — tailwind-variants design language over the
  data-slot contract; dynamic-grid-derived backdrop as the first branded
  module; aesthetics mined from the motion study, built better.
