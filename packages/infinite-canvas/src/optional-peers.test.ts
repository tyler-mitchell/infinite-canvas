import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

import { getInfiniteCanvasMissingSceneSurfaceWarning } from "./infinite-canvas";

const srcDirectory = dirname(fileURLToPath(import.meta.url));

const OPTIONAL_3D_PEERS = ["three", "@react-three/fiber"];

function getStaticImports(text: string) {
  return [
    ...text.matchAll(/^(?:import|export)\s+(?!type\b)[\w\s{},*$]*?\bfrom\s*["']([^"']+)["']/gm),
  ].map((match) => match[1] as string);
}

function resolveLocalModule(fromFile: string, specifier: string) {
  const base = join(dirname(fromFile), specifier);

  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function crawlStaticGraph(entry: string) {
  const modules = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;

    if (modules.has(file)) continue;
    modules.add(file);

    for (const specifier of getStaticImports(readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".")) {
        packages.add(
          specifier.startsWith("@")
            ? specifier.split("/").slice(0, 2).join("/")
            : (specifier.split("/")[0] as string),
        );
        continue;
      }

      const resolved = resolveLocalModule(file, specifier);

      if (resolved !== null) queue.push(resolved);
    }
  }

  return { modules, packages };
}

test("the public entry never statically reaches a 3D engine", () => {
  const { packages } = crawlStaticGraph(join(srcDirectory, "index.ts"));

  expect(OPTIONAL_3D_PEERS.filter((peer) => packages.has(peer))).toEqual([]);
});

test("the public entry never statically reaches the WebGPU surface", () => {
  const { modules } = crawlStaticGraph(join(srcDirectory, "index.ts"));
  const reachable = [...modules]
    .map((file) => file.slice(srcDirectory.length + 1))
    .filter((name) => name === "webgpu-surface.tsx" || name === "visibility-probes.tsx");

  expect(reachable).toEqual([]);
});

test("the public entry never dynamically imports the WebGPU surface either", () => {
  const { modules } = crawlStaticGraph(join(srcDirectory, "index.ts"));
  const offenders = [...modules]
    .filter((file) =>
      /import\(\s*["'][^"']*(webgpu-surface|visibility-probes|scene)["']/.test(
        readFileSync(file, "utf8"),
      ),
    )
    .map((file) => file.slice(srcDirectory.length + 1));

  expect(offenders).toEqual([]);
});

test("the ./scene entry is what owns the 3D engine", () => {
  const { packages } = crawlStaticGraph(join(srcDirectory, "scene.ts"));

  // This assertion prevents a vacuous reachability test.
  expect(OPTIONAL_3D_PEERS.filter((peer) => packages.has(peer)).sort()).toEqual(
    [...OPTIONAL_3D_PEERS].sort(),
  );
});

test("omitting sceneSurface warns instead of silently dropping scene content", () => {
  expect(getInfiniteCanvasMissingSceneSurfaceWarning(2, false, false)).toMatch(
    /`sceneLayers` were provided without a `sceneSurface`/,
  );
  expect(getInfiniteCanvasMissingSceneSurfaceWarning(0, true, false)).toMatch(
    /`diagnostics\.frustum` needs a `sceneSurface`/,
  );
});

test("a supplied sceneSurface, or nothing to render, stays quiet", () => {
  expect(getInfiniteCanvasMissingSceneSurfaceWarning(2, true, true)).toBeNull();
  expect(getInfiniteCanvasMissingSceneSurfaceWarning(0, false, false)).toBeNull();
});
