import { describe, expect, test } from "vite-plus/test";
import * as cpuApi from "./cpu";
import * as gpuApi from "./gpu";

// The layout engine reads README.md rather than this source before adopting the package, so a name
// the README lists that the entry does not export sends a consumer at an import that fails. Prose
// drifts silently; this makes the README's import blocks a checked claim.
const readme = Object.values(
  import.meta.glob("../README.md", { query: "?raw", import: "default", eager: true }),
).join("\n") as string;

// Trailing comments in the import blocks spell out type shapes, and those contain braces, which
// would end the match early. Stripping them first is why this reads a comment-free copy.
const withoutComments = readme.replace(/\/\/[^\n]*/g, "");

const importBlock = /import\s*\{([^}]+)\}\s*from\s*"@hyphened\/math\/(cpu|gpu)"/g;

type Listed = { name: string; entry: "cpu" | "gpu"; isType: boolean };

const listed: Listed[] = [...withoutComments.matchAll(importBlock)].flatMap(([, names, entry]) =>
  names!
    .split(",")
    .map((piece) => piece.replace(/\/\/.*$/, "").trim())
    .filter((piece) => piece.length > 0)
    .map((piece) => ({
      name: piece.replace(/^type\s+/, "").trim(),
      entry: entry as "cpu" | "gpu",
      isType: piece.startsWith("type "),
    })),
);

describe("the README describes the surface that exists", () => {
  test("the README shows imports from both entries", () => {
    expect(listed.filter((entry) => entry.entry === "cpu").length).toBeGreaterThan(10);
    expect(listed.filter((entry) => entry.entry === "gpu").length).toBeGreaterThan(2);
  });

  // Types erase, so only runtime values can be checked here. A type the README names wrongly is
  // caught by the typecheck of any file that imports it, which is not this file's job.
  test("every runtime name the README imports is exported by that entry", () => {
    const api = { cpu: cpuApi, gpu: gpuApi };
    const missing = listed
      .filter((entry) => !entry.isType)
      .filter((entry) => !(entry.name in api[entry.entry]))
      .map(
        (entry) => `README imports ${entry.name} from ./${entry.entry}, which does not export it`,
      );
    expect([...new Set(missing)]).toEqual([]);
  });

  test("the README does not name the deleted root entry", () => {
    expect(readme).not.toMatch(/from\s*"@hyphened\/math"/);
  });

  test("the names the layout engine asked to be pinned are on ./cpu", () => {
    [
      "containsPoint",
      "intersectsRect",
      "outsetRectBy",
      "resizeRect",
      "screenToWorld",
      "unionRects",
      "worldToScreen",
    ].forEach((name) => {
      expect(Object.keys(cpuApi)).toContain(name);
      expect(readme).toContain(name);
    });
  });
});
