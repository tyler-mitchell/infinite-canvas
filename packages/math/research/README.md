# `@hyphened/math` research

Objective: a comprehensive mathematics library whose operations hold **one semantic contract across
CPU and TypeGPU**. The 2D infinite canvas is the incubator — the first consumer that surfaces
requirements — not the scope boundary. First consumer: the layout engine rebuild in
`packages/infinite-canvas/next` (`docs/layout-engine.md`).

> **Scope correction, 2026-09-17.** Everything below this banner up to "TypeGPU runs on the CPU" was
> written against a narrower objective: "a 2D canvas math package scoped to named call sites in
> `next`". The owner corrected it. Findings about representation, naming, sources and algorithms
> still hold; the **two-tier split is on the wrong axis** and the rule "no function without a named
> call site in `next`" was the wrong filter. Both are superseded by the section named above.

## TypeGPU runs the same function on the CPU and the GPU

This is the load-bearing fact for the whole library, and it is measured, not inferred. A throwaway
test inside `packages/infinite-canvas` (which has `typegpu` as a dependency; removed after running,
because that package is not mine to edit) asserted all four of these and passed:

```ts
import { d, std } from "typegpu";

// 1. std operates on d vector instances on the CPU
expect(std.dot(d.vec2f(1, 2), d.vec2f(3, 4))).toBe(11);
expect(std.length(d.vec2f(3, 4))).toBe(5);
expect(std.mix(0, 10, 0.25)).toBe(2.5);

// 2. a 'use gpu' function is callable as plain JavaScript
const rotate = (v: d.v2f, angle: number) => {
  "use gpu";
  const c = std.cos(angle);
  const s = std.sin(angle);
  return d.vec2f(c * v.x - s * v.y, s * v.x + c * v.y);
};
const turned = rotate(d.vec2f(1, 0), Math.PI / 2); // { x: ~0, y: ~1 }

// 3. the environment probes report a CPU context
expect(std.isBeingTranspiled()).toBe(false);
expect(std.getTargetShaderLanguage()).toBe(undefined);

// 4. vector arithmetic works on the CPU
expect(std.add(d.vec2f(1, 2), d.vec2f(3, 4))).toEqual(d.vec2f(4, 6));
```

So parity between CPU and GPU is **structural, not tested into existence**: one implementation, two
execution contexts, with `std.isBeingTranspiled()` available for the rare place they must differ.

> **Correction.** An earlier version of this section claimed precision parity is structural. **It is
> not, and the claim is withdrawn.** Storage is f32 on both sides, but _arithmetic_ is not: a
> `'use gpu'` body evaluates in JavaScript's f64 on the CPU and in f32 per operation on the GPU.
> Measured, same expression `(a + b) - c` with `a = 1e7, b = 0.1, c = 1e7`:
>
> ```txt
> tgpu.fn, declared f32 return : 0.10000000149011612   f64 maths, one round on return
> plain 'use gpu' callback     : 0.09999999962747097   pure f64, never rounded
> true f32 per operation       : 0                     1e7 + 0.1 == 1e7 in f32
> ```
>
> The GPU returns 0 where the CPU returns 0.1. So **parity of the rule is structural; parity of
> numbers must be tested with a tolerance and never asserted bitwise.** Two consequences: exported
> functions use `tgpu.fn` with a declared return type, never a plain callback, so at least the
> result is rounded once; and no decision may depend on the two sides agreeing at a classification
> boundary. This was found by Fable's probe on a real headless WebGPU device and reproduced here.
>
> A second trap from the same source: constant folding runs on the CPU in f64, so a fixture built
> from **literal** arguments tests the resolver rather than the GPU. Fixture inputs must come from
> buffers.

`src/typegpu.probe.test.ts` settles the storage question. Storage is f32 on both sides, which is
still worth having — it is the layout and the round-trip that agree, not the arithmetic:

```ts
// f32 ON THE CPU, not f64 — the CPU holds the value the shader will hold
d.vec2f(0.1, 100.7).x === Math.fround(0.1); // true
d.vec2f(0.1, 100.7).x === 0.1; // false

// std computes in f32 too
std.add(d.vec2f(0.1, 0.2), d.vec2f(0.2, 0.1)).x
  === Math.fround(Math.fround(0.1) + Math.fround(0.2)); // true
  === 0.1 + 0.2;                                        // false
```

That is the trap the hand-written `{ x: number; y: number }` tier falls into and TypeGPU does not:
`Point` arithmetic runs in double precision and will not match the shader, which is the same class
of defect as the `Float32Array` rounding recorded further down, but silent and everywhere.

```ts
// WGSL text, headless, no device and no browser — the GPU side is testable in the normal suite
const lengthSquared = tgpu.fn(
  [d.vec2f],
  d.f32,
)((v) => {
  "use gpu";
  return std.dot(v, v);
});
tgpu.resolve([lengthSquared]); // "fn lengthSquared(v: vec2f) -> f32 { return dot(v, v); }"
lengthSquared(d.vec2f(3, 4)); // 25 — the same function, on the CPU
```

Two conditions on that, both load-bearing:

- **The GPU side needs the build plugin.** Without `unplugin-typegpu` in the Vite config,
  `'use gpu'` functions still run as plain JavaScript but `tgpu.resolve` returns an empty string.
  The plugin is now in this package's `vite.config.ts`; any consumer that wants WGSL needs it too.
- `tgpu.resolve({ externals })` is deprecated and returns empty; the current form is
  `tgpu.resolve([resolvable])`.

And the rectangle representation is already right, by measurement:

```ts
const Rect = d.struct({ position: d.vec2f, size: d.vec2f });
d.sizeOf(Rect); // 16 — four floats, no padding
d.alignmentOf(Rect); // 8
d.sizeOf(d.arrayOf(Rect, 4)); // 64 — stride 16, exactly RECT_STRIDE = 4
```

So the buffer tier's memory layout survives the correction intact. What changes is its owner: the
schema becomes `d.struct`, not hand-written offsets, and the same schema then types the CPU value,
the WGSL type and the buffer in one declaration.

What this costs the package as written:

- `Point = { x: number; y: number }` is the wrong currency. `d.v2f` is the type that works in both
  contexts, carries its own WGSL layout, and needs no conversion at the buffer boundary.
- Roughly thirty functions here are hand-rolled duplicates of `std`, and the `std` versions are
  strictly better because they also run on the GPU: `dot`, `cross`, `magnitude` (`std.length`),
  `distance`, `normalize`, `clamp`, `lerp` (`std.mix`), `mod`, and the `Math.*` wrappers around
  `sign`, `floor`, `round`, `fract`, `min`, `max`, `abs`, `atan2`, `smoothstep`, `step`.
- What survives as genuinely ours is the domain algebra with no WGSL equivalent: rectangles, maximal
  rectangles, occupancy, axis access, camera spaces, Hilbert order, the heap, the spring, the arc.

## Where the dual-target boundary actually falls

Established by `src/dual-target.probe.test.ts`, not by reasoning about WGSL. **An operation is
dual-target when its output shape and its iteration bounds are statically known.** That region is far
larger than it first looks, because a variable-length result reshapes into a fixed capacity plus a
count — which is what WGSL wants anyway.

The case I expected to fail is the one that matters most, and it passes. `subtractRect` is the core
of maximal-rectangles free-space search and returns zero to four pieces:

```ts
const Pieces = d.struct({ items: d.arrayOf(Rect, 4), count: d.u32 });

const subtractRect = tgpu.fn(
  [Rect, Rect],
  Pieces,
)((rect, other) => {
  "use gpu";
  const pieces = d.arrayOf(Rect, 4)();
  let count = d.u32(0);
  // ... the four maximal pieces, each guarded, each written at pieces[count]
  return Pieces({ items: pieces, count });
});
```

It resolves to WGSL and, run on the CPU, returns the same four pieces with the same geometry as the
object-tier version. Runtime-bounded loops resolve too (`for (let i = d.u32(0); i < count; i++)`),
so reductions over a range are dual-target as well.

One rule cost a resolution error and is worth carrying: **assignment copies must be explicit.**
`pieces[0] = rect` fails with "references cannot be assigned"; `pieces[0] = Rect(rect)` is correct.
TypeGPU's error message names the fix, which is the only reason this took one attempt.

What is genuinely CPU-only, then, is narrower than "anything with a list":

| Operation                                                                                               | Side | Why                                                          |
| ------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| Rectangle predicates, intersection, union of two, transforms, camera spaces, spring, arc, Hilbert index | dual | fixed shape in, fixed shape out                              |
| `subtractRect`, and any bounded-capacity result                                                         | dual | fixed capacity plus a count                                  |
| Reductions over a range or a storage buffer                                                             | dual | runtime-bounded loop                                         |
| The binary heap                                                                                         | CPU  | unbounded, pointer-chasing, grows during use                 |
| Occupancy row growth (`markArea` reallocating)                                                          | CPU  | allocation; `isAreaFree` over a fixed grid is dual           |
| An R-tree build, `pruneContainedRects`, `unionRects(Rect[])` over a JS array                            | CPU  | allocation and JS-array iteration; the buffer forms are dual |

So the package needs an explicit CPU-only region, but it is small and it is a property of the
storage, not of the mathematics.

### `mat3x3f` cannot cross the boundary in 0.12.3

A padded matrix cannot survive its own constructor, so it can be neither a `tgpu.fn` parameter nor a
`d.struct` field. `src/matrix-boundary.probe.test.ts` pins it — the defect is `mat3x3f`-specific, and
the cause is visible in one function:

```js
// typegpu@0.12.3 data/matrix.js — createMatSchema.normalImpl
for (const arg of args) {
  if (typeof arg === "number") elements.push(arg);
  // A mat3x3f instance has length 12 (padded storage), not 9.
  else for (let i = 0; i < arg.length; ++i) elements.push(arg[i]);
}
if (elements.length !== 0 && elements.length !== options.columns * options.rows) {
  throw new Error(`'${options.type}' constructor called with invalid number of arguments.`);
}
```

`tgpu.fn` coerces every argument through `schemaCallWrapper(schema, arg)` → `schema(arg)`, so passing
a `mat3x3f` always reaches that throw. Measured:

| Form                      | 2x2 | 3x3               | 4x4 |
| ------------------------- | --- | ----------------- | --- |
| instance `.length`        | 4   | **12** (9 padded) | 16  |
| `tgpu.fn` parameter       | OK  | **throws**        | OK  |
| `d.struct` field, CPU set | OK  | **throws**        | OK  |

Only `mat3x3f` is affected, because only `mat3x3f` pads.

The sharpest statement is the struct case: `d.InferInput` types a `mat3x3f` field as `m3x3f`, and an
`m3x3f` is exactly the value that throws — **the only value the type accepts is the one that fails.**
Note the copy form `schema(instance)` is not itself public API; the `.d.ts` overloads admit 0 or 3
arguments, never 1. The defect is that `tgpu.fn` and `d.struct` reach that form internally.

Status: observed, `typegpu@0.12.3`. Worth an upstream report.

**Consequence for this package: the 2D affine is a struct of three `vec2f` columns, not a matrix.**
That is also the domain-correct shape — CSS `matrix()`, Canvas2D `setTransform`, SVG `matrix()`,
`DOMMatrix` and `glam::Affine2` all carry a 3x2, never a padded 3x3. It is 24 bytes against 48, and
it sidesteps the defect rather than working around it.

```ts
export const Transform = d.struct({ xAxis: d.vec2f, yAxis: d.vec2f, origin: d.vec2f });

// Composition is the only thing a matrix would have given for free. It is three lines:
// the outer transform applied to the inner one's columns, axes as directions, origin as a point.
export const composeTransforms = tgpu.fn(
  [Transform, Transform],
  Transform,
)((outer, inner) => {
  "use gpu";
  return Transform({
    xAxis: transformDirection(outer, inner.xAxis),
    yAxis: transformDirection(outer, inner.yAxis),
    origin: transformPoint(outer, inner.origin),
  });
});
```

The direction/point split that a homogeneous matrix encodes in the `w` component becomes two named
functions, which is clearer at the call site than remembering to pass `0` or `1`.

Test strength note: a transposed inverse passes every diagonal fixture. `scaleAndShift` and the pure
scales are blind to it; only a rotation or a skew catches it. `transform.test.ts` carries both, and
breaking the inverse fails three tests where it once failed one.

## The migration keeps the vocabulary

`src/rect-schema.probe.test.ts` settles what the conversion costs. The answer is: much less than the
"rewrite everything on `d.v2f`" reading suggests, because the rectangle schema can keep its own field
names.

```ts
const Rect = d.struct({ x: d.f32, y: d.f32, width: d.f32, height: d.f32 });
const Paired = d.struct({ position: d.vec2f, size: d.vec2f });

d.sizeOf(Rect) === d.sizeOf(Paired); // true — both 16 bytes
d.sizeOf(d.arrayOf(Rect, 8)) === d.sizeOf(d.arrayOf(Paired, 8)); // true
Rect({ x: 0.1, y: 0, width: 0, height: 0 }).x === Math.fround(0.1); // f32, as the shader will hold it
```

Same sixteen bytes, same array stride, and `rect.x` / `rect.width` still read as they do today. CSS
and the DOM use `x, y, width, height`; so does every call site in `next`; so does this schema.

Predicates keep their shape too — `d.bool` is a valid return type, so no `u32` encoding leaks into
the API:

```ts
const containsPoint = tgpu.fn(
  [Rect, d.vec2f],
  d.bool,
)((rect, point) => {
  "use gpu";
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
});
```

And vector maths composes over scalar fields without a paired-vector representation:

```ts
const distanceToRect = tgpu.fn(
  [Rect, d.vec2f],
  d.f32,
)((rect, point) => {
  "use gpu";
  const nearest = d.vec2f(
    std.clamp(point.x, rect.x, rect.x + rect.width),
    std.clamp(point.y, rect.y, rect.y + rect.height),
  );
  return std.distance(point, nearest);
});
```

So the migration cost is **construction sites, not read sites**: `{ x: 0, y: 0, width: 1, height: 1 }`
becomes `Rect({ x: 0, y: 0, width: 1, height: 1 })`. Field access, function names, return types and
edge rules are all unchanged, which is why this can be one atomic flip per module rather than a
half-migrated representation.

Status: runtime-proven for the schema, the boolean return and the vector composition. The atomic
conversion of `rect.ts` itself is not done.

Adding `typegpu` as a dependency of this package needs the owner's consent.

Scope: scalars, 2D points, rectangles, axis access, affine transforms, camera spaces, free-space
search, occupancy, a rectangle index, scan-line helpers, a heap, interpolation.
Not in scope: layout algorithms (owned by `@hyphened/layout`), DOM, animation scheduling.

Exact sources are captured under `sources/`. Call sites are named by path; they are not copied.

## Implementation map

| Build need               | Source affordance                                                    | Project implication                                                                              | Status   |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| Scalar vocabulary        | `sources/thi.ng-math.interval.d.ts`, `sources/thi.ng-math.prec.d.ts` | `clamp` / `roundTo` / `mod` names; `roundTo` serves both device-pixel rounding and step snapping | observed |
| Approximate equality     | `sources/pmndrs-math.scalar.ts` `equals`                             | relative-plus-absolute epsilon, not a bare `abs(a-b) < eps`                                      | observed |
| Min/max over a list      | none in thi.ng (`extrema.d.ts` is local extrema)                     | own `minOf` / `maxOf`; d3 precedent; replaces `Math.min(...spread)` in `unionRects`              | observed |
| Rectangle representation | `sources/pmndrs-math.box2.ts`                                        | names adopted, representation rejected — see "Representation"                                    | observed |
| Vector names             | `sources/pmndrs-math.vec2.ts`                                        | `add` `subtract` `scale` `length` `distance` `normalize` `dot` `cross` `angle` `lerp`            | observed |
| Affine transform         | `sources/pmndrs-math.mat2d.ts`                                       | `[a, b, c, d, tx, ty]`; `invert` and `multiply` formulas                                         | observed |
| Rectangle index          | `sources/flatbush.index.js`                                          | packed Hilbert R-tree in one `ArrayBuffer`; reimplement, see "Index"                             | observed |
| Spatial ordering         | `sources/flatbush.index.js` `hilbert()`                              | public-domain bit-twiddle, 16-bit domain                                                         | observed |
| Spring step              | `sources/pmndrs-math.spring-core.ts`                                 | closed-form damped oscillator; **substeps are not needed** — see "Spring"                        | observed |
| Easing                   | `sources/pmndrs-math.easing.ts`                                      | pure `(t) => number`, no time ownership                                                          | observed |
| Free-space search        | `docs/research/layout-engine.md` § Q4 (Jylänki 2010 § 2.4)           | maximal rectangles = subtract + prune-contained                                                  | observed |
| Scan-line neighbours     | `docs/research/layout-engine.md` § Q4 (Dwyer et al. 2005 § 3)        | sort open/close events per axis; separation constraints                                          | observed |

## Representation

`sources/pmndrs-math.box2.ts` is min/max:

```ts
// sources/pmndrs-math.box2.ts
export type Box2 = [minX: number, minY: number, maxX: number, maxY: number];
```

Our state, the DOM and the layout contract are position-plus-size:

```ts
// packages/infinite-canvas/next/geometry.ts — current, unchanged
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rect = Point & Size;
```

Both tiers keep position-plus-size. The buffer tier is the same four numbers in order, which is
one WebGPU `vec4f`:

```ts
// target — src/buffer.ts
// stride 4: x, y, width, height
const rects = new Float32Array(capacity * 4);
```

Rejected: converting to min/max at the boundary. `thing-umbrella-evaluation` records the cost of a
half-migrated representation ("no converters ... must be one atomic flip, never per-call adapters").

Status: target

## Argument convention

Object tier takes one object argument, matching the call sites it replaces:

```ts
// packages/infinite-canvas/next/geometry.ts — current
export function containsPoint({
  rect,
  point,
  padding = 0,
}: {
  rect: Rect;
  point: Point;
  padding?: number;
}): boolean;
```

Scalars stay positional — the established mathematical signature, no field names worth stating:

```ts
// sources/thi.ng-math.interval.d.ts
export declare const clamp: FnN3; // clamp(x, min, max)
```

Buffer tier puts the output first, as both references do:

```ts
// sources/pmndrs-math.mat2d.ts
export function multiply(out: Mat2d, a: Mat2d, b: Mat2d): Mat2d;
```

Status: target

## Duplication the package removes

`clamp` and `sum` are defined privately in the layout module:

```ts
// packages/infinite-canvas/next/layout/tracks.ts:4
const clamp = ({ value, min, max }: { value: number; min: number; max: number }) =>
  Math.max(min, Math.min(max, value));

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
```

`sum` is defined a second time one directory over:

```ts
// packages/infinite-canvas/next/layout/kinds.ts:48
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
```

Axis access is private to `kinds.ts` and is written back through computed keys:

```ts
// packages/infinite-canvas/next/layout/kinds.ts:43
const axes = {
  horizontal: { position: "x", extent: "width", cross: "height" },
  vertical: { position: "y", extent: "height", cross: "width" },
} as const;

const oriented = ({ axis, along, across }: { axis: Axis; along: number; across: number }): Size =>
  axis === "horizontal" ? { width: along, height: across } : { width: across, height: along };

// kinds.ts:89 — the write form this package must type without a cast
rect: { ...rect, [position]: offsets[index], [extent]: sizes[index] }
```

`unionRects` spreads the whole list into `Math.min`, twice per axis:

```ts
// packages/infinite-canvas/next/geometry.ts:21
const x = Math.min(...rects.map((rect) => rect.x));
```

Status: observed

## Index

Flatbush is one `ArrayBuffer`: an 8-byte header, then `numNodes * 4` coordinates, then `numNodes`
indices. Level bounds are computed up front:

```js
// sources/flatbush.index.js:63
let n = numItems;
let numNodes = n;
this._levelBounds = [n * 4];
do {
  n = Math.ceil(n / this.nodeSize);
  numNodes += n;
  this._levelBounds.push(numNodes * 4);
} while (n !== 1);
```

`finish()` maps each item centre into a 16-bit Hilbert domain, sorts, then packs parents bottom-up:

```js
// sources/flatbush.index.js:164
const hilbertMax = (1 << 16) - 1;
const sx = hilbertMax / width;
const sy = hilbertMax / height;
const x = (sx * ((itemMinX + itemMaxX) / 2 - minX)) | 0;
const y = (sy * ((itemMinY + itemMaxY) / 2 - minY)) | 0;
hilbertValues[i] = hilbert(x, y);
```

Two details a reimplementation must keep, both easy to miss:

```js
// sources/flatbush.index.js:295 — a fully-contained subtree is one contiguous leaf range,
// so the traversal is skipped entirely rather than descended
let pos = nodeIndex;
for (let l = level; l > 0; l--) pos = indices[pos >> 2];
const leafEnd = Math.min(pos + (end - nodeIndex) * this.nodeSize ** level, numItems4);
```

```js
// sources/flatbush.index.js:337 — nodes and leaves share one queue; the LSB tags a leaf
q.push((boxes.length - 4) << 1, 0);
```

Costs of reimplementing rather than depending on `flatbush@4.6.2`:

- It stores `minX, minY, maxX, maxY`; our rects are `x, y, width, height`. Either the index converts
  on `add` (a per-item conversion, acceptable at build time) or it stores our layout and adjusts the
  four comparisons in `search` and `neighbors`.
- `neighbors` needs a priority queue. Flatbush imports `flatqueue`; the brief already requires a heap
  for overlap removal, so one heap serves both and the dependency disappears.
- Default `ArrayType` is `Float64Array`. A GPU-readable buffer wants `Float32Array`; the Hilbert
  quantisation is already 16-bit, so ordering is unaffected, but stored coordinates lose precision.
- `sort` is a hand-written 3-median quicksort over three parallel arrays, ~30 lines.

**Decision: the R-tree is not built.** `search` and `neighbors` are satisfied by linear scans over the
same `Float32Array` — `intersectingIndices` and `nearestIndices` in `src/buffer.ts`. `hilbertOrder`
ships, because stable spatial ordering of a GPU buffer is its own consumer.

**The crossover is UNMEASURED.** An earlier note of mine put it near 10^5 rectangles with per-query
figures in microseconds; those were arithmetic, not a benchmark, and are withdrawn. What is actually
known: Flatbush's own README measures 1,000,000 rectangles indexed in 109 ms and 10,000 small
searches in 31-150 ms on an M1 Pro. Nothing here has been timed. Before anyone trades ~150 lines for
the tree, measure the linear scan at the real rectangle count on the real path.

Status: observed, except the crossover, which is unresolved

## Spring

The design handoff records a spring that diverged at a 95 ms tick and was fixed with fixed 16 ms
substeps. That is the signature of numeric integration. The closed-form solution has no such failure:

```ts
// sources/pmndrs-math.spring-core.ts:17
export function coefficients(smoothTime: number, dampingRatio: number, delta: number): void {
  const omega = 2 / Math.max(0.0001, smoothTime);

  if (Math.abs(dampingRatio - 1) < 1e-4) {
    // critically damped — a double root at -omega
    const e = Math.exp(-omega * delta);
    coef.pp = e * (1 + omega * delta);
    coef.pv = e * delta;
    coef.vp = -e * omega * omega * delta;
    coef.vv = e * (1 - omega * delta);
  }
  // under-damped and over-damped branches omitted here; see the captured file
}
```

`delta` appears only inside `Math.exp`, `Math.cos` and `Math.sin`, so the map is exact and stable at
any step. Substeps are therefore not built: the brief's "fixed 16 ms substeps" requirement is
satisfied by removing the integrator, not by scheduling it.

Status: runtime-proven. `interpolate.test.ts` steps one long `delta` against many short ones and
they agree; replacing the body with semi-implicit Euler fails that test, the 95 ms stability test and
the no-overshoot test, and reverting makes all three pass.

## Coverage

| Area                                                                        | State                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| thi.ng `math` surface (`interval`, `fit`, `prec`, `eqdelta`, `mix`, `step`) | captured                                                              |
| thi.ng `vectors`, `matrices`, `geom-isec`, `geom-closest-point`             | evaluated secondhand only (memory note `thing-umbrella-evaluation`)   |
| thi.ng `heaps`, `morton`, `intervals` READMEs                               | read; `.d.ts` not captured                                            |
| pmndrs/math `box2`, `vec2`, `mat2d`, `scalar`, `spring-core`, `easing`      | captured                                                              |
| pmndrs/math `segment2`, `polygon2`, `circle`                                | not read                                                              |
| Flatbush source and README                                                  | captured                                                              |
| wgpu-matrix                                                                 | README only; `dst`-last, not `dst`-first — see note below             |
| gl-matrix                                                                   | not read directly; reached through pmndrs/math, which is a port of it |
| Jylänki 2010, Dwyer et al. 2005, CSS Grid 2 § 8.5                           | read in `docs/research/layout-engine.md`, not re-read here            |

Correction to the brief: wgpu-matrix puts `dst` **last**, not first — "an optional destination
parameter as the final argument". thi.ng and pmndrs/math put the output first. The buffer tier
follows thi.ng and pmndrs/math (output first).

Correction to the brief: `mathcat`'s successor `pmndrs/math` does have a `box2` module, captured
here. The brief's "no `box2`" holds for `mathcat` itself, which was not read.

## Modules built

Adopt from these signatures; the source adds nothing a caller needs.

```ts
// src/scalar.ts
export const EPSILON = 1e-6;
export function clamp(value: number, min: number, max: number): number; // min wins when the bounds cross
export function lerp(from: number, to: number, amount: number): number; // exact at 0 and 1
export function norm(value: number, from: number, to: number): number; // 0 for an empty range
export function sum(values: readonly number[]): number;
export function minOf(values: readonly number[]): number; // Infinity when empty
export function maxOf(values: readonly number[]): number; // -Infinity when empty
export function roundTo(value: number, step: number): number; // device pixels: roundTo(v, 1 / scale)
export function mod(value: number, length: number): number; // always non-negative
export function approxEquals(a: number, b: number, epsilon?: number): boolean;
```

```ts
// src/vector.ts
export type Point = { x: number; y: number };
export function addPoints(a: Point, b: Point): Point;
export function subtractPoints(a: Point, b: Point): Point;
export function scalePoint(point: Point, factor: number): Point;
export function dot(a: Point, b: Point): number; // distance along a direction
export function cross(a: Point, b: Point): number; // signed distance across it
export function magnitude(point: Point): number;
export function distance(a: Point, b: Point): number;
export function normalize(point: Point): Point; // zero vector in, zero vector out
export function angle(point: Point): number; // atan2(y, x)
export function lerpPoint(from: Point, to: Point, amount: number): Point;
```

```ts
// src/size.ts
export type Size = { width: number; height: number };
export type FitMode = "contain" | "cover" | "horizontal" | "vertical";
export function fitScale(input: { size: Size; within: Size; mode: FitMode }): number;
```

```ts
// src/axis.ts — replaces the private `axes` table and `oriented` in next/layout/kinds.ts
export type Axis = "horizontal" | "vertical";
export const axes: Record<Axis, AxisFields>; // main, cross, mainPosition, crossPosition, crossAxis
export function sizeOnAxis(input: { axis: Axis; main: number; cross: number }): Size;
export function placeOnAxis(input: {
  axis: Axis;
  rect: Rect;
  position: number;
  extent: number;
}): Rect;
```

Reads go through the table (`rect[axes[axis].main]` types without a cast). `placeOnAxis` is the only
writer, so the computed-key spread in `kinds.ts` disappears.

```ts
// src/rect.ts
export type Rect = Point & Size;
export type Insets = { top: number; right: number; bottom: number; left: number };
export type ResizeHandle =
  "north" | "south" | "east" | "west" | "north-east" | "north-west" | "south-east" | "south-west";

export function centerOfRect(rect: Rect): Point;
export function areaOfRect(rect: Rect): number;
export function aspectRatioOfRect(rect: Rect): number;
export function containsPoint(input: { rect: Rect; point: Point; padding?: number }): boolean;
export function containsRect(input: { rect: Rect; other: Rect }): boolean;
export function intersectsRect(input: { rect: Rect; other: Rect }): boolean; // edge contact counts
export function overlapsRect(input: { rect: Rect; other: Rect }): boolean; // needs shared area
export function intersectionRect(input: { rect: Rect; other: Rect }): Rect | null;
export function unionRects(rects: readonly Rect[]): Rect | null;
export function gapBetweenRects(input: { rect: Rect; other: Rect }): Point; // negative is the overlap
export function insetRect(input: { rect: Rect; by: number | Insets }): Rect; // extents floor at 0
export function outsetRect(input: { rect: Rect; by: number | Insets }): Rect;
export function translateRect(input: { rect: Rect; by: Point }): Rect;
export function scaleRectAbout(input: { rect: Rect; origin: Point; factor: number }): Rect;
export function clampPointToRect(input: { point: Point; rect: Rect }): Point;
export function clampRectWithin(input: { rect: Rect; bounds: Rect }): Rect; // oversized aligns to the min edge
export function alignRectIn(input: { bounds: Rect; size: Size; align: Point }): Rect; // align is a fraction per axis
export function approxEqualsRect(input: { rect: Rect; other: Rect; epsilon?: number }): boolean;
export function lerpRect(input: {
  from: Rect;
  to: Rect;
  amount: number;
  sizeAmount?: number;
}): Rect;
export function resizeRect(input: {
  rect: Rect;
  handle: ResizeHandle;
  delta: Point;
  minSize: Size;
  maxSize?: Size;
  aspectRatio?: number;
}): Rect;
```

Two deliberate omissions from the brief's rectangle list:

- **Placement regions** (halves, quarters, centre, fill) stay with the consumer. `alignRectIn` is the
  geometry; the region-to-size table in `next/placement.ts` is policy about how big a dropped window
  should be, which is not mathematics.
- **`overlapOfRects`** is `gapBetweenRects` negated, so it would be an indirection. Dwyer's rule
  ("an x constraint only when the x overlap is smaller than the y overlap") reads directly off the
  signed gap.

`corners` and `edges` are not built: no call site asks for them. Alignment candidate lines will be
built with the snapping module, from edge fractions, which is what `next/alignment.ts` already does.

### Free space: subtraction and pruning

```ts
// src/rect.ts — the maximal-rectangles substrate
export function subtractRect(input: { rect: Rect; other: Rect }): Rect[]; // 0 to 4 maximal pieces
export function pruneContainedRects(rects: readonly Rect[]): Rect[];
```

Source read before writing: `sources/maxrects.MaxRectsBinPack.cpp`, `SplitFreeNode` and
`PruneFreeList` (Jylänki's own implementation of section 2.4). Three details it settles:

```cpp
// sources/maxrects.MaxRectsBinPack.cpp — SplitFreeNode
// 1. the overlap test is edge-EXCLUSIVE: a touching neighbour splits nothing
if (usedNode.x >= freeNode.x + freeNode.width || usedNode.x + usedNode.width <= freeNode.x ||
    usedNode.y >= freeNode.y + freeNode.height || usedNode.y + usedNode.height <= freeNode.y)
    return false;

// 2. each piece starts as a copy of the whole free rectangle and changes ONE field,
//    so it keeps the full opposite extent and is maximal; the pieces overlap each other
Rect newNode = freeNode;
newNode.height = usedNode.y - newNode.y;
```

3. Containment pruning runs twice in the reference — among the new pieces, then new against old.
   `pruneContainedRects` over one list covers both, at the same O(n²).

Two divergences, both deliberate:

- `subtractRect` returns `[rect]` when the two do not overlap, where `SplitFreeNode` returns `false`
  and leaves the caller to keep the original. Set difference is the honest contract and it removes a
  branch from every call site.
- Pruning is a separate function over a list, not folded into insertion. The caller decides when to
  pay for it; the search loop (scoring rule, anchor) belongs to the layout package, not here.

The test that matters is the sampled form of Jylänki's Proposition 7: every probe rectangle that
fits in the free area fits inside **one** returned piece. A non-maximal split passes the shape tests
and fails that one.

Status: runtime-proven. Edge contact needed a partial-extent neighbour to test: a full-height
touching neighbour produces the same answer under an edge-inclusive test, so the first version of
that test passed against the bug.

### Occupancy grid

```ts
// src/occupancy.ts — cell units; one bit per cell, rows padded to whole 32-bit words
export type GridPosition = { column: number; row: number };
export type GridSpan = { columns: number; rows: number };
export type GridArea = GridPosition & GridSpan;
export type OccupancyGrid = { columns: number; words: Uint32Array };

export function createOccupancyGrid(input: { columns: number; rows?: number }): OccupancyGrid;
export function occupancyRows(grid: OccupancyGrid): number;
export function isAreaFree(input: { grid: OccupancyGrid; area: GridArea }): boolean;
export function markArea(input: { grid: OccupancyGrid; area: GridArea }): OccupancyGrid;
export function findFreeArea(input: {
  grid: OccupancyGrid;
  span: GridSpan;
  from?: GridPosition;
}): GridPosition | null;
```

`markArea` writes into the buffer and returns the grid to use next — a different object when rows
were added. Always rebind. This is the flat tier, so it mutates and uses loop variables.

Source: `sources/css-grid-2.8.5-auto-placement.txt`, extracted from the specification. It makes
exactly three demands of the structure:

```txt
// sources/css-grid-2.8.5-auto-placement.txt:105
Increment the column position of the auto-placement cursor until either this item's grid area
does not overlap any occupied grid cells, or the cursor's column position, plus the item's
column span, overflow the number of columns in the implicit grid
```

```txt
// sources/css-grid-2.8.5-auto-placement.txt:114
Otherwise, increment the auto-placement cursor's row position
(creating new rows in the implicit grid as necessary),
set its column position to the start-most column line
```

`findFreeArea` is that loop, and nothing more. **The cursor is the caller's state**, which is the
whole sparse-versus-dense difference: sparse carries the cursor between items, dense resets it to
the start. Passing `from` or omitting it selects the packing, so no `dense` flag is needed here and
the flow policy stays in the layout package.

Rows past the end are implicit and always free, so a span that fits the width can never fail to
place: `findFreeArea` returns `null` only when the span is wider than the grid, which the spec says
the caller prevents by widening the grid first ("If the largest column span ... is larger than the
width of the implicit grid, add columns to the end").

Status: runtime-proven. The test that carries it is an end-to-end dense placement of eight spans
followed by an all-pairs overlap check.

### Buffer tier

```ts
// src/buffer.ts — 4 floats per rectangle, which is one WebGPU vec4f
export const RECT_STRIDE = 4;
export function createRectBuffer(capacity: number): Float32Array;
export function writeRect(rects: Float32Array, index: number, rect: Rect): void;
export function readRect(rects: Float32Array, index: number): Rect;
export function boundsOfRects(rects: Float32Array, count: number): Rect | null;
export function intersectingIndices(rects: Float32Array, count: number, query: Rect): number[];
```

The id-to-index map is the caller's, as the brief sets out. `count` is passed rather than derived
from `rects.length`, because a buffer is sized to capacity and filled to a count.

The tier boundary is held by agreement tests, not by inspection: `boundsOfRects` is asserted equal
to `unionRects`, and `intersectingIndices` equal to filtering with `intersectsRect`, over the same
sample. A drift in either edge rule fails there. Edge-inclusive intersection is the rule both use;
switching the buffer form to edge-exclusive fails the agreement test on a zero-area query that
touches a rectangle's right edge.

Not built, and why: `transformRects` and `lerpRects` over a range have no caller yet. They are three
lines each on top of `transformRect` and `lerpRect`, and building them now would be machinery with
no consumer. Ask and they land.

Status: runtime-proven.

### Precision is the tier boundary

`Float32Array` rounds; the object tier is `number`, which is f64. That is the only semantic
difference between the tiers, and it is real:

```ts
writeRect(buffer, 0, { x: 0.1, y: 0.2, width: 100.7, height: 50.3 });
readRect(buffer, 0); // { x: 0.10000000149011612, ... } — not the rectangle that went in
```

So the agreement tests assert two different things, and the first one alone is a trap:

```ts
// exact, because every value in `exact` is representable in f32
expect(boundsOfRects(buffer, count)).toEqual(unionRects(exact.slice(0, count)));

// approximate, because these values are not
expect(approxEqualsRect({ rect: fromBuffer, other: fromObjects, epsilon: 1e-6 })).toBe(true);
```

The first version of this suite had only the exact form, and it was green — because the sample was
accidentally made of f32-exact values (`100`, `-40`, `0.25`, `7.5`). Swapping one for `100.7` fails
it. A passing test over a lucky sample.

**Consequence for consumers: a rectangle that round-trips through the buffer tier is not `===` the
one that went in.** Any "did this change?" check across that boundary uses `approxEqualsRect`.

The same hazard, one layer down, is recorded in the owner's own adapter:
`kek-monorepo/packages/arktype-adapters/src/typegpu/index.ts:167` — "The ABI serializer WRAPS
out-of-range values silently (measured: -1 packs as 4294967295)", which is why every integer keyword
there carries both bounds.

Status: runtime-proven.

### WGSL layout is TypeGPU's, not this package's

This package must not carry a table of WGSL alignments. `typegpu` is already a dependency of
`packages/infinite-canvas` and a catalog entry, and it computes layout. Measured here rather than
read off a specification:

```txt
$ node -e 'import * as d from "typegpu/data"' …
vec2f      size 8    align 8
vec4f      size 16   align 16
mat2x2f    size 16   align 8
mat3x3f    size 48   align 16      // 12 floats, not 9 — the classic padding trap
mat4x4f    size 64   align 16
arrayOf(vec4f, 4)    size 64, stride 16
struct{3 x vec2f}    size 24   align 8
struct{vec4f, vec2f} size 32   align 16
```

Two results that settle open questions:

- **`RECT_STRIDE = 4` is right.** `arrayOf(vec4f, N)` has a 16-byte stride, which is four floats, so
  a `Float32Array` of rectangles _is_ an `array<vec4f>` with no padding and no repacking step.
- **`Transform` has no WGSL matrix type.** TypeGPU exposes only `mat2x2f`, `mat3x3f`, `mat4x4f` —
  square only, no `mat3x2f`. The six floats go as three `vec2f` columns, which measures 24 bytes with
  zero padding; `struct{vec4f, vec2f}` measures 32 and wastes eight.

When a schema for these buffers is needed, its owner is
`kek-monorepo/packages/arktype-adapters/src/typegpu` (`createTypeGpuStructFromArkTypeObject`), not a
hand-written layout here. One hazard to carry across, recorded at its line 431: **ArkType yields
object props alphabetically, and in a GPU struct field order is the memory layout** — measured 64 vs
80 bytes per instance for one row type and 144 vs 160 for another, which is why that function takes
an explicit `order`. `next` validates its document with ArkType, so this lands on any struct built
from a `next` schema.

Status: observed, by measurement.

That measurement stood, and then I overrode it: on the advice that WGSL has no `mat3x2f` I rebuilt
`transform.ts` on `d.mat3x3f`, which the defect above made unusable. The 24-byte three-column layout
measured here was right the first time. **A measurement in this document outranks later advice about
the same question.**

Shipped, dual-target, `src/transform.ts`:

```ts
export const Transform = d.struct({ xAxis: d.vec2f, yAxis: d.vec2f, origin: d.vec2f });

export const identityTransform: TgpuFn<[], typeof Transform>;
export const translationTransform: TgpuFn<[d.Vec2f], typeof Transform>;
export const scalingTransform: TgpuFn<[d.Vec2f], typeof Transform>;
export const rotationTransform: TgpuFn<[d.F32], typeof Transform>;

// Inner runs first, matching the matrix reading order it replaces.
export const composeTransforms: TgpuFn<[typeof Transform, typeof Transform], typeof Transform>;

// A direction ignores origin; a point adds it. This replaces the homogeneous w component.
export const transformDirection: TgpuFn<[typeof Transform, d.Vec2f], d.Vec2f>;
export const transformPoint: TgpuFn<[typeof Transform, d.Vec2f], d.Vec2f>;

export const transformDeterminant: TgpuFn<[typeof Transform], d.F32>; // zero means not invertible
export const invertTransform: TgpuFn<[typeof Transform], typeof Transform>; // identity when collapsed
export const transformRect: TgpuFn<[typeof Transform, typeof Rect], typeof Rect>; // AABB of 4 corners
```

`invertTransform` returns the identity for a collapsed plane rather than a null, because WGSL has no
optional return and the Finite Math Assumption bans a NaN sentinel. `transformDeterminant` is the
public invertibility test; the fallback is a defined value, not a concealed failure, and
`transform.test.ts` asserts both halves.

`transformRect` takes all four corners, so it is the true bounding rectangle under rotation and
exact under translate-plus-scale. A two-corner version passes a 90-degree test and fails at 45.

Status: runtime-proven on the CPU path, WGSL resolution asserted; no GPU device run yet.

```ts
// src/camera.ts
export type Camera = { center: Point; zoom: number };
export function cameraTransform(input: { camera: Camera; viewport: Size }): Transform; // world to screen
export function worldToScreen(input: { point: Point; camera: Camera; viewport: Size }): Point;
export function screenToWorld(input: { point: Point; camera: Camera; viewport: Size }): Point;
export function cameraShowing(input: {
  worldPoint: Point;
  screenPoint: Point;
  zoom: number;
  viewport: Size;
}): Camera;
export function zoomCameraAbout(input: {
  camera: Camera;
  screenPoint: Point;
  zoom: number;
  viewport: Size;
}): Camera;
export function visibleWorldRect(input: { camera: Camera; viewport: Size; insets?: Insets }): Rect;
export function zoomToFit(input: {
  rect: Size;
  viewport: Size;
  insets?: Insets;
  padding?: number;
  mode?: FitMode;
}): number;
```

### One conversion boundary

The brief names the conversion boundary as a past bug source. Three places in `next` write the same
formula by hand, each from a different direction:

```ts
// packages/infinite-canvas/next/state.ts:884 — wheel zoom
const offset = { x: input.point.x - viewport.width / 2, y: input.point.y - viewport.height / 2 };
center: { x: camera.center.x + offset.x / camera.zoom - offset.x / zoom, ... }

// packages/infinite-canvas/next/state.computed.ts:94 — pan drag
center: { x: pan.camera.center.x - (pointer.point.x - pan.point.x) / pan.camera.zoom, ... }

// packages/infinite-canvas/next/camera.ts:285 — navigation framing
x: rect.x + rect.width / 2 + offset.x - (insets.left + width * position.x - viewport.width / 2) / zoom
```

All three are `cameraShowing`: place the camera so that one world point lands on one screen point.
`camera.test.ts` asserts each of the three against the hand-written formula, so adoption is
behaviour-preserving, not a rewrite.

Pan is deliberately not a function here: it is `scalePoint(screenDelta, 1 / camera.zoom)` at the
call site, and wrapping that would be an indirection.

`screenToWorld` and `worldToScreen` both go through `cameraTransform`, so the DOM path and the
WebGPU path read one matrix and there is no second copy of the mapping to drift.

Status: runtime-proven — 84 tests pass, and every rule above was proved by breaking the code and
seeing its own test fail. Five tests were too weak on the first attempt and were strengthened:
`lerp` endpoint exactness, `cross` sign, `clampPointToRect` away from the origin,
`clampRectWithin` from the far side, and `transformRect` at 45 degrees.

### Interpolation

```ts
// src/interpolate.ts — no ownership of time; the caller supplies delta
export type SpringState = { value: number; velocity: number };
export function stepSpring(input: {
  state: SpringState;
  target: number;
  delta: number;
  smoothTime: number;
  dampingRatio?: number;
}): SpringState;
export function arcPoint(input: {
  from: Point;
  to: Point;
  amount: number;
  curvature: number;
}): Point;
```

**The brief asks for "a critically damped spring step with fixed substeps". The substeps are not
built, because they are not needed.** The design handoff records a spring that diverged at a 95 ms
tick and was fixed by stepping it in fixed 16 ms pieces. That is the signature of numeric
integration: semi-implicit Euler on a spring is stable only while `omega^2 * delta < 2`, and at
`smoothTime = 0.3` (`omega = 6.67`) that ceiling is a 45 ms step. A 95 ms tick is past it, so the
state runs away.

The closed-form solution of the same differential equation has no such ceiling, because `delta`
only ever appears inside `exp`, `cos` and `sin`:

```ts
// sources/pmndrs-math.spring-core.ts:22 — the critically damped branch
const decay = Math.exp(-omega * delta);
pp = decay * (1 + omega * delta);
pv = decay * delta;
vp = -decay * omega * omega * delta;
vv = decay * (1 - omega * delta);
```

Proved by substitution, not by argument: replacing `stepSpring`'s body with the semi-implicit Euler
integrator fails exactly three tests — one long step no longer equals many short ones, the 95 ms
tick no longer stays finite and inside `[0, target]`, and the critically damped case overshoots.
Reverting makes them pass. So the recorded defect is reproduced and fixed, and the test that names
it would have caught it.

Two divergences from the reference, both because this package must stay pure:

- The reference writes its four coefficients into a shared module-level `coef` object. Here the
  regime functions return them, so `stepSpring` has no hidden state and is safe to call from
  anywhere.
- The three regimes (critical, under-damped, over-damped) are a lookup of named functions rather
  than a chain of branches, which keeps the nested conditional out.

**Easing is not built.** `sources/pmndrs-math.easing.ts` is captured, but Motion owns easing in this
repo today — `next/camera.ts:185` already passes `ease: [0.22, 1, 0.36, 1]` to it — and nothing in
this package consumes an easing curve. The GPU path that would need its own evaluator does not
exist yet. A cubic-bezier solver is the piece worth owning when it does.

**A vector or rectangle spring is not built.** `stepSpring` is scalar; a `Point` or `Rect` spring is
the same step per component, and the composition is clearer at the call site than a wrapper here.

Status: runtime-proven.

## The GPU has now run this, and the harness can tell agreement from luck

This was the largest gap in the document: every claim rested on `tgpu.resolve` producing WGSL text,
which proves generation and not execution. It is closed. `src/agreement.inspect.ts` runs the exported
functions on a real WebGPU device through the `typegpu_inspector` MCP, which drives headless Chrome:

```sh
# The durable form. The same file re-runs for any agent; nothing lives only in a session transcript.
inspect_typegpu target={kind:"module", path:"packages/math/src/agreement.inspect.ts"}
```

```txt
agree    clamp, where std.clamp would give 0: gpu=10 cpu=10
agree    containScale:                        gpu=0.5 cpu=0.5
agree    cross:                               gpu=16 cpu=16
agree    transformPoint x / y:                gpu=24,-17 cpu=24,-17
agree    inverse round-trip x / y:            gpu=7,-4 cpu=7,-4
agree    gapBetweenIntervals:                 gpu=-5 cpu=-5
agree    overlapsInterval:                    gpu=1 cpu=1
agree    subtractRect piece count:            gpu=4 cpu=4
agree    subtractRect piece 0 (x,y,w,h):      gpu=0,0,100,40 cpu=0,0,100,40
agree    subtractRect piece 1 (x,y,w,h):      gpu=0,65,100,35 cpu=0,65,100,35
agree    subtractRect piece 2 (x,y,w,h):      gpu=0,0,30,100 cpu=0,0,30,100
agree    subtractRect piece 3 (x,y,w,h):      gpu=50,0,50,100 cpu=50,0,50,100
control  (1e7+0.1)-1e7:                       gpu=0 cpu=0.10000000149011612
```

**`subtractRect` is the result that matters most.** The dual-target boundary rests on the claim that
a variable-length result reshapes into a fixed capacity plus a count; that claim was previously
supported only by WGSL text and a CPU run. All four maximal free-space pieces and the count now come
back byte-identical from a device, so the maximal-rectangles core is proven on the target it was
designed for.

Three properties make that evidence rather than decoration.

**Inputs come from a uniform buffer, never literals.** The constant-folding trap recorded above says
a fixture built from literals tests the resolver in f64, not the GPU. Every value enters through
`root.createUniform(Input)`.

**The harness carries its own control, and fails if the control ever agrees.** An
agreement test that can only pass proves nothing, so the known-divergent expression runs beside the
real ones:

```ts
const cpuDrift = drifting(1e7, 0.1, 1e7);
if (gpu.drift === cpuDrift) {
  throw new Error(
    "The f32/f64 control agreed, so this harness cannot detect divergence and its passes mean nothing.",
  );
}
```

That control independently reproduces the f32/f64 divergence this document previously took on
report: the GPU returns **0** where the CPU returns **0.10000000149011612**.

**It was break-proofed.** Comparing `gpu.clamped` against a wrong constant made the run fail with
`CPU and GPU disagree: clamp, where std.clamp would give 0`, so the failure path works.

The most valuable single line is the first. `clamp(5, 10, 0) = 10` **on the device** proves the
explicit `max(low, min(high, value))` survives WGSL compilation and keeps minimum-wins, where raw
`std.clamp` leaves crossed bounds undefined. That rule was previously only argued.

Two honest limits. The adapter is SwiftShader (`gpuType: "software"`) — a real WGSL compiler and real
WebGPU semantics, but not a hardware driver, so driver-specific behaviour is still unobserved. And
**this harness cannot catch a wrong rule, only a divergent one**: both sides execute the same source,
so an incorrect `clamp` would agree perfectly. The vitest suite owns correctness; this owns
divergence. Neither substitutes for the other.

Status: runtime-proven on a software WebGPU device.

## Every export is a `tgpu.fn`, and the measurement decided it

The modules disagreed: `interval.ts` and `scalar.ts` exported plain `'use gpu'` callbacks, the rest
exported `tgpu.fn`. A callback stays polymorphic and never rounds; a `tgpu.fn` pins its WGSL
signature and rounds the result once at its declared return type. The argument for each is plausible,
so `src/rounding.inspect.ts` measures it instead: the same ten-step accumulation built both ways, run
on the device and on the CPU.

```ts
// Identical maths. The only difference is the boundary form of the inner step.
const addPinned = tgpu.fn(
  [d.f32, d.f32],
  d.f32,
)((total, step) => {
  "use gpu";
  return total + step;
});
const addLoose = (total: number, step: number) => {
  "use gpu";
  return total + step;
};
```

```txt
gpu      pinned=10000000  loose=10000000     ← both shaders agree, so this measures the CPU side
cpu      pinned=10000000  loose=10000001
error    pinned=0         loose=1
verdict  tgpu.fn is closer to the GPU
```

Ten composed steps are enough for the callback to drift a full unit, because f64 error accumulates
across the whole chain, while the pinned form rounds at each boundary exactly as the GPU does. The
harness refuses to report a verdict if the two GPU results differ, so it cannot be measuring the
shader by accident.

**Decision: every exported function is `tgpu.fn` with declared parameter and return types.** The 17
interval kernels and the scalar rules converted. The cost is polymorphism over `number`, which these
functions never needed — the library is f32-first because GPU storage is.

One visible consequence, now pinned in `scalar.test.ts`: `roundTo(7.3, 0)` returns `Math.fround(7.3)`
rather than `7.3`. That is the point. **The value a caller gets is the value the shader holds**, and a
test that expected the f64 literal was asserting the wrong contract.

### The conversion exposed two guarded divisions that a ternary would have broken

`roundTo` and `inverseLerp` each guarded a division with a ternary. A runtime ternary compiles to
WGSL `select`, **which evaluates both arms**, so the guard would not have prevented the division at
all — only chosen the right answer afterwards, on a value the Finite Math Assumption says must not
exist. Both became `if`/`return`, which genuinely branches, and both are now checked on device:

```txt
agree  roundTo with a zero step, guarding a divide:          gpu=5 cpu=5
agree  inverseLerp over an empty range, guarding a divide:   gpu=0 cpu=0
```

A third division had no guard at all. `aspectRatioOfRect` computed `rect.width / rect.height` with a
zero-height rectangle entirely reachable, and it **threw** rather than returning a wrong number,
because a declared `d.f32` return rejects the infinity the Finite Math Assumption forbids:

```txt
Cannot convert value 'Infinity' to type f32 because of the Finite Math Assumption
```

It had **no test and no caller**, which is how it survived. It now returns 0 for a collapsed
rectangle — the value `resizeRect`'s existing `aspectRatio > 0` guard already treats as absent — and
that case is checked on device. Note the sequence: the `tgpu.fn` decision above is what surfaced it.
A plain callback would have returned `Infinity` in silence.

Auditing the neighbours turned up four more exports with no test at all — `outsetRect`, `rectRight`,
`rectBottom`, `unionRect` — and one of them was a second defect. `rectRight` and `rectBottom`
restated `start + length` inline instead of composing `intervalEnd`, so the edge rule had two owners
and breaking `intervalEnd` did not fail them. Both now compose it, and breaking `intervalEnd` fails
their tests.

Also found while converting: **a WGSL reserved keyword cannot be a `d.struct` field name.**
`d.struct({ from: d.f32 })` throws `Invalid property key 'from'`. Parameter names are unaffected,
because the resolver renames them. None of the shipped schemas use a reserved word.

Status: runtime-proven on a software WebGPU device.

## Conversion state

The scope correction turned the work into one migration: every module whose mathematics is
shape-stable becomes `tgpu.fn` over `d` schemas, and the rest is named CPU-only for a stated reason.

| Module           | State                     | Note                                                        |
| ---------------- | ------------------------- | ----------------------------------------------------------- |
| `interval.ts`    | dual-target               | 17 `tgpu.fn` kernels; every edge rule stated once           |
| `rect.ts`        | dual-target               | composes `interval`; `unionRects`/`pruneContainedRects` CPU |
| `camera.ts`      | dual-target               | matches the compositor backend expression for expression    |
| `transform.ts`   | dual-target               | 3x2 affine struct, not a matrix — see the defect above      |
| `scalar.ts`      | dual-target               | now owns `clamp`; `lerp` deleted as `std.mix`               |
| `vector.ts`      | dual-target               | 11 functions down to 3; `Point` deleted for `d.vec2f`       |
| `reduce.ts`      | CPU by nature             | new; JS-array reductions, holds `minOf`/`maxOf`             |
| `interpolate.ts` | split                     | `arcPoint` dual; the spring is still f64                    |
| `size.ts`        | dual-target               | `containScale`/`coverScale`; the string `FitMode` is gone   |
| `occupancy.ts`   | split                     | `isAreaFree` dual; row growth allocates, so CPU             |
| `queue.ts`       | CPU by nature             | unbounded heap, grows during use                            |
| `order.ts`       | dual-target-able          | Hilbert index is fixed-shape; not converted yet             |
| `buffer.ts`      | **replacement pending**   | hand-written offsets; `d.arrayOf(Rect, n)` supersedes it    |
| `axis.ts`        | **placement in question** | CPU-only; owns `Size`; likely belongs to the layout package |

### `Point` is gone, and `vector.ts` lost eight of eleven functions

`d.vec2f` is the currency. Eight functions were `std` under another name and are deleted outright:
`addPoints`, `subtractPoints`, `scalePoint`, `dot`, `magnitude`, `distance`, `angle`, `lerpPoint`.
Three survive because `std` genuinely cannot do them, and each one's test now asserts that difference
at the survivor rather than in a separate probe, so `std-equivalence.probe.test.ts` is deleted:

```ts
// std.cross is three-dimensional and throws on a vec2f pair.
export const cross: TgpuFn<[d.Vec2f, d.Vec2f], d.F32>;
// std.normalize throws on a zero vector (Finite Math Assumption).
export const normalizeOrZero: TgpuFn<[d.Vec2f], d.Vec2f>;
// No std equivalent.
export const perpendicular: TgpuFn<[d.Vec2f], d.Vec2f>;
```

`normalize` became `normalizeOrZero`: a name shared with `std.normalize` that behaves differently at
the one input that matters is a trap.

### One owner for clamping, proved by breaking it

`clampToInterval` still called raw `std.clamp`, which this document had already measured as ignoring
the minimum-wins rule when the bounds cross — while `clampIntervalWithin`, eight lines below it,
spelled out `max(min(...))` to avoid exactly that. Two spellings of one rule, and the raw one was
wrong: `clampToInterval(500, 30, -100)` returned **-70** instead of 30, reachable through
`clampPointToRect` with a negative-width rectangle.

```ts
// src/scalar.ts — the single owner. std.clamp leaves crossed bounds undefined; CSS and WGSL do not.
export const clamp = (value: number, low: number, high: number) => {
  "use gpu";
  return std.max(low, std.min(high, value));
};

// src/interval.ts — the (start, length) parameterisation composes it instead of restating it.
export const clampToInterval = (value: number, start: number, length: number) => {
  "use gpu";
  return clamp(value, start, start + length);
};
```

Breaking `clamp` to `min(high, max(low, value))` fails four tests across three files, including the
rectangle-level consumer. That is the check that the ownership is real rather than tidy naming.

`norm` became `inverseLerp`: in a canvas-scoped package `norm` was unambiguous, but in a general
mathematics library `norm` is the magnitude of a vector. `sum` was deleted as a plain `reduce` with
no invariant. `minOf`/`maxOf` were nearly deleted with it and should not have been — a test recorded
that `Math.max(...values)` **throws** on a 200 000-element list, which is the invariant that earns
them their place. They moved to `reduce.ts`, because they iterate a JS array and so can never be
dual-target. Their `Infinity` identity is therefore no longer an f32 problem.

### `Size` is not a duplicate of `d.vec2f`, and deleting it was wrong

This document said `Point` and `Size` were "the wrong currency", full stop. Half of that was right.
I deleted `Size`, moved `sizeOnAxis` to `d.vec2f`, and a consumer test failed:

```txt
Error: Cannot convert value 'Infinity' to type f32 because of the Finite Math Assumption
```

Layout limits use `Infinity` for an unbounded maximum — the CSS `max-width: none` convention — and
f32 cannot hold it. So the two types differ in the set of values they admit, which makes them
different types rather than two spellings of one:

```ts
// src/axis.ts — CPU-only. f64, so an unbounded maximum is representable.
export type Size = { width: number; height: number };

// Pinned in axis.test.ts, so the deletion is not attempted again.
expect(() => d.vec2f(Infinity, 100)).toThrow(/Finite Math Assumption/);
expect(sizeOnAxis({ axis: "horizontal", main: Infinity, cross: 100 })).toEqual({
  width: Infinity,
  height: 100,
});
```

**The rule this corrects: `d.vec2f` is the currency at the CPU/GPU boundary, not everywhere.** Code
that never crosses that boundary may use f64 where it needs a value f32 forbids. `Point` was still
a genuine duplicate — every one of its operations crosses — so its deletion stands.

`fitScale` did convert, and lost its string `FitMode` doing so. WGSL cannot switch on a string, and
the four modes were not four things: `contain` and `cover` are the CSS `object-fit` names and became
two functions, while the single-axis modes were one division at the call site and earned no function
of their own.

Status: runtime-proven on the CPU path, and break-proofed.

## Unresolved

- **`typegpu` as `dependencies` or `peerDependencies`.** Currently `dependencies`, moved there
  because `vp pack` inlined it as a devDependency (192.69 kB down to 25.75 kB). `@typegpu/sdf`
  declares it a peer. A peer avoids two copies of the runtime in a consumer. Owner decision.
- **Only a software adapter has run this.** `agreement.inspect.ts` closes the execution gap, but on
  SwiftShader. Hardware drivers differ in precision and in how they treat undefined behaviour, so a
  run on a real GPU is still worth having. The harness is ready for one; only the adapter changes.
- **Nine functions are under the agreement harness**, in 26 checks: `clamp`, `containScale`, `cross`,
  `transformPoint`, `invertTransform`, `gapBetweenIntervals`, `overlapsInterval`, `subtractRect` and
  the `Transform` constructor. The camera spaces, the occupancy grid and the Hilbert index are not.
- Whether `search` should store `x, y, width, height` directly or convert to min/max on `add`.
  Decide when `src/rect-index.ts` is written; measure nothing before there is a call site.
- Equal-gap snapping (three rectangles with equal spacing) has no source yet. Bier and Stone 1986
  is still unread.
- Occupancy grid row growth: bitset rows in one `Uint32Array` versus an array of rows. No source
  read; CSS Grid 2 § 8.5 states the algorithm, not the storage.
- Scan-line helpers (interval events, nearest neighbours — Dwyer § 3) are named in the brief and not
  built.

## Resumption point

Every module whose mathematics is shape-stable has converted, and the device harness exists. The next
increments, in order of value:

1. Extend `agreement.inspect.ts` to the camera spaces and the occupancy grid. Each addition is a
   field on the input struct and a row in the comparison table.
2. Convert `order.ts`, whose Hilbert index is fixed-shape and should already be dual-target.
3. Decide whether `buffer.ts` survives `d.arrayOf(Rect, n)`. It is hand-written offsets over a
   `Float32Array`, and the schema this document measured at the identical 16-byte stride supersedes
   it. Its `intersectingIndices`/`nearestIndices` queries are real capabilities that belong to the
   unwritten `rect-index.ts`, so this is a move, not a deletion.
4. **Audit every export for a test.** Four in `rect.ts` had none, and one of those hid a defect. The
   check is mechanical — an export with zero references outside its own module is untested — and it
   should be a lint rule rather than a thing an agent remembers to do.
   `sources/` holds every artifact already used; add to it before each new module rather than reading
   into context and discarding.
