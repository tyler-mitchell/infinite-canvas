import { escapeIdent } from "surrealdb";

import type { SurrealReader } from "./reads.ts";

/** These values combine `DEFINE` statements with structured field types. */

type SurrealFieldDefinition = Readonly<{
  definition: string;
  flexible: boolean;
  /** This field contains the declared type, or `null` when SurrealDB omits it. */
  kind: string | null;
  name: string;
  readonly: boolean;
}>;

type SurrealTableDefinition = Readonly<{
  definition: string;
  events: readonly string[];
  fields: readonly SurrealFieldDefinition[];
  indexes: readonly string[];
  isRelation: boolean;
  name: string;
}>;

type SurrealCatalogue = Readonly<{
  analyzers: readonly string[];
  functions: readonly string[];
  params: readonly string[];
  tables: readonly SurrealTableDefinition[];
}>;

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function readDefinitionMap(value: unknown): readonly string[] {
  return Object.values(asRecord(value))
    .filter((definition): definition is string => typeof definition === "string")
    .toSorted((left, right) => left.localeCompare(right));
}

function asStructuredFields(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  const fields = asRecord(value).fields;

  return Array.isArray(fields) ? fields.map(asRecord) : [];
}

async function readTableDefinition(
  reader: SurrealReader,
  name: string,
  definition: string,
): Promise<SurrealTableDefinition> {
  const identifier = escapeIdent(name);
  const info = asRecord(await reader.cached(`table:${name}`, `INFO FOR TABLE ${identifier};`));
  const structure = asStructuredFields(
    await reader.cached(`table-structure:${name}`, `INFO FOR TABLE ${identifier} STRUCTURE;`),
  );
  const declarations = asRecord(info.fields);

  return {
    definition,
    events: readDefinitionMap(info.events),
    fields: structure.flatMap((field) => {
      const fieldName = field.name;

      if (typeof fieldName !== "string") {
        return [];
      }

      const declared = declarations[fieldName];

      return [
        {
          definition: typeof declared === "string" ? declared : "",
          flexible: field.flex === true,
          kind: typeof field.kind === "string" ? field.kind : null,
          name: fieldName,
          readonly: field.readonly === true,
        },
      ];
    }),
    indexes: readDefinitionMap(info.indexes),
    isRelation: /\bTYPE\s+RELATION\b/i.test(definition),
    name,
  };
}

async function readCatalogue(reader: SurrealReader): Promise<SurrealCatalogue> {
  const info = asRecord(await reader.cached("database", "INFO FOR DB;"));
  const tables = asRecord(info.tables);

  return {
    analyzers: readDefinitionMap(info.analyzers),
    functions: readDefinitionMap(info.functions),
    params: readDefinitionMap(info.params),
    tables: await Promise.all(
      Object.entries(tables)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([name, definition]) =>
          readTableDefinition(reader, name, typeof definition === "string" ? definition : ""),
        ),
    ),
  };
}

/** The `unreadable` field records a permission error instead of an empty result. */
type SurrealTopology = Readonly<{
  databases: readonly string[];
  namespaces: readonly string[];
  unreadable: string | null;
}>;

function readNames(value: unknown): readonly string[] {
  return Object.keys(asRecord(value)).toSorted((left, right) => left.localeCompare(right));
}

async function readTopology(reader: SurrealReader): Promise<SurrealTopology> {
  try {
    const root = asRecord(await reader.cached("root", "INFO FOR ROOT;"));
    const namespace = asRecord(await reader.cached("namespace", "INFO FOR NS;"));

    return {
      databases: readNames(namespace.databases),
      namespaces: readNames(root.namespaces),
      unreadable: null,
    };
  } catch (error) {
    return {
      databases: [],
      namespaces: [],
      unreadable: error instanceof Error ? error.message : String(error),
    };
  }
}

export { readCatalogue, readTopology };
export type { SurrealCatalogue, SurrealFieldDefinition, SurrealTableDefinition, SurrealTopology };
