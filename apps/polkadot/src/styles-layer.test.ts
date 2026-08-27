import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * Nothing in `styles.css` escapes its cascade layer.
 *
 * An unlayered rule outranks every layered rule in the document — including the whole of
 * `@layer utilities`. So one bare selector at the top level of this file is a ceiling over the
 * entire utility system, and nothing about it looks wrong: the class is on the element, the rule is
 * in the stylesheet, and it simply loses.
 *
 * `AGENTS.md` records this shipping **twice**, the second time to the whole file at once — 23 rules,
 * every one a ceiling, which cost this app its typography until someone measured a computed value
 * against its declaration. A rule with that history and no guard is a rule waiting for its third
 * time.
 *
 * Structural rather than textual, for the same reason the framework's copy is: it walks braces, so
 * a rule nested three deep inside the layer passes and a rule appended after the closing brace
 * fails. A regex for `@layer` would pass on both.
 */

const stylesCss = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

/**
 * Every prelude that sits at depth zero — the part before a `{`, or a statement ending in `;`.
 *
 * A statement at-rule (`@import …;`, `@layer a, b;`) declares nothing and cannot outrank anything,
 * but it is kept rather than filtered so the assertion below names the whole top level and an
 * addition has to be a deliberate edit.
 */
const getTopLevelPreludes = (css: string): readonly string[] => {
  /*
   * Only `{`, `}` and `;` carry structure, so the scan visits those and slices the text between —
   * rather than walking every character. That is also what keeps it clear of `no-misused-spread`:
   * spreading a string yields code points, which splits complex characters, and a stylesheet
   * holding an emoji in a `content` value is an ordinary thing rather than a hypothetical.
   */
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

/**
 * At-rules that carry no declarations, so they can outrank nothing.
 *
 * Listed by name rather than matched as "anything starting with `@`", because the point of the
 * check is that a new top-level construct gets looked at once. `@source` is here because the first
 * run flagged Tailwind's scanner directives — the allowlist was incomplete, not the stylesheet.
 */
const STATEMENT_AT_RULES = ["@layer", "@import", "@source"] as const;

test("every rule in styles.css is layered, imported, or a token declaration", () => {
  const top = getTopLevelPreludes(stylesCss);
  const rules = top.filter((prelude) => !STATEMENT_AT_RULES.some((at) => prelude.startsWith(at)));

  /*
   * `:root` is the one exemption `AGENTS.md` grants, and it is granted because a custom-property
   * declaration outranks nothing — there is no `--foo` on any element for it to beat. `@theme`
   * is Tailwind's own registration block and declares properties for the same reason.
   *
   * Anything else here is a selector that paints, at depth zero, beating the utility system.
   */
  expect(rules.filter((prelude) => prelude !== ":root" && !prelude.startsWith("@theme"))).toEqual(
    [],
  );
});

test("the check fails on a rule written outside the layer", () => {
  // The test above is worthless unless it bites, and the failure it guards is invisible in a
  // browser — the rule is present and merely loses. Prove it here.
  const escaped = `${stylesCss}\n.rail { color: red; }\n`;

  expect(getTopLevelPreludes(escaped)).toContain(".rail");
  expect(getTopLevelPreludes(stylesCss)).not.toContain(".rail");
});

test("it does not mistake a nested rule for an escaped one", () => {
  const nested = `@layer components {\n  .a {\n    &:hover { color: red; }\n  }\n}\n`;

  expect(getTopLevelPreludes(nested)).toEqual(["@layer components"]);
});
