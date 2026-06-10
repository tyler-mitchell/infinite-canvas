/**
 * Token-sync test for the opt-in theme stylesheet.
 *
 * theme.css bridges DEFAULT_INFINITE_CANVAS_THEME into `--icx-*` custom
 * properties; if either side drifts the headless default look and the
 * stylesheet look diverge. This test also validates that every
 * `data-slot` selector in theme.css exists in the styling contract so a
 * selector typo cannot silently style nothing.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { DEFAULT_INFINITE_CANVAS_THEME } from "./constants";
import { INFINITE_CANVAS_SLOTS } from "./data-attributes";

const themeCss = readFileSync(fileURLToPath(new URL("./theme.css", import.meta.url)), "utf8");

function getDeclaredThemeTokens(css: string): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();

  for (const match of css.matchAll(/(--icx-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1] as string, (match[2] as string).replace(/\s+/g, " ").trim());
  }

  return tokens;
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

test("theme.css bridges every DEFAULT_INFINITE_CANVAS_THEME field verbatim", () => {
  const tokens = getDeclaredThemeTokens(themeCss);
  const bridgedTokens = Object.fromEntries(
    Object.keys(DEFAULT_INFINITE_CANVAS_THEME).map((field) => {
      const token = `--icx-${toKebabCase(field)}`;

      return [token, tokens.get(token)];
    }),
  );

  expect(Object.keys(bridgedTokens)).toHaveLength(11);
  expect(bridgedTokens).toStrictEqual(
    Object.fromEntries(
      Object.entries(DEFAULT_INFINITE_CANVAS_THEME).map(([field, value]) => [
        `--icx-${toKebabCase(field)}`,
        value,
      ]),
    ),
  );
});

test("every data-slot selector in theme.css exists in the styling contract", () => {
  const contractSlots = new Set<string>(Object.values(INFINITE_CANVAS_SLOTS));
  const referencedSlots = [...themeCss.matchAll(/data-slot="([^"]+)"/g)].map(
    (match) => match[1] as string,
  );
  const unknownSlots = referencedSlots.filter((slot) => !contractSlots.has(slot));

  expect(referencedSlots.length).toBeGreaterThan(0);
  expect(unknownSlots).toStrictEqual([]);
});
