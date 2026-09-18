export type PriorityQueue = { ids: number[]; values: number[]; length: number };

export function createPriorityQueue(): PriorityQueue {
  return { ids: [], values: [], length: 0 };
}

export function enqueue(queue: PriorityQueue, id: number, value: number): void {
  let position = queue.length++;
  while (position > 0) {
    const parent = (position - 1) >> 1;
    const parentValue = queue.values[parent]!;
    if (value >= parentValue) break;
    queue.ids[position] = queue.ids[parent]!;
    queue.values[position] = parentValue;
    position = parent;
  }
  queue.ids[position] = id;
  queue.values[position] = value;
}

export function dequeue(queue: PriorityQueue): number | undefined {
  if (queue.length === 0) return undefined;
  const top = queue.ids[0]!;
  const last = --queue.length;
  if (last > 0) {
    const id = queue.ids[last]!;
    const value = queue.values[last]!;
    const internal = last >> 1;
    let position = 0;
    while (position < internal) {
      const left = (position << 1) + 1;
      const right = left + 1;
      const child = right < last && queue.values[right]! < queue.values[left]! ? right : left;
      if (queue.values[child]! >= value) break;
      queue.ids[position] = queue.ids[child]!;
      queue.values[position] = queue.values[child]!;
      position = child;
    }
    queue.ids[position] = id;
    queue.values[position] = value;
  }
  return top;
}

export function peek(queue: PriorityQueue): number | undefined {
  return queue.length > 0 ? queue.ids[0] : undefined;
}

export function peekValue(queue: PriorityQueue): number | undefined {
  return queue.length > 0 ? queue.values[0] : undefined;
}

export function clearQueue(queue: PriorityQueue): void {
  queue.length = 0;
}
