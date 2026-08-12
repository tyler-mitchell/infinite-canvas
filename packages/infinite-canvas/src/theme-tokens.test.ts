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

/**
 * Two `--icx-*` tokens are **computed per window at runtime**, not declared in theme.css:
 * `--icx-chrome-stroke`, which the frame widens in world units as zoom shrinks so a 1px border
 * never renders sub-pixel, and `--icx-resize-handle-size`, which sizes the grab targets.
 *
 * They are therefore invisible to the bridging test above, and the failure mode if a refactor
 * drops the write is silent and exactly the bug the low-zoom chrome work fixed: `var()` falls
 * back to nothing, every stroke collapses at low zoom, and the canvas looks *almost* right.
 */
const RUNTIME_WRITTEN_TOKENS = ["--icx-chrome-stroke", "--icx-resize-handle-size"] as const;

test("runtime-computed tokens are still written as inline custom properties", () => {
  const frameSource = readFileSync(
    fileURLToPath(new URL("./window-frame.tsx", import.meta.url)),
    "utf8",
  );

  for (const token of RUNTIME_WRITTEN_TOKENS) {
    // Declared as a named constant, then written into a style object by that name. Asserting the
    // literal appears is deliberately weak — it cannot prove the write reaches the DOM — but it
    // is strong enough to fail when the token is renamed or the write deleted outright, which is
    // how it would actually be lost.
    expect(frameSource).toContain(`"${token}"`);
    expect(getDeclaredThemeTokens(themeCss).has(token)).toBe(false);
  }
});

test("no component references an --icx-* token that nothing defines or writes", () => {
  // The dangling-token check. A `var(--icx-typo)` renders as nothing and styles silently vanish.
  //
  // Scope is honest rather than flattering: this scans literal `var(--icx-…)` text, and
  // `group-layer.tsx` builds its `var()` through template interpolation, so that reference is
  // invisible here. A clean run therefore means "no dangling *literal* reference", not "no
  // dangling reference" — which is why the constant-name assertions above exist alongside it.
  const sources = ["frame-slots.tsx", "window-frame.tsx", "infinite-canvas.tsx"].map((name) =>
    readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8"),
  );
  const declared = getDeclaredThemeTokens(themeCss);
  const dangling = sources
    .flatMap((source) => [...source.matchAll(/var\((--icx-[a-z0-9-]+)/g)])
    .map((match) => match[1] as string)
    .filter((token) => !declared.has(token) && !RUNTIME_WRITTEN_TOKENS.includes(token as never));

  expect([...new Set(dangling)]).toEqual([]);
});
