import type { d } from "typegpu";
import type { Rect } from "./rect";

export const RECT_STRIDE = 4;

export function createRectBuffer(capacity: number): Float32Array {
  return new Float32Array(capacity * RECT_STRIDE);
}

export function writeRect(rects: Float32Array, index: number, rect: Rect): void {
  const at = index * RECT_STRIDE;
  rects[at] = rect.x;
  rects[at + 1] = rect.y;
  rects[at + 2] = rect.width;
  rects[at + 3] = rect.height;
}

export function readRect(rects: Float32Array, index: number): Rect {
  const at = index * RECT_STRIDE;
  return { x: rects[at]!, y: rects[at + 1]!, width: rects[at + 2]!, height: rects[at + 3]! };
}

export function boundsOfRects(rects: Float32Array, count: number): Rect | null {
  if (count <= 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < count; index++) {
    const at = index * RECT_STRIDE;
    const x = rects[at]!;
    const y = rects[at + 1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + rects[at + 2]! > maxX) maxX = x + rects[at + 2]!;
    if (y + rects[at + 3]! > maxY) maxY = y + rects[at + 3]!;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function nearestIndices(
  rects: Float32Array,
  count: number,
  point: d.v2f,
  limit = Infinity,
  maxDistance = Infinity,
): number[] {
  const furthest = maxDistance * maxDistance;
  const found: { index: number; distance: number }[] = [];
  for (let index = 0; index < count; index++) {
    const at = index * RECT_STRIDE;
    const x = rects[at]!;
    const y = rects[at + 1]!;
    const dx = Math.max(x - point.x, point.x - (x + rects[at + 2]!), 0);
    const dy = Math.max(y - point.y, point.y - (y + rects[at + 3]!), 0);
    const distance = dx * dx + dy * dy;
    if (distance <= furthest) found.push({ index, distance });
  }
  return found
    .sort((left, right) => left.distance - right.distance || left.index - right.index)
    .slice(0, limit === Infinity ? undefined : limit)
    .map((entry) => entry.index);
}
