import type { SurrealCatalogue, SurrealTableDefinition } from "./catalogue.ts";
import { getErrorMessage, type SurrealReader } from "./reads.ts";

/**
 * Checks for damage a schema cannot prevent, because it happens after a valid write: a link whose
 * target was deleted, an edge with a missing end, a field made required over pre-existing rows.
 * None of this raises an error at write time or appears in `INFO`.
 *
 * A check that cannot run is reported as a gap rather than a pass, so an empty findings list means
 * the checks ran and found nothing.
 */

type SurrealIntegrityCheck = "broken-edge" | "dangling-link" | "missing-required";

/** Maximum offender ids read back per check. `truncated` indicates more exist. */
const OFFENDER_LIMIT = 20;

type SurrealIntegrityFinding = Readonly<{
  check: SurrealIntegrityCheck;
  detail: string;
  offenders: readonly string[];
  table: string;
  /** More offenders exist than were read back. */
  truncated: boolean;
}>;

type SurrealIntegrityGap = Readonly<{
  check: SurrealIntegrityCheck;
  detail: string;
  reason: string;
  table: string;
}>;

type SurrealIntegrityReport = Readonly<{
  checked: number;
  findings: readonly SurrealIntegrityFinding[];
  gaps: readonly SurrealIntegrityGap[];
}>;

/** A check to run, or one already determined to be unrunnable. */
type PlannedCheck =
  | Readonly<{
      check: SurrealIntegrityCheck;
      detail: string;
      plan: "run";
      statement: string;
      table: string;
    }>
  | Readonly<{
      check: SurrealIntegrityCheck;
      detail: string;
      plan: "skip";
      reason: string;
      table: string;
    }>;

/**
 * The only field shape safe to place in a `WHERE` clause. `INFO … STRUCTURE` reports nested fields
 * by path (`content.text`, `tags[*]`), which is not an identifier: escaping the whole path looks
 * for a field of that literal name, and splicing it raw allows injection. Anything else is a gap.
 */
const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/** Engine-owned fields. `id` always exists; `in` and `out` are covered by the edge check. */
const RESERVED_FIELDS = new Set(["id", "in", "out"]);

function isLink(kind: string | null) {
  return kind !== null && kind.includes("record<");
}

/**
 * The engine reports canonical types, not SurQL shorthand: `TYPE option<string>` comes back as
 * `none | string`. Testing only for `option<` treats every optional field as required and reports
 * a finding against each one.
 */
function isOptional(kind: string | null) {
  return kind === null || kind.startsWith("option<") || /(?:^|\|)\s*none\s*(?:\||$)/u.test(kind);
}

/**
 * Finds links pointing at deleted records: the field is set, but its `.id` dereferences to `NONE`.
 */
function planLinkChecks(table: SurrealTableDefinition): readonly PlannedCheck[] {
  return table.fields
    .filter((field) => isLink(field.kind) && !RESERVED_FIELDS.has(field.name))
    .map((field) =>
      PLAIN_NAME.test(field.name)
        ? ({
            check: "dangling-link",
            detail: `${table.name}.${field.name} → ${field.kind ?? "record"}`,
            plan: "run",
            statement: `SELECT VALUE id FROM type::table($table) WHERE ${field.name} != NONE AND ${field.name}.id = NONE LIMIT $limit;`,
            table: table.name,
          } as const)
        : ({
            check: "dangling-link",
            detail: `${table.name}.${field.name}`,
            plan: "skip",
            reason: "Nested field paths are not checked.",
            table: table.name,
          } as const),
    );
}

/** Finds relation records whose `in` or `out` target no longer exists. */
function planEdgeChecks(table: SurrealTableDefinition): readonly PlannedCheck[] {
  return table.isRelation
    ? [
        {
          check: "broken-edge",
          detail: `${table.name} in/out`,
          plan: "run",
          statement:
            "SELECT VALUE id FROM type::table($table) WHERE in.id = NONE OR out.id = NONE LIMIT $limit;",
          table: table.name,
        },
      ]
    : [];
}

/**
 * Finds records missing a non-optional field. Writes are type-enforced, so this only matches rows
 * written before the field was declared.
 */
function planRequiredChecks(table: SurrealTableDefinition): readonly PlannedCheck[] {
  return table.fields
    .filter(
      (field) =>
        !isOptional(field.kind) && !RESERVED_FIELDS.has(field.name) && PLAIN_NAME.test(field.name),
    )
    .map((field) => ({
      check: "missing-required",
      detail: `${table.name}.${field.name} is ${field.kind ?? "required"}`,
      plan: "run",
      statement: `SELECT VALUE id FROM type::table($table) WHERE ${field.name} = NONE LIMIT $limit;`,
      table: table.name,
    }));
}

/** Returns a finding if there are offenders, a gap if the query failed, nothing if it passed. */
async function runCheck(
  reader: SurrealReader,
  planned: Extract<PlannedCheck, { plan: "run" }>,
): Promise<
  Readonly<{ findings: readonly SurrealIntegrityFinding[]; gaps: readonly SurrealIntegrityGap[] }>
> {
  try {
    const result = await reader.read(planned.statement, {
      limit: OFFENDER_LIMIT + 1,
      table: planned.table,
    });
    const rows = Array.isArray(result) ? (result as readonly unknown[]) : [];
    // `SELECT VALUE id` through `.json()` is a list of record ids already in string form.
    const offenders = rows
      .slice(0, OFFENDER_LIMIT)
      .map((row) => (typeof row === "string" ? row : (JSON.stringify(row) ?? "")));

    return {
      findings:
        offenders.length === 0
          ? []
          : [
              {
                check: planned.check,
                detail: planned.detail,
                offenders,
                table: planned.table,
                truncated: rows.length > OFFENDER_LIMIT,
              },
            ],
      gaps: [],
    };
  } catch (error) {
    return {
      findings: [],
      gaps: [
        {
          check: planned.check,
          detail: planned.detail,
          reason: getErrorMessage(error),
          table: planned.table,
        },
      ],
    };
  }
}

async function inspectIntegrity(
  reader: SurrealReader,
  catalogue: SurrealCatalogue,
): Promise<SurrealIntegrityReport> {
  const planned = catalogue.tables.flatMap((table) => [
    ...planLinkChecks(table),
    ...planEdgeChecks(table),
    ...planRequiredChecks(table),
  ]);
  const outcomes = await Promise.all(
    planned.flatMap((check) => (check.plan === "run" ? [runCheck(reader, check)] : [])),
  );

  return {
    checked: planned.length,
    findings: outcomes.flatMap((outcome) => outcome.findings),
    gaps: [
      ...planned.flatMap((check) =>
        check.plan === "skip"
          ? [
              {
                check: check.check,
                detail: check.detail,
                reason: check.reason,
                table: check.table,
              },
            ]
          : [],
      ),
      ...outcomes.flatMap((outcome) => outcome.gaps),
    ],
  };
}

export { inspectIntegrity, OFFENDER_LIMIT };
export type {
  SurrealIntegrityCheck,
  SurrealIntegrityFinding,
  SurrealIntegrityGap,
  SurrealIntegrityReport,
};
