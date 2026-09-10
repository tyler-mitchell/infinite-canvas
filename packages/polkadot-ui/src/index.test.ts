import { existsSync, readdirSync, readFileSync } from "node:fs";

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

/** Route files the generated tree does not import, which is the direction the compiler misses. */
const unregisteredIn = (tree: string, files: readonly string[]) =>
  files.map((name) => name.replace(/\.tsx$/, "")).filter((route) => !tree.includes(`/${route}'`));

/**
 * The route tree is generated and committed. Removing a route breaks typecheck, because the tree
 * still imports it; adding one is silent — the page exists and nothing routes to it.
 *
 * The comparison is a function so it can be checked against a tree that is actually stale. A file
 * dropped into `app/routes` proves nothing while the dev server is up, because the generator
 * rewrites the tree before a test can read it.
 */
test("a route missing from the generated tree is named", () => {
  const stale = "import { Route } from './routes/index'\nimport { Route } from './routes/data'";

  expect(unregisteredIn(stale, ["index.tsx", "data.tsx"])).toEqual([]);
  expect(unregisteredIn(stale, ["index.tsx", "motion.tsx"])).toEqual(["motion"]);
});

test("every route file is registered in the generated tree", () => {
  const tree = readFileSync(new URL("../app/routeTree.gen.ts", import.meta.url), "utf8");

  expect(unregisteredIn(tree, pageFiles)).toEqual([]);
});

/**
 * Being routed to is not the same as being reachable. The rule above says the router knows a page;
 * this says the rail offers it, and a page the rail leaves out is one nothing on the site links to.
 *
 * The other direction is the router's own: `to` is typed against the generated tree, so a rail
 * entry pointing nowhere fails typechecking rather than needing a rule here.
 */
const shell = read("../app/routes/__root.tsx");

const railLinks = [...shell.matchAll(/\{ to: "([^"]*)", label: "([^"]*)" \}/g)].map(
  ([, to, label]) => ({ to: to!, label: label! }),
);

test("the rail offers every page, and offers each of them once", () => {
  const routes = pageFiles.map((name) => `/${name.replace(/(index)?\.tsx$/, "")}`);
  const offered = railLinks.map(({ to }) => to);

  /* A floor on the reader, not on the rail: a pattern that matched nothing would agree with an
   * empty routes list and report a rail that offers everything. The comparison below is the rule,
   * and it names the page that is missing rather than a count that is one short. */
  expect(railLinks.length).toBeGreaterThan(3);
  expect([...offered].sort()).toEqual([...routes].sort());
  expect(new Set(offered).size).toBe(offered.length);
});

/**
 * `/` is a prefix of every other route, so without exact matching the rail would mark overview as
 * the current page everywhere and a reader would be told they are in two places at once. Driven:
 * on four routes exactly one link carries `aria-current="page"`, and it is that route's own.
 */
test("the rail matches a route exactly, so only one link is ever current", () => {
  expect(shell).toContain("activeOptions={{ exact: true }}");
});

test("every component the entry exports is rendered on a page", () => {
  const undemonstrated = [...components].filter((name) => !isRendered(name));

  expect(undemonstrated).toEqual([]);
});

/**
 * Six components work something out and export the function that does it — a ceiling, a share, the
 * digits of a falling number, the points of a trace, where a dragged card lands, which column a day
 * belongs in. Those six have a test beside them and the other forty do not, which is the right
 * split: the rest are `tv` slots and JSX, and every other rule in this suite already reads those.
 *
 * The split was a habit rather than a rule, so the seventh could have arrived without one.
 */
const helpersIn = (source: string) => {
  const local = /const (\w+) = tv\(/.exec(source)?.[1];
  const inline = [...source.matchAll(/^export (?:const|function) (\w+)/gm)].map(
    ([, name]) => name!,
  );
  const listed = [...source.matchAll(/^export \{([^}]*)\}/gm)].flatMap(([, list]) =>
    list!.split(",").map((part) =>
      part
        .trim()
        .split(/\s+as\s+/)[0]!
        .replace(/^type\s+/, "")
        .trim(),
    ),
  );

  return [
    ...new Set(
      [...inline, ...listed].filter(
        (name) => /^[a-z]/.test(name) && !name.endsWith("Variants") && name !== local,
      ),
    ),
  ];
};

const untested = (
  sources: readonly { readonly file: string; readonly source: string }[],
  hasTest: (file: string) => boolean,
) =>
  sources
    .map(({ file, source }) => ({ file, helpers: helpersIn(source) }))
    .filter(({ file, helpers }) => helpers.length > 0 && !hasTest(file))
    .map(({ file, helpers }) => `${file} works out ${helpers.join(", ")} and has no test`)
    .sort();

test("a component that works something out and has no test is reported", () => {
  const drawn = {
    file: "badge.tsx",
    source: "const badge = tv({});\nexport { Badge, badge as badgeVariants };",
  };
  const works = {
    file: "bars.tsx",
    source: "const bars = tv({});\nexport function barCeiling() {}",
  };

  /* The tv object is exported under an alias and is not a helper, or every file would be one. */
  expect(helpersIn(drawn.source)).toEqual([]);
  expect(helpersIn(works.source)).toEqual(["barCeiling"]);
  expect(untested([drawn, works], () => true)).toEqual([]);
  expect(untested([drawn, works], () => false)).toEqual([
    "bars.tsx works out barCeiling and has no test",
  ]);
});

test("every component that works something out has a test beside it", () => {
  const sources = componentFiles.map((file) => ({
    file,
    source: readFileSync(new URL(file, componentDir), "utf8"),
  }));

  /*
   * Told that none of them has a test, the rule has to name the six and no others. Without this
   * the clean result below would also be what an extractor that found nothing at all produced.
   */
  expect(untested(sources, () => false).map((line) => line.split(" ")[0])).toEqual([
    "activity-grid.tsx",
    "bars.tsx",
    "breakdown.tsx",
    "number-ticker.tsx",
    "sparkline.tsx",
    "swipe-deck.tsx",
  ]);

  expect(
    untested(sources, (file) =>
      existsSync(new URL(file.replace(".tsx", ".test.ts"), componentDir)),
    ),
  ).toEqual([]);
});
