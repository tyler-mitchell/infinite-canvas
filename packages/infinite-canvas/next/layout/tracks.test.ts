import { describe, expect, test } from "vite-plus/test";
import { resizeTracks, resolveTracks, type Track } from "@hyphened/math/cpu";

const track = (input: Partial<Track>): Track => ({
  base: 0,
  factor: 1,
  min: 0,
  max: Infinity,
  ...input,
});

describe("resolveTracks", () => {
  test("shares free space in proportion to the factors", () => {
    expect(resolveTracks({ available: 300, tracks: [track({}), track({ factor: 2 })] })).toEqual([
      100, 200,
    ]);
  });

  test("treats factors as proportions when they sum to less than one", () => {
    expect(
      resolveTracks({ available: 300, tracks: [track({ factor: 0.2 }), track({ factor: 0.2 })] }),
    ).toEqual([150, 150]);
  });

  test("freezes a track at its minimum and gives the rest to the others", () => {
    expect(resolveTracks({ available: 300, tracks: [track({ min: 200 }), track({})] })).toEqual([
      200, 100,
    ]);
  });

  test("freezes a track at its maximum and gives the rest to the others", () => {
    expect(resolveTracks({ available: 300, tracks: [track({ max: 100 }), track({})] })).toEqual([
      100, 200,
    ]);
  });

  test("freezes a track whose base already breaks its own limit before it shares space, as CSS Flexbox 9.7 step 2 does", () => {
    expect(
      resolveTracks({
        available: 200,
        tracks: [track({ base: 100, max: 50 }), track({ min: 80 })],
      }),
    ).toEqual([50, 150]);
    expect(
      resolveTracks({
        available: 100,
        tracks: [track({ base: 20, min: 60 }), track({ base: 100, max: 90 })],
      }),
    ).toEqual([60, 40]);
  });

  test("shrinks below the base sizes by factor times base, as CSS Flexbox 9.7 step 4 does", () => {
    expect(
      resolveTracks({ available: 120, tracks: [track({ base: 100 }), track({ base: 50 })] }),
    ).toEqual([80, 40]);
    expect(
      resolveTracks({
        available: 120,
        tracks: [track({ base: 100, factor: 0 }), track({ base: 50 })],
      }),
    ).toEqual([100, 20]);
  });

  test("freezes every track when minimum and maximum violations cancel", () => {
    expect(
      resolveTracks({
        available: 300,
        tracks: [track({ max: 50 }), track({}), track({ min: 150 })],
      }),
    ).toEqual([50, 100, 150]);
  });

  test("resolves a minimum violation before a maximum violation that it causes", () => {
    expect(
      resolveTracks({
        available: 300,
        tracks: [track({ min: 220 }), track({ max: 30 }), track({})],
      }),
    ).toEqual([220, 30, 50]);
  });

  test("keeps an inflexible track at its base size", () => {
    expect(
      resolveTracks({
        available: 300,
        tracks: [track({ base: 40, factor: 0 }), track({}), track({})],
      }),
    ).toEqual([40, 130, 130]);
  });

  test("grows from the base size", () => {
    expect(resolveTracks({ available: 300, tracks: [track({ base: 100 }), track({})] })).toEqual([
      200, 100,
    ]);
  });

  test("overflows at the minimums when they exceed the available space", () => {
    expect(
      resolveTracks({ available: 100, tracks: [track({ min: 80 }), track({ min: 80 })] }),
    ).toEqual([80, 80]);
  });

  test("gives each flexible track its maximum when the space has no limit", () => {
    expect(
      resolveTracks({
        available: Infinity,
        tracks: [track({ max: 90 }), track({}), track({ base: 40, factor: 0 })],
      }),
    ).toEqual([90, Infinity, 40]);
  });

  test("fills the available space within every limit when the limits allow it", () => {
    const limits = [0, 40, 120];
    const cases = limits.flatMap((first) =>
      limits.flatMap((second) =>
        [1, 3].map((factor) => [
          track({ min: first, max: first + 150 }),
          track({ min: second, factor }),
          track({ max: 200 }),
        ]),
      ),
    );
    cases.forEach((tracks) => {
      const sizes = resolveTracks({ available: 400, tracks });
      expect(sizes.reduce((total, size) => total + size, 0)).toBeCloseTo(400);
      sizes.forEach((size, index) => {
        expect(size).toBeGreaterThanOrEqual(tracks[index].min);
        expect(size).toBeLessThanOrEqual(tracks[index].max);
      });
    });
  });
});

describe("resizeTracks", () => {
  const limits = [
    { min: 50, max: Infinity },
    { min: 50, max: Infinity },
    { min: 50, max: Infinity },
  ];

  test("cascades to the next track when the nearest reaches its minimum", () => {
    expect(resizeTracks({ sizes: [100, 100, 100], tracks: limits, index: 0, delta: 80 })).toEqual([
      180, 50, 70,
    ]);
  });

  test("limits the delta to what both sides can give", () => {
    expect(resizeTracks({ sizes: [100, 100, 100], tracks: limits, index: 0, delta: 500 })).toEqual([
      200, 50, 50,
    ]);
    expect(resizeTracks({ sizes: [100, 100, 100], tracks: limits, index: 0, delta: -500 })).toEqual(
      [50, 150, 100],
    );
  });

  test("cascades backwards from the sash on a negative delta", () => {
    expect(resizeTracks({ sizes: [100, 100, 100], tracks: limits, index: 1, delta: -80 })).toEqual([
      70, 50, 180,
    ]);
  });

  test("respects a maximum on the growing side", () => {
    const tracks = [
      { min: 50, max: 120 },
      { min: 50, max: Infinity },
    ];
    expect(resizeTracks({ sizes: [100, 100], tracks, index: 0, delta: 80 })).toEqual([120, 80]);
  });

  test("matches the sash drag of VS Code splitview.ts (resize, lines 1279 to 1326 at main) on random cases", () => {
    const reference = ({ sizes, tracks, index, delta }: Parameters<typeof resizeTracks>[0]) => {
      const items = tracks.map((track, item) => ({ ...track, size: sizes[item] }));
      const up = items
        .map((_, item) => item)
        .filter((item) => item <= index)
        .toReversed();
      const down = items.map((_, item) => item).filter((item) => item > index);
      const minDeltaUp = up.reduce((r, i) => r + (items[i].min - sizes[i]), 0);
      const maxDeltaUp = up.reduce((r, i) => r + (items[i].max - sizes[i]), 0);
      const maxDeltaDown =
        down.length === 0 ? Infinity : down.reduce((r, i) => r + (sizes[i] - items[i].min), 0);
      const minDeltaDown =
        down.length === 0 ? -Infinity : down.reduce((r, i) => r + (sizes[i] - items[i].max), 0);
      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);
      const clamped = clamp(
        delta,
        Math.max(minDeltaUp, minDeltaDown),
        Math.min(maxDeltaDown, maxDeltaUp),
      );
      up.reduce((deltaUp, i) => {
        const size = clamp(sizes[i] + deltaUp, items[i].min, items[i].max);
        items[i].size = size;
        return deltaUp - (size - sizes[i]);
      }, clamped);
      down.reduce((deltaDown, i) => {
        const size = clamp(sizes[i] - deltaDown, items[i].min, items[i].max);
        items[i].size = size;
        return deltaDown + (size - sizes[i]);
      }, clamped);
      return items.map((item) => item.size);
    };
    const random = (seed: number) => () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    Array.from({ length: 500 }, (_, seed) => seed + 1).forEach((seed) => {
      const next = random(seed);
      const count = 2 + Math.floor(next() * 4);
      const tracks = Array.from({ length: count }, () => {
        const min = Math.floor(next() * 60);
        return { min, max: next() < 0.3 ? Infinity : min + Math.floor(next() * 200) };
      });
      const sizes = tracks.map((track) =>
        Math.min(track.max, track.min + Math.floor(next() * 150)),
      );
      const input = {
        sizes,
        tracks,
        index: Math.floor(next() * (count - 1)),
        delta: Math.floor(next() * 600) - 300,
      };
      expect(resizeTracks(input), `seed ${seed}`).toEqual(reference(input));
    });
  });

  test("keeps the total size", () => {
    [-500, -80, -1, 0, 1, 80, 500].forEach((delta) =>
      [0, 1].forEach((index) =>
        expect(
          resizeTracks({ sizes: [100, 140, 90], tracks: limits, index, delta }).reduce(
            (total, size) => total + size,
            0,
          ),
        ).toBe(330),
      ),
    );
  });
});
