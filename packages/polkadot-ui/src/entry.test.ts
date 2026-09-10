import { readFileSync } from "node:fs";

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
