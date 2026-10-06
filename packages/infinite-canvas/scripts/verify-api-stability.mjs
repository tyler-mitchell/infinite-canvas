/** Fails when public module and type stability tiers are incomplete. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));
const apiDocPath = join(repoRoot, "docs", "API.md");
const manifestPath = join(packageRoot, "scripts", "api-stability.json");

const BARRELS = [
  { entry: "./legacy", path: join(packageRoot, "legacy", "index.ts"), prefix: "" },
  { entry: "./legacy/core", path: join(packageRoot, "legacy", "core.ts"), prefix: "" },
  { entry: "./legacy/scene", path: join(packageRoot, "legacy", "scene.ts"), prefix: "scene:" },
];

const TYPES_MODULE = "types";

const stripComments = (source) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*/g, "");

/** Returns exported names grouped by source module. */
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
// Use sets because both barrels can export the same name.
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
      // Type overrides take priority over the module tier.
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

// Reject stale experimental type overrides.
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

// Keep machine tiers and API documentation aligned.
const apiDoc = readFileSync(apiDocPath, "utf8");
const stabilitySection = /\n## Stability\n([\s\S]*?)(?=\n## |$)/.exec(apiDoc);

if (stabilitySection === null) {
  failures.push(
    "docs/API.md has no `## Stability` section. The tiers must be readable by a human.",
  );
} else {
  const documented = new Set(
    // Nested compositor modules carry a slash, as in `scene:compositor/pass`.
    [...stabilitySection[1].matchAll(/`([\w:$/-]+)`/g)].map((match) => match[1]),
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
