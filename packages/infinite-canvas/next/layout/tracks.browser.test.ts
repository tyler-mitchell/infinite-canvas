import { expect, test } from "vite-plus/test";
import { resolveTracks, type Track } from "./tracks";

const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const flexed = ({ available, tracks }: { available: number; tracks: readonly Track[] }) => {
  const row = document.createElement("div");
  row.style.cssText = `display:flex;width:${available}px;position:absolute;left:-10000px;top:0`;
  tracks.forEach((track) => {
    const item = document.createElement("div");
    item.style.cssText =
      `flex:${track.factor} ${track.factor} ${track.base}px;min-width:${track.min}px;` +
      `max-width:${track.max === Infinity ? "none" : `${track.max}px`};height:10px`;
    row.append(item);
  });
  document.body.append(row);
  const widths = [...row.children].map((item) => item.getBoundingClientRect().width);
  row.remove();
  return widths;
};

test("a track whose base breaks its own limit is frozen first, as Chromium does", () => {
  const input = {
    available: 200,
    tracks: [
      { base: 100, factor: 1, min: 0, max: 50 },
      { base: 0, factor: 1, min: 80, max: Infinity },
    ],
  };
  expect(flexed(input)).toEqual([50, 150]);
  expect(resolveTracks(input)).toEqual([50, 150]);
});

test("resolveTracks gives the widths Chromium flexbox gives, whenever the factors sum to at least one", () => {
  Array.from({ length: 400 }, (_, seed) => seed + 1).forEach((seed) => {
    const next = random(seed);
    const tracks = Array.from({ length: 1 + Math.floor(next() * 4) }, (): Track => {
      const min = Math.floor(next() * 80);
      return {
        base: next() < 0.5 ? 0 : Math.floor(next() * 200),
        factor: next() < 0.15 ? 0 : 1 + Math.floor(next() * 3),
        min,
        max: next() < 0.3 ? Infinity : min + Math.floor(next() * 200),
      };
    });
    const available = Math.floor(next() * 600);
    const ours = resolveTracks({ available, tracks });
    const browser = flexed({ available, tracks });
    ours.forEach((width, index) =>
      expect(Math.abs(width - browser[index]), `seed ${seed} track ${index}`).toBeLessThanOrEqual(
        1 / 64,
      ),
    );
  });
});
