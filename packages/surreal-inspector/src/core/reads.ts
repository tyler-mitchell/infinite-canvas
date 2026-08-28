import type { Surreal } from "surrealdb";

/**
 * Records every read and whether it was answered from cache, so a panel can show whether it is
 * displaying current data.
 *
 * SurrealDB publishes no cache statistics, so "cache" here means only this cache, in front of the
 * engine. Planner behaviour comes from `EXPLAIN` instead.
 */

type SurrealReadOutcome = "cached" | "failed" | "queried";

type SurrealReadEvent = Readonly<{
  at: number;
  durationMs: number;
  key: string;
  outcome: SurrealReadOutcome;
  statement: string;
}>;

type SurrealReadLedger = Readonly<{
  cached: number;
  events: readonly SurrealReadEvent[];
  failed: number;
  queried: number;
}>;

/** Maximum events retained, so a long session does not grow the ledger without limit. */
const LEDGER_LIMIT = 200;

type SurrealReader = Readonly<{
  /** Repeat calls with the same key are answered from memory and never reach the engine. */
  cached: (
    key: string,
    statement: string,
    bindings?: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>;
  /** Drop the cache. The next read of every key reaches the engine again. */
  forget: () => void;
  ledger: () => SurrealReadLedger;
  /** One statement, one result. Never cached. */
  read: (statement: string, bindings?: Readonly<Record<string, unknown>>) => Promise<unknown>;
  /** Every statement's result, in order. Never cached. */
  readAll: (
    statement: string,
    bindings?: Readonly<Record<string, unknown>>,
  ) => Promise<readonly unknown[]>;
}>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads through `.json()` throughout. Record ids, datetimes, and durations otherwise arrive as SDK
 * value objects, so converting once here means panels do not each need to handle them.
 */
function createSurrealReader(client: Surreal): SurrealReader {
  const state = {
    cache: new Map<string, unknown>(),
    events: [] as readonly SurrealReadEvent[],
  };

  const record = (event: SurrealReadEvent) => {
    state.events = [event, ...state.events].slice(0, LEDGER_LIMIT);
  };

  const execute = async (
    key: string,
    statement: string,
    bindings: Readonly<Record<string, unknown>> | undefined,
  ) => {
    const startedAt = performance.now();

    try {
      const results = await client
        .query<unknown[]>(statement, bindings as Record<string, unknown> | undefined)
        .json();

      record({
        at: Date.now(),
        durationMs: performance.now() - startedAt,
        key,
        outcome: "queried",
        statement,
      });

      return results as readonly unknown[];
    } catch (error) {
      record({
        at: Date.now(),
        durationMs: performance.now() - startedAt,
        key,
        outcome: "failed",
        statement,
      });

      throw new Error(getErrorMessage(error), { cause: error });
    }
  };

  return {
    cached: async (key, statement, bindings) => {
      if (state.cache.has(key)) {
        record({ at: Date.now(), durationMs: 0, key, outcome: "cached", statement });

        return state.cache.get(key);
      }

      const [first] = await execute(key, statement, bindings);

      state.cache.set(key, first);

      return first;
    },
    forget: () => {
      state.cache.clear();
    },
    ledger: () => ({
      cached: state.events.filter((event) => event.outcome === "cached").length,
      events: state.events,
      failed: state.events.filter((event) => event.outcome === "failed").length,
      queried: state.events.filter((event) => event.outcome === "queried").length,
    }),
    read: async (statement, bindings) => {
      const [first] = await execute(statement, statement, bindings);

      return first;
    },
    readAll: async (statement, bindings) => execute(statement, statement, bindings),
  };
}

export { createSurrealReader, getErrorMessage, LEDGER_LIMIT };
export type { SurrealReader, SurrealReadEvent, SurrealReadLedger, SurrealReadOutcome };
