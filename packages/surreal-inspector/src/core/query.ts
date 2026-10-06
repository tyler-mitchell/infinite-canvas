import { getErrorMessage, type SurrealReader } from "./reads.ts";

/** This module normalizes both SurrealDB query-plan formats to one flat list. */

type SurrealQueryOutcome = Readonly<{
  durationMs: number;
  error: string | null;
  results: readonly unknown[];
  statement: string;
}>;

type SurrealPlanStep = Readonly<{
  depth: number;
  detail: unknown;
  operation: string;
}>;

type SurrealPlan = Readonly<{
  steps: readonly SurrealPlanStep[];
  /** This field contains raw plan text when SurrealDB does not return structured data. */
  text: string | null;
  /** This field explains why SurrealDB did not return a plan. */
  unavailable: string | null;
  usesIndex: boolean;
}>;

const INDEX_OPERATIONS = new Set(["Iterate Index", "Iterate Index Count", "IndexScan"]);

async function runStatement(
  reader: SurrealReader,
  statement: string,
): Promise<SurrealQueryOutcome> {
  const startedAt = performance.now();

  try {
    const results = await reader.readAll(statement);

    return { durationMs: performance.now() - startedAt, error: null, results, statement };
  } catch (error) {
    return {
      durationMs: performance.now() - startedAt,
      error: getErrorMessage(error),
      results: [],
      statement,
    };
  }
}

/** `EXPLAIN` accepts one `SELECT` statement. */
function toExplainable(statement: string) {
  const trimmed = statement.trim().replace(/;\s*$/u, "");

  return /^select\b/iu.test(trimmed) && !trimmed.includes(";") ? trimmed : null;
}

function asObject(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function readFlatPlan(rows: readonly unknown[]): readonly SurrealPlanStep[] {
  return rows.flatMap((row) => {
    const step = asObject(row);
    const operation = step?.operation;

    return typeof operation === "string" ? [{ depth: 0, detail: step?.detail, operation }] : [];
  });
}

function readTreePlan(node: unknown, depth = 0): readonly SurrealPlanStep[] {
  const step = asObject(node);
  const operator = step?.operator;

  if (typeof operator !== "string") {
    return [];
  }

  const children = step?.children;

  return [
    {
      depth,
      detail: { attributes: step?.attributes, metrics: step?.metrics },
      operation: operator,
    },
    ...(Array.isArray(children) ? children.flatMap((child) => readTreePlan(child, depth + 1)) : []),
  ];
}

async function explainStatement(reader: SurrealReader, statement: string): Promise<SurrealPlan> {
  const explainable = toExplainable(statement);

  if (explainable === null) {
    return {
      steps: [],
      text: null,
      unavailable: "EXPLAIN applies to a single SELECT statement.",
      usesIndex: false,
    };
  }

  try {
    const answer = await reader.read(`${explainable} EXPLAIN;`);
    const steps = Array.isArray(answer) ? readFlatPlan(answer) : readTreePlan(answer);

    return {
      steps,
      text: typeof answer === "string" ? answer : null,
      unavailable:
        steps.length === 0 && typeof answer !== "string"
          ? "The engine answered in a shape this panel does not recognise."
          : null,
      usesIndex: steps.some((step) => INDEX_OPERATIONS.has(step.operation)),
    };
  } catch (error) {
    return { steps: [], text: null, unavailable: getErrorMessage(error), usesIndex: false };
  }
}

export { explainStatement, INDEX_OPERATIONS, runStatement, toExplainable };
export type { SurrealPlan, SurrealPlanStep, SurrealQueryOutcome };
