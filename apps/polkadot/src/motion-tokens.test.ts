import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Motion is decided once, in the theme, and not per control.
 *
 * `ROADMAP.md` puts it in the bar — "springs, not linear ramps ... `--ease-settle` and
 * `--ease-swift` exist so this is not decided per-site" — and it was being decided per-site by
 * omission. Anything writing a bare `transition-*` utility took Tailwind's default easing, which is
 * `cubic-bezier(0.4, 0, 0.2, 1)` and is not a value anyone here chose. Measured on the running app:
 * 117 live transitions on this app's curve and 34 on the default, the 34 being the framework's own
 * chrome and the shared `ui` Button. Both are now covered — the framework by its own tokens, the
 * primitives by the theme default this asserts — and the same measurement reports 151 and zero.
 *
 * Losing the line is silent: nothing errors, nothing looks broken, and every unspecified transition
 * quietly moves on a curve from a utility framework's defaults again.
 */

const stylesCss = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

/** The app's own easing tokens. A default pointing anywhere else is the per-site decision returning. */
const EASING_TOKENS = ["--ease-swift", "--ease-settle"] as const;

const getDeclaration = (css: string, property: string) =>
  new RegExp(`(?<![-\\w])${property}\\s*:\\s*([^;]+);`, "u").exec(css)?.[1]?.trim();

test("the theme sets a default transition curve, so a bare transition is not Tailwind's", () => {
  const declared = getDeclaration(stylesCss, "--default-transition-timing-function");

  expect(declared).toBeDefined();
  expect(EASING_TOKENS.some((token) => declared?.includes(token))).toBe(true);
});

test("the app's easing tokens are the ones that default points at", () => {
  // The assertion above is only worth something if these exist to be pointed at.
  for (const token of EASING_TOKENS) {
    expect(getDeclaration(stylesCss, token)).toMatch(/^cubic-bezier\(/u);
  }
});

test("the scan would notice the default going missing", () => {
  const without = stylesCss.replaceAll("--default-transition-timing-function", "--unused-thing");

  expect(getDeclaration(without, "--default-transition-timing-function")).toBeUndefined();
});
