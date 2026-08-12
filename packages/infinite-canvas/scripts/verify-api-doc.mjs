/**
 * Docs gate: assert `docs/API.md` still describes the public surface.
 *
 * `README.md` points consumers at `docs/API.md` for "the full export surface", and
 * `SHIP_PLAN.md` once described that file as "generated from the barrel". It is neither
 * generated nor self-checking, and on 2026-07-08 it had silently drifted by 43 names:
 * undo/redo, layout recipes, and portals had no section in it *at all*, though each is a
 * headline feature in `CHANGELOG.md`. Nothing caught it, because nothing was looking.
 *
 * This looks. Every name the barrels export must own an **entry**: it appears in the
 * leading backticked name-list of a bullet or heading, before that entry's prose. Both
 * house styles satisfy that — a name on its own bullet, and the grouped
 * `` - `A`, `B` — shared description `` form used for families.
 *
 * Requiring an entry rather than a mere mention is the 2026-08-12 tightening. The check
 * was "the name appears somewhere in the document", which a name satisfies by being
 * quoted inside a *different* export's description — so an entry that was deleted, or
 * absorbed into its neighbour during an edit, kept passing. All 365 exports already
 * satisfied the stricter rule when it was introduced, so it costs nothing today and
 * catches that drift tomorrow.
 *
 * What it still does not check, stated plainly because a gate that overclaims is worse
 * than no gate: that an entry's prose is *correct*, or even that the prose sitting under
 * a name is about that name. On 2026-08-12 an edit spliced one entry's description into
 * its neighbour's, leaving the first bare — every name still had an entry, and this gate
 * passed. Nor does it check the reverse direction; the doc names types and options that
 * are not themselves exports.
 *
 * Reads source rather than `dist/`, so it runs without a build and can gate `vp check`.
 * Both barrels are exclusively re-export blocks (`export { … } from`, `export type { … }
 * from`) with no `export *` and no direct declarations, which is what makes this parse
 * sound. It fails loudly if that ever stops being true.
 *
 * Run: node ./scripts/verify-api-doc.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));
const apiDocPath = join(repoRoot, "docs", "API.md");

const BARRELS = [
  { entry: ".", path: join(packageRoot, "src", "index.ts") },
  { entry: "./scene", path: join(packageRoot, "src", "scene.ts") },
];

const stripComments = (source) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*/g, "");

/**
 * Exported names, split into values and types.
 *
 * `export type { A }` marks the whole block; `export { type A, b }` marks one specifier.
 * A renamed specifier (`x as y`) publishes `y`.
 */
const getBarrelExports = (source) => {
  const values = new Set();
  const types = new Set();

  for (const match of stripComments(source).matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
    const isTypeBlock = Boolean(match[1]);

    for (const raw of match[2].split(",")) {
      const specifier = raw.trim();
      if (specifier === "") continue;

      const isInlineType = specifier.startsWith("type ");
      const name = (isInlineType ? specifier.slice(5) : specifier).split(" as ").pop().trim();
      if (name === "") continue;

      (isTypeBlock || isInlineType ? types : values).add(name);
    }
  }

  return { types, values };
};

/**
 * The backticked names an entry declares itself to be about: the run at its start, before
 * any prose. `` `A`, `B` — … `` declares both; a name quoted later in the prose declares
 * nothing. A renamed re-export documents itself as `` `Source as Published` ``, so both
 * sides of an `as` count.
 */
const getEntryNames = (text) => {
  const names = [];
  let rest = text.trim();

  for (;;) {
    const name = /^`([A-Za-z_$][\w$ ]*?)`\s*/.exec(rest);
    if (name === null) break;

    for (const part of name[1].split(" as ")) {
      if (/^[A-Za-z_$][\w$]*$/.test(part.trim())) names.push(part.trim());
    }

    rest = rest.slice(name[0].length);

    const separator = /^(?:,|and)\s*/.exec(rest);
    if (separator === null) break;

    rest = rest.slice(separator[0].length);
  }

  return names;
};

const failures = [];
const apiDoc = readFileSync(apiDocPath, "utf8");
const documented = new Set(
  apiDoc.split("\n").flatMap((line) => {
    const entry = /^\s*(?:[-*]\s+|#{2,6}\s+)(.*)$/.exec(line);

    return entry === null ? [] : getEntryNames(entry[1]);
  }),
);

let totalValues = 0;
let totalTypes = 0;

for (const { entry, path } of BARRELS) {
  const source = readFileSync(path, "utf8");

  // The parse above only understands re-export blocks. A direct `export const`/`export
  // function`, or an `export * from`, would be silently invisible to it — the gate would
  // pass while documenting nothing. Refuse to run rather than lie.
  const stripped = stripComments(source);
  for (const line of stripped.split("\n")) {
    const isBlockExport = /^export\s+(type\s+)?\{/.test(line.trim());
    const isExport = /^export\b/.test(line.trim());

    if (isExport && !isBlockExport) {
      failures.push(
        `${entry}: "${line.trim()}" is not a re-export block — this gate cannot see it. ` +
          "Teach verify-api-doc.mjs the new form, or the surface it adds goes undocumented.",
      );
    }
  }

  const { types, values } = getBarrelExports(source);
  totalValues += values.size;
  totalTypes += types.size;

  for (const name of [...values, ...types].sort((left, right) => left.localeCompare(right))) {
    if (!documented.has(name)) {
      failures.push(
        `${entry}: \`${name}\` is exported but owns no entry in docs/API.md — it must lead ` +
          "a bullet or heading, alone or in a comma-separated family, rather than only " +
          "appearing inside another entry's prose.",
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Public API documentation verification FAILED:\n");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(
    `\n${failures.length} problem(s). An undocumented export belongs in docs/API.md ` +
      "under the module that owns it, as its own entry, with the count in that section's " +
      "header updated.",
  );
  process.exit(1);
}

console.log(
  `Public API documentation OK — ${totalValues} values and ${totalTypes} types across ` +
    `${BARRELS.length} entries, each owning an entry in docs/API.md`,
);
