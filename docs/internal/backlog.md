# Backlog

Ordered by dependency, not by date. Take the first open item whose dependencies are done.
Each item names the product-visible outcome that closes it.

## DOM track — governs everything below since 2026-09-12

The owner parked the GPU engine track on branch `gpu-canvas-engine` (c102c2b8) because
html-in-canvas is not in stable Chrome and the portfolio must run there. `main` follows a DOM-based
approach with Framer Motion as the DOM-plane animation owner. Design:
`docs/internal/shaping/layout-container.md`. The engine-first section below is the long-term end
state and stays ranked under this section.

D1. [x] **Layout container: `masonry` group mode with `hug` sizing.** Closed 2026-09-12. Seen live
on `/board` in polkadot-ui: 16 hugging cards in four tracks, a card that opens grows and the later
cards move to their new slots, the shell grows to the tallest track. One defect found live: a frame
culled with `content-visibility: auto` reports a zero body box, now ignored.
D2. [x] **DOM-plane animation owner.** Closed 2026-09-12: the camera is one unsnapped,
compositor-promoted transform per layer, frames and shells carry world transforms with the spring
transition from `layout-motion.ts`, a pointer-owned rect has no transition, and a frame takes only
the zoom, so a pan writes two layer styles and nothing else. Seen live on `/board`: a card that
opens moves its neighbours with a tween; the camera stayed under a synthetic wheel. Smoothness at
240Hz is the owner's verdict. Reopened 2026-09-12 earlier that day. A first version sprang the world rect
from JavaScript through Motion values, four values per frame including width and height. That is
a layout per frame per card, and the camera was baked into every window transform, so no tween
could run on the compositor. Removed. The handoff (`docs/handoff/design_handoff_scatter_canvas/
README.md`, lesson 3) already stated the correct structure: JavaScript owns state transitions, CSS
owns the tween. Target: the camera transform on the layer element, world transforms on windows and
shells, CSS transitions on those transforms with a spring easing, transitions off while the pointer
owns a rect, and no per-frame width or height writes. Done when a card that opens on `/board`
moves its neighbours with a visible tween and a pan or zoom stays on the pointer.
D3. [x] **`movable` window capability.** Closed 2026-09-12, with the keyboard resize command gated
on `resizable` as well, which it never was.
D3b. [ ] **Polkadot's HUD tree renders on every camera step.** Found 2026-09-12 while measuring
the pan at 240Hz: the board presents every frame under a per-frame pan, the Polkadot canvas drops
about 19 of 240 with zero windows open (was 32 before the library rail was memoized and stopped
subscribing to the whole state). Per step the synchronous part is 0.2ms; the microtask part is
2.2ms median and 8.6ms p90. Two causes, both measured: nine app components still call
`useInfiniteCanvasState` and so re-render per step whether or not they read the camera, and the
whole HUD (rails, palette, minimap, library, tour) sits inside `renderOverlay`, which the
framework renders on every state change by contract. Done when a per-frame synthetic pan on a Polkadot canvas drops no frames at
240Hz and the search input is not rewritten per step. Decision needed first: a stable overlay
context that overlays subscribe to themselves (framework contract change, playground overlays
adapt), or the app moves its chrome out of `renderOverlay` and selects fields.
D4. [ ] **Yoga-backed `flex` group mode.** Depends on D1 and D2. Same seams, `yoga-layout` as the
solver with measured sizes as leaf results.
D5. [ ] **The canvas is the page (reading mode).** The camera-stops model built and rejected on
2026-09-17 is demolished (stored camera positions stepped like slides). Replacement, designed in
`~/.claude/plans/lively-singing-brook.md` §2: the page scrolls, the viewport is fixed, one snap
child per section gives gravity, and Motion's `scroll()` maps the offset through a pure
`getCameraTrack` into the camera; the route is the layout's reading order (`getRoute`). Built
2026-09-17, not yet seen live: `getRoute`, `getCameraTrack`, `CanvasScroll` on Base UI
`ScrollArea` (snap, sticky viewport, `attached`, start `section`, `useCanvasScroll`), the `read`
and `explore` viewport policies, `setCamera`, the board's rail (titles on desktop, dots on a
phone), the URL hash per section, Explore and Back to reading, and the playground `reading`
showcase; design in `docs/reading.md`. Done when the owner scrolls `/board?mode=read` on desktop
and at phone width and the cards pass in reading order with nothing on the canvas moving but the
camera. Later on 2026-09-17: the board's consumer plumbing moved into the framework
(`onSectionChange`, viewport mode from the scroll context, `computed.selectionActions`,
`computed.parentLayoutType`, the `grouping` option), the scroll camera previews per frame and
commits on `scrollend` (the lag root: Legend persists the document on every change), and a fresh
load with a URL hash now places once the viewport is measured. Seen live 2026-09-18 on the
playground `reading` route, where it was collapsed: every section sat at scroll offset 0 and the
page had no scroll range at all, because `getCameraTrack` derived `length` from the content
overflow (`bounds.height * zoom - height`, clamped at 0) and then clamped every section offset to
it, so any document not taller than the viewport lost its whole route. `length` is now the larger
of the content overflow and the last section's offset. After the fix the three sections sit at 0,
100 and 330, scrolling those offsets moves the camera by exactly -100 and -230 in world y, the
rail's `aria-current` steps archive to control to log, and the world transform is the only thing
that changes. Two more defects fixed on the same path: the nearest-section search seeded its
reduce with the current offset, so it compared against a distance of zero and no section could
ever win; and the settle test used exact float equality on the camera pose, which an animated
camera can never satisfy. Seen on `/board?mode=read` the same day, at both widths: eight sections
at distinct offsets, scrolling moves the camera by exactly the scroll delta in world y, the URL
hash follows the section, and only the world transform changes. At 375px the board fits at zoom
0.625, which is D6's remaining work, not this item's. Two cards that share a world row share one
scroll offset, so one of them can never become the current section; whether side-by-side cards
should be one stop or two is an open design question. The owner's own look is still the verdict.
D6. [ ] **Legible sections on a phone.** Depends on D5. A window can carry `widthMode:
"viewport"` (beside `heightMode`), the board's root container does, a resize or placement sets it
back to manual, and `setWindowSizeMode` switches it, so the grid's breakpoints fire at phone width
and a section fits near zoom 1. Done when the owner reads the cards in one column near zoom 1 at
phone width. Measured 2026-09-18 at 375px on `/board?mode=read`: the board document already
carries `widthMode: "viewport"` on `main` and breakpoints `640 -> 12 columns, 0 -> 1 column`, and
the canvas viewport element measures 375, but `main` renders **804 world px** wide, so the 640
breakpoint still matches and the grid never collapses; the board sits at zoom 0.625 with cards
still side by side. Cause: `columnSize` in `layout/columns.ts` returns
`Math.max(narrowest, proposal.width)`, where `narrowest` is the widest child's intrinsic minimum
(`size({ width: 0 }).width`). `widthMode: "viewport"` does hand the container 375, but the layout
floors it at the children's minimum and reports 804 back. The children only become narrow when the
column count drops to 1, and the column count only drops when the container narrows, so the two
hold each other up. That floor was tried and is NOT the cause: removing it left `main` at 804 and
the zoom at 0.625, so the change was reverted. (An earlier note here blamed a screen/world unit mix
in `rootRect`; also wrong.) The framework is correct and the cause is persisted state:
`localStorage["board.v6"]` holds `main.widthMode: "manual"` with a baked-in width of 803.985, and
the persisted document overrides the shipped `portfolio/document.json`, which still says
`"viewport"` and 1200. Proven by patching only that one field in the persisted copy and reloading
at 375: `main` renders 375 wide, the board sits at **zoom 1**, and the cards collapse to one
column (distinct child x values drop from four to two). The persisted copy was then restored
untouched, so the board is still in its manual state on disk. Every write of `widthMode: "manual"`
was then read: `resizeWindow`, `placeWindow`, the resize branch of `commitDrag`, the `container`
factory that builds wrapper windows, and `openWindow`. None fires on a plain load, and a load in
read mode was observed leaving a restored `"viewport"` intact, so nothing is flipping it silently.
The likely history is an ordinary resize of the board container in edit mode, which correctly set
manual. The real gap is what that leaves behind: once a container that the document declares as
`widthMode: "viewport"` is resized even once, phone layout is permanently broken and there is no
visible way back. `setWindowSizeMode` is the action that restores it but nothing in the board's UI
calls it. Two ways out, and the choice is the owner's because it is a product decision: give the
container a visible control that returns it to viewport width, or have the board re-assert the
modes its own `document.json` declares when it loads a persisted copy. The `container` factory at
`state.ts:1627` also hard-codes `widthMode: "manual"` while rebuilding a wrapper, so a group or
dock that rebuilds such a container would drop the mode too; that one is a framework defect
whichever way the product question goes.
2026-09-19: three claims above are now out of date. The `container` factory keeps an existing
window's `heightMode` and `widthMode` and defaults to manual only for an id that does not exist
yet, so that framework defect is closed. The board's inspector carries a **Viewport width** switch
on the Window fieldset, calling `setWindowSizeMode` for any window with no layout parent, so the
recovery control exists and the stuck state is no longer a dead end. The persisted copy is not
stuck either: `localStorage["board.v6"]` reads `main.widthMode: "viewport"` with width 1200. What
remains is the owner's look at phone width, which is the done-condition. It cannot be measured
from an agent session: a hidden preview pane reports every rect as zero.
D9. [ ] **The selection toolbar does not follow the camera.** Found 2026-09-19. The toolbar is a Base
UI Popover positioned against a world-layer anchor element. Base UI drives position with Floating
UI's `autoUpdate`, and it hardcodes the options to `{ elementResize, layoutShift }`
(`esm/utils/useAnchorPositioning.js:287-290`), exposing only `disableAnchorTracking` to turn those
two off. A camera pan or zoom changes a CSS transform on an ancestor: that fires no scroll, no
resize, and no ResizeObserver, because the anchor's border box in CSS pixels never changes.
`layoutShift`'s IntersectionObserver catches some movement but is threshold-based, so it cannot
follow a camera. Floating UI's own `animationFrame: true` would, and Base UI has no prop for it.
There is no clean fix inside the current composition, so nothing was changed. Two real options when
this is taken up: position the toolbar with the framework's own `CanvasPortal scope="window"`, which
re-renders on every camera change by construction and is how the framework already places
canvas-anchored chrome, at the cost of Floating UI's collision flipping; or get the `autoUpdate`
options exposed upstream. Done when the toolbar stays on its selection through a pan and a zoom.
D8. [ ] **The board's reading width is a tablet-ish measure, not the full desktop viewport.** Deferred
by the owner on 2026-09-19, to be taken up later: on a desktop screen the main portfolio container
should read at roughly the width of a tablet screen rather than stretching the full window. The
measure is a visual approximation, not a device: no tablet width is codified. Today `main` carries
`widthMode: "viewport"`, which ties it to the viewport width at every size. Done when the board
reads at that narrower measure on a desktop screen while still collapsing at phone width.
D7. [ ] **Retire the old `src` framework.** `next` is the only live framework; `src` stays as a
capability checklist until nothing imports it. Measured 2026-09-17 by import survey: the old entry
points (`.`, `./core`, `./scene`, `./theme.css`) have 80 consumer files in `apps/polkadot`, 14 in
`apps/playground` (eight routes, six showcases), and one in `apps/compositor-poc`. The board and
the `next` playground routes import nothing from `src`. Order: (1) each old playground route is
either rebuilt on `next` as a showcase of a capability `next` already has, or deleted with the
capability recorded as a `next` gap; (2) Polkadot moves to `next` one seam at a time, starting
with the canvas runtime (`apps/polkadot/src/canvas/use-canvas-runtime.ts`) and the window
registry, because every other file reaches the framework through those two; (3) `src`, its tests,
and the old package exports are deleted in one commit. Done when `packages/infinite-canvas` has
one framework and Polkadot's own test suite passes on it.

## Engine-first target — long-term end state

Added on 2026-09-08 after reading `docs/internal/shaping/compositor-blueprint.md` in full. Its
"Correction on 2026-09-08" is the architecture authority for the compositor, and its ordered steps
lived only in that document, so this queue pointed at polish while the real sequence sat unread.
Everything in the Compositor section below refines a seam these steps remove. That does not make
those items wrong, but it does rank them: prefer a step here over polishing what a step deletes.

E1. [x] **Verify or fix the empty compositor canvas.** Closed 2026-09-08; nothing above could be
seen without it. Cause was the surface re-rendering on every store change, which re-attached the
canvas ref and let `useConfigureContext` reset the swap chain.
E2. [ ] **Build the scene model and the `connections` state slice.** The framework maintains one
GPU-resident scene from the store — window instances, connections, selection, camera — and
consumers add entities through the store and commands, as they add windows today. The world in
`compositor/backend/world.ts` is the time half of this and already exists; the `connections`
slice and the pure derivation do not. Source-shaped spine:
`apps/compositor-poc/src/spine/scene-model-spine.tsx`, revisions 2 and 3.
E3. [ ] **Replace `sceneLayers` in the playground and Polkadot with store entities.** Depends on E2.
The workflow-board links become the `connections` slice the framework draws. A consumer never
writes a shader.

**Corrected on 2026-09-09, after reading Polkadot's relation store and connector geometry.** The
original line said Polkadot's connectors become the same slice. They cannot, and the difference is
not cosmetic:

- A framework connection is keyed by **window id**, is directed, lives in the canvas document, and
  undoes with the canvas.
- A Polkadot relation is keyed by **content item id**, is undirected (`findRelation` matches either
  direction), lives in SurrealDB, spans every canvas in the project, and has its own undo through
  `rememberUndoableAction`.

The killing detail is arity. `getConnectorRectsByItem` returns a list of rects per item, because one
item can be open in more than one window, and one relation then draws several connectors. A
window-id-keyed edge cannot say "join whatever windows show item A to whatever windows show item B".

So Polkadot keeps the database as the owner of the durable fact and **projects** it into the canvas;
it does not move it. The slice is right for a canvas whose edges really are canvas state, which the
workflow board's links are. Treating these two as one concept would be the affordance duplication
this queue exists to prevent, in the direction that loses data.
E4. [ ] **Delete the `sceneSurface` prop and the `sceneLayers` split.** Depends on E3. The compositor
mounts with the viewport when the `/scene` entry is present. This is what makes the pass
contract, `CompositorSceneResources` and the consumer-facing pass exports go away; until then
they are refinements to something scheduled for removal.

**Derived on 2026-09-09, after the connections pass landed in `834b30f`.** `sceneLayers` now has
exactly one consumer left: `apps/playground/src/routes/drop-tray.tsx` passes
`createDropPreviewPass`, which draws the ghost rect where a dragged payload will land.

That pass is a framework concept wearing a consumer's clothes. Every input it reads is framework
state — `drop.status`, `drop.isOverViewport`, `drop.dropTarget.status`, `drop.placement.rect` — all
produced by `drop-interaction.ts` and the `dropPolicy` prop. The only consumer-specific part is the
colour, which the showcase takes from its own payload's accent.

So the order is: move it to `compositor/passes/drop-preview.ts` with valid and invalid colours in
the policy, exactly as `connections` was moved. The per-payload accent does not survive that and
should not — a framework preview says valid or invalid, and a consumer that wants its own hue is
asking for a policy field, not a shader. Once that lands, `sceneLayers` has no consumer and the
prop, the `InfiniteCanvasScenePass` export, and the four-way placement split can all be deleted
rather than deprecated.

## Compositor

Done by reading on 2026-09-08, not yet verified live: the per-render pipeline rebuild from a fresh
`sceneLayers` default is fixed; the particle field, contact shadow, `sceneChanged` gate, and the
reduced-motion and active-window options are staged. Item 1 verifies all of it.

1. [x] **Type-check the framework, then the playground, then Polkadot.** Done 2026-09-08 on Opus 5.
       Found and fixed one real error: the radiance pass rebound a texture accessor on the pipeline, which
       has no such overload. All three packages now report zero type errors and the three API gates pass.
       Original text: Nothing has been
       type-checked since the focus-field pass, the store signals, the compositor policy, the contact
       shadow, the particle field, and the `sceneChanged` frame flag landed. Closes when all three
       packages type-check and the API doc, stability, and pure-core gates pass.
2. [x] **Fix the empty compositor canvas.** Closed 2026-09-08. The split experiment was never needed.
       Two real causes, both found by reading: the radiance pass could not compile (item 1), and the
       particle compute step assigned a buffer reference to `let`, which threw during pass build and took
       the whole surface down through the error boundary. With both fixed the canvas renders and the light
       follows a dragged window.
3. [x] **Fix the flashing of every compositor effect during a drag.** Closed 2026-09-08. Cause: the
       surface re-rendered on every store change. Each render re-attaches the canvas ref, and
       `useConfigureContext` disconnects and builds a new `ResizeObserver` for every attach. A newly
       observed element always gets one callback, and that callback writes `canvas.width`, which resets
       the canvas and drops its WebGPU swap chain. The frame then presents blank, with no error and with
       correct data, which is why every earlier hypothesis missed it. Fix: memoize the surface, so the
       window plane's renders stop at it. `@typegpu/react` documents that per-frame values go through
       `useFrame` and `.write()` rather than a render, and the surface already reads the store with
       `state$.peek()` inside `useFrame`.
       Method: wrap `ResizeObserver` and the canvas `width` setter on the live page and count. A
       30-frame drag went from 60 observers, 29 callbacks and 29 writes to 0, 0 and 0.
       Recorded so nobody retries them: four wrong hypotheses were the shared command encoder, the
       render-pass descriptor, `runner.run()` submitting from inside an open pass, and an upstream
       deficit in the library's resizer. There is no upstream deficit. Screenshots and `drawImage`
       readback disagreed with each other throughout and neither is evidence on its own; counting the
       writes was what settled it.
4. [ ] **Tune the default compositor policy on sight.** Depends on 3. The particle field and the
       contact shadow defaults are first guesses, and the particle behaviour has never been judged live.
       Closes when the owner accepts the defaults in Polkadot.
5. [ ] **Zoom-level impostors.** Depends on 3. Design, from reading `detail-level.ts`,
       `window-frame.tsx`, `window-raster-body.tsx`, and `group-layer.tsx`: add a third detail level
       `impostor` below `summary` with its own hysteresis pair (`impostorBelowPx`, `summaryAbovePx`) in
       `InfiniteCanvasDetailPolicy`; the window frame renders no body and no chrome at that level and
       keeps only its hit-test box; `WindowInstance` gains a `detail` float in a new `flags` vec4 (the
       `state` vec4 is full: active, selected, pinned, z) that `getWindowInstanceColumns` fills from the
       same pure function; a `passes/impostor.ts` render pass draws a rounded tinted card with a title
       band for instances whose `detail` says impostor, gated by `compositor.impostor`. Both sides read
       one function, so the DOM never disappears before the card appears. Closes when zooming out past
       the threshold swaps every window for its card with no flash and zooming in restores it.
       The hard half already exists as a prototype, found on 2026-09-08:
       `apps/compositor-poc/src/signature.ts` is a compute pass that reads each window's rendered
       texture from a `texture2dArray` and derives an ink density, an eight-band vertical profile, and
       a chroma-weighted accent colour, with the cubic chroma weight there to stop neutral text
       dominating the accent. That is what makes an impostor read as its window rather than a flat
       rectangle, so port it rather than rebuild it. The file name suggests the rejected scene-hash and
       is unrelated to it; read it before assuming either way.
6. [x] **The world: a GPU-resident scene that lives across frames.** Closed 2026-09-08.
       `compositor/backend/world.ts` holds the world: the surface writes the document's intent into a
       readonly `targets` buffer, and `settleWorld` moves a mutable `bodies` buffer toward it by `dt`
       in one compute dispatch before any pass draws. Every pass binds `instances` to the world, so
       nothing draws the document directly and no change can step instantly. A window with zero width
       was never simulated, so it starts settled rather than flying in from a recycled slot.
       Original text: Now the top item; everything
       below the compositor's surface depends on it. Spine revised 2026-09-08 in
       `apps/compositor-poc/src/spine/scene-model-spine.tsx`, revision 2.
       Revision 1 declared the scene model a pure derivation from state, which is the architecture the
       compositor already has. It could not produce continuity, because a pure projection of the
       current state has no previous value to move from, and it had no depth, because window proxies
       are rects and `state.w` is a stacking index rather than a position.
       Revision 2 splits intent from state: the store says what the world should become, and a
       GPU-resident world holds what it is and moves toward the intent by dt in one compute step
       before any pass draws. Continuity then belongs to the architecture. `height` becomes a world
       coordinate. The pattern is the one `passes/particle-field.ts` already uses, generalized from
       particles to every entity.
       The revision also deletes rather than tunes: the radiance pass, because
       `@typegpu/radiance-cascades` solves a 2D field and its hooks take a flat uv so depth cannot
       reach it; `WindowInstance.state.w`; and `InfiniteCanvasScenePass.frameloop`, which nothing
       reads. Closes when a focus change and a window move both settle over time on screen, with no
       instant step, and depth is one world coordinate every pass reads.
7. [ ] **Judge the lighting for a world with depth.** Depends on 6. The choice this item once
       framed as open was made and shipped on 2026-09-08: `compositor/passes/area-light.ts` implements
       the LTC candidate below, and `policy.ts` keeps it off by default. Do not write a second lighting
       pass. What it covers, and what it deliberately does not, so the remaining question is narrow:
       the spine's revision 3 named three things a lighting model needs that the world lacked, and the
       shipped pass answers two of them by specialisation rather than by adding them. The receiver is
       fixed as the floor plane facing the viewer, so its tangent basis is the identity and no
       per-pixel basis is built; and the material is skipped entirely, because only LTC's specular term
       indexes the roughness LUT, so the diffuse term is exact without vendoring the 315KB of tables.
       The third, an oriented emitter, is still a specialisation: every window is treated as a
       downward-facing panel at a height taken from stack order.
       What is genuinely open is the look, and one structural gap behind it: irradiance on a
       featureless plane is a radial gradient by construction, so light will keep reading as an aura
       until the medium has material structure. That is the spine's `FloorMaterial`, and it is unbuilt.
       Original text and evidence: Radiance cascades is ruled out
       and the pass is deleted. Candidate, from watching the TypeGPU examples run rather than reading
       them: **Area Light (LTC)**, `rendering--area-light`. It lights a dark room from a rectangular
       emitter through Linearly Transformed Cosines, with correct soft falloff, stretched speculars
       and materials that vary in roughness and metallicity. A window is a rectangle, so the emitter
       shape matches the scene exactly, and LTC has no angular spread artifact, which is the owner's
       complaint about the cascades. It also ships a key, fill and rim rig, which maps onto the
       focused window as key and the rest as fill.
       Also watched: `rendering--clouds` ray marches a volumetric field from layered noise at 4.17ms
       per frame, which is the shape of a real medium if the substrate should be volumetric rather
       than a flat wash. Its noise comes from `@typegpu/noise`, which item 9 already tracks.
       Closes when the owner accepts the look on a live board.
       Do NOT port `apps/compositor-poc/src/light-field.ts`, read on 2026-09-08. It is a per-window
       glow quad whose fragment is a radial falloff, `pow(reach, 1.15) * 0.26 + pow(reach, 3.5) * 0.55
   - pow(reach, 10) * 0.4`, with a saturation boost over grey. That is the aura the owner asked to
be removed and called tacky and CSS-looking, and it is what the deleted framework pass was.
Its file name will look like a find to anyone working this item; it is not.
One idea in it is worth keeping and is easy to miss: the light's reach is
`spread * REACH * signature.w`, so a window's ink density sets how far it casts. That is
     content-aware light rather than a fixed radius, and it needs the signature pass item 5 points at.
8. [ ] **Minimap and off-screen indicators as passes.** Depends on 6. Each replaces its DOM or CPU
       counterpart; the old owner is deleted in the same change. The dot grid part is done:
       `passes/grid.ts` draws it in world space with an edge falloff, reusing `getAdaptiveGridSpacing`
       so the two never diverge, and `infinite-canvas.tsx` picks exactly one owner through `gridOwner`,
       so the CSS backdrop stands down whenever the compositor paints it.

Opened by the surface rewrite on 2026-09-08, in dependency order:

10. [x] **`frameloop` deleted.** Closed 2026-09-08. It became dead config when the surface rewrite
        stopped reading it, and the world advances by dt every frame, so a demand mode cannot coexist
        with it. Removed from the pass contract, every pass, `types.ts` and both barrels.
11. [ ] **Decide whether an idle canvas may redraw at display rate.** The surface redraws every
        frame, which costs power on a still canvas. Needs a measurement, not a guess. Any gating must
        come from the store's own change signal rather than a hand-rolled scene hash; that was tried
        and reverted on 2026-09-08.
        Narrowed on 2026-09-08 without measuring: a store change signal cannot gate this while any
        pass animates on its own clock, and two do. The world settles toward the document over `dt`,
        so it must keep drawing after the last store change until it converges, and the particle field
        drifts continuously by design. Gating on store changes would freeze both. What remains for a
        measurement is the genuinely still case: reduced motion stops the particles after one step, and
        a settled world writes the same values every frame. The unconditional per-frame cost was cut
        once already by making `proximity` opt-in, which removed a compute dispatch and a GPU-to-CPU
        map from every default canvas.
12. [x] **Decide who releases pass resources.** Decided 2026-09-08 by reading the upstream
        contract: the root owns them, and the pass contract needs no `destroy`. `TgpuRoot.destroy`
        "destroys all underlying resources (i.e. buffers...) created through this root object"
        (`core/root/rootTypes.d.ts`), so everything a pass makes with `root.create*` is released when
        `@typegpu/react` disposes the root. Adding `destroy` back to the contract would also need a
        cleanup the surface has nowhere to put: pipelines are built in a `useMemo`, which has no
        teardown, and `useEffect` is banned in that file.
        The one case the root does not cover is a policy change mid-session, which rebuilds `built`
        and leaves the previous passes' buffers alive until the root dies. Nothing in the repository
        changes the policy at runtime today. Worth knowing before anything does: a consumer passing an
        inline object literal to `compositor` gives a new identity every render, and `built` lists it
        as a dependency, so that consumer would rebuild every pipeline and strand its buffers on each
        render. `diagnostics` has the same shape and the framework's convention is that consumers
        memoize policy objects, but the cost there is a cheap re-render rather than GPU memory.
13. [ ] **Reproduce the grab cursor flicker over a window header.** Reported by the owner while
        moving the pointer over a header, alternating between the default arrow and `grab`. Two claimed
        causes have already been withdrawn, so no fix may be written until it reproduces. What is
        measured so far, on the live board: with the pointer at rest the header resolves to `grab` on
        40 of 40 frames; across the header rectangle the north and corner resize handles own the top
        five pixels, which is by design and yields `ns-resize` rather than the arrow; and the window
        body owns the bottom half pixel of the header's border box. None of that explains the report.
        Closes when the alternation is observed and its cause named.
        A lead ruled out on 2026-09-08, so nobody spends the time twice: `contain: content` on
        `[data-slot="window"]` is not involved. It looks like a strong candidate because
        `shaping/resize-handle-target.md` proves its paint containment clips the resize handle's outer
        half away, and because the handles own the top of the header. Measured by probing the header
        with `contain: content` and again with `contain: none`: both give `resize-handle` with
        `ns-resize` from y 0.5 to 6 and `window-header` with `grab` from y 8, identically. The
        containment clips only at the window's outer edge, not at the header-handle boundary inside it.
        That boundary at 8px is by design, and it yields `ns-resize` rather than the arrow the owner
        described.

## Polkadot

16. [x] **Await the app actions in the Polkadot tests.** Closed 2026-09-08. All ten sites await,
        Polkadot reports zero warnings across 171 files, and its 426 tests pass. The two findings worth
        keeping: `project.open`'s test hand-rolled `await new Promise((resolve) => setTimeout(resolve, 0))`
        with a comment explaining the timer, where awaiting `run` is the affordance; and
        `note-write-verb.test.ts` did `String(read)` on the run union, so a missing action stringified to
        `"undefined"` and the following `.replace` silently did nothing. The parenthesising trap this
        entry predicted was real: `runReveal(...)[0]?.type` and `runWorkspaceVerb(...)[0]` both needed
        `(await ...)[0]` rather than a blind replace.
        Original text: Ten `no-floating-promises` warnings across
        `app-actions.test.ts` and `notes/note-write-verb.test.ts`. `AppAction.run` returns
        `string | Promise<string | undefined> | undefined`, and the helpers call it and then read a
        captured array or `projectContent$.peek()` immediately.
        Corrected on 2026-09-08, because the first version of this entry overstated it. Traced: if an
        action became async, `runOpen` would read an empty array and `storedAfterWriting` would read
        before the write landed, so those tests would **fail loudly** rather than pass having proven
        nothing. Every fixture is `kind: "note"` today and that opener is synchronous, so nothing is
        wrong now. The real hazard the lint names is narrower and still worth closing: an action that
        **rejects** surfaces as an unhandled rejection instead of a test failure, which is a silent
        outcome rather than a red one.
        One line deserves separate attention regardless: `note-write-verb.test.ts:59` does
        `String(read)` on that same union, so a `undefined` return stringifies to `"undefined"` and a
        promise to `"[object Promise]"`, and the `.replace` then silently does nothing.
        Six of the ten are done as of 2026-09-08, taking Polkadot from ten warnings to four with all 38
        tests passing. Done: both helpers in `notes/note-write-verb.test.ts`, plus its `String(read)`
        line, which now awaits and defaults with `?? ""`; and in `app-actions.test.ts` the inline
        `attempt`, `canvas.open`, `workspace.moveActiveWindow` and `project.open` calls.
        The `project.open` one is the reason this was worth doing at all: that test hand-rolled
        `await new Promise((resolve) => setTimeout(resolve, 0))` to let the verb settle, with a comment
        explaining the timer. Awaiting `run` is the affordance, and the timer is gone.
        The remaining four are the shared helpers `runReveal`, `runOpen`, `runGroupVerb` and
        `runWorkspaceVerb`. Each is one warning but the ripple is real: making them async means awaiting
        at 25 call sites and marking about fifteen enclosing tests async, and one site indexes the
        result (`runReveal(...)[0]?.type`) so it needs parenthesising rather than a blind replace.
        Stopped there on purpose: 25 mechanical edits, in tests that are correct today, for a hazard
        that is an unhandled rejection rather than a wrong assertion, against a standing instruction to
        prefer the least code. Closes when those four helpers await and their call sites follow.

17. [ ] **Resize handles: 8px, and unreachable from outside the window.** A measured user-facing
        defect with no queue entry until now. Shaping and evidence are in
        `docs/internal/shaping/resize-handle-target.md`; read it before touching this.
        The handle is positioned to straddle the frame edge at `calc(extent / -2)`, but
        `[data-slot="window"]` sets `contain: content`, whose paint containment clips the outer half
        away. So the real target is 8px inside-only, and a pointer approaching from outside crosses
        nothing until it is already inside the frame. Proven by re-probing the identical points with
        `contain: none`, where the outer band does resolve to the handle.
        Two hit paths disagree, which is the deeper defect: starting a resize goes through the handle
        element's own `onPointerDown`, while `resolveInfiniteCanvasSpatialTarget` classifies a 16px
        inside band and is separately gated by `getTopmostWindowAtWorldPoint`'s strict
        `rectContainsPoint`. Both refuse everything outside the rect, for unrelated reasons.
        Do NOT simply raise `resizeHandleSize`. That is shape A, it is what an earlier diagnosis
        implied, and the measurement disproves it: widening a misaligned band moves both edges outward,
        so the outer half stays dead and it takes area from the header because resize is tested first.
        Not implemented on 2026-09-08 because the document's own fit check has all four shapes failing
        at least one must-have, and every one of them fails R4, the corner-versus-edge ratio. Closes
        when a shape passes the fit check and a pointer arriving from outside the window can grab the
        edge.

## TypeGPU grounding

Findings from reading the TypeGPU consumer material in full (`react.md`, `encoders.md`, `shaders.md`,
`noise.md`, `pipelines.md` from the skill the toolkit ships). Read the reference that covers a
subject before writing code in it; the skill file says which reference covers what.

13. [x] **Replace the particle field's hand-rolled randomness.** Closed 2026-09-08. The packaging
        question recorded here was not the owner's to answer and should never have been filed as
        blocked: `@typegpu/noise` is a dependency rather than a peer, so it neither touches the
        published peer surface nor the stability tiers. It is now in the catalog and the manifest, and
        the drift comes from `perlin2d.sampleWithGradient`, taking the perpendicular of the gradient so
        the flow is divergence-free and cannot gather particles anywhere.
14. [ ] **Decide whether to adopt `tsover`.** `shaders.md` calls plain vector operators the idiomatic
        style and names `std` call chains the fallback for projects that cannot use `tsover`. This
        workspace configures no `tsover` plugin, so the compositor is correctly in the fallback position
        today and every pass uses `std` consistently. Polkadot's `SPIKES.md` already notes that `tsover`
        restores operator syntax. Adopting it would let the compositor read as vector math, and it changes
        the published package's typecheck requirements, so it is an owner decision.

Checked and found NOT to be defects, recorded so nobody re-opens them:

- The manual workgroup size and bounds guard in the particle compute step are correct. The original
  reason given here — that `encoders.md` forbids a guarded compute pipeline from recording into a
  shared pass and the compositor records every compute pass into one encoder — is stale as of
  2026-09-08: there is no shared encoder any more, each dispatch submits itself. The guard is still
  right, now for the plainer reason that a dispatch rounds up to whole workgroups and the tail
  invocations must not write past the live count.
- The `std` call style is correct while `tsover` is absent.
- `WindowInstance.state.z`, the pinned lane, has no shader reader, and `state.y` (selected) is read
  only indirectly because the CPU folds it into `tint.w`. Checked 2026-09-08 and deliberately left
  alone, unlike the `id`, `screenRect` and `CompositorSceneResources` removals that came from the
  same reader count. A lane inside an existing `vec4f` costs nothing: dropping both would leave
  `state` as a `vec2f`, and with `rect` and `tint` still `vec4f` the struct pads to 48 bytes either
  way under WGSL alignment. So the change would trade a doc comment for zero bytes and zero GPU
  work. If `state` ever loses `rect` or `tint` beside it, re-measure before assuming that still holds.
- Most fields of `InfiniteCanvasSceneLayerRenderContext` have no reader, and that is deliberate as of
  2026-09-08. It is the consumer contract for a pass, so `chrome`, `devicePixelRatio`, `space`,
  `theme`, `viewport`, `visibleScreenRect`, `visibleWindows`, `visibleWorldRect`, `actions`,
  `getState`, `getWindowProxy` and `resolveSpatialTarget` stay: each is an input a pass could
  reasonably read, and `getState` is the only way to read fresh state inside an async readback.
  Two were removed on the same pass for reasons the others do not share: `visibleRect` held the same
  value as `visibleWorldRect` under a second name, and `contextualCommands` ran a list build every
  frame to hand a pass UI commands it cannot use. Do not delete the rest on reader count alone.
- `getWindowInstanceColumns` allocating four `Float32Array`s per frame is correct use of
  `common.writeSoA`, checked 2026-09-08. Its third parameter is `BufferWriteOptions`, which is
  `startOffset` and `endOffset` in destination bytes — a partial-write range, not a source count.
  Reusing capacity-sized arrays would therefore need stride arithmetic and an options object, which
  is more code and more concepts than `new Float32Array(count * 4)`, for a gain nobody has measured.
  The arrays are sized to the live window count, typically a handful.

## Interaction experiments

- **L-shaped widgets:** explore non-rectangular rendering, hit testing, selection, and layout.
- **Camera rig:** explore one framework-owned API for camera control, framing, navigation,
  constraints, and coordinated transitions.
