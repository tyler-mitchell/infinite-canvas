/**
 * API gate: assert every public name carries a stability promise, and that the promise is written
 * down where a consumer will read it.
 *
 * `docs/API.md` says what the surface *is*. Nothing said what any of it *means*. 374 names shipped
 * from two barrels with no tier, which is not "no promise" — it is an implicit promise of
 * stability on all 374, made by silence, including on modules nobody has ever watched run. That is
 * the same class of error `verify-api-doc.mjs` was written for: a claim with nothing enforcing it.
 *
 * Classification is by **module**, not by name, and the asymmetry is the point. Adding
 * `getRectArea` to `geometry.ts` should inherit stable without anyone touching a manifest — the
 * module already decided. Adding a whole module to a barrel should stop the build until someone
 * says what it promises. `types.ts` is the exception, because it is a grab-bag holding
 * `InfiniteCanvasSceneLayer` next to `InfiniteCanvasRect`; its experimental names are listed one by
 * one and checked to still exist.
 *
 * Reads source rather than `dist/`, so it runs without a build and can gate `vp check`.
 *
 * Run: node ./scripts/verify-api-stability.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));
const apiDocPath = join(repoRoot, "docs", "API.md");
const manifestPath = join(packageRoot, "scripts", "api-stability.json");

const BARRELS = [
  { entry: ".", path: join(packageRoot, "src", "index.ts"), prefix: "" },
  { entry: "./scene", path: join(packageRoot, "src", "scene.ts"), prefix: "scene:" },
];

const TYPES_MODULE = "types";

const stripComments = (source) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*/g, "");

/**
 * `[{ module, names }]` for every re-export block, keyed by the module it re-exports from.
 *
 * The same shape `verify-api-doc.mjs` parses, plus the source specifier — which is what makes
 * module-level classification possible at all. Both barrels are exclusively re-export blocks; the
 * doc gate already refuses to run if that stops being true, so this one does not repeat the check.
 */
const getBarrelModules = (source, prefix) => {
  const byModule = new Map();

  for (const match of stripComments(source).matchAll(
    /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g,
  )) {
    const module = prefix + match[2].replace(/^\.\//, "");
    const names = byModule.get(module) ?? new Set();

    for (const raw of match[1].split(",")) {
      const specifier = raw.trim();
      if (specifier === "") continue;

      const bare = specifier.startsWith("type ") ? specifier.slice(5) : specifier;
      const name = bare.split(" as ").pop().trim();
      if (name !== "") names.add(name);
    }

    byModule.set(module, names);
  }

  return byModule;
};

const failures = [];
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const stable = new Set(manifest.stable);
const experimental = new Map(Object.entries(manifest.experimental));
const typesExperimental = new Set(manifest.typesExperimental);

const seenModules = new Set();
const experimentalNames = new Set();
// Sets, not counters: `scene-surface` is re-exported from both barrels, and a name counted twice
// would inflate the surface the gate reports. The number is the point of the line it prints.
const stableNames = new Set();

for (const { entry, path, prefix } of BARRELS) {
  for (const [module, names] of getBarrelModules(readFileSync(path, "utf8"), prefix)) {
    seenModules.add(module);

    const isStable = stable.has(module);
    const isExperimental = experimental.has(module);

    if (isStable === isExperimental) {
      failures.push(
        isStable
          ? `${entry}: module "${module}" is in both tiers of scripts/api-stability.json`
          : `${entry}: module "${module}" is exported but classified in neither tier of ` +
              "scripts/api-stability.json. Decide what it promises before it reaches a consumer.",
      );
      continue;
    }

    for (const name of names) {
      // `types.ts` is stable as a module and experimental in places. Its overrides win.
      const nameIsExperimental =
        module === TYPES_MODULE ? typesExperimental.has(name) : isExperimental;

      if (nameIsExperimental) experimentalNames.add(name);
      else stableNames.add(name);
    }
  }
}

for (const module of [...stable, ...experimental.keys()]) {
  if (!seenModules.has(module)) {
    failures.push(
      `scripts/api-stability.json classifies "${module}", which no barrel re-exports from. ` +
        "A stale entry means the manifest is describing a surface that no longer exists.",
    );
  }
}

// A `typesExperimental` name that `types.ts` no longer exports would quietly demote nothing while
// reading as though it demoted something. The empty-set case is the dangerous one: rename every
// scene type and this list still passes, still looks like a promise, and covers nothing.
const typeNames = new Set();
for (const { path, prefix } of BARRELS) {
  const module = getBarrelModules(readFileSync(path, "utf8"), prefix).get(TYPES_MODULE);
  if (module !== undefined) for (const name of module) typeNames.add(name);
}
for (const name of typesExperimental) {
  if (!typeNames.has(name)) {
    failures.push(
      `scripts/api-stability.json lists \`${name}\` as an experimental type, but types.ts ` +
        "no longer exports it.",
    );
  }
}

// The manifest is machine truth; docs/API.md is where a consumer looks. Neither is allowed to
// drift from the other, or the promise exists only in a file nobody installs.
const apiDoc = readFileSync(apiDocPath, "utf8");
const stabilitySection = /\n## Stability\n([\s\S]*?)(?=\n## |$)/.exec(apiDoc);

if (stabilitySection === null) {
  failures.push(
    "docs/API.md has no `## Stability` section. The tiers must be readable by a human.",
  );
} else {
  const documented = new Set(
    [...stabilitySection[1].matchAll(/`([\w:$-]+)`/g)].map((match) => match[1]),
  );

  for (const module of experimental.keys()) {
    if (!documented.has(module)) {
      failures.push(
        `docs/API.md's Stability section does not name the experimental module \`${module}\`.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Public API stability verification FAILED:\n");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(
    `\n${failures.length} problem(s). Classify the module in scripts/api-stability.json ` +
      "and name it in docs/API.md's Stability section.",
  );
  process.exit(1);
}

console.log(
  `Public API stability OK — ${stableNames.size} stable and ${experimentalNames.size} experimental ` +
    `names across ${seenModules.size} modules, tiers agree with docs/API.md`,
);
