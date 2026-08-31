import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

const raw = readFileSync(fileURLToPath(new URL("minimap.tsx", import.meta.url)), "utf8");

const source = raw
  .replaceAll(/\/\*[\s\S]*?\*\//g, (match) => match.replaceAll(/[^\n]/g, " "))
  .replaceAll(/\/\/[^\n]*/g, (match) => " ".repeat(match.length));

const variants = /variants:\s*\{([\s\S]*?)\n {2}\},/.exec(source)?.[1] ?? "";

const viewportSlot = /viewport:\s*"([^"]*)"/.exec(source)?.[1] ?? "";

test("the file still has the two shapes this guard reads", () => {
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
  expect(variants, "a window state is using the accent the camera frame owns").not.toContain(
    "--accent",
  );
});

test("window states are still distinguishable from each other", () => {
  const fills = [...variants.matchAll(/fill-\[var\((--[\w-]+)\)\]/g)].map((match) => match[1]);

  expect(fills.length).toBe(3);
  expect(new Set(fills).size, `states share a fill: ${fills.join(", ")}`).toBe(3);
});
