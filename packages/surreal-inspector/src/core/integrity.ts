import type { SurrealCatalogue, SurrealTableDefinition } from "./catalogue.ts";
import { getErrorMessage, type SurrealReader } from "./reads.ts";

/** This module finds post-write data errors that schema checks cannot prevent. */

type SurrealIntegrityCheck = "broken-edge" | "dangling-link" | "missing-required";

const OFFENDER_LIMIT = 20;

type SurrealIntegrityFinding = Readonly<{
  check: SurrealIntegrityCheck;
  detail: string;
  offenders: readonly string[];
  table: string;
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
  /** Checks that did not run. */
  gaps: readonly SurrealIntegrityGap[];
}>;

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

/** Only plain field names are safe in generated `WHERE` clauses. */
const PLAIN_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;

/** SurrealDB owns `id`. Edge checks cover `in` and `out`. */
const RESERVED_FIELDS = new Set(["id", "in", "out"]);

function isLink(kind: string | null) {
  return kind !== null && kind.includes("record<");
}

/** `INFO` can report `option<T>` as `none | T`. */
function isOptional(kind: string | null) {
  return kind === null || kind.startsWith("option<") || /(?:^|\|)\s*none\s*(?:\||$)/u.test(kind);
}

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

/** This check finds rows written before a required field existed. */
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
    // `SELECT VALUE id` returns string record IDs through `.json()`.
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
