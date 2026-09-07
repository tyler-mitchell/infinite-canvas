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

test("the scan reads both spellings and ignores framework tokens", () => {
  expect([..."fill-[var(--edge-light)]".matchAll(USED_TOKEN)].map((m) => m[1])).toEqual([
    "--edge-light",
  ]);
  expect([..."var( --surface )".matchAll(USED_TOKEN)].map((m) => m[1])).toEqual(["--surface"]);
  expect(isOwnToken("--icx-header-idle")).toBe(false);
  expect(declared.has("--surface")).toBe(true);
});
