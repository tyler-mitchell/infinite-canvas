# Recursive Navigation

How a canvas that contains mini-apps — which themselves contain canvases — stays addressable,
shareable, and mountable at bounded cost.

Objective: one navigation model that survives unbounded containment depth and continuous zoom,
built from TanStack Router affordances rather than a bespoke navigator.

Target identity: `@tanstack/react-router` 1.170.32. Retrieved 2026-09-09.

**Scope: none of this is implemented in `polkadot-ui`, and none of it is owed by it.** The package
is a component kit with no canvas, no camera and no zoom; its lab app has nine flat routes that
demonstrate components. What survives here is the router research — which affordances exist at
1.170.32, verified against the installed package — and a design for whatever owns a canvas. The
route trees and components below are targets for that owner, not descriptions of this app.

## The three things that feel like routing and are not the same thing

Recursion looks impossible while these stay merged. Separating them is the whole design.

| Concern         | Question it answers                               | Lives in      | Changes at      |
| --------------- | ------------------------------------------------- | ------------- | --------------- |
| **Containment** | which widget is inside which canvas               | document data | edit rate       |
| **Focus**       | which node the camera is looking at, and how deep | URL path      | navigation rate |
| **Camera**      | pan and zoom inside the focused frame             | URL search    | pointer rate    |

Containment is dynamic and unbounded; a route tree is static and finite. So containment must not
be expressed as routes. Focus is a _path through_ the containment tree, and that is what a route
can carry.

## One splat route absorbs unbounded depth

The route tree stays flat. Depth lives in the path.

```txt
app/routes/                          target — a canvas owner's route tree, not this package's
├── __root.tsx        the shell
├── index.tsx         /              the root canvas, focus depth 0
└── w.$.tsx           /w/$_splat     a focus path of any depth
```

```tsx
// app/routes/w.$.tsx — target
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/w/$")({
  // The route never learns the depth. It hands the whole tail to the canvas.
  component: () => {
    const { _splat } = Route.useParams();
    return <CanvasFrame path={(_splat ?? "").split("/").filter(Boolean)} />;
  },
});
```

`/w/deck/mail/thread-4` yields `_splat = "deck/mail/thread-4"`.

Each canvas level renders the frame at its own index and hands the **whole stack** down. Recursive
descent, not a registry:

```tsx
// target
function CanvasFrame({ frames, index }: { frames: FrameStack; index: number }) {
  const frame = frames[index];
  if (!frame) return null;
  const focused = index === frames.length - 1;

  return (
    <Canvas>
      {useWidgetsOf(frame.id).map((widget) => (
        <Widget key={widget.id} id={widget.id}>
          {/* A widget that is itself a canvas continues the same descent one level down. */}
          {widget.kind === "canvas" && !focused ? (
            <CanvasFrame frames={frames} index={index + 1} />
          ) : (
            <WidgetBody widget={widget} />
          )}
        </Widget>
      ))}
    </Canvas>
  );
}
```

**Descend by index, never by consuming a tail.** The obvious shape — destructure `[head, ...tail]`
and recurse on `tail` — leaves every level blind to its own prefix, so no level can build an
absolute link. Measured in the probe below: the deepest frame emitted
`/w/thread-4/level-1` where `/w/deck/mail/thread-4/level-3` was correct. The bug is silent, because
each level's _own_ rendering is right; only links and any absolute address are wrong.

Status: was runtime-proven, no longer reproducible here. Observed 2026-09-09 in a lab route
`app/routes/w.$.tsx` that has since been removed; the lab app now demonstrates the component kit
rather than recursive routing. The finding stands on the transcript below, not on anything you can
re-run in this package today.

```sh
curl -s http://localhost:3210/w/deck/mail/thread-4/level-3/level-4/level-5
```

```txt
depth 6 · /w/deck/mail/thread-4/level-3/level-4/level-5
deck      depth 0
mail      depth 1
thread-4  depth 2
level-3   depth 3
level-4   depth 4
level-5   depth 5
descend → /w/deck/mail/thread-4/level-3/level-4/level-5/level-6
```

The splat param is named `_splat`, one route definition absorbed six levels with no per-depth
registration, and the absolute descend link is correct at every depth.

**One Router instance, one URL.** A nested canvas is not a nested router. A second router forks
history and breaks back/forward, and nothing in Router asks for one — `useMatches`,
`useParentMatches` and `useChildMatches` already expose the match chain.

## The frame stack is the thing the splat serializes

The ordered list of coordinate frames from root canvas to focused node needs a name of its own,
because it is not the route match chain — it is the _containment_ match chain.

```ts
// target
interface Frame {
  readonly id: string;
  /** The node's rect in its parent's coordinate space. */
  readonly rect: Rect;
  readonly camera: Camera;
}

/** Root first, focused node last. `frames.length - 1` is the focus depth. */
type FrameStack = readonly Frame[];
```

The URL carries the ids; the rects come from document data; the cameras come from search. That
split is why the URL stays short as depth grows.

## Mounting is a virtualized list along the zoom axis

This is what makes unbounded depth tractable: depth is unbounded in the data and in the URL, and
**bounded in the React tree**. A window of live levels travels with the focus.

| Distance from focus | State  | What exists                                   |
| ------------------- | ------ | --------------------------------------------- |
| 0                   | live   | full subtree, interactive                     |
| ±1                  | warm   | mounted, `pointer-events: none`, reduced work |
| ±2                  | proxy  | a painted stand-in, no subtree                |
| beyond              | absent | id and rect only                              |

Two constraints on that table, both already paid for once in the design POC this package was
seeded from:

- **Promotion is hysteretic.** Promote at one threshold and demote at a wider one, or a widget
  sitting on the boundary thrashes mount and unmount. The POC's detail level demotes below 120px
  and restores above 160px on the smaller on-screen axis.
- **Cross-fade, never swap.** Swapping proxy for live loses caret, scroll and focus, and costs a
  layout exactly while the camera is moving.

Status: target. The thresholds are inherited from the POC, not re-derived, and they cannot be
re-derived here: measuring a promote-and-demote boundary needs a canvas that mounts levels, and
this package has none. Whoever builds one should measure rather than adopt 120 and 160.

## Route masking is how a mini-app gets its own deep link

Zooming a mini-app to fill the viewport puts two truths in conflict: the render should stay
"canvas with a widget zoomed in" so zooming out is continuous, while the URL should be the
mini-app's own address so it can be shared and reloaded.

`createRouteMask` resolves exactly that — render one route, display another URL.

```tsx
// app/router.tsx — target
import { createRouteMask, createRouter } from "@tanstack/react-router";

const focusedAppMask = createRouteMask({
  routeTree,
  from: "/w/$",
  // Displayed while the canvas stays mounted underneath.
  to: "/app/$appId",
  params: true,
});

export function getRouter() {
  return createRouter({ routeTree, routeMasks: [focusedAppMask] });
}
```

On reload the masked URL loads the mini-app standalone. That is the correct outcome rather than a
limitation: a deep link to a mail thread should open the mail thread, and it can then walk its
parent chain and reconstitute the canvas behind it.

Confirmed present at 1.170.32 (`src/index.tsx`): `createRouteMask` (line 263), the `RouteMask`
type (217), `ToMaskOptions` (157), `InferMaskTo` (321) and `InferMaskFrom` (322).

Status: observed in the export surface; masking behaviour across reload is not yet runtime-proven.

## Camera state belongs in search, behind a compact codec

Pan and zoom change at pointer rate and must not write history per frame.

```tsx
// target
export const Route = createFileRoute("/w/$")({
  validateSearch: type({ "cam?": "string" }),
  // Keeps the camera across navigations instead of re-deriving it per route.
  search: { middlewares: [retainSearchParams(["cam"])] },
});
```

```tsx
// Camera commits replace; only a focus change earns a history entry.
navigate({ search: (prev) => ({ ...prev, cam: encode(camera) }), replace: true });
```

A deep camera state would otherwise become a long query string, so the codec is swappable rather
than hand-rolled into the component:

```tsx
createRouter({
  routeTree,
  parseSearch: parseSearchWith(decodeCamera),
  stringifySearch: stringifySearchWith(encodeCamera),
});
```

Confirmed present at 1.170.32: `retainSearchParams`, `stripSearchParams` (lines 24-25),
`defaultParseSearch`, `defaultStringifySearch`, `parseSearchWith`, `stringifySearchWith` (14-17),
`SearchMiddleware` (76), `createSerializationAdapter` (26), `composeRewrites` (344).

Status: observed in the export surface.

## The invariant that makes the recursion real

> Any view is reconstructible from its URL alone.

```txt
/w/deck/mail/thread-4?cam=<codec>
```

If a view cannot be restored from its URL, the nesting is decorative — nested divs, not a
recursive universe. This is the acceptance test for the navigation model and it is checkable.

## Open gaps

Every one of these belongs to whatever owns a canvas, which is not this package — see the scope
note at the top. They are written down so that owner does not re-derive them, not as work pending
here. This package has no route to probe at depth four and nothing to mount a window of.

- Runtime-prove masking across reload, and decide what "walk the parent chain" reads from.
- Decide whether `composeRewrites` should shorten deep paths, or whether ids stay literal.
- The mount-window thresholds are inherited from a DOM design POC. They need re-deriving once
  widgets draw through the GPU world, where the cost curve is different.
- Sound is out of scope here but shares the focus signal; a frame change is the event both the
  motion system and the audio layer will subscribe to.

Nothing to resume in `polkadot-ui`. For the owner of a canvas: a runtime probe of `/w/$` at depth
four, then the mount-window policy.
