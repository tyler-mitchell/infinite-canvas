import { globSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import * as kit from "./index.ts";

/**
 * The other entry rules read the entry as text, so they can only ask whether a name is written
 * there. A name can be written and still not arrive: a module renames its export, or drops one,
 * and the re-export becomes a hole that only shows up when a consumer imports it. This file is the
 * only one that asks the entry the way a consumer does, by importing it.
 */
const entry = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

/** Every value name the entry claims to re-export, with the `type` ones left out. */
const claimed = [...entry.matchAll(/export \{([\s\S]*?)\} from/g)]
  .flatMap(([, list]) => list!.split(","))
  .map((part) => part.trim())
  .filter((part) => part.length > 0 && !part.startsWith("type "))
  .map((part) =>
    part
      .split(/\s+as\s+/)
      .pop()!
      .trim(),
  );

test("the entry claims a surface worth checking", () => {
  expect(claimed.length).toBeGreaterThan(100);
  expect(new Set(claimed).size).toBe(claimed.length);
});

/*
 * Carrying a value, not merely having the key. A renamed export leaves the binding in place and
 * sets it to `undefined`, so `in` answers yes for a name that would crash a consumer at first use.
 * Checked by renaming `rowVariants` at its source: `in` said yes, and this said no.
 */
test("every name the entry claims arrives at runtime carrying a value", () => {
  const missing = claimed.filter((name) => (kit as Record<string, unknown>)[name] === undefined);

  expect(missing).toEqual([]);
});

test("nothing the entry exports is undefined", () => {
  const hollow = Object.entries(kit)
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);

  expect(hollow).toEqual([]);
});

/**
 * A component is a function and a variant object is callable too, so the shapes are worth pinning:
 * a slot object that arrived as a plain object would still pass a defined check and then fail the
 * moment a page called it.
 *
 * So it is called. This asked only `typeof value === "function"` for a while, under a name that
 * promised the slots as well — which is the failure its own note describes and did not catch,
 * since a function that throws on the first call is still a function.
 *
 * Two shapes are right. A `slots` object yields an object of slot functions; a `base` object
 * yields the string directly. Anything else is a variant object a page cannot draw with.
 *
 * A slot may draw nothing and be correct: tailwind-variants adds a `base` slot to every slots
 * object, and it returns `undefined` for a component that declares no base classes. So a slot has
 * to be callable and return a string or nothing, and one of them has to actually draw — a set of
 * slots that all draw nothing is an object with no classes in it.
 */
const drawnBy = (value: unknown) => {
  const yielded = (value as () => unknown)();

  if (typeof yielded === "string") return yielded.length > 0 ? [] : ["yields an empty string"];
  if (typeof yielded !== "object" || yielded === null) return [`yields ${typeof yielded}`];

  const slots = Object.entries(yielded as Record<string, unknown>);
  if (slots.length === 0) return ["yields no slots"];

  const drawn = slots.map(([slot, fn]) => ({
    slot,
    classes: typeof fn === "function" ? (fn as () => unknown)() : fn,
  }));

  const faulty = drawn
    .filter(({ classes }) => classes !== undefined && typeof classes !== "string")
    .map(({ slot, classes }) => `slot ${slot} draws ${typeof classes}`);

  if (faulty.length > 0) return faulty;

  return drawn.some(({ classes }) => typeof classes === "string" && classes.length > 0)
    ? []
    : ["no slot draws anything"];
};

test("a variant object that cannot be drawn with is reported", () => {
  expect(drawnBy(() => "flex items-center")).toEqual([]);
  expect(drawnBy(() => ({ root: () => "flex", body: () => "gap-2" }))).toEqual([]);
  /* A base slot with nothing in it is what tailwind-variants gives a slots-only component. */
  expect(drawnBy(() => ({ base: () => undefined, root: () => "flex" }))).toEqual([]);
  expect(drawnBy(() => "")).toEqual(["yields an empty string"]);
  expect(drawnBy(() => 42)).toEqual(["yields number"]);
  expect(drawnBy(() => ({}))).toEqual(["yields no slots"]);
  /* A slot holding something that is not classes at all, which is the branch that reports. */
  expect(drawnBy(() => ({ root: () => 42 }))).toEqual(["slot root draws number"]);
  expect(drawnBy(() => ({ base: () => undefined, root: () => undefined }))).toEqual([
    "no slot draws anything",
  ]);
});

test("every variants export is callable and yields the classes it promises", () => {
  const variants = Object.entries(kit).filter(([name]) => name.endsWith("Variants"));

  const broken = variants.flatMap(([name, value]) => {
    if (typeof value !== "function") return [`${name} is ${typeof value}`];

    try {
      return drawnBy(value).map((fault) => `${name} ${fault}`);
    } catch (error) {
      return [`${name} threw: ${(error as Error).message.slice(0, 40)}`];
    }
  });

  expect(broken).toEqual([]);
  expect(variants.length).toBeGreaterThan(25);
});

test("a name the entry never exported does not arrive", () => {
  expect("Nonexistent" in kit).toBe(false);
  expect(claimed.includes("Nonexistent")).toBe(false);
});

/**
 * The package has a second entry. `theme.css` is what a consumer imports for the look, and the
 * `@source` lines in it are the only thing that puts the kit's classes in their stylesheet —
 * Tailwind ignores `node_modules` unless a directive names it.
 *
 * The lab app cannot see a break here. It scans the whole package on its own, so a class in a file
 * outside `@source` still reaches these pages while a consumer gets an unstyled component.
 *
 * Measured on the real build rather than argued: with automatic detection turned off
 * (`@import "tailwindcss" source(none)`), a class only `keycap.tsx` writes was still in the output
 * and a class only the lab writes was gone. The directive in the shipped file did that work.
 */
const here = fileURLToPath(new URL("./", import.meta.url));

const sourcesIn = (css: string) =>
  [...css.matchAll(/@source\s+(not\s+)?"([^"]+)"/g)].map(([, negated, path]) => ({
    path: path!,
    negated: Boolean(negated),
  }));

test("a directive the theme states is read as what it says", () => {
  expect(sourcesIn('@source "./components";\n@source not "./components/*.test.*";')).toEqual([
    { path: "./components", negated: false },
    { path: "./components/*.test.*", negated: true },
  ]);
  expect(sourcesIn("/* nothing here */")).toEqual([]);
});

/** A named directory means everything under it, which is how Tailwind reads one. */
const reaches = (pattern: string) =>
  globSync(
    statSync(new URL(pattern, import.meta.url), { throwIfNoEntry: false })?.isDirectory()
      ? `${pattern}/**/*`
      : pattern,
    { cwd: here },
  );

test("every file that declares classes sits where the theme sends a consumer's build", () => {
  const stated = sourcesIn(readFileSync(new URL("./theme.css", import.meta.url), "utf8"));
  const skipped = new Set(
    stated.filter(({ negated }) => negated).flatMap(({ path }) => reaches(path)),
  );
  const scanned = new Set(
    stated
      .filter(({ negated }) => !negated)
      .flatMap(({ path }) => reaches(path))
      .filter((file) => !skipped.has(file)),
  );

  const declaring = globSync("**/*.{ts,tsx}", { cwd: here })
    .filter((file) => !file.includes(".test."))
    .filter((file) => /\btv\(/.test(readFileSync(new URL(file, import.meta.url), "utf8")));

  expect(declaring.length).toBeGreaterThan(40);
  expect(declaring.filter((file) => !scanned.has(file)).sort()).toEqual([]);
});
