/**
 * Boundary gate: shipped source compiles under a *consumer's* tsconfig, not just ours.
 *
 * This package sets `"types": ["node"]`, correctly — its tests read its own source from disk
 * to enforce invariants a type cannot express, so they import `node:fs`, `node:path`, and
 * `node:url`. But the package is **source-linked** into its consumers, so a consumer
 * typechecks this source under *their* tsconfig, where those ambient globals do not exist.
 *
 * That is not hypothetical. One `process.env.NODE_ENV` in `infinite-canvas.tsx` compiled green
 * here and failed in the playground with `TS2591: Cannot find name 'process'` — and the
 * playground build stayed broken, unnoticed, because **every other gate runs inside this
 * package** and the leak is only visible from the other side of the boundary.
 *
 * So this one asks a question the others structurally cannot: does shipped source reach for an
 * ambient global its consumers will not have?
 *
 * Test files are exempt by design. They are never shipped, never source-linked into anyone, and
 * needing node is exactly what they are for.
 *
 * Reads source, needs no build, resolves its own paths.
 *
 * Run: node ./scripts/verify-consumer-portability.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(packageRoot, "src");

/**
 * Ambient globals a browser consumer's tsconfig will not have typed.
 *
 * `process` is the one that bit. It is matched as a bare identifier rather than as
 * `process.env.NODE_ENV` specifically, because the failure is the *reference*, not the property
 * — a consumer without `@types/node` cannot compile any of them.
 */
const FORBIDDEN_GLOBALS = [
  { name: "process", pattern: /(?<![.\w$])process\s*\./g },
  { name: "__dirname", pattern: /(?<![.\w$])__dirname\b/g },
  { name: "__filename", pattern: /(?<![.\w$])__filename\b/g },
  { name: "require", pattern: /(?<![.\w$])require\s*\(/g },
];

/** A `node:` import is the unambiguous form and the only one this package uses. */
const NODE_BUILTIN_IMPORT = /from\s*["']node:([a-z_/]+)["']/g;

/**
 * A module-scope `declare const process: …` shadows the global and supplies the type itself,
 * which is precisely the sanctioned fix. A file that declares what it uses is portable, so the
 * declaration is what this gate accepts — not an ignore comment, which would decay into one
 * more thing nobody reads.
 */
const localDeclaration = (source, name) =>
  new RegExp(`declare\\s+(?:const|let|var|function)\\s+${name}\\b`).test(source);

const sourceFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    // `.test.` and `.spec.` are exempt; `.d.ts` declares rather than ships behaviour.
    return /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\./.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
      ? [path]
      : [];
  });

const files = sourceFiles(sourceRoot);
const failures = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const name = relative(packageRoot, file);

  for (const global of FORBIDDEN_GLOBALS) {
    global.pattern.lastIndex = 0;

    if (global.pattern.test(source) && !localDeclaration(source, global.name)) {
      failures.push(
        `${name} references the ambient global \`${global.name}\` without declaring it. ` +
          "A consumer typechecking this source without @types/node cannot compile it — " +
          `add \`declare const ${global.name}: …\` in module scope, which shadows the global ` +
          "where one is typed and supplies the type where none is.",
      );
    }
  }

  NODE_BUILTIN_IMPORT.lastIndex = 0;

  for (const match of source.matchAll(NODE_BUILTIN_IMPORT)) {
    failures.push(
      `${name} imports \`node:${match[1]}\`. This package ships to browsers; a node builtin ` +
        "in shipped source breaks any consumer that does not bundle for node.",
    );
  }
}

/**
 * A gate that scans nothing reports success. `verify-pure-core.mjs` shipped once with a regex
 * that matched no modules and passed vacuously, so every gate here carries a floor.
 */
const MINIMUM_SCANNED_FILES = 40;

if (files.length < MINIMUM_SCANNED_FILES) {
  failures.push(
    `scanned only ${files.length} files (expected >= ${MINIMUM_SCANNED_FILES}) — ` +
      "the source tree is not being walked, so this gate is asserting nothing",
  );
}

if (failures.length > 0) {
  console.error("Consumer portability verification FAILED:\n");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(
  `Consumer portability OK — ${files.length} shipped modules reference no undeclared ambient ` +
    "global and import no node builtin",
);
