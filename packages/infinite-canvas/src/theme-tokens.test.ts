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

const RUNTIME_WRITTEN_TOKENS = [
  "--icx-chrome-stroke",
  "--icx-resize-handle-size",
  "--icx-screen-px",
] as const;

const RUNTIME_WRITTEN_TOKENS_BY_SOURCE = [
  ["window-frame.tsx", RUNTIME_WRITTEN_TOKENS],
  ["group-layer.tsx", ["--icx-group-label-size", "--icx-resize-handle-size"]],
] as const;

test("runtime-computed tokens are still written as inline custom properties", () => {
  for (const [file, tokens] of RUNTIME_WRITTEN_TOKENS_BY_SOURCE) {
    const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8");

    for (const token of tokens) {
      expect(source).toContain(`"${token}"`);
      expect(getDeclaredThemeTokens(themeCss).has(token)).toBe(false);
    }
  }
});

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
  expect(
    getTopLevelPreludes(`${themeCss}\n[data-slot="viewport"] { color: red; }\n`),
  ).toStrictEqual(["@layer infinite-canvas", '[data-slot="viewport"]']);
});

test("every --icx-* token the API doc names is declared in theme.css or written at runtime", () => {
  const apiDoc = readFileSync(
    fileURLToPath(new URL("../../../docs/API.md", import.meta.url)),
    "utf8",
  );
  const declared = new Set([
    ...[...themeCss.matchAll(/(--icx-[a-z0-9-]+)\s*:/g)].map((match) => match[1] as string),
    ...RUNTIME_WRITTEN_TOKENS_BY_SOURCE.flatMap(([, tokens]) => tokens),
  ]);
  const named = [...new Set([...apiDoc.matchAll(/`(--icx-[a-z0-9-]+)`/g)].map((m) => m[1]))];

  expect(named.length).toBeGreaterThan(0);
  expect(named.filter((token) => token !== undefined && !declared.has(token))).toEqual([]);
});

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

test("no rule inlines a timing function or a duration that a token should carry", () => {
  const body = themeCss.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
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
  expect(getDeclaredThemeTokens(themeCss).get("--icx-hud-panel-shadow")).toBe("none");
});

test("no component references an --icx-* token that nothing defines or writes", () => {
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

const getRuleBodies = (css: string) =>
  css
    .replaceAll(/\/\*[\s\S]*?\*\//g, (comment) => comment.replaceAll(/[^\n]/g, " "))
    .replaceAll(/--icx-[a-z0-9-]+\s*:[^;]+;/g, "");

test("no colour is written into a rule body, where a consumer cannot reach it", () => {
  const literals = getRuleBodies(themeCss)
    .split("\n")
    .flatMap((line, index) =>
      /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(line) ? [`${String(index + 1)}: ${line.trim()}`] : [],
    );

  expect(literals).toStrictEqual([]);
});

test("no type size is written into a rule body", () => {
  const sizes = getRuleBodies(themeCss)
    .split("\n")
    .flatMap((line, index) =>
      /font-size:\s*[0-9]/.test(line) ? [`${String(index + 1)}: ${line.trim()}`] : [],
    );

  expect(sizes).toStrictEqual([]);
});

test("the checks bite on the values that were actually there", () => {
  expect(/font-size:\s*[0-9]/.test("    font-size: 11px;")).toBe(true);
  expect(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test("    color: #d7fbff;")).toBe(true);
  expect(/font-size:\s*[0-9]/.test("    font-size: var(--icx-hud-font-size);")).toBe(false);
  expect(
    /#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(
      "    background: color-mix(in oklab, var(--icx-active-accent) 18%, transparent);",
    ),
  ).toBe(false);
});
