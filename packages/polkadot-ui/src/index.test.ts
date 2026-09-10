import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "vite-plus/test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const entry = read("./index.ts");
const componentDir = new URL("./components/", import.meta.url);
const componentFiles = readdirSync(componentDir).filter(
  (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
);

const routeDir = new URL("../app/routes/", import.meta.url);
const pageFiles = readdirSync(routeDir).filter(
  (name) => name.endsWith(".tsx") && name !== "__root.tsx",
);
const pageSources = pageFiles.map((name) => ({
  name,
  source: readFileSync(new URL(name, routeDir), "utf8"),
}));
const pages = pageSources.map(({ source }) => source).join("\n");

/**
 * Every component the entry exports. Read from the export lists themselves, because the entry
 * writes some on one line and some over several, and a rule that only sees one shape would check
 * part of the surface while looking like it checked all of it.
 */
const components = new Set(
  [...entry.matchAll(/export \{([\s\S]*?)\} from/g)]
    .flatMap(([, list]) => list!.split(","))
    .map((part) => part.trim())
    .filter((part) => !part.startsWith("type "))
    .map((part) =>
      part
        .split(/\s+as\s+/)
        .pop()!
        .trim(),
    )
    /* PascalCase only: the lowercase second character keeps out constants such as FONT_SIZES. */
    .filter((part) => /^[A-Z][a-z\d]/.test(part)),
);

/**
 * How each part is written in JSX. A part is usually reached through its parent, and the component
 * files say so themselves with `Tabs.Tab = Tab`, so the mapping is read rather than guessed at
 * from the shape of a name.
 */
const jsxNames = new Map<string, Set<string>>();
for (const file of componentFiles) {
  const source = readFileSync(new URL(file, componentDir), "utf8");

  for (const [, parent, part, exported] of source.matchAll(/^(\w+)\.(\w+) = (\w+);$/gm)) {
    const written = jsxNames.get(exported!) ?? new Set<string>();
    written.add(`${parent}.${part}`);
    jsxNames.set(exported!, written);
  }
}

const isRendered = (name: string) =>
  [name, ...(jsxNames.get(name) ?? [])].some((written) =>
    new RegExp(`<${written.replace(".", "\\.")}[\\s/>]`).test(pages),
  );

test("the entry, the components and the pages are all read", () => {
  expect(componentFiles.length).toBeGreaterThan(30);
  expect(components.size).toBeGreaterThan(85);
  expect(pages.length).toBeGreaterThan(10_000);
});

test("no component module is left out of the entry", () => {
  const orphans = componentFiles.filter((file) => !entry.includes(`./components/${file}`));

  expect(orphans).toEqual([]);
});

test("every variant object reaches the entry, because the props tables read them", () => {
  const missing = componentFiles.flatMap((file) => {
    const source = readFileSync(new URL(file, componentDir), "utf8");

    return [...source.matchAll(/\bas (\w+Variants)\b/g)]
      .map(([, name]) => name!)
      .filter((name) => !new RegExp(`\\b${name}\\b`).test(entry))
      .map((name) => `${name} (${file})`);
  });

  expect(missing).toEqual([]);
});

test("every props type reaches the entry, because a consumer types wrappers with them", () => {
  const missing = componentFiles.flatMap((file) => {
    const source = readFileSync(new URL(file, componentDir), "utf8");

    return [...source.matchAll(/export (?:type|interface) (\w+Props)\b/g)]
      .map(([, name]) => name!)
      .filter((name) => !new RegExp(`\\b${name}\\b`).test(entry))
      .map((name) => `${name} (${file})`);
  });

  expect(missing).toEqual([]);
});

/**
 * `Display` renders an `h1`, so a page that reaches for it twice emits two top-level headings and
 * a reader navigating by heading meets two page subjects. Using it as a size is legitimate — that
 * is what `render` is for — so the rule counts the ones that leave the element alone.
 */
test("each page names itself once, and no more", () => {
  const offenders = pageSources
    .map(({ name, source }) => ({ name, headings: source.split("<Display>").length - 1 }))
    .filter(({ headings }) => headings !== 1);

  expect(offenders).toEqual([]);
});

test("every component the entry exports is rendered on a page", () => {
  const undemonstrated = [...components].filter((name) => !isRendered(name));

  expect(undemonstrated).toEqual([]);
});
