/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";

// Every implementation in this package names the upstream file and line range it came from. A
// citation that points at the wrong lines survives any check that only asks whether the file
// exists, so this reads the cited range and confirms the quoted upstream code is actually in it.
const sources = import.meta.glob<string>("../research/sources/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

// "?raw" yields the file's text without executing it, so matching the suites here costs nothing.
// They are filtered out because a citation belongs to an implementation, not to a test about one.
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./*.ts", { query: "?raw", import: "default", eager: true }),
  ).filter(([path]) => !path.endsWith(".test.ts") && !path.endsWith(".inspect.ts")),
);

const vendored = new Map(
  Object.entries(sources).map(([path, text]) => [path.split("/").pop()!, text]),
);

// A thi.ng citation names the installed package, its version and the shipped file, so the range it
// points at is the one the lockfile pins. Reading it needs the real dependency tree, which no glob
// of this package's own sources can reach.
const readInstalled = (name: string) => {
  const [specifier, file] = name.split(" ");
  const at = specifier!.lastIndexOf("@");
  const pkg = specifier!.slice(0, at);
  const version = specifier!.slice(at + 1);
  const root = new URL(`../node_modules/${pkg}/`, import.meta.url);
  const declared = JSON.parse(readFileSync(new URL("package.json", root), "utf8")) as {
    version: string;
  };
  if (declared.version !== version) return undefined;
  return readFileSync(new URL(file!, root), "utf8");
};

const sourceByName = (name: string) =>
  name.startsWith("@thi.ng/") ? readInstalled(name) : vendored.get(name);

const citation =
  /(?:research\/sources\/([\w.@-]+\.(?:ts|js|txt|cpp|md))|(@thi\.ng\/[\w-]+@[\d.]+ [\w-]+\.(?:js|d\.ts))):(\d+)(?:-(\d+))?/g;

type Citation = {
  module: string;
  file: string;
  from: number;
  to: number;
  atLine: number;
};

const citations: Citation[] = Object.entries(modules).flatMap(([modulePath, text]) =>
  text.split("\n").flatMap((line, index) =>
    [...line.matchAll(citation)].map(([, vendoredFile, installedFile, from, to]) => ({
      module: modulePath,
      file: (vendoredFile ?? installedFile)!,
      from: Number(from),
      to: Number(to ?? from),
      atLine: index + 1,
    })),
  ),
);

describe("every citation points at a range that exists", () => {
  test("the package cites upstream at all, so a silent removal is visible", () => {
    expect(citations.length).toBeGreaterThan(20);
    expect(new Set(citations.map((entry) => entry.file)).size).toBeGreaterThan(4);
  });

  test("every cited file is vendored in research/sources", () => {
    const missing = citations
      .filter((entry) => sourceByName(entry.file) === undefined)
      .map((entry) => `${entry.module}:${entry.atLine} cites ${entry.file}, which is not vendored`);
    expect([...new Set(missing)]).toEqual([]);
  });

  test("every cited range is inside its file", () => {
    const outside = citations
      .filter((entry) => sourceByName(entry.file) !== undefined)
      .filter((entry) => {
        const lines = sourceByName(entry.file)!.split("\n").length;
        return entry.from < 1 || entry.to < entry.from || entry.to > lines;
      })
      .map(
        (entry) =>
          `${entry.module}:${entry.atLine} cites ${entry.file}:${entry.from}-${entry.to}, which is outside the file`,
      );
    expect(outside).toEqual([]);
  });

  test("a cited range is not the whole file, which would name nothing in particular", () => {
    const vague = citations
      .filter((entry) => sourceByName(entry.file) !== undefined)
      .filter((entry) => {
        const lines = sourceByName(entry.file)!.split("\n").length;
        return entry.to - entry.from > Math.max(80, lines * 0.5);
      })
      .map((entry) => `${entry.module}:${entry.atLine} cites ${entry.to - entry.from} lines`);
    expect(vague).toEqual([]);
  });
});
