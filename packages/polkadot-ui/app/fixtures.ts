import type { ActivityDay } from "polkadot-ui";

/* Sample content for the pages. Plausible values, because a kit judged on placeholder text lies. */

export const WRITING = [
  [
    "Why the pure core cannot import React",
    "Geometry as pure functions, enforced by a test that fails when the boundary moves.",
    "08.26",
  ],
  [
    "Snapping is a resolver, not a heuristic",
    "Candidates in, one committed rect out. The guides are the resolver's own reasoning made visible.",
    "06.26",
  ],
  [
    "Semantic summaries at far zoom",
    "What a window should say at eight percent scale, when its body is smaller than its own title.",
    "04.26",
  ],
] as const;

/*
 * Zero-probability first, magnitude second: that is what gives a year weekday blocks, weekend gaps
 * and one visible fortnight away, rather than uniform noise that hides the level scale.
 */
export const ACTIVITY: ActivityDay[] = Array.from({ length: 371 }, (_, i) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - (370 - i));
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const r = Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1;
  const r2 = Math.abs(Math.sin((i + 1000) * 12.9898 + 78.233) * 43758.5453) % 1;
  const pZero = i > 202 && i < 219 ? 0.92 : weekend ? 0.46 : 0.11;
  const season = 0.6 + 0.4 * Math.sin(i / 58);
  return {
    date,
    count: r < pZero ? 0 : 1 + Math.round(r2 ** 1.7 * 13 * season * (weekend ? 0.5 : 1)),
  };
});

/*
 * The same days in minutes rather than commits — the case the default level ladder cannot bucket.
 * Every non-zero value here clears the top default bound of ten, so without its own bounds the whole
 * year renders in one colour.
 */
export const READING: ActivityDay[] = ACTIVITY.map(({ date, count }) => ({
  date,
  count: count * 14,
}));

export const INSTALLS = [1420, 1880, 1310, 2410, 2150, 2860, 1980, 4182] as const;

/* The same metric for a smaller package. Read beside INSTALLS, the two only mean anything on one
 * scale — left to scale themselves, a peak of 510 draws exactly as tall as a peak of 4,182. */
export const INSTALLS_SMALL = [210, 260, 180, 340, 300, 420, 380, 510] as const;

export const LEVELS = [
  0.3, 0.7, 0.45, 0.9, 0.62, 0.35, 0.78, 0.55, 0.42, 0.88, 0.6, 0.29, 0.71, 0.5, 0.83, 0.38,
] as const;

export const CATEGORIES = ["stack", "work", "words", "life"] as const;

export const COMMITS = [
  "a1f9c2  fix(snap): resolve gap guides before edges",
  "7e04b1  feat(groups): accordion axis labels",
  "c92d55  perf(raster): skip offscreen window bodies",
  "3b7a19  refactor(camera): one conversion boundary",
  "d40c81  fix(hud): keep every surface inside the root",
  "8fe2a0  chore(deps): bump base-ui to 1.5.0",
] as const;
