import type { SurrealCatalogue } from "./catalogue.ts";
import type { SurrealMigrationManifest } from "./source.ts";

/** This module compares manifest `DEFINE` statements with database definitions. */

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
  /** This field is stable across a manifest and database, for example `table:canvas_document`. */
  id: string;
  kind: SurrealDefinitionKind;
  name: string;
  relation: boolean;
  table: string | null;
  /** This field contains a normalized field type, or `null` for other definitions. */
  type: string | null;
}>;

/** This pattern scans `DEFINE` only. It ignores `REMOVE` and interpolated statements. */
// `(` ends function names before parameter types in engine output.
const DEFINE_PATTERN =
  /\bDEFINE\s+(TABLE|FIELD|INDEX|EVENT|FUNCTION|ANALYZER|PARAM|ACCESS)\s+(?:(?:IF\s+NOT\s+EXISTS|OVERWRITE)\s+)?([^\s;(]+)(?:\s+ON\s+(?:TABLE\s+)?([^\s;]+))?([^;]*)/giu;

const TYPE_PATTERN =
  /\bTYPE\s+(.+?)(?=\s+(?:DEFAULT|VALUE|ASSERT|READONLY|PERMISSIONS|COMMENT|REFERENCE|FLEXIBLE)\b|\s*$)/isu;

const REMOVE_PATTERN = /\bREMOVE\s+(TABLE|FIELD|INDEX|EVENT|FUNCTION|ANALYZER|PARAM|ACCESS)\b/iu;

/** `INFO` escapes some identifiers, so comparisons use bare names. */
function bareName(raw: string) {
  return raw.replace(/^[`"']|[`"']$/gu, "");
}

/** This function maps SurQL shorthand and engine type output to one form. */
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

/** This function scans catalogue statements. It does not rebuild structured fields. */
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
  /** This field contains a manifest path, or `null` for a database-only definition. */
  origin: string | null;
}>;

type SurrealRedefinition = Readonly<{
  declared: string;
  id: string;
  live: string;
  origin: string;
}>;

type SurrealMigrationReport = Readonly<{
  /** These entries are definitions that SurrealDB adds for relations and array items. */
  derived: readonly SurrealDriftEntry[];
  missing: readonly SurrealDriftEntry[];
  redefined: readonly SurrealRedefinition[];
  undeclared: readonly SurrealDriftEntry[];
  unmodelled: readonly string[];
  stages: readonly SurrealMigrationStageReport[];
}>;

type SurrealMigrationStageReport = Readonly<{
  declared: number;
  files: readonly string[];
  missing: number;
  name: string;
}>;

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

  // Live canonical types take precedence when available.
  const liveTypes =
    canonicalTypes ??
    new Map(
      live.flatMap((definition) =>
        definition.type === null ? [] : [[definition.id, definition.type] as const],
      ),
    );

  /** These manifest relations have engine-supplied `in` and `out` fields. */
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
