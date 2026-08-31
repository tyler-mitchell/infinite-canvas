import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const SRC = fileURLToPath(new URL(".", import.meta.url));

const sources = (): readonly string[] =>
  readdirSync(SRC, { encoding: "utf8", recursive: true })
    .filter((entry) => entry.endsWith(".tsx") && !entry.endsWith(".test.tsx"))
    .map((entry) => entry.replaceAll("\\", "/"));

const allSources = (): readonly string[] =>
  readdirSync(SRC, { encoding: "utf8", recursive: true })
    .filter((entry) => /\.tsx?$/.test(entry) && !entry.includes(".test."))
    .map((entry) => entry.replaceAll("\\", "/"));

const LITERAL_CLASS_NAME = /className=(?:"[^"]*"|\{\s*(?:"[^"]*"|'[^']*'|`[^`]*`)\s*\})/g;

test("no component writes a class list by hand", () => {
  const offenders = sources().flatMap((file) => {
    const matches = readFileSync(`${SRC}${file}`, "utf8").match(LITERAL_CLASS_NAME);

    return matches === null ? [] : matches.map((match) => `${file}: ${match}`);
  });

  expect(offenders).toEqual([]);
});

test.each([
  ["a bare attribute", '<div className="flex items-center gap-2" />'],
  ["the same string in braces", '<div className={"flex items-center gap-2"} />'],
  ["a template literal", "<div className={`flex items-center gap-2`} />"],
])("the scan notices %s", (_spelling, planted) => {
  expect(planted.match(LITERAL_CLASS_NAME)).toHaveLength(1);
});

test.each([
  ["a slot call", "<div className={styles.row()} />"],
  ["a slot call with a variant", "<div className={styles.chip({ active: true })} />"],
  ["a className passed through from props", "<Icon className={className} />"],
])("it does not mistake %s for a literal", (_shape, allowed) => {
  expect(allowed.match(LITERAL_CLASS_NAME)).toBeNull();
});

const ASSIGNED_CLASS_LITERAL = /\.className\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`)/g;

test("nothing assigns a class list onto a DOM node by hand", () => {
  const offenders = allSources().flatMap((file) => {
    const matches = readFileSync(`${SRC}${file}`, "utf8").match(ASSIGNED_CLASS_LITERAL);

    return matches === null ? [] : matches.map((match) => `${file}: ${match}`);
  });

  expect(offenders).toEqual([]);
});

test.each([
  ["a bare string", 'dom.className = "cursor-pointer rounded-[4px]";'],
  ["single quotes", "dom.className = 'px-1 py-px';"],
  ["a template literal", "dom.className = `px-1 ${extra}`;"],
  ["no spaces around the equals", 'el.className="flex gap-2";'],
])("the DOM scan notices %s", (_spelling, planted) => {
  expect(planted.match(ASSIGNED_CLASS_LITERAL)).toHaveLength(1);
});

test.each([
  ["a theme key", "dom.className = config.theme.mention;"],
  ["a slot call", "dom.className = mention();"],
  ["a guarded theme read", 'dom.className = typeof t === "string" ? t : "";'],
])("the DOM scan does not mistake %s for a literal", (_shape, allowed) => {
  expect(allowed.match(ASSIGNED_CLASS_LITERAL)).toBeNull();
});
