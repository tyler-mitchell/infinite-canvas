import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";

const srcDirectory = dirname(fileURLToPath(import.meta.url));

/**
 * Every package of the GPU stack. `typegpu` and `@typegpu/react` are optional
 * peers; `@typegpu/sdf` and `@typegpu/noise` are dependencies. Both kinds
 * belong here: the crawl stops at a package boundary, so reaching `sdf` from
 * the public entry would pull `typegpu` in transitively and go unseen.
 */
const GPU_STACK_PACKAGES = ["typegpu", "@typegpu/react", "@typegpu/sdf", "@typegpu/noise"];

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

test("the public entry never statically reaches the GPU stack", () => {
  const { packages } = crawlStaticGraph(join(srcDirectory, "index.ts"));

  expect(GPU_STACK_PACKAGES.filter((name) => packages.has(name))).toEqual([]);
});

test("the public entry never statically reaches the compositor backend", () => {
  const { modules } = crawlStaticGraph(join(srcDirectory, "index.ts"));
  const reachable = [...modules]
    .map((file) => file.slice(srcDirectory.length + 1))
    .filter(
      (name) => name.startsWith("compositor/backend/") || name.startsWith("compositor/passes/"),
    );

  expect(reachable).toEqual([]);
});

test("the public entry never dynamically imports the compositor either", () => {
  const { modules } = crawlStaticGraph(join(srcDirectory, "index.ts"));
  const offenders = [...modules]
    .filter((file) =>
      /import\(\s*["'][^"']*(compositor\/backend|compositor\/passes|scene)["']/.test(
        readFileSync(file, "utf8"),
      ),
    )
    .map((file) => file.slice(srcDirectory.length + 1));

  expect(offenders).toEqual([]);
});

test("the ./scene entry is what owns the GPU stack", () => {
  const { packages } = crawlStaticGraph(join(srcDirectory, "scene.ts"));

  // This assertion prevents a vacuous reachability test.
  expect(GPU_STACK_PACKAGES.filter((name) => packages.has(name)).sort()).toEqual(
    [...GPU_STACK_PACKAGES].sort(),
  );
});
