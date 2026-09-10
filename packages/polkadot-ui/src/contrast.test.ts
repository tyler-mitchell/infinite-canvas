import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

/*
 * A focus ring is a non-text mark, so it is asked for 3:1 against what it sits on. The ring is the
 * accent at half alpha, which means the number is not a property of the ring: it is a property of
 * the ring and the seat together, and every tone sets a different seat.
 *
 * The numbers written into component comments are checked here too. One of the four was a pair of
 * values in the wrong order, and nothing could have caught it while it lived only in prose.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const themeCss = read("./theme.css");
const componentDir = new URL("./components/", import.meta.url);
const componentSources = readdirSync(componentDir)
  .filter((name) => name.endsWith(".tsx"))
  .map((file) => ({ file, source: readFileSync(new URL(file, componentDir), "utf8") }));

/**
 * The plain sRGB values. The sheet also carries a display-p3 accent, which paints a slightly
 * brighter ring; this reads the fallback on purpose, because that is the weaker of the two and the
 * one an ordinary display gets.
 */
const palette = new Map(
  [...themeCss.matchAll(/^\s+(--pk-[a-z\d-]+):\s*(#[\da-f]{3,8});/gim)].map(([, token, hex]) => [
    token!,
    hex!,
  ]),
);

type Rgb = readonly [number, number, number];

const rgb = (token: string): Rgb => {
  const hex = palette.get(token);
  if (!hex) throw new Error(`${token} is not a plain colour in the sheet`);

  const digits = hex.slice(1);
  const full =
    digits.length <= 4 ? digits.replace(/./g, (character) => character.repeat(2)) : digits;

  return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16)) as unknown as Rgb;
};

/** Straight alpha over an opaque ground, which is what the browser composites a ring with. */
const over = (ink: Rgb, ground: Rgb, alpha = 1): Rgb =>
  ground.map((value, index) =>
    Math.round(alpha * ink[index]! + (1 - alpha) * value),
  ) as unknown as Rgb;

/** WCAG relative luminance, then the ratio the guidelines define from it. */
const luminance = ([red, green, blue]: Rgb) => {
  const channel = (value: number) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
};

const contrast = (a: Rgb, b: Rgb) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((one, two) => two - one);
  return Number(((light! + 0.05) / (dark! + 0.05)).toFixed(2));
};

/** Every seat a control can sit on: the root default, and each one a Surface tone restates. */
const seats = () => {
  const written = componentSources.flatMap(({ source }) =>
    [...source.matchAll(/\[--pk-ring-seat:var\((--pk-[a-z\d-]+)\)\]/g)].map(([, token]) => token!),
  );
  const [, fallback] = /--pk-ring-seat:\s*var\((--pk-[a-z\d-]+)\)/.exec(themeCss) ?? [];

  return [...new Set([fallback!, ...written])];
};

test("the sheet and the tones are both read", () => {
  expect(palette.size).toBeGreaterThan(30);
  expect(seats().length).toBeGreaterThan(4);
  expect(contrast([255, 255, 255], [0, 0, 0])).toBe(21);
  expect(contrast([255, 255, 255], [255, 255, 255])).toBe(1);
});

test("the focus ring clears 3:1 on every seat a control can sit on", () => {
  const ink = rgb("--pk-accent");

  const thin = seats()
    .map((seat) => ({ seat, ratio: contrast(over(ink, rgb(seat), 0.5), rgb(seat)) }))
    .filter(({ ratio }) => ratio < 3);

  expect(thin).toEqual([]);
});

/**
 * Paper is its own ground and takes its own ring, because the accent at half alpha reaches only
 * 1.32:1 against it. Nothing puts an accent ring on paper today; this pins the ring paper does use.
 */
test("the ring paper uses clears 3:1 on paper", () => {
  const page = rgb("--pk-paper-page");

  expect(contrast(rgb("--pk-paper-ink"), page)).toBeGreaterThanOrEqual(3);
  expect(contrast(over(rgb("--pk-accent"), page, 0.5), page)).toBeLessThan(3);
});

/** Each ratio a component states in prose, and the two colours it is a ratio between. */
const CLAIMED = [
  { file: "button.tsx", says: "4.95", ink: "--pk-ink-faint", on: "--pk-surface", alpha: 1 },
  { file: "button.tsx", says: "5.66", ink: "--pk-ink-dim", on: "--pk-surface", alpha: 1 },
  { file: "scroll-area.tsx", says: "1.92", ink: "--pk-line-strong", on: "--pk-surface", alpha: 1 },
  {
    file: "activity-grid.tsx",
    says: "1.36",
    ink: "--pk-ink-bright",
    on: "--pk-accent",
    alpha: 0.7,
  },
] as const;

test("every ratio a component writes down is the ratio it has", () => {
  const wrong = CLAIMED.flatMap(({ file, says, ink, on, alpha }) => {
    const source = componentSources.find((entry) => entry.file === file)?.source;
    if (!source?.includes(says)) return [`${file} no longer says ${says}`];

    const measured = contrast(over(rgb(ink), rgb(on), alpha), rgb(on));
    return measured.toFixed(2) === says ? [] : [`${file} says ${says}, ${ink} is ${measured}`];
  });

  expect(wrong).toEqual([]);
});
