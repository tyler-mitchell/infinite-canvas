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
 */
test("every variants export is callable and yields its slots", () => {
  const variants = Object.entries(kit).filter(([name]) => name.endsWith("Variants"));

  expect(variants.length).toBeGreaterThan(25);

  const broken = variants.filter(([, value]) => typeof value !== "function");

  expect(broken.map(([name]) => name)).toEqual([]);
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
