import { readdirSync, readFileSync } from "node:fs";

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
 * A component whose props type has no name leaves a consumer writing `React.ComponentProps<"div">`
 * and guessing the element, which stops being true the moment the component draws a different one.
 * Eight did — four parts of the receipt, two of the accordion, a menu shortcut and a dialog footer
 * — while `Receipt` in the same file exported a name for exactly that shape.
 *
 * The text roles share one `TextProps` and are right as they are, which is why this asks whether
 * the type has a name rather than whether an `XProps` exists for every `X`.
 *
 * Whether a named type then reaches the entry is `index.test.ts`, which asks it of every type a
 * component declares — a wider question than this one, and already answered there.
 */
const componentDir = new URL("./components/", import.meta.url);

const anonymousProps = (sources: readonly { readonly file: string; readonly source: string }[]) =>
  sources
    .flatMap(({ file, source }) =>
      [...source.matchAll(/^function (\w+)\(\{[\s\S]*?\}: ([^)]+)\) \{$/gm)].map(
        ([, name, type]) => ({ file, name: name!, type: type!.trim() }),
      ),
    )
    .filter(({ type }) => !/^\w+$/.test(type))
    .map(({ file, name, type }) => `${name} takes ${type} (${file})`)
    .sort();

test("a component whose props type has no name is reported", () => {
  const named = [{ file: "a.tsx", source: "function Rule({ className }: RuleProps) {\n" }];
  const bare = [
    { file: "a.tsx", source: 'function Rule({ className }: React.ComponentProps<"div">) {\n' },
  ];

  expect(anonymousProps(named)).toEqual([]);
  expect(anonymousProps(bare)).toEqual(['Rule takes React.ComponentProps<"div"> (a.tsx)']);
});

test("every component names the props type it takes", () => {
  const sources = readdirSync(componentDir)
    .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
    .map((file) => ({ file, source: readFileSync(new URL(file, componentDir), "utf8") }));

  expect(sources.length).toBeGreaterThan(30);
  expect(anonymousProps(sources)).toEqual([]);
});
