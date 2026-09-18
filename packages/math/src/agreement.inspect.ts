/// <reference lib="dom" />
import { d, tgpu, type TgpuRoot } from "typegpu";
import { gapBetweenIntervals, overlapsInterval } from "./interval";
import { aspectRatioOfRect, Pieces, Rect, rectRight, subtractRect } from "./rect";
import { clamp, inverseLerp, roundTo } from "./scalar";
import { containScale } from "./size";
import { Transform, invertTransform, transformPoint } from "./transform";
import { cross } from "./vector";

const Input = d.struct({
  value: d.f32,
  low: d.f32,
  high: d.f32,
  size: d.vec2f,
  within: d.vec2f,
  a: d.vec2f,
  b: d.vec2f,
  point: d.vec2f,
  drifting: d.vec3f,
  span: d.vec4f,
  outer: Rect,
  hole: Rect,
});

const Output = d.struct({
  clamped: d.f32,
  contain: d.f32,
  crossed: d.f32,
  drift: d.f32,
  gap: d.f32,
  snappedByZero: d.f32,
  unlerpedEmpty: d.f32,
  ratioCollapsed: d.f32,
  ratioNormal: d.f32,
  farEdge: d.f32,
  moved: d.vec2f,
  back: d.vec2f,
  overlapping: d.u32,
  free: Pieces,
});

const scaleAndShift = tgpu.fn(
  [],
  Transform,
)(() => {
  "use gpu";
  return Transform({ xAxis: d.vec2f(2, 0), yAxis: d.vec2f(0, 3), origin: d.vec2f(10, -5) });
});

const drifting = tgpu.fn(
  [d.f32, d.f32, d.f32],
  d.f32,
)((a, b, c) => {
  "use gpu";
  return a + b - c;
});

type Agreement = readonly [name: string, onGpu: number, onCpu: number];

export async function inspect({ root }: { root: TgpuRoot }) {
  const input = root.createUniform(Input);
  input.write({
    value: 5,
    low: 10,
    high: 0,
    size: d.vec2f(200, 100),
    within: d.vec2f(100, 100),
    a: d.vec2f(3, -4),
    b: d.vec2f(-5, 12),
    point: d.vec2f(7, -4),
    drifting: d.vec3f(1e7, 0.1, 1e7),
    span: d.vec4f(10, 30, 35, 20),
    outer: Rect({ x: 0, y: 0, width: 100, height: 100 }),
    hole: Rect({ x: 30, y: 40, width: 20, height: 25 }),
  });
  const output = root.createMutable(Output);

  const kernel = root.createGuardedComputePipeline(() => {
    "use gpu";
    const given = input.$;
    const transform = scaleAndShift();
    const moved = transformPoint(transform, given.point);
    output.$.clamped = clamp(given.value, given.low, given.high);
    output.$.contain = containScale(given.size, given.within);
    output.$.crossed = cross(given.a, given.b);
    output.$.drift = drifting(given.drifting.x, given.drifting.y, given.drifting.z);
    output.$.moved = d.vec2f(moved);
    output.$.back = d.vec2f(transformPoint(invertTransform(transform), moved));
    output.$.gap = gapBetweenIntervals(given.span.x, given.span.y, given.span.z, given.span.w);
    output.$.overlapping = d.u32(
      overlapsInterval(given.span.x, given.span.y, given.span.z, given.span.w) ? 1 : 0,
    );
    output.$.free = Pieces(subtractRect(given.outer, given.hole));
    // Both guard a division. A ternary would compile to select, which evaluates each side.
    output.$.snappedByZero = roundTo(given.value, 0);
    output.$.unlerpedEmpty = inverseLerp(given.value, given.low, given.low);
    output.$.ratioCollapsed = aspectRatioOfRect(
      Rect({ x: given.outer.x, y: given.outer.y, width: given.outer.width, height: 0 }),
    );
    output.$.ratioNormal = aspectRatioOfRect(given.hole);
    output.$.farEdge = rectRight(given.hole);
  });

  kernel.dispatchThreads();
  const gpu = await output.buffer.read();

  const transform = scaleAndShift();
  const moved = transformPoint(transform, d.vec2f(7, -4));
  const back = transformPoint(invertTransform(transform), moved);
  const free = subtractRect(
    Rect({ x: 0, y: 0, width: 100, height: 100 }),
    Rect({ x: 30, y: 40, width: 20, height: 25 }),
  );

  const agreements: readonly Agreement[] = [
    ["clamp, where std.clamp would give 0", gpu.clamped, clamp(5, 10, 0)],
    ["containScale", gpu.contain, containScale(d.vec2f(200, 100), d.vec2f(100, 100))],
    ["cross", gpu.crossed, cross(d.vec2f(3, -4), d.vec2f(-5, 12))],
    ["transformPoint x", gpu.moved.x, moved.x],
    ["transformPoint y", gpu.moved.y, moved.y],
    ["inverse round-trip x", gpu.back.x, back.x],
    ["inverse round-trip y", gpu.back.y, back.y],
    ["gapBetweenIntervals", gpu.gap, gapBetweenIntervals(10, 30, 35, 20)],
    ["overlapsInterval", gpu.overlapping, overlapsInterval(10, 30, 35, 20) ? 1 : 0],
    ["roundTo with a zero step, guarding a divide", gpu.snappedByZero, roundTo(5, 0)],
    [
      "inverseLerp over an empty range, guarding a divide",
      gpu.unlerpedEmpty,
      inverseLerp(5, 10, 10),
    ],
    [
      "aspectRatioOfRect collapsed, guarding a divide",
      gpu.ratioCollapsed,
      aspectRatioOfRect(Rect({ x: 0, y: 0, width: 100, height: 0 })),
    ],
    [
      "aspectRatioOfRect normal",
      gpu.ratioNormal,
      aspectRatioOfRect(Rect({ x: 30, y: 40, width: 20, height: 25 })),
    ],
    [
      "rectRight through intervalEnd",
      gpu.farEdge,
      rectRight(Rect({ x: 30, y: 40, width: 20, height: 25 })),
    ],
    ["subtractRect piece count", gpu.free.count, free.count],
    ...free.items.flatMap((piece, index): Agreement[] => [
      [`subtractRect piece ${index} x`, gpu.free.items[index]!.x, piece.x],
      [`subtractRect piece ${index} y`, gpu.free.items[index]!.y, piece.y],
      [`subtractRect piece ${index} width`, gpu.free.items[index]!.width, piece.width],
      [`subtractRect piece ${index} height`, gpu.free.items[index]!.height, piece.height],
    ]),
  ];

  const disagreed = agreements.filter(([, onGpu, onCpu]) => Math.abs(onGpu - onCpu) > 1e-5);
  agreements.forEach(([name, onGpu, onCpu]) =>
    console.log(
      `${disagreed.length === 0 ? "agree" : "check"}  ${name}: gpu=${onGpu} cpu=${onCpu}`,
    ),
  );

  const cpuDrift = drifting(1e7, 0.1, 1e7);
  console.log(`control  (1e7+0.1)-1e7: gpu=${gpu.drift} cpu=${cpuDrift}`);
  if (gpu.drift === cpuDrift) {
    throw new Error(
      "The f32/f64 control agreed, so this harness cannot detect divergence and its passes mean nothing.",
    );
  }
  if (disagreed.length > 0) {
    throw new Error(
      `CPU and GPU disagree: ${disagreed.map(([name]) => name).join(", ")}. See the log above.`,
    );
  }

  return { label: "cpu-gpu-agreement", kind: "compute-pipeline" as const, value: kernel };
}
