/** Fails when a pure core module reaches a renderer runtime. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(packageRoot, "src");

/** Modules that consumers can drive without a renderer. */
const PURE_CORE_ROOTS = [
  "camera-navigation.ts",
  "commands.ts",
  "constants.ts",
  "data-attributes.ts",
  "drop-interaction.ts",
  "factory.ts",
  "geometry.ts",
  "group-layout.ts",
  "group-state.ts",
  "group-tree.ts",
  "history.ts",
  "input-policy.ts",
  "interaction.ts",
  "keyboard.ts",
  "minimap.ts",
  "offscreen.ts",
  "persistence.ts",
  "recipes.ts",
  "reducer.ts",
  "registry.ts",
  "scene-layer-geometry.ts",
  "selection.ts",
  "snap-candidates.ts",
  "snap-resolver.ts",
  "spatial-target.ts",
  "validation.ts",
  "window-focus.ts",
  "window-placement.ts",
  "window-presence.ts",
  "window-proxy.ts",
];

/**
 * Runtime packages forbidden from the core graph. Every package of the GPU
 * stack belongs here, not only `typegpu`: `./scene` is the sole entry allowed
 * to reach any of them, which is what keeps those peers optional.
 */
const FORBIDDEN_PACKAGES = new Set([
  "@legendapp/state",
  "@typegpu/noise",
  "@typegpu/react",
  "@typegpu/sdf",
  "@zumer/snapdom",
  "react",
  "react-dom",
  "typegpu",
]);

/** Minimum graph size that prevents a vacuous crawl. */
const MINIMUM_REACHED_MODULES = 25;

const toPackageName = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

/** Returns value and side-effect import specifiers. */
const getRuntimeImportSpecifiers = (source) => {
  const specifiers = [];

  for (const match of source.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) {
    specifiers.push(match[1]);
  }

  for (const match of source.matchAll(
    /^\s*(?:import|export)\s+(type\s+)?([^;]*?)\bfrom\s*["']([^"']+)["']/gm,
  )) {
    const [, typePrefix, clause, specifier] = match;
    if (typePrefix !== undefined) continue;

    const braces = clause.match(/\{([^}]*)\}/);
    const hasNonBraceBinding =
      clause
        .replace(/\{[^}]*\}/, "")
        .replaceAll(",", "")
        .trim() !== "";

    if (braces !== null && !hasNonBraceBinding) {
      const bindings = braces[1]
        .split(",")
        .map((binding) => binding.trim())
        .filter((binding) => binding !== "");

      // An all-type clause has no runtime edge.
      if (bindings.length > 0 && bindings.every((binding) => binding.startsWith("type "))) {
        continue;
      }
    }

    specifiers.push(specifier);
  }

  return specifiers;
};

const resolveRelative = (specifier, fromFile) => {
  const base = normalize(join(dirname(fromFile), specifier));

  for (const extension of [".ts", ".tsx"]) {
    if (existsSync(base + extension)) return base + extension;
  }

  return null;
};

const failures = [];
const reached = new Set();

for (const root of PURE_CORE_ROOTS) {
  const rootPath = join(sourceRoot, root);

  if (!existsSync(rootPath)) {
    failures.push(`pure-core root "${root}" no longer exists — update PURE_CORE_ROOTS`);
    continue;
  }

  // Track import trails for actionable failures.
  const stack = [[rootPath, [root]]];
  const visited = new Set();

  while (stack.length > 0) {
    const [file, trail] = stack.pop();
    if (visited.has(file)) continue;
    visited.add(file);
    reached.add(file);

    for (const specifier of getRuntimeImportSpecifiers(readFileSync(file, "utf8"))) {
      if (specifier.startsWith(".")) {
        const resolved = resolveRelative(specifier, file);

        if (resolved === null) {
          failures.push(`${trail.join(" -> ")}: cannot resolve "${specifier}"`);
          continue;
        }

        stack.push([resolved, [...trail, relative(sourceRoot, resolved)]]);
        continue;
      }

      if (FORBIDDEN_PACKAGES.has(toPackageName(specifier))) {
        failures.push(
          `${trail.join(" -> ")} imports "${specifier}" at runtime — ` +
            "the pure core must stay drivable without a renderer",
        );
      }
    }
  }
}

if (reached.size < MINIMUM_REACHED_MODULES) {
  failures.push(
    `the crawl reached only ${reached.size} modules (expected >= ${MINIMUM_REACHED_MODULES}) — ` +
      "the import graph is not being walked, so this gate is asserting nothing",
  );
}

if (failures.length > 0) {
  console.error("Pure-core boundary verification FAILED:\n");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(
  `Pure-core boundary OK — ${PURE_CORE_ROOTS.length} roots reach ${reached.size} modules, ` +
    `none importing ${[...FORBIDDEN_PACKAGES].join(", ")}`,
);
