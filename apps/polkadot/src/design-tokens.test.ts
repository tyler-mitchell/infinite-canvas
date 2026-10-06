import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SRC = fileURLToPath(new URL(".", import.meta.url));

const styles = readFileSync(`${SRC}styles.css`, "utf8");

const sources = (): readonly string[] =>
  readdirSync(SRC, { encoding: "utf8", recursive: true })
    .filter((entry) => /\.tsx?$/.test(entry) && !entry.includes(".test."))
    .map((entry) => entry.replaceAll("\\", "/"));

/*
 * A token the stylesheet does not define paints its property with nothing, and CSS fills that
 * with the initial value. For `fill` that is black, which on this ground is invisible rather than
 * wrong-looking. The minimap carried a dead `--edge-light` this way after the palette dropped it.
 */
const USED_TOKEN = /var\(\s*(--[a-z0-9-]+)/g;
const DECLARED_TOKEN = /(--[a-z0-9-]+)\s*:/g;

// Framework tokens are Polkadot's to write, not to define; their own suite guards them.
const isOwnToken = (token: string) => !token.startsWith("--icx-");

const declared = new Set([...styles.matchAll(DECLARED_TOKEN)].map((match) => match[1] as string));

test("every design token a component uses is defined in the stylesheet", () => {
  const dangling = sources().flatMap((file) =>
    [...readFileSync(`${SRC}${file}`, "utf8").matchAll(USED_TOKEN)]
      .map((match) => match[1] as string)
      .filter((token) => isOwnToken(token) && !declared.has(token))
      .map((token) => `${file}: ${token}`),
  );

  expect([...new Set(dangling)]).toEqual([]);
});

test("every design token the stylesheet uses is also defined there", () => {
  const dangling = [...styles.matchAll(USED_TOKEN)]
    .map((match) => match[1] as string)
    .filter((token) => isOwnToken(token) && !declared.has(token));

  expect([...new Set(dangling)]).toEqual([]);
});

/*
 * The ground is black and stays black.
 *
 * It was raised three times in one day before it settled here, and each step read as reasonable on
 * its own. What kept it honest was measuring the result over black rather than trusting the
 * percentage: the grain composited to a mean of rgb(8.4) at one point, which is fog, not texture.
 * These bounds fail a change that lifts it again by increments nobody sees individually.
 */
const valueOf = (token: string) => new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(styles)?.[1] ?? "";

const alphaOf = (token: string) => {
  const percent = /(\d+(?:\.\d+)?)%/.exec(valueOf(token));

  return percent === null ? Number.NaN : Number(percent[1]);
};

test("the ground stays at the floor, so no increment quietly lifts it", () => {
  const grain = /opacity='(\d*\.?\d+)'/.exec(valueOf("--ground-grain"));

  expect(grain).not.toBeNull();
  expect(Number(grain?.[1])).toBeLessThanOrEqual(0.01);
  // Both grid rules stay below a tenth of the hairline that bounds a real surface.
  expect(alphaOf("--icx-grid-major")).toBeLessThanOrEqual(6);
  expect(alphaOf("--icx-grid-minor")).toBeLessThanOrEqual(3);
});

test("nothing paints a light source on the ground", () => {
  // The spotlight was removed for reading as a generic glow. A gradient here would be its return.
  expect(/\[data-slot="viewport"\]::before[^}]*gradient/.test(styles)).toBe(false);
});

test("the scan reads both spellings and ignores framework tokens", () => {
  expect([..."fill-[var(--edge-light)]".matchAll(USED_TOKEN)].map((m) => m[1])).toEqual([
    "--edge-light",
  ]);
  expect([..."var( --surface )".matchAll(USED_TOKEN)].map((m) => m[1])).toEqual(["--surface"]);
  expect(isOwnToken("--icx-header-idle")).toBe(false);
  expect(declared.has("--surface")).toBe(true);
});
