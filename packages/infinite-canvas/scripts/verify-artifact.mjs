/**
 * Publish gate: assert the built artifact is actually consumable.
 *
 * The workspace resolves `@infinite-canvas/react` to `src/` via source-linked
 * exports, which hides every packaging bug from the dev loop and the test
 * suite. These invariants are only observable on `dist/`, so they are checked
 * here and wired into CI + `prepublishOnly`.
 *
 * Run: node ./scripts/verify-artifact.mjs   (after `vp pack`)
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(packageRoot, "dist");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

/** Bare specifiers statically imported by an ESM chunk, collapsed to package names. */
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

// 1. Every file promised by publishConfig.exports must exist on disk — and for
//    every JS entry, so must the sibling declaration file that TypeScript's
//    `bundler` resolution looks for. A missing one degrades the subpath to
//    `any` without any build error.
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

const bundle = readFileSync(join(dist, "index.mjs"), "utf8");
const types = readFileSync(join(dist, "index.d.mts"), "utf8");

// 2. This is a hooks/DOM/WebGPU client library. Without the directive as the
//    bundle's first statement, React Server Component consumers break on
//    import. The bundler flattens the per-file directives away.
check(
  /^["']use client["'];/.test(bundle.trimStart()),
  '"use client" is not the first statement of dist/index.mjs (RSC consumers will break)',
);

// 3. snapdom must stay lazy — it is a heavy DOM-serialization fallback that
//    most consumers never hit. A static import would pull it into every bundle.
check(
  !/^import[^\n]*@zumer\/snapdom/m.test(bundle),
  "@zumer/snapdom became a static import; it must remain dynamically imported",
);

// 4. `three` and `@react-three/fiber` are declared optional peers. That promise
//    holds only if the 3D engine is reachable from the ./scene entry and from
//    nowhere else — not even a dynamic import(), because bundlers follow static
//    specifiers into lazy chunks and fail to resolve the peer at build time.
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
  // Vacuity guard: if ./scene stopped importing the engine, the check above
  // would pass while proving nothing.
  check(
    sceneImports.has(peer),
    `dist/scene.mjs does not import "${peer}" — the ./scene entry is supposed to own the 3D engine`,
  );
}
// A dynamic import of the scene chunk from the main entry would re-couple them:
// the bundler resolves the specifier eagerly even though the module loads late.
check(
  ![...entryDynamicImports].some((specifier) => specifier.includes("scene")),
  "dist/index.mjs dynamically imports the scene chunk. Bundlers resolve dynamic-import " +
    "specifiers at build time, so this makes `three` a hard requirement again: " +
    `${[...entryDynamicImports].join(", ")}`,
);

// 5. Nothing may be imported that consumers were not told to install — in *any*
//    chunk, not just the entry. Lazy chunks resolve at runtime, so an undeclared
//    import there is a crash the entry-only check would have missed.
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

// 6. Type declarations must ship and resolve the public entry.
check(types.length > 0, "dist/index.d.mts is empty");
check(
  /InfiniteCanvasDesktop/.test(types),
  "dist/index.d.mts does not declare InfiniteCanvasDesktop — dts emit is broken",
);
// Declarations share the bundler's output pipeline, so the "use client" banner
// can silently leak into them. A directive prologue is a statement, and
// statements are illegal in an ambient context: every consumer who has not set
// `skipLibCheck` then fails to compile with TS1036.
for (const declaration of readdirSync(dist).filter((file) => file.endsWith(".d.mts"))) {
  check(
    !/^["']use client["'];/.test(readFileSync(join(dist, declaration), "utf8").trimStart()),
    `dist/${declaration} starts with a "use client" directive — consumers without ` +
      "skipLibCheck will fail with TS1036 (statements are not allowed in ambient contexts)",
  );
}

// 7. The npm name must be one we can actually publish.
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
