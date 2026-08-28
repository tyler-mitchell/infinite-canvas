import { readEngineArtifacts, type SurrealArtifact } from "./core/artifacts.ts";
import { readCatalogue, readTopology, type SurrealCatalogue } from "./core/catalogue.ts";
import { inspectIntegrity, type SurrealIntegrityReport } from "./core/integrity.ts";
import { inspectMigrations, type SurrealMigrationReport } from "./core/migrations.ts";
import { explainStatement, runStatement, type SurrealPlan } from "./core/query.ts";
import { createSurrealReader, type SurrealReader } from "./core/reads.ts";
import { readRecordPage, type SurrealRecordPage } from "./core/records.ts";
import { inspectSurrealDatabase, type SurrealInspectorReport } from "./core/report.ts";
import type { SurrealInspectorSource } from "./core/source.ts";
import {
  measureDatabasePayload,
  surveyStorage,
  type SurrealPayloadMeasurement,
  type SurrealStorageSurvey,
} from "./core/storage.ts";
import {
  exportSurql,
  importSurql,
  type SurrealExport,
  type SurrealImportOutcome,
} from "./core/transfer.ts";

/**
 * Console-drivable access to the database, returning data rather than rendered output. The UI
 * panels are a view over the same functions.
 *
 * Development only. `query` and `importSurql` write, so this must not reach a shipped build.
 */

type SurrealInspectorHandle = Readonly<{
  artifacts: () => readonly SurrealArtifact[];
  catalogue: (sourceId?: string) => Promise<SurrealCatalogue>;
  exportSurql: (sourceId?: string) => Promise<SurrealExport>;
  /** Destructive. Runs the statements against the live database. */
  importSurql: (surql: string, sourceId?: string) => Promise<SurrealImportOutcome>;
  integrity: (sourceId?: string) => Promise<SurrealIntegrityReport>;
  /** `null` when the source declares no manifest, leaving nothing to compare against. */
  migrations: (sourceId?: string) => Promise<SurrealMigrationReport | null>;
  /** Exact logical payload bytes for one IndexedDB database. Walks every entry. */
  payload: (databaseName: string) => Promise<SurrealPayloadMeasurement>;
  query: (
    statement: string,
    sourceId?: string,
  ) => Promise<
    Readonly<{
      durationMs: number;
      error: string | null;
      plan: SurrealPlan;
      results: readonly unknown[];
    }>
  >;
  records: (
    table: string,
    options?: Readonly<{ limit?: number; sourceId?: string; start?: number }>,
  ) => Promise<SurrealRecordPage>;
  /** Everything, in one call. Start here. */
  report: (
    sourceId?: string,
    options?: Readonly<{ integrity?: boolean }>,
  ) => Promise<SurrealInspectorReport>;
  /** Every declared source, without connecting to any of them. */
  sources: () => readonly Readonly<{
    database: string;
    endpoint: string;
    hasManifest: boolean;
    id: string;
    label: string;
    namespace: string;
  }>[];
  /** IndexedDB and origin quota. Needs no engine, so it answers even when one will not start. */
  storage: () => Promise<SurrealStorageSurvey>;
  /** Namespaces and databases visible to this connection, or the reason they could not be read. */
  topology: (sourceId?: string) => Promise<Awaited<ReturnType<typeof readTopology>>>;
}>;

declare global {
  interface Window {
    /** Set in development builds only. See `installSurrealInspectorHandle`. */
    __surreal?: SurrealInspectorHandle;
  }
}

function createSurrealInspectorHandle(
  sources: readonly SurrealInspectorSource[],
): SurrealInspectorHandle {
  if (sources.length === 0) {
    throw new Error("createSurrealInspectorHandle needs at least one source");
  }

  // One reader per source, kept for the handle's life. A fresh one per call would never hit cache.
  const readers = new Map<string, Promise<SurrealReader>>();

  const select = (sourceId?: string) => {
    const source = sourceId === undefined ? sources[0] : sources.find((it) => it.id === sourceId);

    if (source === undefined) {
      throw new Error(
        `No source "${sourceId ?? ""}". Known: ${sources.map((it) => it.id).join(", ")}`,
      );
    }

    return source;
  };

  const readerFor = async (sourceId?: string) => {
    const source = select(sourceId);
    const existing = readers.get(source.id);

    if (existing !== undefined) {
      return existing;
    }

    const created = source.connect().then(createSurrealReader);

    readers.set(source.id, created);

    return created;
  };

  return {
    artifacts: readEngineArtifacts,
    catalogue: async (sourceId) => readCatalogue(await readerFor(sourceId)),
    exportSurql: async (sourceId) => exportSurql(await select(sourceId).connect()),
    importSurql: async (surql, sourceId) => importSurql(await select(sourceId).connect(), surql),
    integrity: async (sourceId) => {
      const reader = await readerFor(sourceId);

      return inspectIntegrity(reader, await readCatalogue(reader));
    },
    migrations: async (sourceId) => {
      const source = select(sourceId);

      return source.manifest === undefined
        ? null
        : inspectMigrations(await readCatalogue(await readerFor(sourceId)), source.manifest);
    },
    payload: measureDatabasePayload,
    query: async (statement, sourceId) => {
      const reader = await readerFor(sourceId);
      const [outcome, plan] = await Promise.all([
        runStatement(reader, statement),
        explainStatement(reader, statement),
      ]);

      return {
        durationMs: outcome.durationMs,
        error: outcome.error,
        plan,
        results: outcome.results,
      };
    },
    records: async (table, options) =>
      readRecordPage(await readerFor(options?.sourceId), {
        limit: options?.limit,
        start: options?.start ?? 0,
        table,
      }),
    report: async (sourceId, options) => inspectSurrealDatabase(select(sourceId), options ?? {}),
    sources: () =>
      sources.map((source) => ({
        database: source.database,
        endpoint: source.endpoint,
        hasManifest: source.manifest !== undefined,
        id: source.id,
        label: source.label,
        namespace: source.namespace,
      })),
    storage: surveyStorage,
    topology: async (sourceId) => readTopology(await readerFor(sourceId)),
  };
}

/**
 * Installs the handle on `window` and returns a function that removes it. Call at startup rather
 * than from the inspector route, so querying does not require navigating there.
 */
function installSurrealInspectorHandle(sources: readonly SurrealInspectorSource[]) {
  window.__surreal = createSurrealInspectorHandle(sources);

  return () => {
    delete window.__surreal;
  };
}

export { createSurrealInspectorHandle, installSurrealInspectorHandle };
export type { SurrealInspectorHandle };
