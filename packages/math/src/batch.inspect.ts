/// <reference lib="dom" />
import { d, type TgpuRoot } from "typegpu";
import { screenToWorldKernel, View } from "./camera";
import { Transform, transformRect } from "./transform";
import { type Mat, mulM23, mulV23, rotation23, scale23, translation23 } from "./matrix";
import { containsPoint, intersectsRect, unionRect } from "./cpu";
import {
  containsPointKernel,
  intersectsRectKernel,
  Rect,
  translateRectKernel,
  unionRectKernel,
} from "./rect";

const COUNT = 8;

// Rect and Camera are vec2f-aligned (8), but a uniform struct member needs 16. Without the explicit
// align this validates on SwiftShader and is documented to break on some devices.
const Query = d.struct({
  pointer: d.vec2f,
  window: d.align(16, Rect),
  camera: d.align(16, View),
  placement: d.align(16, Transform),
});

// Chosen so every value is exactly representable in f32 and the answers are mixed: an all-true or
// all-false buffer is what a dispatch that never ran would also produce.
const windows = [
  { x: 0, y: 0, width: 120, height: 80 },
  { x: 200, y: 40, width: 160, height: 90 },
  { x: 64, y: 192, width: 96, height: 96 },
  { x: -128, y: -64, width: 32, height: 32 },
  { x: 256, y: 256, width: 512, height: 256 },
  { x: 16, y: 8, width: 32, height: 16 },
  { x: 1024, y: 512, width: 256, height: 128 },
  { x: -32, y: 128, width: 64, height: 64 },
];

const pointer = { x: 96, y: 64 };
const window = { x: 32, y: 16, width: 256, height: 256 };

// The transform a renderer applies per frame. The rotation is what makes this witness worth having:
// a pure scale and translate keeps the corners axis-aligned, so a kernel that transformed only two
// of them would still agree. A rotated rect only comes out right if all four are carried through.
const placement: Mat = mulM23(
  null,
  translation23(null, [64, -32]),
  mulM23(null, rotation23(null, Math.PI / 6), scale23(null, 2)),
);
export async function inspect({ root }: { root: TgpuRoot }) {
  const rects = root.createReadonly(d.arrayOf(Rect, COUNT));
  rects.write(windows);

  const query = root.createUniform(Query);
  query.write({
    pointer: d.vec2f(pointer.x, pointer.y),
    window: Rect(window),
    camera: View({ center: d.vec2f(200, 150), viewport: d.vec2f(800, 600), zoom: 2 }),
    placement: Transform({
      xAxis: d.vec2f(placement[0]!, placement[1]!),
      yAxis: d.vec2f(placement[2]!, placement[3]!),
      origin: d.vec2f(placement[4]!, placement[5]!),
    }),
  });

  const hits = root.createMutable(d.arrayOf(d.u32, COUNT));
  const overlaps = root.createMutable(d.arrayOf(d.u32, COUNT));
  const bounds = root.createMutable(d.arrayOf(Rect, COUNT));
  const moved = root.createMutable(d.arrayOf(Rect, COUNT));
  const placed = root.createMutable(d.arrayOf(Rect, COUNT));

  const pipeline = root.createGuardedComputePipeline((index: number) => {
    "use gpu";
    const rect = rects.$[index]!;
    const given = query.$;
    hits.$[index] = d.u32(containsPointKernel(rect, given.pointer) ? 1 : 0);
    overlaps.$[index] = d.u32(intersectsRectKernel(rect, given.window) ? 1 : 0);
    bounds.$[index] = Rect(unionRectKernel(rect, given.window));
    moved.$[index] = Rect(
      translateRectKernel(rect, screenToWorldKernel(given.pointer, given.camera)),
    );
    placed.$[index] = Rect(transformRect(given.placement, rect));
  });

  pipeline.dispatchThreads(COUNT);

  const [onGpuHits, onGpuOverlaps, onGpuBounds, onGpuMoved, onGpuPlaced] = await Promise.all([
    hits.buffer.read(),
    overlaps.buffer.read(),
    bounds.buffer.read(),
    moved.buffer.read(),
    placed.buffer.read(),
  ]);

  // transformRect has no f64 twin, so the oracle is the definition: carry all four corners through
  // the same affine and take their extent. If the kernel only transformed the origin, or dropped a
  // corner, this disagrees.
  const placeOnCpu = (rect: Rect) => {
    const corners = [
      mulV23(null, placement, [rect.x, rect.y]),
      mulV23(null, placement, [rect.x + rect.width, rect.y]),
      mulV23(null, placement, [rect.x, rect.y + rect.height]),
      mulV23(null, placement, [rect.x + rect.width, rect.y + rect.height]),
    ];
    const xs = corners.map((corner) => corner[0]!);
    const ys = corners.map((corner) => corner[1]!);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  };

  const disagreed: string[] = [];

  // The tolerance scales with magnitude, because a flat one does not survive contact with f32. An
  // absolute 1e-4 passed every axis-aligned fixture and then failed a rotated rect at magnitude
  // ~478, where one f32 step is already ~3e-5 and several compose. The rule is the one this package
  // already publishes as eqDeltaScaled, itself from @thi.ng/math@5.15.17 eqdelta.js:5:
  //   const eqDeltaScaled = (a, b, eps = EPS) => abs(a - b) <= eps * max(1, abs(a), abs(b));
  // tfjs makes the same choice for the same reason, selecting its epsilon from the backend's float
  // precision rather than fixing one (tfjs-core/src/test_util.ts, TEST_EPSILON_FLOAT32 = 1e-3).
  const TOLERANCE = 1e-5;
  const check = (name: string, onGpu: number, onCpu: number) => {
    const scale = Math.max(1, Math.abs(onGpu), Math.abs(onCpu));
    if (Math.abs(onGpu - onCpu) > TOLERANCE * scale) {
      disagreed.push(`${name}: gpu=${onGpu} cpu=${onCpu}`);
    }
  };

  windows.forEach((rect, index) => {
    check(`containsPoint[${index}]`, onGpuHits[index]!, containsPoint(rect, pointer) ? 1 : 0);
    check(`intersectsRect[${index}]`, onGpuOverlaps[index]!, intersectsRect(rect, window) ? 1 : 0);

    const merged = unionRect(rect, window);
    check(`unionRect[${index}].x`, onGpuBounds[index]!.x, merged.x);
    check(`unionRect[${index}].y`, onGpuBounds[index]!.y, merged.y);
    check(`unionRect[${index}].width`, onGpuBounds[index]!.width, merged.width);
    check(`unionRect[${index}].height`, onGpuBounds[index]!.height, merged.height);

    const put = placeOnCpu(rect);
    check(`transformRect[${index}].x`, onGpuPlaced[index]!.x, put.x);
    check(`transformRect[${index}].y`, onGpuPlaced[index]!.y, put.y);
    check(`transformRect[${index}].width`, onGpuPlaced[index]!.width, put.width);
    check(`transformRect[${index}].height`, onGpuPlaced[index]!.height, put.height);
  });

  const hitCount = onGpuHits.reduce((total, hit) => total + hit, 0);
  const overlapCount = onGpuOverlaps.reduce((total, hit) => total + hit, 0);
  console.log(`read back from ${COUNT} threads: hits=${hitCount} overlaps=${overlapCount}`);
  console.log(`rect[0] bounds on gpu: ${JSON.stringify(onGpuBounds[0])}`);
  console.log(`rect[0] moved on gpu:  ${JSON.stringify(onGpuMoved[0])}`);

  // A dispatch that never ran leaves every element zero, and a predicate that is uniformly false
  // would agree with it. Mixed answers are what prove the kernel executed per invocation.
  if (hitCount === 0 || hitCount === COUNT) {
    throw new Error(
      `containsPoint returned ${hitCount} of ${COUNT} across the batch, so this witness cannot tell a real dispatch from an untouched buffer.`,
    );
  }
  if (overlapCount === 0 || overlapCount === COUNT) {
    throw new Error(
      `intersectsRect returned ${overlapCount} of ${COUNT} across the batch, so the same blind spot applies.`,
    );
  }

  const untouched = onGpuMoved.filter(
    (rect, index) => rect.x === windows[index]!.x && rect.y === windows[index]!.y,
  );
  if (untouched.length === COUNT) {
    throw new Error("translateRect moved nothing, so the value-returning path did not run.");
  }

  if (disagreed.length > 0) {
    throw new Error(`the batch disagrees with the f64 adapter:\n${disagreed.join("\n")}`);
  }

  console.log(`agree  ${windows.length * 10} checks across a d.arrayOf(Rect, ${COUNT}) dispatch`);

  return { label: "rect-array-batch", kind: "compute-pipeline" as const, value: pipeline };
}
