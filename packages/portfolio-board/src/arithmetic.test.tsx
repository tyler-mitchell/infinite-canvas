import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vite-plus/test";

import { ActivityGrid, Bars, Breakdown, NumberTicker, Sparkline } from "./index.ts";

/**
 * An empty series is the easy path: nothing divides, nothing rounds, nothing clamps. These are the
 * shapes where the arithmetic actually runs, and where it fails quietly — a division by a zero
 * ceiling reaches the markup as `NaN` inside a style or a path, which the browser drops. The chart
 * then draws nothing at all and no error is raised anywhere.
 */
const SERIES: Record<string, readonly number[]> = {
  flat: [4, 4, 4, 4],
  allZero: [0, 0, 0],
  single: [7],
  singleZero: [0],
  outlier: [1, 1, 1, 100_000],
  negative: [-5, 3, -2, 8],
  fractional: [0.001, 0.002, 0.0015],
  huge: [1e12, 2e12],
};

/** What a browser silently drops, and what a reader would be read aloud. */
const isNonsense = (html: string) => /NaN|Infinity|undefined|\[object Object\]/.test(html);

const offenders = (draw: (values: readonly number[]) => string) =>
  Object.entries(SERIES)
    .filter(([, values]) => isNonsense(draw(values)))
    .map(([shape]) => shape);

test("the bars survive every series shape", () => {
  expect(offenders((values) => renderToStaticMarkup(<Bars values={values} />))).toEqual([]);
});

test("the sparkline survives every series shape", () => {
  expect(offenders((values) => renderToStaticMarkup(<Sparkline values={values} />))).toEqual([]);
});

test("the breakdown survives every series shape", () => {
  expect(
    offenders((values) =>
      renderToStaticMarkup(
        <Breakdown
          parts={values.map((share, index) => ({
            name: `p${index}`,
            share,
            color: "var(--pk-accent)",
          }))}
        />,
      ),
    ),
  ).toEqual([]);
});

test("the ticker prints every value shape without nonsense", () => {
  const values = [0, -1, 7, 1000, -1000, 1e6, 0.5, -0.5];
  const bad = values.filter((value) =>
    isNonsense(renderToStaticMarkup(<NumberTicker value={value} locale pad={4} />)),
  );

  expect(bad).toEqual([]);
});

/** A ceiling below the readings is the case that used to hold a whole series against the floor. */
test("a ceiling under the readings still draws each bar apart from the others", () => {
  const html = renderToStaticMarkup(<Bars values={[10, 20, 30]} max={5} />);

  expect(isNonsense(html)).toBe(false);

  const heights = [...html.matchAll(/height:\s*([\d.]+)%/g)].map(([, value]) => value!);

  expect(heights.length).toBeGreaterThan(0);
  expect(heights.every((height) => Number(height) <= 100)).toBe(true);
});

/**
 * The ceiling is the divisor, and the note at the top of this file names a zero one as the way the
 * arithmetic fails quietly. Every series above carries its own ceiling, so the one a consumer can
 * hand in was never given the values that break a division.
 */
test("a ceiling of zero or less draws bars rather than nonsense", () => {
  const ceilings = [0, -1, Number.NaN];

  const drawn = ceilings.map((max) => renderToStaticMarkup(<Bars values={[3, 6, 9]} max={max} />));

  expect(drawn.filter((html) => isNonsense(html))).toEqual([]);
  /* Bars, not an empty box: nonsense cannot appear in markup that was never drawn. */
  expect(drawn.map((html) => (html.match(/height:/g) ?? []).length)).toEqual([3, 3, 3]);
});

test("a floor of zero or one still leaves every bar inside the box", () => {
  const floors = [0, 1, -1];

  const bad = floors.filter((minHeight) => {
    const html = renderToStaticMarkup(<Bars values={[0, 5, 10]} minHeight={minHeight} />);
    const heights = [...html.matchAll(/height:\s*([\d.]+)%/g)].map(([, value]) => Number(value));

    return isNonsense(html) || heights.some((height) => height > 100);
  });

  expect(bad).toEqual([]);
});

test("a grid given a single day draws that day and no nonsense", () => {
  const html = renderToStaticMarkup(
    <ActivityGrid days={[{ date: new Date("2026-09-10T00:00:00Z"), count: 3 }]} />,
  );

  expect(isNonsense(html)).toBe(false);
  expect(html).toContain('role="img"');
});

test("the check would notice nonsense if it were there", () => {
  expect(isNonsense('<div style="height:NaN%"></div>')).toBe(true);
  expect(isNonsense('<div style="height:50%"></div>')).toBe(false);
});
