import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { compile } from "tailwindcss";
import { expect, test } from "vite-plus/test";

import * as kit from "./index.ts";

/*
 * Tailwind drops a utility it does not recognise and says nothing. The class stays in the markup,
 * the element keeps its shape, and the style simply never exists. Nothing in a rendered-markup
 * test can see it, because the markup is right; only the stylesheet knows.
 *
 * Two sources, because a dead class costs a different thing in each. The kit's variant objects are
 * read as objects: they are the whole of what a consumer installs, so a class that builds nothing
 * there ships broken. The pages are read as text, from inside their own `tv` calls, where a string
 * is a class by construction; a dead one there makes a page document a style it does not have.
 */

const entry = new URL("../app/styles.css", import.meta.url);
const tailwind = new URL(import.meta.resolve("tailwindcss/index.css"));
const sheet = new URL("./theme.css", import.meta.url);

const directoryOf = (file: URL) => fileURLToPath(new URL(".", file));

/** What the two names in `app/styles.css` mean, and where a relative import inside one lands. */
const resolve = (id: string, base: string) => {
  if (id === "tailwindcss") return tailwind;
  if (id === "polkadot-ui/theme.css") return sheet;
  return new URL(id, pathToFileURL(`${base}/`));
};

const loadStylesheet = async (id: string, base: string) => {
  const file = resolve(id, base);

  return {
    path: fileURLToPath(file),
    base: directoryOf(file),
    content: readFileSync(file, "utf8"),
  };
};

/**
 * Every class the kit can ever put on an element. Read from the variant objects themselves rather
 * than from a rendered page, so a tone or a size no page happens to draw is covered as well.
 *
 * A compound entry holds its conditions beside its classes, so only the class fields are taken:
 * reading the whole entry collects the condition values too, and two of them looked like dead
 * utilities the first time this ran.
 */
const classesTheKitCanEmit = () => {
  const found = new Map<string, string>();

  const take = (value: unknown, owner: string) => {
    if (typeof value === "string") {
      for (const token of value.split(/\s+/).filter(Boolean)) {
        if (!found.has(token)) found.set(token, owner);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) take(item, owner);
      return;
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value)) take(item, owner);
    }
  };

  for (const [name, config] of Object.entries(kit)) {
    if (!name.endsWith("Variants")) continue;

    const owned = config as {
      base?: unknown;
      slots?: unknown;
      variants?: unknown;
      compoundVariants?: readonly { class?: unknown; className?: unknown }[];
      compoundSlots?: readonly { class?: unknown; className?: unknown }[];
    };

    take(owned.base, name);
    take(owned.slots, name);
    take(owned.variants, name);
    for (const entry of [...(owned.compoundVariants ?? []), ...(owned.compoundSlots ?? [])]) {
      take(entry.class, name);
      take(entry.className, name);
    }
  }

  return found;
};

const componentDir = new URL("./components/", import.meta.url);
const appDir = new URL("../app/", import.meta.url);

const componentFiles = readdirSync(componentDir).filter(
  (name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"),
);

/** Walked rather than listed a level at a time, so a route in a new folder cannot escape it. */
const pageFiles = readdirSync(appDir, { recursive: true })
  .map(String)
  .filter((name) => name.endsWith(".tsx"));

/**
 * The body of every `tv(` call in a file. Parens count to the matching close and quoted spans are
 * stepped over: an arbitrary value like `grid-cols-[repeat(auto-fill,minmax(236px,1fr))]` carries
 * parens of its own, and a scan that counted those would end a block in the wrong place.
 */
const tvBlocks = (source: string) => {
  const blocks: string[] = [];

  for (const call of source.matchAll(/\btv\(/g)) {
    const opens = call.index + call[0].length;
    let depth = 1;
    let at = opens;
    let quote = "";

    while (at < source.length && depth > 0) {
      const character = source[at]!;
      if (quote) {
        if (character === "\\") at += 1;
        else if (character === quote) quote = "";
      } else if (character === '"' || character === "'" || character === "`") quote = character;
      else if (character === "(") depth += 1;
      else if (character === ")") depth -= 1;
      at += 1;
    }

    blocks.push(source.slice(opens, at - 1));
  }

  return blocks;
};

const blocksIn = (directory: URL, files: readonly string[]) =>
  files.flatMap((file) => tvBlocks(readFileSync(new URL(file, directory), "utf8")));

/** Every class a page writes in a slot, against the page that wrote it. */
const classesThePagesWrite = () => {
  const found = new Map<string, string>();

  for (const file of pageFiles) {
    for (const block of tvBlocks(readFileSync(new URL(file, appDir), "utf8"))) {
      for (const [, literal] of block.matchAll(/"([^"\\]*)"/g)) {
        for (const token of literal.split(/\s+/).filter(Boolean)) {
          if (!found.has(token)) found.set(token, file);
        }
      }
    }
  }

  return found;
};

/** A selector holds the class escaped, so every character Tailwind escapes may carry a backslash. */
const written = (token: string) =>
  new RegExp(
    `\\.${token.replace(/[^A-Za-z\d_-]/g, (character) => `\\\\?\\${character}`)}(?![\\w-])`,
  );

const compiled = await compile(readFileSync(entry, "utf8"), {
  base: directoryOf(entry),
  loadStylesheet,
});

const tokens = classesTheKitCanEmit();
const pageTokens = classesThePagesWrite();
const css = compiled.build([
  ...tokens.keys(),
  ...pageTokens.keys(),
  "not-a-utility-this-kit-would-write",
]);

test("the stylesheet is built and both sources are read", () => {
  expect(css.length).toBeGreaterThan(10_000);
  expect(tokens.size).toBeGreaterThan(400);
  expect(pageTokens.size).toBeGreaterThan(100);
  expect(blocksIn(appDir, pageFiles).length).toBeGreaterThan(10);
});

/**
 * A component whose variants stop being exported is skipped in silence: its classes are never
 * built and every rule below still reports clean. So the count of variant objects answers to the
 * count of `tv` calls in `src`, not to a floor it clears by nine.
 *
 * Counted as objects, not as owners. Ownership is first-wins, so a component whose every class was
 * already claimed by an earlier one holds no token and would read as missing when it is not.
 */
test("every styled component in src reaches this check", () => {
  expect(componentFiles.length).toBeGreaterThan(30);
  expect(Object.keys(kit).filter((name) => name.endsWith("Variants")).length).toBe(
    blocksIn(componentDir, componentFiles).length,
  );
});

test("a tv block ends at its own closing paren, not at one inside a class", () => {
  const arbitrary = `const a = tv({ slots: { grid: "grid-cols-[repeat(auto-fill,minmax(236px,1fr))]" } });`;
  expect(tvBlocks(arbitrary)).toEqual([
    `{ slots: { grid: "grid-cols-[repeat(auto-fill,minmax(236px,1fr))]" } }`,
  ]);
  expect(tvBlocks(`x(); const b = tv({ base: "flex" }); y(tv({ base: "gap-2" }));`)).toEqual([
    `{ base: "flex" }`,
    `{ base: "gap-2" }`,
  ]);
});

test("a class Tailwind does not recognise leaves no rule behind", () => {
  expect(written("flex").test(css)).toBe(true);
  expect(written("not-a-utility-this-kit-would-write").test(css)).toBe(false);
  /* A longer class must not answer for a shorter one that is a prefix of it. */
  expect(written("flex").test(".flex-col { display: flex }")).toBe(false);
});

/**
 * The spacing scale multiplies one variable, so a step can be any number, not only the ones
 * Tailwind lists. Half steps matter here: eighteen, twenty-two, twenty-six, thirty and sixty-six
 * pixels are all steps, and a rule elsewhere leans on that to tell a step from a measurement.
 */
test("the spacing scale takes a half step", () => {
  const halves = ["p-0.5", "p-4.5", "p-5.5", "p-6.5", "p-7.5", "p-16.5"];
  const built = compiled.build([...tokens.keys(), ...halves]).replaceAll("\\", "");

  const bodies = halves.map((name) => {
    const found = new RegExp(`\\.${name.replace(".", "\\.")}\\s*\\{([^}]*)\\}`).exec(built);
    return found?.[1]?.trim();
  });

  expect(bodies).toEqual(halves.map((name) => `padding: calc(var(--spacing) * ${name.slice(2)});`));
});

const undrawn = (found: ReadonlyMap<string, string>) =>
  [...found]
    .filter(([token]) => !written(token).test(css))
    .map(([token, owner]) => `${owner}: ${token}`);

test("a class that builds nothing is named against whoever wrote it", () => {
  const planted = new Map([
    ["flex", "a live one"],
    ["bg-pk-nonexistent", "index.tsx"],
  ]);

  expect(undrawn(planted)).toEqual(["index.tsx: bg-pk-nonexistent"]);
});

test("every class the kit can emit compiles to a rule", () => {
  expect(undrawn(tokens)).toEqual([]);
});

/*
 * The wider of the two: a `pk-` token the sheet never declared fails here and in `theme.test.ts`,
 * and a plain misspelling like `size-16x` fails only here, because it names no token for that rule
 * to look up. Narrowing this one silently narrows the pair.
 */
test("every class a page writes compiles to a rule", () => {
  expect(undrawn(pageTokens)).toEqual([]);
});

/**
 * The other end of the same question: which files a consumer's build reads to find these classes.
 * The kit ships source, so the sheet's own `@source` is the whole of that, and everything it
 * reaches becomes a rule in their stylesheet. It named all of `src`, which is sixteen test files —
 * so every control those tests plant to prove a class is wrong shipped as a rule, `bg-white` and
 * `text-zinc-400` among them, and `focus-visible:ring-offset-pk-ground`, which another rule here
 * exists to forbid.
 */
const declaredSources = [...readFileSync(sheet, "utf8").matchAll(/@source\s+(not\s+)?"([^"]+)"/g)];

/** A pattern is a directory to walk unless it globs, which is how Tailwind reads one. */
const reaches = (pattern: string, file: string) => {
  const cleaned = pattern.replace(/^\.\/?/, "");

  if (!cleaned) return true;
  if (!cleaned.includes("*")) return file === cleaned || file.startsWith(`${cleaned}/`);

  return new RegExp(`^${cleaned.replaceAll(".", "\\.").replaceAll("*", "[^/]*")}$`).test(file);
};

/** Every file under `src` a consumer would scan, as the sheet's own patterns decide it. */
const scanned = readdirSync(new URL(".", sheet), { recursive: true })
  .map(String)
  .filter((name) => /\.tsx?$/.test(name))
  .filter((name) =>
    declaredSources.reduce(
      (kept, [, negated, pattern]) => (reaches(pattern!, name) ? negated === undefined : kept),
      false,
    ),
  );

test("a consumer scans the files that hold classes, and no test among them", () => {
  expect(scanned.filter((name) => name.includes(".test."))).toEqual([]);
  /* `motion.ts` holds the transition recipes the slots now compose, so it is scanned as well. */
  expect([...scanned].sort()).toEqual(
    [...componentFiles.map((name) => `components/${name}`), "motion.ts"].sort(),
  );
});

/**
 * Two components say a thing in words that only a screen reader is given: the ticker's whole
 * number beside the digits it rolls, and the terminal's running command. Both sit in a row with a
 * gap between its parts, and a gap is shared out between the items of that row — so drawn as one,
 * each would open a space with nothing in it.
 *
 * Taken out of flow it is not one of those items and takes no share. Read from the built rule,
 * because the pane this suite would look at renders black.
 */
test("the class that says a thing only to a screen reader takes no room", () => {
  const rule = /\.sr-only\s*\{([^}]*)\}/.exec(css)?.[1]?.replaceAll(/\s+/g, "");

  expect(rule).toBeDefined();
  expect(rule).toContain("position:absolute");
});
