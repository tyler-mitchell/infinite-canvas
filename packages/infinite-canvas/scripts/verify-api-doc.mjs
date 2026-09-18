/** Fails when a barrel export has no API entry. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));
const apiDocPath = join(repoRoot, "docs", "API.md");

const BARRELS = [
  { entry: ".", path: join(packageRoot, "src", "index.ts") },
  { entry: "./core", path: join(packageRoot, "src", "core.ts") },
  { entry: "./scene", path: join(packageRoot, "src", "scene.ts") },
];

const stripComments = (source) =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/.*/g, "");

/** Returns exported value and type names from re-export blocks. */
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

/** Returns names at the start of a bullet or heading. */
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
/** Every name either barrel exports, for the reverse check below. */
const exported = new Set();

for (const { entry, path } of BARRELS) {
  const source = readFileSync(path, "utf8");

  // Reject export forms that this parser cannot read.
  const stripped = stripComments(source);
  for (const line of stripped.split("\n")) {
    const isBlockExport = /^export\s+(type\s+)?\{/.test(line.trim());
    const isExport = /^export\b/.test(line.trim());
    const star = /^export\s+\*\s+from\s+"\.\/([^"]+)"/.exec(line.trim());
    const isBarrelStar = star !== null && BARRELS.some((barrel) => barrel.entry === `./${star[1]}`);

    if (isExport && !isBlockExport && !isBarrelStar) {
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
    exported.add(name);

    if (!documented.has(name)) {
      failures.push(
        `${entry}: \`${name}\` is exported but owns no entry in docs/API.md — it must lead ` +
          "a bullet or heading, alone or in a comma-separated family, rather than only " +
          "appearing inside another entry's prose.",
      );
    }
  }
}

/**
 * The reverse direction. Without it an entry naming a deleted export reads as
 * live API and this gate stays green: `DEFAULT_RADIANCE_OPTIONS` outlived the
 * radiance pass that way until 2026-09-08.
 *
 */
for (const name of [...documented].sort((left, right) => left.localeCompare(right))) {
  if (!exported.has(name)) {
    failures.push(
      `docs/API.md leads an entry with \`${name}\`, which neither barrel exports — ` +
        "a reference naming a symbol that is gone tells a consumer to import nothing. " +
        "Remove the entry, or export the symbol.",
    );
  }
}

// Compare the API headline count with barrel exports.
const headline = /^The public surface of `[^`]+`: (\d+) values and (\d+) types\b/m.exec(apiDoc);

if (headline === null) {
  failures.push(
    "docs/API.md no longer opens with its headline count — this gate reads " +
      '"The public surface of `pkg`: N values and M types" from the first paragraph. ' +
      "Restore the sentence or teach the gate the new wording; do not drop the count.",
  );
} else if (Number(headline[1]) !== totalValues || Number(headline[2]) !== totalTypes) {
  failures.push(
    `docs/API.md opens with ${headline[1]} values and ${headline[2]} types; the barrels ` +
      `export ${totalValues} and ${totalTypes}. Update the first sentence.`,
  );
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
