import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const source = readFileSync(fileURLToPath(new URL("styles.css", import.meta.url)), "utf8");

const DECLARED = new Map(
  [...source.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((match) => [match[1], match[2].trim()]),
);

const resolve = (token: string, seen = new Set<string>()): string => {
  const value = DECLARED.get(token);

  if (value === undefined || seen.has(token)) {
    return token;
  }

  const alias = /^var\((--[\w-]+)\)$/.exec(value);

  return alias === null ? value : resolve(alias[1], new Set([...seen, token]));
};

test("the tokens this file reads are actually declared, or it proves nothing", () => {
  for (const token of ["--secondary", "--surface", "--card", "--background", "--ground"]) {
    expect(DECLARED.has(token)).toBe(true);
  }
});

test("a secondary control is not the colour of the surfaces it sits on", () => {
  for (const surface of ["--surface", "--card", "--background"]) {
    expect(resolve("--secondary")).not.toStrictEqual(resolve(surface));
  }
});

test("the check bites on the alias that shipped", () => {
  expect(resolve("--card")).toStrictEqual(resolve("--surface"));
});
