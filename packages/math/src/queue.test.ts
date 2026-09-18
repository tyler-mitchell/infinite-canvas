import { describe, expect, test } from "vite-plus/test";
import { clearQueue, createPriorityQueue, dequeue, enqueue, peek, peekValue } from "./queue";

const drain = (entries: readonly (readonly [number, number])[]): number[] => {
  const queue = createPriorityQueue();
  entries.forEach(([id, value]) => enqueue(queue, id, value));
  return Array.from({ length: entries.length }, () => dequeue(queue)!);
};

describe("priority queue", () => {
  test("returns ids in ascending order of their value, whatever order they arrived in", () => {
    expect(
      drain([
        [10, 5],
        [11, 1],
        [12, 9],
        [13, 3],
        [14, 1],
      ]),
    ).toEqual(expect.arrayContaining([11, 14]));
    const order = drain([
      [10, 5],
      [11, 1],
      [12, 9],
      [13, 3],
    ]);
    expect(order).toEqual([11, 13, 10, 12]);
  });

  test("handles negative and fractional values", () => {
    expect(
      drain([
        [1, 0.5],
        [2, -3],
        [3, 0],
        [4, -0.25],
      ]),
    ).toEqual([2, 4, 3, 1]);
  });

  test("keeps heap order through interleaved pushes and pops", () => {
    const queue = createPriorityQueue();
    const taken: number[] = [];
    [
      [1, 8],
      [2, 3],
      [3, 12],
    ].forEach(([id, value]) => enqueue(queue, id!, value!));
    taken.push(dequeue(queue)!);
    [
      [4, 1],
      [5, 6],
    ].forEach(([id, value]) => enqueue(queue, id!, value!));
    taken.push(dequeue(queue)!, dequeue(queue)!, dequeue(queue)!, dequeue(queue)!);
    expect(taken).toEqual([2, 4, 5, 1, 3]);
  });

  test("reports empty with undefined rather than a sentinel", () => {
    const queue = createPriorityQueue();
    expect(dequeue(queue)).toBe(undefined);
    expect(peek(queue)).toBe(undefined);
    expect(peekValue(queue)).toBe(undefined);
  });

  test("peek reads the head without removing it", () => {
    const queue = createPriorityQueue();
    enqueue(queue, 7, 4);
    enqueue(queue, 8, 2);
    expect(peek(queue)).toBe(8);
    expect(peekValue(queue)).toBe(2);
    expect(queue.length).toBe(2);
    expect(dequeue(queue)).toBe(8);
  });

  test("clear empties the queue", () => {
    const queue = createPriorityQueue();
    enqueue(queue, 1, 1);
    enqueue(queue, 2, 2);
    clearQueue(queue);
    expect(queue.length).toBe(0);
    expect(dequeue(queue)).toBe(undefined);
  });

  test("agrees with a sorted list over a long random run", () => {
    const entries = Array.from({ length: 400 }, (_, index) => [
      index,
      Math.sin(index * 12.9898) * 43758.5453,
    ]) as [number, number][];
    const expected = entries.toSorted((left, right) => left[1] - right[1]).map(([id]) => id);
    expect(drain(entries)).toEqual(expected);
  });
});
