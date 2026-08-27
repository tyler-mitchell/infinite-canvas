import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

/**
 * On the map, the accent means one thing: where the camera is looking.
 *
 * It meant two. The viewport frame is stroked `--accent` and the *active window* was filled with it,
 * so a box 156px wide carried one hue for two unrelated facts — and because the active window is
 * usually inside the visible rect, the ordinary case was an accent rectangle sitting inside an
 * accent outline. Neither read as itself.
 *
 * The frame keeps the hue because "where am I in this canvas" is the question only a minimap
 * answers; which window is active is already obvious on the canvas, where that window is the one
 * wearing chrome and focus. Window state ranks by brightness instead, which still puts the active
 * one first without spending the one colour the map has.
 *
 * Scanned rather than asserted against a rendered tree, for the reason every guard in this app is:
 * there are no component tests here, and the thing worth protecting is a rule about the stylesheet
 * rather than about a DOM. What this catches is someone reaching for `--accent` to make a window
 * state louder, which is exactly how it got in the first time.
 */

const raw = readFileSync(fileURLToPath(new URL("minimap.tsx", import.meta.url)), "utf8");

/**
 * Comments blanked, not deleted, so line positions survive and prose cannot trip the scan.
 *
 * The first run of this guard failed on its own docstring, which names `--accent` while explaining
 * why no window state may use it. That is the same way the theme-token guard failed the first time
 * it ran — a scan that reads prose is measuring what the file *says* rather than what it does.
 */
const source = raw
  .replaceAll(/\/\*[\s\S]*?\*\//g, (match) => match.replaceAll(/[^\n]/g, " "))
  .replaceAll(/\/\/[^\n]*/g, (match) => " ".repeat(match.length));

/** The `variants` block, which is where window state is expressed. */
const variants = /variants:\s*\{([\s\S]*?)\n {2}\},/.exec(source)?.[1] ?? "";

/** The `viewport` slot's own declaration, wherever it sits in the slots block. */
const viewportSlot = /viewport:\s*"([^"]*)"/.exec(source)?.[1] ?? "";

test("the file still has the two shapes this guard reads", () => {
  // A refactor that renamed either would leave every assertion below comparing empty strings and
  // passing by knowing nothing.
  expect(variants, "no variants block found").not.toBe("");
  expect(viewportSlot, "no viewport slot found").not.toBe("");
  expect(variants).toContain("active:");
  expect(variants).toContain("idle:");
  expect(variants).toContain("selected:");
});

test("the camera frame is the thing wearing the accent", () => {
  expect(viewportSlot).toContain("--accent");
});

test("no window state spends the accent, whatever it is trying to emphasise", () => {
  /*
   * `active: { window: "fill-[var(--accent)]" }` is what shipped. The failure is not that it was
   * invisible — it was the loudest thing on the map, competing with the one mark that had to stay
   * distinct.
   */
  expect(variants, "a window state is using the accent the camera frame owns").not.toContain(
    "--accent",
  );
});

test("window states are still distinguishable from each other", () => {
  // Removing the accent must not have collapsed the ramp into one colour, which would trade a
  // legibility problem for a worse one.
  const fills = [...variants.matchAll(/fill-\[var\((--[\w-]+)\)\]/g)].map((match) => match[1]);

  expect(fills.length).toBe(3);
  expect(new Set(fills).size, `states share a fill: ${fills.join(", ")}`).toBe(3);
});
