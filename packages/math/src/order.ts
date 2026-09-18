import { RECT_STRIDE } from "./buffer";

export const HILBERT_RESOLUTION = (1 << 16) - 1;

export function hilbertIndex(x: number, y: number): number {
  let a = x ^ y;
  let b = 0xffff ^ a;
  let c = 0xffff ^ (x | y);
  let d = x & (y ^ 0xffff);

  let upperA = a | (b >> 1);
  let upperB = (a >> 1) ^ a;
  let upperC = c ^ ((c >> 1) ^ (b & (d >> 1)));
  let upperD = d ^ ((a & (c >> 1)) ^ (d >> 1));

  a = (upperA & (upperA >> 2)) ^ (upperB & (upperB >> 2));
  b = (upperA & (upperB >> 2)) ^ (upperB & ((upperA ^ upperB) >> 2));
  c = upperC ^ ((upperA & (upperC >> 2)) ^ (upperB & (upperD >> 2)));
  d = upperD ^ ((upperB & (upperC >> 2)) ^ ((upperA ^ upperB) & (upperD >> 2)));

  upperA = (a & (a >> 4)) ^ (b & (b >> 4));
  upperB = (a & (b >> 4)) ^ (b & ((a ^ b) >> 4));
  upperC = c ^ ((a & (c >> 4)) ^ (b & (d >> 4)));
  upperD = d ^ ((b & (c >> 4)) ^ ((a ^ b) & (d >> 4)));

  c = upperC ^ ((upperA & (upperC >> 8)) ^ (upperB & (upperD >> 8)));
  d = upperD ^ ((upperB & (upperC >> 8)) ^ ((upperA ^ upperB) & (upperD >> 8)));

  c ^= c >> 1;
  d ^= d >> 1;
  a = x ^ y;
  b = d | (0xffff ^ (a | c));

  a = (a | (a << 8)) & 0x00ff00ff;
  a = (a | (a << 4)) & 0x0f0f0f0f;
  a = (a | (a << 2)) & 0x33333333;
  a = (a | (a << 1)) & 0x55555555;

  b = (b | (b << 8)) & 0x00ff00ff;
  b = (b | (b << 4)) & 0x0f0f0f0f;
  b = (b | (b << 2)) & 0x33333333;
  b = (b | (b << 1)) & 0x55555555;

  return ((b << 1) | a) >>> 0;
}

export function hilbertOrder(rects: Float32Array, count: number): Uint32Array {
  if (count <= 0) return new Uint32Array(0);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < count; index++) {
    const at = index * RECT_STRIDE;
    const centerX = rects[at]! + rects[at + 2]! / 2;
    const centerY = rects[at + 1]! + rects[at + 3]! / 2;
    if (centerX < minX) minX = centerX;
    if (centerY < minY) minY = centerY;
    if (centerX > maxX) maxX = centerX;
    if (centerY > maxY) maxY = centerY;
  }
  const scaleX = HILBERT_RESOLUTION / (maxX - minX || 1);
  const scaleY = HILBERT_RESOLUTION / (maxY - minY || 1);
  const keys = new Float64Array(count);
  for (let index = 0; index < count; index++) {
    const at = index * RECT_STRIDE;
    const centerX = rects[at]! + rects[at + 2]! / 2;
    const centerY = rects[at + 1]! + rects[at + 3]! / 2;
    keys[index] = hilbertIndex((scaleX * (centerX - minX)) | 0, (scaleY * (centerY - minY)) | 0);
  }
  return Uint32Array.from(
    Array.from({ length: count }, (_, index) => index).sort(
      (left, right) => keys[left]! - keys[right]!,
    ),
  );
}
