/**
 * Architecture gate: the pure core stays pure.
 *
 * The framework's central claim is that every state transition is a plain
 * `(state, action)` function over serializable data — no React, no observable runtime,
 * no `three`. `README.md` and `CONTRIBUTING.md` both once said a test enforced this.
 * **No such test existed.** It held by construction and by reading, and nothing stopped
 * the next contributor from importing an observable into `reducer.ts`.
 *
 * This crawls the real import graph from each pure-core root and fails if any of them can
 * reach a runtime dependency. Type-only imports are ignored: `import type { … }` and
 * `import { type X }` erase before runtime, so they cannot drag a package into the core.
 *
 * Reads source, needs no build, resolves its own paths.
 *
 * Run: node ./scripts/verify-pure-core.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(packageRoot, "src");

/**
 * A pure-core root is a module a consumer may drive headlessly: the reducer and everything
 * the reducer's vocabulary is built from. Anything that legitimately holds React or Legend
 * State — `store`, `rasterization`, `visibility`, `canvas-handle`, every `.tsx` — is simply
 * not a root, and reaching one of them from a root is itself the failure.
 */
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
  "scene-model.ts",
  "selection.ts",
  "snap-candidates.ts",
  "snap-resolver.ts",
  "snap.ts",
  "spatial-target.ts",
  "validation.ts",
  "window-focus.ts",
  "window-placement.ts",
  "window-presence.ts",
  "window-proxy.ts",
];

/** Runtime dependencies the core must never reach. Type-only use of these is fine. */
const FORBIDDEN_PACKAGES = new Set([
  "@legendapp/state",
  "@react-three/fiber",
  "@zumer/snapdom",
  "react",
  "react-dom",
  "three",
]);

/**
 * The crawl must reach substantially more than its roots, or it proves nothing.
 *
 * `optional-peers.test.ts` shipped in this repo passing vacuously: its regex missed
 * `export … from`, so the barrel crawl reached exactly one module and asserted nothing
 * about the other forty-five. A coverage floor is the cheapest defence against repeating
 * that, and it fails loudly if a refactor quietly disconnects the graph.
 */
const MINIMUM_REACHED_MODULES = 25;

const toPackageName = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

/**
 * Value-import specifiers only. A statement whose every binding is a type erases entirely.
 *
 * Matches `import … from "x"`, `export … from "x"`, and bare `import "x"` (side effects
 * are exactly what must not sneak in). Skips `import type { … } from "x"` outright, and
 * skips a brace clause in which every specifier is `type`-prefixed.
 */
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

      // `export * from` has no braces; an all-`type` clause contributes no runtime edge.
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

  // Depth-first, remembering how we got here: "reducer.ts imports @legendapp/state" is
  // actionable, "something imports @legendapp/state" is not.
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
