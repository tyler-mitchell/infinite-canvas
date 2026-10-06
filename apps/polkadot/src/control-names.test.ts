import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SRC = fileURLToPath(new URL(".", import.meta.url));

const openingTag = (rest: string) => {
  const lines = rest.split("\n");
  const closes = (line: string) => line.trim() === "/>" || line.trim() === ">";

  if (lines[0]?.includes(">") === true) {
    return lines[0];
  }

  const end = lines.findIndex(closes);

  return (end === -1 ? lines : lines.slice(0, end)).join("\n");
};

const FIELD_TAGS = ["<input", "<ContentEditable"] as const;

const sources = (): readonly string[] =>
  readdirSync(SRC, { encoding: "utf8", recursive: true })
    .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
    .map((entry) => entry.replaceAll("\\", "/"));

const isNamed = (props: string, source: string) => {
  if (props.includes("aria-label")) {
    return true;
  }

  const id = /\bid="([^"]+)"/.exec(props)?.[1];

  return id !== undefined && source.includes(`htmlFor="${id}"`);
};

const unnamedFields = (source: string, file: string) =>
  FIELD_TAGS.flatMap((tag) =>
    source
      .split(tag)
      .slice(1)
      .map(openingTag)
      .filter((props) => !isNamed(props, source))
      .map(() => `${file}: ${tag} with no accessible name`),
  );

const hasVisibleText = (children: string) => {
  const withoutTags = children.replaceAll(/<[^>]*>/gu, " ");
  const withoutComments = withoutTags.replaceAll(/\/\*[\s\S]*?\*\//gu, " ");
  const flattenBraces = (text: string): string => {
    const next = text.replaceAll(/\{[^{}]*\}/gu, " ");

    return next === text ? next : flattenBraces(next);
  };

  return /\p{L}/u.test(flattenBraces(withoutComments));
};

const buttonChildren = (rest: string, closer: string) => {
  const opened = rest.indexOf(">");
  const closed = rest.indexOf(closer);

  return opened === -1 || closed === -1 || closed < opened ? "" : rest.slice(opened + 1, closed);
};

const isComposedIntoAWrapper = (before: string) => before.trimEnd().endsWith("render={");

const unnamedButtons = (source: string, file: string) =>
  (
    [
      ["<Button", "</Button>"],
      ["<button", "</button>"],
    ] as const
  ).flatMap(([tag, closer]) => {
    const parts = source.split(tag);

    return parts
      .slice(1)
      .filter((_rest, index) => !isComposedIntoAWrapper(parts[index] ?? ""))
      .filter((rest) => !openingTag(rest).includes("aria-label"))
      .filter((rest) => !hasVisibleText(buttonChildren(rest, closer)))
      .map(() => `${file}: ${tag} with only a glyph and no aria-label`);
  });

test("no field is rendered without an accessible name", () => {
  const offenders = sources().flatMap((file) =>
    unnamedFields(readFileSync(`${SRC}${file}`, "utf8"), file),
  );

  expect(offenders).toEqual([]);
});

test("the scan would notice a field losing its name", () => {
  const planted = `<input className={styles.title()} placeholder="Untitled" />`;

  expect(unnamedFields(planted, "planted.tsx")).toHaveLength(1);
});

test("it accepts a field that has one", () => {
  const named = `<input aria-label="Note title" className={styles.title()} />`;

  expect(unnamedFields(named, "named.tsx")).toEqual([]);
});

test("a visible label counts, and counts as the better answer", () => {
  const labelled = `<label htmlFor="confirm">Type the name</label><input id="confirm" />`;

  expect(unnamedFields(labelled, "labelled.tsx")).toEqual([]);
});

test("an id nothing points at is not a name", () => {
  const orphaned = `<input id="confirm" className={styles.input()} />`;

  expect(unnamedFields(orphaned, "orphaned.tsx")).toHaveLength(1);
});

test("no button is a glyph with nothing to call it", () => {
  const offenders = sources().flatMap((file) =>
    unnamedButtons(readFileSync(`${SRC}${file}`, "utf8"), file),
  );

  expect(offenders).toEqual([]);
});

test.each([
  ["an icon and nothing else", `<Button size="icon-sm">\n  <Plus />\n</Button>`],
  ["a self-closing button", `<Button onClick={run} size="icon-sm" />`],
])("the scan notices %s", (_shape, planted) => {
  expect(unnamedButtons(planted, "planted.tsx")).toHaveLength(1);
});

test.each([
  ["a word beside its icon", `<Button size="sm">\n  <Plus />\n  New note\n</Button>`],
  ["an explicit label", `<Button aria-label="New note" size="icon-sm">\n  <Plus />\n</Button>`],
  ["interpolated text", `<Button size="sm">\n  {label}\n  Archive\n</Button>`],
  [
    "one composed into a wrapper that carries the words",
    `<DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>`,
  ],
])("it accepts %s", (_shape, allowed) => {
  expect(unnamedButtons(allowed, "allowed.tsx")).toEqual([]);
});
