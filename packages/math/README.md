# `@hyphened/math`

2D mathematics for the canvas, in two execution contracts. The same operation has the same name in
both; the import path chooses the precision.

```ts
import { containsPoint, screenToWorld } from "@hyphened/math/cpu"; // f64, plain objects
import { containsPoint, screenToWorld } from "@hyphened/math/gpu"; // f32, resolves to WGSL
```

There is no root entry. The obvious import used to hand callers f32 silently, including through
`resizeRect` and `unionRects`, so precision is visible in the first line of a consumer's file or it
is not visible at all.

## Which entry

`./cpu` if the numbers touch the DOM. `./gpu` if they touch a shader.

A `tgpu.fn` rounds **both its arguments and its return value** to f32 on every CPU call — TypeGPU
maps them through `schemaCallWrapper`, and `d.f32`'s cast is `Math.fround`. Hit-testing at zoom on a
rect far from the origin needs a tenth of a pixel that f32 cannot hold, so the DOM path cannot call
the kernels at all. That is the whole reason the package has two halves.

```ts
// f64 keeps it; the kernel does not
screenToWorld({
  point: worldToScreen({ point: { x: 400.1, y: 0.1 }, camera, viewport }),
  camera,
  viewport,
});
// → { x: 400.1, y: 0.1 } within 1e-12
```

## `./cpu`

Plain objects, `number`, no TypeGPU value anywhere in a signature.

```ts
import {
  type Camera, // { center: Point; zoom: number }
  type Point, // { x: number; y: number }
  type Rect, // { x, y, width, height }
  type Size, // { width, height }
  type SizeLimits,
  type ResizeHandle,
  containsPoint,
  containsRect,
  intersectsRect,
  outsetRectBy,
  unionRect,
  unionRects,
  pruneContainedRects,
  resizeRect,
  screenToWorld,
  worldToScreen,
  visibleWorldRect,
} from "@hyphened/math/cpu";
```

Predicates are positional, `(rect, point)` or `(rect, other)`. Operations with more than two
parameters take one object:

```ts
const world = screenToWorld({ point: pointer, camera, viewport });
const hit = windows.find((window) => containsPoint(window.rect, world));

const next = resizeRect({ rect, handle, delta: { x, y }, limits: { min, max }, aspectRatio });
```

There is no `padding` argument on `containsPoint`. Outsetting the rect is the same value and keeps
one predicate shape across the library:

```ts
containsPoint(outsetRectBy(strip.rect, threshold / camera.zoom), point);
```

`./cpu` also carries what has no GPU form: the occupancy grid over a `@thi.ng/bitfield` `BitMatrix`,
the `mat23` affine primitives re-exported from `@thi.ng/matrices` (`identity23`, `translation23`,
`scale23`, `rotation23`, `mulM23`, `mulV23`, `invert23`, `concat`, `fit23`), the flow layouts from
`@thi.ng/layout` (`GridLayout`, `StackedLayout`), and the rect constructions whose results are
plain objects rather than vectors: `fitRectInto`, `alignRectIn`, `clampRectWithin`, `mapPoint`,
`unmapPoint`, `centroidOfRect`, `rectWithCentroid`, `rectCorners`, `rectFromCorners`,
`pruneContainedRects`. It re-exports `@thi.ng/math` whole, plus the 2D subset of `@thi.ng/vectors`,
`@thi.ng/geom-isec`, `@thi.ng/intervals`, `@thi.ng/grid-iterators` and `argmin` from
`@thi.ng/distance`, so a consumer needs one import.

## `./gpu`

## Layout calculations

```ts
import {
  columnOptions,
  columnItem,
  resolveColumns,
  columnSize,
  placeGridItems,
  placeLanes,
  closestRect,
  resolveTracks,
  resizeTracks,
  intrinsicSize,
} from "@hyphened/math/cpu";
```

Column schemas supply the runtime contracts and inferred types.
`placeGridItems` separates authored items from target cells. It uses
`react-grid-layout/core` for collision displacement and vertical compaction.
`placeLanes` uses `@thi.ng/layout` stacking. `closestRect` compares centers through
`@thi.ng/distance`. `intrinsicSize` adds frame space outside the content viewport.

## `./gpu`

Every runtime export resolves to WGSL. Schemas (`Rect`, `View`, `Insets`, `Transform`,
`Intersection`, `Pieces`) resolve to a struct.

```ts
import { Rect, View, containsPoint, worldToScreen } from "@hyphened/math/gpu";

const place = tgpu["~unstable"].computeFn({
  in: { gid: d.builtin.globalInvocationId },
  workgroupSize: [64],
})(({ gid }) => {
  "use gpu";
  const rect = layout.$.rects[gid.x];
  layout.$.placed[gid.x] = worldToScreen(d.vec2f(rect.x, rect.y), layout.$.camera);
});
```

`View` bundles centre, viewport and zoom so a shader binds one uniform. `Camera` on `./cpu` is
centre and zoom only, with the viewport passed separately, because the CPU has no uniform to bundle
for and consumers hold them apart.

**`Rect` and `View` need `d.align(16, ...)` as members of a uniform struct.** Both are `vec2f`-aligned
at 8; TypeGPU warns that the offsets are not portable and "will break on some devices". A run on a
software adapter passes without the align, so this is easy to miss.

## What the two halves guarantee about each other

`parity.test.ts` runs both adapters over one fixture set at a declared tolerance. `batch.inspect.ts`
puts a `d.arrayOf(Rect, n)` storage buffer through a real compute dispatch on a device and compares
every element against the f64 adapter. Nothing else is promised: the two are _not_ bit-identical,
and the suite pins that they diverge, because that divergence is why both exist.

`containsPoint` and `intersectsRect` are inclusive — a point on an edge is inside, and touching
rects intersect. `overlapsRect` is the strict form, where touching is not overlapping.

## Grounding

Every implementation names the upstream file and line range it came from, and
`citations.test.ts` reads the cited range to confirm the quoted code is actually in it. Sources are
vendored under `research/sources/`. Where no upstream says what the code says, the implementation
carries an explicit refusal instead of a citation: every export of `camera.ts`, two in `axis.ts`
and three in `rect.ts`. `citations.test.ts` also holds a list of exports that carry neither, so a
new one cannot slip in beside them.

## Peer dependency

`typegpu` is a **required** peer. `./cpu` re-exports from modules that import it at the top level, so
a consumer without it fails at import even when calling only `resizeRect`.
