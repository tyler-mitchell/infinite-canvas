import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * A filled control has to be a different colour from the thing it is drawn on.
 *
 * That sounds too obvious to test until you see how it fails: nothing errors, the state is applied,
 * the element is there and labelled and focusable, and it is simply the same colour as its
 * background. It has happened twice here, both times through the shadcn compatibility block aliasing
 * a control token to a surface token.
 *
 * The group rail's active segment carried `variant="secondary"` and painted `oklch(0.205 0.009 265)`
 * onto a pill already painted `oklch(0.205 0.009 265)`. And the canvas-failure screen's "Try again"
 * — the only action on a screen you reach when a canvas will not open — measured 1.09:1 against the
 * panel behind it, where a UI boundary wants 3:1.
 *
 * Comparing resolved values rather than contrast, deliberately: the ramp is designed so adjacent
 * surfaces are close, and a threshold would either fail the whole ramp or pass the exact identity
 * that shipped. Identity is the defect this file exists to catch.
 */

const source = readFileSync(fileURLToPath(new URL("styles.css", import.meta.url)), "utf8");

/** Every `--token: value;` in the file, before any `var()` is followed. */
const DECLARED = new Map(
  [...source.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((match) => [match[1], match[2].trim()]),
);

/** What a token actually paints, after following `var(--x)` aliases to something concrete. */
const resolve = (token: string, seen = new Set<string>()): string => {
  const value = DECLARED.get(token);

  if (value === undefined || seen.has(token)) {
    return token;
  }

  const alias = /^var\((--[\w-]+)\)$/.exec(value);

  return alias === null ? value : resolve(alias[1], new Set([...seen, token]));
};

test("the tokens this file reads are actually declared, or it proves nothing", () => {
  // A rename upstream would otherwise turn every assertion below into a comparison of two literals
  // that are trivially unequal, and the guard would pass by knowing nothing.
  for (const token of ["--secondary", "--surface", "--card", "--background", "--ground"]) {
    expect(DECLARED.has(token)).toBe(true);
  }
});

test("a secondary control is not the colour of the surfaces it sits on", () => {
  /*
   * `--card` is `--surface` and `--background` is `--ground`, so these three comparisons are the
   * app's two panel colours plus the alias a shared primitive would reach for.
   */
  for (const surface of ["--surface", "--card", "--background"]) {
    expect(resolve("--secondary")).not.toStrictEqual(resolve(surface));
  }
});

test("the check bites on the alias that shipped", () => {
  // `--secondary: var(--surface)` is what the file said, through one level of indirection.
  expect(resolve("--card")).toStrictEqual(resolve("--surface"));
});
