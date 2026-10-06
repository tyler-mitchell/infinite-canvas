import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const stylesCss = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

const EASING_TOKENS = ["--ease-swift", "--ease-settle"] as const;

const getDeclaration = (css: string, property: string) =>
  new RegExp(`(?<![-\\w])${property}\\s*:\\s*([^;]+);`, "u").exec(css)?.[1]?.trim();

test("the theme sets a default transition curve, so a bare transition is not Tailwind's", () => {
  const declared = getDeclaration(stylesCss, "--default-transition-timing-function");

  expect(declared).toBeDefined();
  expect(EASING_TOKENS.some((token) => declared?.includes(token))).toBe(true);
});

test("the app's easing tokens are the ones that default points at", () => {
  for (const token of EASING_TOKENS) {
    expect(getDeclaration(stylesCss, token)).toMatch(/^cubic-bezier\(/u);
  }
});

test("the scan would notice the default going missing", () => {
  const without = stylesCss.replaceAll("--default-transition-timing-function", "--unused-thing");

  expect(getDeclaration(without, "--default-transition-timing-function")).toBeUndefined();
});
