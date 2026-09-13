# Layout container

Objective: a group whose member rects come from a layout scheme instead of free placement, with
content-sized members and animated reflow on the DOM plane. The portfolio board is the first
consumer. Nothing in this design names the portfolio.

Status: the model, solver, measurement path, spans, body-drag move, reorder inside masonry, and
the lock capability are implemented on `main` (2026-09-12, uncommitted). Placement, measurement,
and reflow were seen live; spans, body-drag, and reorder were not. The animation owner is not
built: a JavaScript spring on the world rect was built and removed the same day, because it wrote
width and height every frame and baked the camera into every window transform. The Animate
section below is the corrected target. Reference reading is listed at the end.

## Implementation map

| Build need | Owner | Precedent | Status |
| --- | --- | --- | --- |
| Layout scheme on a group | `InfiniteCanvasGroupContainerNode.layout` gains `"masonry"` with `masonry: { gap, tracks }` | Figma auto layout: a frame carries the layout mode | typechecked, tested |
| Container grows with content | group `sizing.height: "hug"` takes the solved root extent | Figma "hug contents" on a frame | typechecked, tested |
| Member sizes | `InfiniteCanvasWindow.sizing.height`: `fixed` or `hug`. Width is the track in masonry; `fill` waits for flex | Figma sizing modes | typechecked, tested |
| Content size into the model | one `ResizeObserver` per hugging body in the Body slot, `window.reportContentSize` action | React Native: Yoga solves, leaves supply a measure function | typechecked, not seen live |
| Placement | CSS Grid Level 3 masonry rule: next item goes into the track with the smallest running extent | drafts.csswg.org/css-grid-3 | tested |
| Order | child index in the group tree; drag inside the container reorders | existing `reorderGroupChild` | observed |
| Animated reflow | camera on the layer element, world transforms on frames, CSS transitions with a spring `linear()` easing | handoff lesson 3: JS owns state transitions, CSS owns the tween | target; a JS spring version was built and removed |
| Lock a board | `InfiniteCanvasWindowCapability` gains `"movable"` | existing capability flags | typechecked, tested |
| Presentation | consumer composes recipes, camera navigation, detail levels | existing | observed |
| First consumer | a board route in `packages/polkadot-ui/app` (owner decision 2026-09-12) | — | target |

## Model

```ts
// packages/infinite-canvas/src/group-tree.ts — target
type InfiniteCanvasGroupLayoutMode = "accordion" | "masonry" | "split" | "tabs";

type InfiniteCanvasGroupContainerNode = Readonly<{
  activeChildId: string | null;
  axis: InfiniteCanvasGroupAxis;
  children: readonly InfiniteCanvasGroupNode[];
  id: string;
  kind: "container";
  layout: InfiniteCanvasGroupLayoutMode;
  /** Masonry only. Track count and gap are model values, not measurements. */
  masonry?: Readonly<{ gap: number; tracks: number }>;
  weight: number;
}>;
```

```ts
// packages/infinite-canvas/src/types.ts — target
type InfiniteCanvasSizingMode = "fill" | "fixed" | "hug";

type InfiniteCanvasWindow<Kind extends string = string, Data = unknown> = Readonly<{
  // ...existing fields
  /** Absent means fixed on both axes, which is today's behavior. */
  sizing?: Readonly<{ height?: InfiniteCanvasSizingMode; width?: InfiniteCanvasSizingMode }>;
  /** Last measured content size. Written only by `reportWindowContentSize`. */
  contentSize?: InfiniteCanvasSize;
}>;

type InfiniteCanvasWindowCapability =
  | "closable"
  | "maximizable"
  | "minimizable"
  | "movable"
  | "resizable";

type InfiniteCanvasGroup = Readonly<{
  // ...existing fields
  /** `hug` lets the solver set the group height from its content. */
  sizing?: Readonly<{ height?: "fixed" | "hug" }>;
}>;
```

## Solve

The existing solver walks the tree and pushes member placements into a draft. Masonry is one more
branch beside split, tabs, and accordion.

```ts
// packages/infinite-canvas/src/group-layout.ts — target
function solveMasonryContainer(
  container: InfiniteCanvasGroupContainerNode,
  rect: InfiniteCanvasRect,
  sizes: ReadonlyMap<string, InfiniteCanvasSize>, // measured content sizes by window id
  draft: InfiniteCanvasGroupLayoutDraft,
  isHidden: boolean,
) {
  const { gap, tracks } = container.masonry ?? { gap: 0, tracks: 1 };
  const trackWidth = (rect.width - gap * (tracks - 1)) / tracks;
  const running = new Array<number>(tracks).fill(rect.y);

  for (const child of container.children) {
    // CSS Grid Level 3: place into the track whose running position is smallest.
    const track = running.indexOf(Math.min(...running));
    const height = sizes.get(child.id)?.height ?? 0; // hug: measured; fixed: window.rect.height
    const placement = {
      height,
      width: trackWidth,
      x: rect.x + track * (trackWidth + gap),
      y: running[track]!,
    };

    solveInfiniteCanvasGroupNode(child, placement, sizes, draft, isHidden);
    running[track] = placement.y + height + gap;
  }

  draft.extent.set(container.id, Math.max(...running) - gap - rect.y);
}
```

The solver signature grows by one argument, the measured sizes. `getInfiniteCanvasGroupProjection`
in group-state.ts already runs the solver after every group mutation and writes member rects; a
hugging group additionally takes its height from `draft.extent`.

## Measure

```tsx
// packages/infinite-canvas/src/window-frame.tsx — target, inside the frame for a hugging window
useLayoutEffect(() => {
  const body = bodyRef.current;
  if (body === null || window.sizing?.height !== "hug") return;
  const observer = new ResizeObserver(([entry]) => {
    const { blockSize, inlineSize } = entry!.contentBoxSize[0]!;
    actions.reportWindowContentSize({ windowId: window.id, size: { height: blockSize, width: inlineSize } });
  });
  observer.observe(body);
  return () => observer.disconnect();
}, [actions, window.id, window.sizing?.height]);
```

`reportWindowContentSize` is a reducer action that writes `contentSize` and re-runs the group
projection. It is not an undo entry. A card animating its own height reports every frame; the
solver is linear in members, so a re-solve per frame is acceptable for tens of cards.

## Animate

Rule, from the design handoff (`docs/handoff/design_handoff_scatter_canvas/README.md`, lesson 3):
JavaScript owns state transitions, CSS owns the tween. A per-frame JavaScript loop over
`style.transform` read as 25fps in a throttled host; the same motion as one CSS transition did not.

Today every window bakes the camera into its own transform
(`translate(screenX, screenY) scale(zoom)` in window-frame.tsx and group-layer.tsx). A CSS
transition on that transform would tween the camera too, so the structure has to change before a
tween can exist:

```tsx
// packages/infinite-canvas/src/infinite-canvas.tsx — target: one camera transform on the layer
<div style={{ transform: `translate(${originX}px, ${originY}px) scale(${camera.zoom})`, transformOrigin: "0 0" }}>
  {windows.map((window) => <InfiniteCanvasWindowFrame ... />)}
</div>
```

```tsx
// packages/infinite-canvas/src/window-frame.tsx — target: world units only, tweened by CSS
style={{
  height: `${rect.height}px`,
  transform: `translate(${rect.x}px, ${rect.y}px)`,
  // Off while the pointer owns the rect, so a drag never lags the hand.
  transition: isInteracting ? "none" : "transform var(--icx-layout-duration) var(--icx-layout-easing), height ..., width ...",
  width: `${rect.width}px`,
}}
```

The easing is a spring rendered as CSS `linear()`; Motion's `spring()` generates that string
(`motion.dev/docs/spring`, read 2026-09-12). Position moves are compositor tweens. A size change
lays out the one element that changed, natively, with no script per frame. The camera never
transitions.

Open before this is built: the per-window screen-pixel snapping and the `--icx-*` screen-length
variables read `screenTransform.scale` today; with the camera on the layer they read `camera.zoom`
and the snap moves to the layer origin. Read `geometry.ts` and every consumer of
`projectWorldRectToScreen` first.

## What stays with the consumer

- Which windows are movable. `capabilities: { movable: false }` on each card locks a board.
- Presentation steps. A step is "apply recipe, then `fit` this rect". Recipes already capture
  group trees (recipes.ts:71-77), so a masonry group restores with its order.
- Zoom-dependent card content, through detail levels.

## Not in this design

- Flex with wrap. It is the general case and Yoga (`yoga-layout`) is the solver for it. It lands
  on the same seams after masonry proves them: a `"flex"` mode whose branch calls Yoga with the
  measured sizes as leaf measure results.
- Drag reorder inside a masonry group. The tab strip already reorders by pointer; the same
  `reorderGroupChild` command serves masonry once a drop index is derived from placements.

## Reference reading

| Source | Needed for | Status |
| --- | --- | --- |
| Figma help: auto layout properties (sizing modes, gap, padding, wrap) | vocabulary | from memory, not re-read this session |
| CSS Grid Level 3 masonry placement (drafts.csswg.org/css-grid-3) | placement rule | from memory, not re-read this session |
| Motion docs: `useSpring`, `useMotionTemplate`, layout animations | animation owner | fetch declined this session; read before the hook is written |
| `yoga-layout` README | flex mode, later | not read |
