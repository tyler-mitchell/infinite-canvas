import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { compile } from "tailwindcss";
import { expect, test } from "vite-plus/test";

import * as kit from "./index.ts";

/*
 * Tailwind drops a utility it does not recognise and says nothing. The class stays in the markup,
 * the element keeps its shape, and the style simply never exists. Nothing in a rendered-markup
 * test can see it, because the markup is right; only the stylesheet knows.
 *
 * This reads the kit's own variant objects, which is the whole of what a consumer installs. The
 * pages hold slots of their own and are not covered: they are not exported, so there is nothing to
 * read them from without guessing which strings in a file are classes.
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
const css = compiled.build([...tokens.keys(), "not-a-utility-this-kit-would-write"]);

test("the stylesheet is built and the kit is read", () => {
  expect(css.length).toBeGreaterThan(10_000);
  expect(tokens.size).toBeGreaterThan(400);
  expect(new Set(tokens.values()).size).toBeGreaterThan(30);
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

test("every class the kit can emit compiles to a rule", () => {
  const dead = [...tokens]
    .filter(([token]) => !written(token).test(css))
    .map(([token, owner]) => `${owner}: ${token}`);

  expect(dead).toEqual([]);
});
