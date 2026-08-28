import { getErrorMessage, type SurrealReader } from "./reads.ts";

/**
 * Runs a statement and reads its query plan. `EXPLAIN` reports the engine's own planning, unlike
 * the read ledger, which measures the inspector's cache.
 *
 * `EXPLAIN` answers in two shapes and which one arrives is decided at runtime, because SurrealDB
 * 3's streaming planner falls back to the legacy executor without reporting it. The legacy shape is
 * a flat array of `{ operation, detail }` that names an index hit `Iterate Index`; the streaming
 * shape is a tree of `{ operator, attributes, children }` that names it `IndexScan`. Both are
 * normalised to one flat list.
 */

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
  /** The plan verbatim, when the engine answered with text rather than structure. */
  text: string | null;
  /** Why no plan was read. `null` when `steps` or `text` holds the answer. */
  unavailable: string | null;
  /** True when a step names an index rather than a scan, under either planner's naming. */
  usesIndex: boolean;
}>;

/** Both planners' names for "an index was used". */
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

/**
 * `EXPLAIN` is a `SELECT` clause and cannot be appended to other statements. Returns `null` for
 * anything that is not a single select, so the console reports no plan instead of an engine error.
 */
function toExplainable(statement: string) {
  const trimmed = statement.trim().replace(/;\s*$/u, "");

  return /^select\b/iu.test(trimmed) && !trimmed.includes(";") ? trimmed : null;
}

function asObject(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

/** Reads the legacy executor's shape: one flat row per step, already in order. */
function readFlatPlan(rows: readonly unknown[]): readonly SurrealPlanStep[] {
  return rows.flatMap((row) => {
    const step = asObject(row);
    const operation = step?.operation;

    return typeof operation === "string" ? [{ depth: 0, detail: step?.detail, operation }] : [];
  });
}

/**
 * Reads the streaming planner's tree, outermost first. `depth` is retained so the panel can show
 * the original nesting.
 */
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
