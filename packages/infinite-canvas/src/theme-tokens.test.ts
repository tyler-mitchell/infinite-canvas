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
 * Three `--icx-*` tokens are **computed per window at runtime**, not declared in theme.css:
 * `--icx-chrome-stroke`, which the frame widens in world units as zoom shrinks so a 1px border
 * never renders sub-pixel; `--icx-resize-handle-size`, which sizes the grab targets; and
 * `--icx-screen-px`, the world length of one screen pixel, which is the general form of the other
 * two and the one a consumer sizes its own in-window controls against.
 *
 * They are therefore invisible to the bridging test above, and the failure mode if a refactor
 * drops the write is silent and exactly the bug the low-zoom chrome work fixed: `var()` falls
 * back to nothing, every stroke collapses at low zoom, and the canvas looks *almost* right.
 */
const RUNTIME_WRITTEN_TOKENS = [
  "--icx-chrome-stroke",
  "--icx-resize-handle-size",
  "--icx-screen-px",
] as const;

/**
 * `--icx-group-label-size` is a fourth, written by the group shell rather than the window frame.
 *
 * It is the label's band height as a world length that holds a constant *screen* size, and
 * theme.css derives the label's `font-size` from it. So losing the write costs both: `calc()` on
 * an undefined property is invalid, the declaration is dropped, and the name renders at whatever
 * the shell inherits — which is the world-scaled size this replaced.
 */
const RUNTIME_WRITTEN_TOKENS_BY_SOURCE = [
  ["window-frame.tsx", RUNTIME_WRITTEN_TOKENS],
  ["group-layer.tsx", ["--icx-group-label-size", "--icx-resize-handle-size"]],
] as const;

test("runtime-computed tokens are still written as inline custom properties", () => {
  for (const [file, tokens] of RUNTIME_WRITTEN_TOKENS_BY_SOURCE) {
    const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8");

    for (const token of tokens) {
      // Declared as a named constant, then written into a style object by that name. Asserting the
      // literal appears is deliberately weak — it cannot prove the write reaches the DOM — but it
      // is strong enough to fail when the token is renamed or the write deleted outright, which is
      // how it would actually be lost.
      expect(source).toContain(`"${token}"`);
      expect(getDeclaredThemeTokens(themeCss).has(token)).toBe(false);
    }
  }
});

/**
 * Layer containment. The one promise theme.css makes about the cascade.
 *
 * A rule added to this file *outside* the `@layer infinite-canvas` block is unlayered, and an
 * unlayered rule outranks every layered rule in the document — including all of a consumer's
 * `@layer utilities`. So a single stray brace turns the opt-in theme into a ceiling over the
 * consumer's entire styling system, and nothing about it looks wrong: the consumer's class is in
 * the DOM, present in their stylesheet, and simply loses.
 *
 * It is the same defect that has already shipped twice on the consumer side of this repo, which is
 * why it is worth a test rather than a comment. Structural, not textual: it walks braces, so a rule
 * nested three deep inside the layer passes and a rule appended after the closing brace fails.
 */
function getTopLevelPreludes(css: string): readonly string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const preludes: string[] = [];
  let depth = 0;
  let prelude = "";

  for (const character of source) {
    if (character === "{") {
      if (depth === 0) preludes.push(prelude.replace(/\s+/g, " ").trim());
      depth += 1;
      prelude = "";
    } else if (character === "}") {
      depth -= 1;
      prelude = "";
    } else if (depth === 0) {
      // A top-level `;` closes a statement at-rule (`@layer a, b;`, `@import …;`), which declares
      // nothing and cannot outrank anything. Keep it as its own prelude so it is still asserted.
      if (character === ";") {
        preludes.push(prelude.replace(/\s+/g, " ").trim());
        prelude = "";
      } else {
        prelude += character;
      }
    }
  }

  return preludes.filter((entry) => entry.length > 0);
}

test("every rule in theme.css is inside the infinite-canvas layer", () => {
  expect(getTopLevelPreludes(themeCss)).toStrictEqual(["@layer infinite-canvas"]);
});

test("the containment check fails on a rule written outside the layer", () => {
  // The test above is worthless unless it bites, and its failure mode — a rule that is present and
  // simply loses — is invisible in a browser. Prove it here instead.
  expect(
    getTopLevelPreludes(`${themeCss}\n[data-slot="viewport"] { color: red; }\n`),
  ).toStrictEqual(["@layer infinite-canvas", '[data-slot="viewport"]']);
});

/**
 * Every `--icx-*` token `docs/API.md` names is one this stylesheet declares.
 *
 * The doc did not name a single token until 2026-08-26, which made the whole theming surface
 * reachable only by reading this file. Naming them creates the other failure: a documented token
 * that was renamed or never existed, which a consumer discovers by writing an override that does
 * nothing. The direction is deliberately one-way — a token may exist undocumented, since the doc
 * names the layers a consumer overrides rather than enumerating derivations that would go stale.
 */
test("every --icx-* token the API doc names is declared in theme.css or written at runtime", () => {
  const apiDoc = readFileSync(
    fileURLToPath(new URL("../../../docs/API.md", import.meta.url)),
    "utf8",
  );
  const declared = new Set([
    ...[...themeCss.matchAll(/(--icx-[a-z0-9-]+)\s*:/g)].map((match) => match[1] as string),
    // The camera-dependent ones. A consumer reads these in an override, so the doc must be able to
    // name them; declaring them here would be wrong, since the next camera tick overwrites the
    // element's inline value regardless. Their existence is asserted by the write checks above.
    ...RUNTIME_WRITTEN_TOKENS_BY_SOURCE.flatMap(([, tokens]) => tokens),
  ]);
  const named = [...new Set([...apiDoc.matchAll(/`(--icx-[a-z0-9-]+)`/g)].map((m) => m[1]))];

  expect(named.length).toBeGreaterThan(0);
  expect(named.filter((token) => token !== undefined && !declared.has(token))).toEqual([]);
});

/**
 * A HUD panel that can be given an edge is one that can be given *its own* edge.
 *
 * Four rules make a HUD panel — the control group, a standalone button, the status card, a dock
 * item — and each said its edge with `--icx-hud-panel-border` alone. A consumer whose language
 * rejects outlines turns that border off and is left with a flat fill: measured in the incubator,
 * whose own four floating surfaces carry a specular inset ring while the framework's HUD rails
 * beside them carried none.
 *
 * `--icx-hud-panel-shadow` is the second way, and it was applied to those four by hand. A fifth
 * panel added later would be missed silently, so the rule is stated instead of remembered: a
 * selector that reaches for the border token is a panel, and a panel takes the shadow token too.
 */
test("every HUD panel offers an elevation token, not only a border", () => {
  const rules = [...themeCss.matchAll(/\[data-slot="hud-[a-z-]+"\][^{]*\{([^}]*)\}/g)].map(
    (match) => ({
      selector: match[0].slice(0, match[0].indexOf("{")).trim(),
      body: match[1] ?? "",
    }),
  );
  const panels = rules.filter((rule) => rule.body.includes("--icx-hud-panel-border"));
  const withoutElevation = panels
    .filter((rule) => !rule.body.includes("--icx-hud-panel-shadow"))
    .map((rule) => rule.selector);

  expect(panels.length).toBeGreaterThan(0);
  expect(withoutElevation).toEqual([]);
});

/**
 * Motion is themeable, and the check is that nothing goes back to inlining it.
 *
 * Three rules hardcoded 150ms and `cubic-bezier(0.4, 0, 0.2, 1)` — a utility framework's default
 * `ease-in-out`, not a value chosen here — so an app with its own motion system ran two. Measured
 * on the incubator: 117 live transitions on its easing token, 34 on this one, the 34 being window
 * controls and HUD buttons beside controls that moved differently.
 *
 * A literal timing function anywhere in this file is that state returning, and it is invisible in
 * review because a curve reads like a value rather than like a decision somebody else should own.
 */
test("no rule inlines a timing function or a duration that a token should carry", () => {
  const body = themeCss.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
  /*
   * The lookbehind is the correctness of this scan, and its absence is what the first run caught:
   * `transition-duration` is a substring of `--icx-transition-duration`, so the check flagged the
   * very token it exists to install. A guard that reports its own fix as the defect is worse than
   * no guard, because the obvious response is to undo the fix.
   */
  const declarations = [
    ...body.matchAll(/(?<![-\w])transition-(?:duration|timing-function)\s*:\s*([^;]+);/gu),
  ]
    .map((match) => (match[1] ?? "").trim())
    .filter((value) => !value.startsWith("var("));

  expect(declarations).toEqual([]);
});

test("the motion tokens default to the values they replaced, so nothing moves differently", () => {
  const tokens = getDeclaredThemeTokens(themeCss);

  expect(tokens.get("--icx-transition-duration")).toBe("150ms");
  expect(tokens.get("--icx-transition-timing")).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
});

test("the shadow defaults to nothing, so an existing consumer sees no change", () => {
  // The border stays the shipped answer. A default of anything else would restyle every canvas
  // that has never heard of this token, which is not what adding an affordance may cost.
  expect(getDeclaredThemeTokens(themeCss).get("--icx-hud-panel-shadow")).toBe("none");
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

/**
 * The rule from the repo's `AGENTS.md`, made mechanical where it can be.
 *
 * "Anything that can be made configurable should be made configurable" is a judgement call almost
 * everywhere — but inside this stylesheet it is checkable: a value written into a rule body is a
 * value a consumer cannot reach, because overriding a token is the only lever the theme contract
 * gives them. Both of these were true findings before they were tests. The HUD's frosting was
 * `blur(8px)` written twice, so a consumer theming the panel fill opaque paid for a filter that
 * could not be seen and had no way to switch it off. Its type size was `11px` written three times,
 * which agreed with the first consumer's own scale by coincidence rather than by contract.
 *
 * Geometry is deliberately not covered. Padding and border widths are still literal here, and the
 * file's own scope note draws that line — nothing has diverged on them, and a token per padding
 * would be the speculative reading of the rule rather than the useful one.
 */
/**
 * Rule bodies only: comments and token declarations both come out first.
 *
 * Comments have to go, and finding out why is the point. The first run of this flagged seven
 * "violations", every one of them prose — the history above narrating the literals it replaced,
 * `rgb(183 244 255)` and `#d7fbff` quoted as the values that used to be there. A file that
 * documents its own defects would otherwise fail a check aimed at those defects, which is the kind
 * of guard that gets deleted rather than fixed. Blank lines are kept so the reported line numbers
 * stay the file's own.
 */
const getRuleBodies = (css: string) =>
  css
    .replaceAll(/\/\*[\s\S]*?\*\//g, (comment) => comment.replaceAll(/[^\n]/g, " "))
    .replaceAll(/--icx-[a-z0-9-]+\s*:[^;]+;/g, "");

test("no colour is written into a rule body, where a consumer cannot reach it", () => {
  // Hex and `rgb()` only: `color-mix(in oklab, var(--icx-…) 18%, transparent)` names a colour
  // *space*, and its colour comes from a token, so it is the shape this rule wants rather than a
  // violation of it.
  const literals = getRuleBodies(themeCss)
    .split("\n")
    .flatMap((line, index) =>
      /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(line) ? [`${String(index + 1)}: ${line.trim()}`] : [],
    );

  expect(literals).toStrictEqual([]);
});

test("no type size is written into a rule body", () => {
  // `var(…)` and `calc(…)` both pass: the group label's size is a calc over two tokens, which is a
  // consumer-reachable value expressed as arithmetic rather than a literal.
  const sizes = getRuleBodies(themeCss)
    .split("\n")
    .flatMap((line, index) =>
      /font-size:\s*[0-9]/.test(line) ? [`${String(index + 1)}: ${line.trim()}`] : [],
    );

  expect(sizes).toStrictEqual([]);
});

test("the checks bite on the values that were actually there", () => {
  // The two lines this pair exists because of, verbatim. A guard nobody has watched fail may be
  // matching nothing at all.
  expect(/font-size:\s*[0-9]/.test("    font-size: 11px;")).toBe(true);
  expect(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test("    color: #d7fbff;")).toBe(true);
  // And do not fire on the forms that are correct.
  expect(/font-size:\s*[0-9]/.test("    font-size: var(--icx-hud-font-size);")).toBe(false);
  expect(
    /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(
      "    background: color-mix(in oklab, var(--icx-active-accent) 18%, transparent);",
    ),
  ).toBe(false);
});
