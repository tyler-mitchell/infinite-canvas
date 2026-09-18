import { createRectBuffer, RECT_STRIDE, writeRect } from "./buffer";
import { hilbertOrder } from "./order";
import type { Rect } from "./rect";

const NODE_SIZE = 16;

export type RectIndex = {
  readonly count: number;
  readonly search: (query: Rect) => readonly number[];
};

const empty: RectIndex = { count: 0, search: () => [] };

// A packed Hilbert R-tree, after Flatbush. Boxes are stored min/max rather than position and
// extent, because the search inner loop compares stored values directly instead of adding each
// visit. Typed arrays and `let` are the point of the structure, not an accident of style.
export function buildRectIndex(rects: readonly Rect[]): RectIndex {
  const count = rects.length;
  if (count === 0) return empty;

  const source = createRectBuffer(count);
  rects.forEach((rect, index) => writeRect(source, index, rect));
  const order = hilbertOrder(source, count);

  const levelBounds: number[] = [count * 4];
  let levelCount = count;
  let nodeCount = count;
  while (levelCount !== 1) {
    levelCount = Math.ceil(levelCount / NODE_SIZE);
    nodeCount += levelCount;
    levelBounds.push(nodeCount * 4);
  }

  const boxes = new Float32Array(nodeCount * 4);
  const indices = new Uint32Array(nodeCount);

  order.forEach((sourceIndex, leaf) => {
    const at = sourceIndex * RECT_STRIDE;
    const writeAt = leaf * 4;
    boxes[writeAt] = source[at]!;
    boxes[writeAt + 1] = source[at + 1]!;
    boxes[writeAt + 2] = source[at]! + source[at + 2]!;
    boxes[writeAt + 3] = source[at + 1]! + source[at + 3]!;
    indices[leaf] = sourceIndex;
  });

  let writePosition = count * 4;
  let readPosition = 0;
  for (let level = 0; level < levelBounds.length - 1; level++) {
    const end = levelBounds[level]!;
    while (readPosition < end) {
      const nodeStart = readPosition;
      let minX = boxes[readPosition]!;
      let minY = boxes[readPosition + 1]!;
      let maxX = boxes[readPosition + 2]!;
      let maxY = boxes[readPosition + 3]!;
      readPosition += 4;
      for (let child = 1; child < NODE_SIZE && readPosition < end; child++) {
        minX = Math.min(minX, boxes[readPosition]!);
        minY = Math.min(minY, boxes[readPosition + 1]!);
        maxX = Math.max(maxX, boxes[readPosition + 2]!);
        maxY = Math.max(maxY, boxes[readPosition + 3]!);
        readPosition += 4;
      }
      indices[writePosition >> 2] = nodeStart;
      boxes[writePosition] = minX;
      boxes[writePosition + 1] = minY;
      boxes[writePosition + 2] = maxX;
      boxes[writePosition + 3] = maxY;
      writePosition += 4;
    }
  }

  const leafEnd = count * 4;

  const search = (query: Rect): readonly number[] => {
    const queryMinX = query.x;
    const queryMinY = query.y;
    const queryMaxX = query.x + query.width;
    const queryMaxY = query.y + query.height;
    const found: number[] = [];
    const pending: number[] = [boxes.length - 4, levelBounds.length - 1];

    while (pending.length > 0) {
      const level = pending.pop()!;
      const nodeIndex = pending.pop()!;
      const end = Math.min(nodeIndex + NODE_SIZE * 4, levelBounds[level]!);
      const isLeafLevel = nodeIndex < leafEnd;

      for (let position = nodeIndex; position < end; position += 4) {
        if (
          boxes[position]! > queryMaxX ||
          boxes[position + 1]! > queryMaxY ||
          boxes[position + 2]! < queryMinX ||
          boxes[position + 3]! < queryMinY
        ) {
          continue;
        }
        const entry = indices[position >> 2]!;
        if (isLeafLevel) {
          found.push(entry);
        } else {
          pending.push(entry, level - 1);
        }
      }
    }

    return found.sort((left, right) => left - right);
  };

  return { count, search };
}
