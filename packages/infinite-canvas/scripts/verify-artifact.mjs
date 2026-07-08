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
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(packageRoot, "dist");
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

if (!existsSync(dist)) {
  console.error("dist/ is missing — run `vp pack` before verifying.");
  process.exit(1);
}

// 1. Every file promised by publishConfig.exports must exist on disk.
for (const [subpath, target] of Object.entries(manifest.publishConfig.exports)) {
  if (typeof target !== "string" || !target.startsWith("./dist")) continue;
  check(
    existsSync(join(packageRoot, target)),
    `publishConfig.exports["${subpath}"] points at ${target}, which does not exist`,
  );
}

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

// 4. Nothing may be imported that consumers were not told to install.
const declared = new Set([
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.peerDependencies ?? {}),
]);
const imported = [...bundle.matchAll(/^import\s[^\n]*?from\s*["']([^"']+)["']/gm)]
  .map((match) => match[1])
  .filter((specifier) => !specifier.startsWith("."))
  .map((specifier) =>
    specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0],
  );
for (const specifier of new Set(imported)) {
  check(
    declared.has(specifier),
    `dist imports "${specifier}" but it is neither a dependency nor a peerDependency`,
  );
}

// 5. Type declarations must ship and resolve the public entry.
check(types.length > 0, "dist/index.d.mts is empty");
check(
  /InfiniteCanvasDesktop/.test(types),
  "dist/index.d.mts does not declare InfiniteCanvasDesktop — dts emit is broken",
);

// 6. The npm name must be one we can actually publish.
check(manifest.name.startsWith("@"), `unscoped name "${manifest.name}" is taken on npm`);

if (failures.length > 0) {
  console.error("Package artifact verification FAILED:\n");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(
  `Package artifact OK — ${manifest.name}@${manifest.version}, ` +
    `${(bundle.length / 1024).toFixed(0)} KB esm, imports: ${[...new Set(imported)].join(", ")}`,
);
