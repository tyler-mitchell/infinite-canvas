import type { SurrealCatalogue } from "./catalogue.ts";
import type { SurrealMigrationManifest } from "./source.ts";

/**
 * Compares the host's declared SurQL against the definitions the database actually has.
 *
 * An embedded SurrealDB has no migration table, so it cannot report which migrations ran. `INFO`
 * returns each object as its `DEFINE` statement, so comparing those against the host's manifest
 * gives what is missing, extra, or redefined.
 *
 * Both sides use the same scanner. It matches `DEFINE` statements by pattern rather than parsing:
 * `REMOVE` is not handled, and definitions built by string interpolation are not visible. Both
 * cases are listed in the report.
 */

type SurrealDefinitionKind =
  | "ACCESS"
  | "ANALYZER"
  | "EVENT"
  | "FIELD"
  | "FUNCTION"
  | "INDEX"
  | "PARAM"
  | "TABLE";

type SurrealDefinition = Readonly<{
  /** `table:canvas_document`, `field:canvas_document.layout` — stable across both sides. */
  id: string;
  kind: SurrealDefinitionKind;
  name: string;
  /** A `TYPE RELATION` table, whose `in` and `out` fields the engine defines for it. */
  relation: boolean;
  table: string | null;
  /** A field's declared `TYPE`, normalised for comparison. `null` for anything else. */
  type: string | null;
}>;

/**
 * `(` terminates a name. Without it a function name runs to the first whitespace, which differs
 * between the manifest (`fn::save_canvas(`) and the engine's echo (`fn::save_canvas($canvas:`).
 * That produced two ids per function, so every function was reported missing and undeclared.
 */
const DEFINE_PATTERN =
  /\bDEFINE\s+(TABLE|FIELD|INDEX|EVENT|FUNCTION|ANALYZER|PARAM|ACCESS)\s+(?:(?:IF\s+NOT\s+EXISTS|OVERWRITE)\s+)?([^\s;(]+)(?:\s+ON\s+(?:TABLE\s+)?([^\s;]+))?([^;]*)/giu;

/** Everything that can follow a field's `TYPE`, which is how its end is found. */
const TYPE_PATTERN =
  /\bTYPE\s+(.+?)(?=\s+(?:DEFAULT|VALUE|ASSERT|READONLY|PERMISSIONS|COMMENT|REFERENCE|FLEXIBLE)\b|\s*$)/isu;

const REMOVE_PATTERN = /\bREMOVE\s+(TABLE|FIELD|INDEX|EVENT|FUNCTION|ANALYZER|PARAM|ACCESS)\b/iu;

/** `INFO` escapes identifiers that need it; a manifest usually does not. Compare them bare. */
function bareName(raw: string) {
  return raw.replace(/^[`"']|[`"']$/gu, "");
}

/**
 * Normalises a type to one spelling so both sides compare. The manifest uses SurQL shorthand and
 * the engine reports canonical form: `TYPE option<string>` comes back as `none | string`. Comparing
 * them raw reports every optional field as redefined.
 */
function normaliseType(raw: string) {
  const compact = raw.replaceAll(/\s+/gu, "").toLowerCase();

  return /^option<.+>$/u.test(compact) ? `none|${compact.slice("option<".length, -1)}` : compact;
}

function scanDefinitions(source: string): readonly SurrealDefinition[] {
  return [...source.matchAll(DEFINE_PATTERN)].flatMap((match) => {
    const [, rawKind, rawName, rawTable, rest] = match;

    if (rawKind === undefined || rawName === undefined) {
      return [];
    }

    const kind = rawKind.toUpperCase() as SurrealDefinitionKind;
    const name = bareName(rawName);
    const table = rawTable === undefined ? null : bareName(rawTable);
    const scope = table === null ? name : `${table}.${name}`;
    const declaredType = kind === "FIELD" ? TYPE_PATTERN.exec(rest ?? "")?.[1] : undefined;

    return [
      {
        id: `${kind.toLowerCase()}:${scope}`,
        kind,
        name,
        relation: kind === "TABLE" && /\bTYPE\s+RELATION\b/iu.test(rest ?? ""),
        table,
        type: declaredType === undefined ? null : normaliseType(declaredType),
      },
    ];
  });
}

/**
 * Every `DEFINE` the database currently holds. Read from the catalogue's statement strings rather
 * than rebuilt from the structured form, so both sides are scanned the same way.
 */
function scanCatalogue(catalogue: SurrealCatalogue): readonly SurrealDefinition[] {
  return [
    ...catalogue.analyzers,
    ...catalogue.functions,
    ...catalogue.params,
    ...catalogue.tables.flatMap((table) => [
      table.definition,
      ...table.events,
      ...table.indexes,
      ...table.fields.map((field) => field.definition),
    ]),
  ].flatMap((definition) => scanDefinitions(definition));
}

type SurrealDriftEntry = Readonly<{
  definition: SurrealDefinition;
  /** Which manifest file declared it. `null` for something only the database has. */
  origin: string | null;
}>;

/**
 * A field present on both sides with different declared types. A presence check cannot see this.
 * With `IF NOT EXISTS`, installing over an existing field does nothing, so editing a type in the
 * source leaves the old definition in the database. Both values are reported; neither is assumed
 * to be the correct one.
 */
type SurrealRedefinition = Readonly<{
  declared: string;
  id: string;
  live: string;
  origin: string;
}>;

type SurrealMigrationReport = Readonly<{
  /**
   * Definitions the engine adds itself: `in`/`out` on a `TYPE RELATION` table, `.*` entries for
   * array items. They appear in no manifest but are not drift, so they are listed separately and
   * excluded from the other counts.
   */
  derived: readonly SurrealDriftEntry[];
  /** In the SurQL the host installs, absent from the database. */
  missing: readonly SurrealDriftEntry[];
  /** Present on both sides, declaring different types. */
  redefined: readonly SurrealRedefinition[];
  /** In the database, declared by no manifest file. */
  undeclared: readonly SurrealDriftEntry[];
  /** Files carrying `REMOVE`, whose effect this scan cannot model. */
  unmodelled: readonly string[];
  stages: readonly SurrealMigrationStageReport[];
}>;

type SurrealMigrationStageReport = Readonly<{
  declared: number;
  files: readonly string[];
  missing: number;
  name: string;
}>;

/**
 * The comparison, over definitions from any source. Two callers use it: a live database read
 * through `INFO`, and a `.surql` dump read from disk. Both supply `DEFINE` statements, so one
 * implementation covers both and they cannot disagree.
 */
function diffDefinitions(
  live: readonly SurrealDefinition[],
  manifest: SurrealMigrationManifest,
  canonicalTypes?: ReadonlyMap<string, string>,
): SurrealMigrationReport {
  const present = new Map(live.map((definition) => [definition.id, definition]));
  const declared = new Map<string, SurrealDriftEntry>();

  for (const stage of manifest.stages) {
    for (const file of stage.files) {
      for (const definition of scanDefinitions(file.source)) {
        declared.set(definition.id, { definition, origin: file.path });
      }
    }
  }

  // A live database gives canonical types; a dump gives statement text. Prefer canonical.
  const liveTypes =
    canonicalTypes ??
    new Map(
      live.flatMap((definition) =>
        definition.type === null ? [] : [[definition.id, definition.type] as const],
      ),
    );

  /** Relation tables named by the corpus, whose `in` and `out` the engine supplies. */
  const relationTables = new Set(
    [...declared.values()]
      .filter((entry) => entry.definition.relation)
      .map((entry) => entry.definition.name),
  );

  const isDerived = (definition: SurrealDefinition) => {
    if (definition.kind !== "FIELD" || definition.table === null) {
      return false;
    }

    const [root] = definition.name.split(/[.[]/u);

    return (
      (relationTables.has(definition.table) && ["in", "out"].includes(definition.name)) ||
      (root !== definition.name && declared.has(`field:${definition.table}.${root ?? ""}`))
    );
  };
  const undeclared = [...present.values()].filter((definition) => !declared.has(definition.id));

  return {
    derived: undeclared.filter(isDerived).map((definition) => ({ definition, origin: null })),
    missing: [...declared.values()].filter((entry) => !present.has(entry.definition.id)),
    redefined: [...declared.values()].flatMap((entry) => {
      const declaredType = entry.definition.type;
      const liveType = liveTypes.get(entry.definition.id);

      return declaredType === null ||
        liveType === undefined ||
        liveType === declaredType ||
        entry.origin === null
        ? []
        : [
            {
              declared: declaredType,
              id: entry.definition.id,
              live: liveType,
              origin: entry.origin,
            },
          ];
    }),
    stages: manifest.stages.map((stage) => {
      const inStage = stage.files.flatMap((file) => scanDefinitions(file.source));

      return {
        declared: inStage.length,
        files: stage.files.map((file) => file.path),
        missing: inStage.filter((definition) => !present.has(definition.id)).length,
        name: stage.name,
      };
    }),
    undeclared: undeclared
      .filter((definition) => !isDerived(definition))
      .map((definition) => ({ definition, origin: null })),
    unmodelled: manifest.stages.flatMap((stage) =>
      stage.files.filter((file) => REMOVE_PATTERN.test(file.source)).map((file) => file.path),
    ),
  };
}

/** Drift against a live database, whose canonical field types the catalogue already carries. */
function inspectMigrations(
  catalogue: SurrealCatalogue,
  manifest: SurrealMigrationManifest,
): SurrealMigrationReport {
  return diffDefinitions(
    scanCatalogue(catalogue),
    manifest,
    new Map(
      catalogue.tables.flatMap((table) =>
        table.fields.flatMap((field) =>
          field.kind === null
            ? []
            : [[`field:${table.name}.${field.name}`, normaliseType(field.kind)] as const],
        ),
      ),
    ),
  );
}

/** Drift against a `.surql` dump, which carries the same `DEFINE` statements and no engine. */
function inspectExportedMigrations(
  dump: string,
  manifest: SurrealMigrationManifest,
): SurrealMigrationReport {
  return diffDefinitions(scanDefinitions(dump), manifest);
}

export { diffDefinitions, inspectExportedMigrations, inspectMigrations, scanDefinitions };
export type {
  SurrealDefinition,
  SurrealDefinitionKind,
  SurrealDriftEntry,
  SurrealMigrationReport,
  SurrealMigrationStageReport,
  SurrealRedefinition,
};
