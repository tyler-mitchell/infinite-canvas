import { clamp, minMax } from "@thi.ng/math";
import { add as sum } from "@thi.ng/transducers";

export type Track = { base: number; factor: number; min: number; max: number };

export function resolveTracks({
  available,
  tracks,
}: {
  available: number;
  tracks: readonly Track[];
}): number[] {
  if (available === Infinity)
    return tracks.map((track) =>
      track.factor > 0 ? track.max : clamp(track.base, ...minMax(track.min, track.max)),
    );
  const growing =
    sum(tracks.map((track) => clamp(track.base, ...minMax(track.min, track.max)))) < available;
  const settle = (frozen: ReadonlyMap<number, number>): number[] => {
    const flexible = tracks.flatMap((track, index) =>
      frozen.has(index) ? [] : [{ track, index }],
    );
    if (flexible.length === 0) return tracks.map((_, index) => frozen.get(index)!);
    const free =
      available - sum([...frozen.values()]) - sum(flexible.map(({ track }) => track.base));
    const weights = flexible.map(({ track }) =>
      growing ? track.factor : track.factor * track.base,
    );
    const total = sum(weights);
    const sized = flexible.map(({ track, index }, position) => {
      const target = total === 0 ? track.base : track.base + (free * weights[position]) / total;
      return { index, target, size: clamp(target, ...minMax(track.min, track.max)) };
    });
    const violation = sum(sized.map(({ size, target }) => size - target));
    const freeze = sized.filter(
      ({ size, target }) => violation === 0 || (violation > 0 ? size > target : size < target),
    );
    return settle(new Map([...frozen, ...freeze.map(({ index, size }) => [index, size] as const)]));
  };
  const inflexible = (track: Track) =>
    track.factor === 0 || (growing ? track.base > track.max : track.base < track.min);
  return settle(
    new Map(
      tracks.flatMap((track, index) =>
        inflexible(track)
          ? [[index, clamp(track.base, ...minMax(track.min, track.max))] as const]
          : [],
      ),
    ),
  );
}

export function resizeTracks({
  sizes,
  tracks,
  index,
  delta,
}: {
  sizes: readonly number[];
  tracks: readonly Pick<Track, "min" | "max">[];
  index: number;
  delta: number;
}): number[] {
  const before = sizes
    .map((_, item) => item)
    .filter((item) => item <= index)
    .toReversed();
  const after = sizes.map((_, item) => item).filter((item) => item > index);
  const room = (indexes: readonly number[], limit: "min" | "max") =>
    sum(indexes.map((item) => tracks[item][limit] - sizes[item]));
  const floor = Math.max(room(before, "min"), -room(after, "max"));
  const bounded = clamp(
    delta,
    floor,
    Math.max(floor, Math.min(room(before, "max"), -room(after, "min"))),
  );
  const absorb = (indexes: readonly number[], amount: number) =>
    indexes.reduce<{ rest: number; sizes: Map<number, number> }>(
      (result, item) => {
        const size = clamp(
          sizes[item] + result.rest,
          ...minMax(tracks[item].min, tracks[item].max),
        );
        return {
          rest: result.rest - (size - sizes[item]),
          sizes: new Map([...result.sizes, [item, size]]),
        };
      },
      { rest: amount, sizes: new Map() },
    ).sizes;
  const resized = new Map([...absorb(before, bounded), ...absorb(after, -bounded)]);
  return sizes.map((size, item) => resized.get(item) ?? size);
}
