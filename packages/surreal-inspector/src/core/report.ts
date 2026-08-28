import { readEngineArtifacts, type SurrealArtifact } from "./artifacts.ts";
import { readCatalogue, type SurrealCatalogue } from "./catalogue.ts";
import { inspectIntegrity, type SurrealIntegrityReport } from "./integrity.ts";
import { inspectMigrations, type SurrealMigrationReport } from "./migrations.ts";
import { createSurrealReader, getErrorMessage, type SurrealReadLedger } from "./reads.ts";
import { countRecords } from "./records.ts";
import type { SurrealInspectorSource } from "./source.ts";
import { surveyStorage, type SurrealStorageSurvey } from "./storage.ts";

/**
 * Collects the full state of a database in one call.
 *
 * Any field can be absent either because there was nothing to report or because it could not be
 * read. `unavailable` distinguishes the two: every `null` elsewhere has a matching entry giving
 * the reason, so an empty report is not mistaken for a healthy one.
 */

type SurrealUnavailable = Readonly<{
  reason: string;
  what: string;
}>;

type SurrealTableCount = Readonly<{
  records: number;
  table: string;
}>;

type SurrealConnectionReport = Readonly<{
  database: string;
  endpoint: string;
  /** The engine's version string, e.g. `surrealdb-3.0.5`. `null` if it did not answer. */
  engine: string | null;
  namespace: string;
  open: boolean;
}>;

type SurrealInspectorReport = Readonly<{
  artifacts: readonly SurrealArtifact[];
  catalogue: SurrealCatalogue | null;
  connection: SurrealConnectionReport;
  counts: readonly SurrealTableCount[];
  generatedAt: number;
  integrity: SurrealIntegrityReport | null;
  /** `null` when the source declares no manifest, leaving nothing to compare against. */
  migrations: SurrealMigrationReport | null;
  reads: SurrealReadLedger;
  sourceId: string;
  storage: SurrealStorageSurvey;
  /** Every part of this report that could not be read, with the reason. */
  unavailable: readonly SurrealUnavailable[];
}>;

/**
 * Surveys storage before connecting, so the figure is present even when the engine fails to open.
 * The survey queries the browser rather than SurrealDB.
 */
async function inspectSurrealDatabase(
  source: SurrealInspectorSource,
  options: Readonly<{ integrity?: boolean }> = {},
): Promise<SurrealInspectorReport> {
  const unavailable: SurrealUnavailable[] = [];
  const storage = await surveyStorage();
  const artifacts = readEngineArtifacts();
  const connection = {
    database: source.database,
    endpoint: source.endpoint,
    namespace: source.namespace,
  };

  const client = await source.connect().catch((error: unknown) => {
    unavailable.push({ reason: getErrorMessage(error), what: "connection" });

    return null;
  });

  if (client === null) {
    for (const what of ["catalogue", "counts", "integrity", "migrations"]) {
      unavailable.push({ reason: "The database is not open.", what });
    }

    return {
      artifacts,
      catalogue: null,
      connection: { ...connection, engine: null, open: false },
      counts: [],
      generatedAt: Date.now(),
      integrity: null,
      migrations: null,
      reads: { cached: 0, events: [], failed: 0, queried: 0 },
      sourceId: source.id,
      storage,
      unavailable,
    };
  }

  const reader = createSurrealReader(client);
  const engine = await client
    .version()
    .then((info) => (typeof info.version === "string" ? info.version : null))
    .catch((error: unknown) => {
      unavailable.push({ reason: getErrorMessage(error), what: "engine version" });

      return null;
    });

  const catalogue = await readCatalogue(reader).catch((error: unknown) => {
    unavailable.push({ reason: getErrorMessage(error), what: "catalogue" });

    return null;
  });

  if (catalogue === null) {
    for (const what of ["counts", "integrity", "migrations"]) {
      unavailable.push({ reason: "The catalogue could not be read.", what });
    }

    return {
      artifacts,
      catalogue: null,
      connection: { ...connection, engine, open: true },
      counts: [],
      generatedAt: Date.now(),
      integrity: null,
      migrations: null,
      reads: reader.ledger(),
      sourceId: source.id,
      storage,
      unavailable,
    };
  }

  const counts = await Promise.all(
    catalogue.tables.map(async (table) => ({
      records: await countRecords(reader, table.name).catch(() => -1),
      table: table.name,
    })),
  );

  for (const count of counts) {
    if (count.records < 0) {
      unavailable.push({ reason: "The count query failed.", what: `count of ${count.table}` });
    }
  }

  if (source.manifest === undefined) {
    unavailable.push({
      reason:
        "This source declares no manifest. An embedded database records no migration history, so there is nothing to compare against.",
      what: "migrations",
    });
  }

  return {
    artifacts,
    catalogue,
    connection: { ...connection, engine, open: true },
    counts: counts.filter((count) => count.records >= 0),
    generatedAt: Date.now(),
    integrity: options.integrity === false ? null : await inspectIntegrity(reader, catalogue),
    migrations:
      source.manifest === undefined ? null : inspectMigrations(catalogue, source.manifest),
    reads: reader.ledger(),
    sourceId: source.id,
    storage,
    unavailable:
      options.integrity === false
        ? [...unavailable, { reason: "Not requested.", what: "integrity" }]
        : unavailable,
  };
}

export { inspectSurrealDatabase };
export type {
  SurrealConnectionReport,
  SurrealInspectorReport,
  SurrealTableCount,
  SurrealUnavailable,
};
