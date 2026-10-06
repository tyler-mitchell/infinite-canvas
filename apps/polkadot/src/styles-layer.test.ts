import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const stylesCss = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

const getTopLevelPreludes = (css: string): readonly string[] => {
  const source = css.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
  const tidy = (value: string) => value.replaceAll(/\s+/gu, " ").trim();

  return [...source.matchAll(/[{};]/gu)]
    .reduce<Readonly<{ cursor: number; depth: number; preludes: readonly string[] }>>(
      (state, match) => {
        const at = match.index;
        const prelude = tidy(source.slice(state.cursor, at));
        const token = match[0];

        if (token === "{") {
          return {
            cursor: at + 1,
            depth: state.depth + 1,
            preludes: state.depth === 0 ? [...state.preludes, prelude] : state.preludes,
          };
        }

        if (token === "}") {
          return { cursor: at + 1, depth: state.depth - 1, preludes: state.preludes };
        }

        return {
          cursor: at + 1,
          depth: state.depth,
          preludes: state.depth === 0 ? [...state.preludes, prelude] : state.preludes,
        };
      },
      { cursor: 0, depth: 0, preludes: [] },
    )
    .preludes.filter((entry) => entry.length > 0);
};

const STATEMENT_AT_RULES = ["@layer", "@import", "@source"] as const;

test("every rule in styles.css is layered, imported, or a token declaration", () => {
  const top = getTopLevelPreludes(stylesCss);
  const rules = top.filter((prelude) => !STATEMENT_AT_RULES.some((at) => prelude.startsWith(at)));

  expect(rules.filter((prelude) => prelude !== ":root" && !prelude.startsWith("@theme"))).toEqual(
    [],
  );
});

test("the check fails on a rule written outside the layer", () => {
  const escaped = `${stylesCss}\n.rail { color: red; }\n`;

  expect(getTopLevelPreludes(escaped)).toContain(".rail");
  expect(getTopLevelPreludes(stylesCss)).not.toContain(".rail");
});

test("it does not mistake a nested rule for an escaped one", () => {
  const nested = `@layer components {\n  .a {\n    &:hover { color: red; }\n  }\n}\n`;

  expect(getTopLevelPreludes(nested)).toEqual(["@layer components"]);
});
