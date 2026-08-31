/** Examines the packed artifact after `vp pack`. */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(packageRoot, "dist");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

/** Returns bare package names from static ESM imports. */
const getStaticImports = (source) =>
  [...source.matchAll(/^import\s[^\n]*?from\s*["']([^"']+)["']/gm)]
    .map((match) => match[1])
    .filter((specifier) => !specifier.startsWith("."))
    .map((specifier) =>
      specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0],
    );

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

if (!existsSync(dist)) {
  console.error("dist/ is missing — run `vp pack` before verifying.");
  process.exit(1);
}

// Export targets and declaration siblings must exist.
for (const [subpath, target] of Object.entries(manifest.publishConfig.exports)) {
  if (typeof target !== "string" || !target.startsWith("./dist")) continue;
  check(
    existsSync(join(packageRoot, target)),
    `publishConfig.exports["${subpath}"] points at ${target}, which does not exist`,
  );
  if (!target.endsWith(".mjs")) continue;
  const declaration = `${target.slice(0, -".mjs".length)}.d.mts`;
  check(
    existsSync(join(packageRoot, declaration)),
    `publishConfig.exports["${subpath}"] has no declaration file at ${declaration}`,
  );
}
check(
  manifest.publishConfig.exports["./scene"] !== undefined,
  'publishConfig.exports is missing "./scene" — the 3D entry consumers import',
);

// Package-root legal and orientation files must exist.
for (const required of ["LICENSE", "README.md"]) {
  check(
    existsSync(join(packageRoot, required)),
    `${required} is missing from the package root, so npm will not pack it — ` +
      "npm looks for it beside package.json, not at the repository root",
  );
}

check(
  typeof manifest.license === "string" && manifest.license.length > 0,
  "package.json declares no license",
);

// README imports must exist in source barrels.
const barrelExports = (entry) => {
  const source = readFileSync(join(packageRoot, "src", entry), "utf8")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/\/\/.*/g, "");

  return new Set(
    [...source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)].flatMap((match) =>
      match[1]
        .split(",")
        .map((specifier) =>
          specifier
            .trim()
            .replace(/^type\s+/, "")
            .split(" as ")
            .pop()
            ?.trim(),
        )
        .filter((name) => name !== undefined && name !== ""),
    ),
  );
};

const README_BARRELS = {
  [manifest.name]: barrelExports("index.ts"),
  [`${manifest.name}/scene`]: barrelExports("scene.ts"),
};
const readme = readFileSync(join(packageRoot, "README.md"), "utf8");

for (const match of readme.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
  const surface = README_BARRELS[match[2]];

  if (surface === undefined) continue;

  for (const specifier of match[1].split(",")) {
    const name = specifier
      .trim()
      .replace(/^type\s+/, "")
      .trim();

    check(
      name === "" || surface.has(name),
      `README.md imports \`${name}\` from "${match[2]}", which no longer exports it`,
    );
  }
}

const bundle = readFileSync(join(dist, "index.mjs"), "utf8");
const types = readFileSync(join(dist, "index.d.mts"), "utf8");

// Require the client directive as the first bundle statement.
check(
  /^["']use client["'];/.test(bundle.trimStart()),
  '"use client" is not the first statement of dist/index.mjs (RSC consumers will break)',
);

// Keep snapdom lazy.
check(
  !/^import[^\n]*@zumer\/snapdom/m.test(bundle),
  "@zumer/snapdom became a static import; it must remain dynamically imported",
);

// Keep optional 3D peers isolated to the scene entry.
const OPTIONAL_3D_PEERS = ["three", "@react-three/fiber"];
const sceneBundle = readFileSync(join(dist, "scene.mjs"), "utf8");
const entryImports = new Set(getStaticImports(bundle));
const sceneImports = new Set(getStaticImports(sceneBundle));
const entryDynamicImports = new Set(
  [...bundle.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]),
);
for (const peer of OPTIONAL_3D_PEERS) {
  check(
    !entryImports.has(peer),
    `dist/index.mjs statically imports "${peer}", but it is declared an optional peer. ` +
      "The 3D engine must be reachable only from the ./scene entry.",
  );
  check(
    manifest.peerDependenciesMeta?.[peer]?.optional === true,
    `peerDependenciesMeta["${peer}"].optional must be true`,
  );
  // Require the scene entry to import each optional 3D peer.
  check(
    sceneImports.has(peer),
    `dist/scene.mjs does not import "${peer}" — the ./scene entry is supposed to own the 3D engine`,
  );
}
// Keep the main entry independent of the scene chunk.
check(
  ![...entryDynamicImports].some((specifier) => specifier.includes("scene")),
  "dist/index.mjs dynamically imports the scene chunk. Bundlers resolve dynamic-import " +
    "specifiers at build time, so this makes `three` a hard requirement again: " +
    `${[...entryDynamicImports].join(", ")}`,
);

// Reject undeclared imports from all runtime chunks.
const declared = new Set([
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
]);
const chunks = readdirSync(dist).filter((file) => file.endsWith(".mjs"));
for (const chunk of chunks) {
  for (const specifier of getStaticImports(readFileSync(join(dist, chunk), "utf8"))) {
    check(
      declared.has(specifier),
      `dist/${chunk} imports "${specifier}" but it is neither a dependency nor a peerDependency`,
    );
  }
}

// Public declarations must exist in emitted types.
check(types.length > 0, "dist/index.d.mts is empty");
check(
  /InfiniteCanvasDesktop/.test(types),
  "dist/index.d.mts does not declare InfiniteCanvasDesktop — dts emit is broken",
);
// Reject client directives in ambient declaration files.
for (const declaration of readdirSync(dist).filter((file) => file.endsWith(".d.mts"))) {
  check(
    !/^["']use client["'];/.test(readFileSync(join(dist, declaration), "utf8").trimStart()),
    `dist/${declaration} starts with a "use client" directive — consumers without ` +
      "skipLibCheck will fail with TS1036 (statements are not allowed in ambient contexts)",
  );
}

// Require a publishable scoped package name.
check(manifest.name.startsWith("@"), `unscoped name "${manifest.name}" is taken on npm`);

if (failures.length > 0) {
  console.error("Package artifact verification FAILED:\n");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(
  `Package artifact OK — ${manifest.name}@${manifest.version}, ` +
    `${(bundle.length / 1024).toFixed(0)} KB entry across ${chunks.length} chunks, ` +
    `entry imports: ${[...entryImports].filter((s) => !s.startsWith(".")).join(", ")} | ` +
    `scene entry owns: ${OPTIONAL_3D_PEERS.join(", ")}`,
);
