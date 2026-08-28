import type { Surreal } from "surrealdb";

/**
 * A database to inspect and the client to reach it through.
 *
 * `connect` must return the host's existing client. Opening a second engine on the same IndexedDB
 * store gives two writers, which can corrupt the data.
 *
 * `endpoint`, `namespace`, and `database` are supplied by the host, not read back, because the SDK
 * does not expose the URL a client was connected with. They are labels only.
 */
type SurrealInspectorSource = Readonly<{
  connect: () => Promise<Surreal>;
  database: string;
  /** The connection string the host opened, e.g. `indxdb://polkadot`. */
  endpoint: string;
  id: string;
  label: string;
  /** The SurQL this database is supposed to have installed, if the host tracks any. */
  manifest?: SurrealMigrationManifest;
  namespace: string;
}>;

/**
 * The SurQL a host installs on connect, in order. An embedded database has no migration table, so
 * this is the only record of what should be present.
 */
type SurrealMigrationManifest = Readonly<{
  stages: readonly SurrealMigrationStage[];
  version: number;
}>;

type SurrealMigrationStage = Readonly<{
  files: readonly SurrealMigrationFile[];
  name: string;
}>;

type SurrealMigrationFile = Readonly<{
  path: string;
  source: string;
}>;

/** The IndexedDB database name an `indxdb://` endpoint refers to, or `null` for any other scheme. */
function getIndexedDatabaseName(endpoint: string) {
  const prefix = "indxdb://";

  return endpoint.startsWith(prefix) ? endpoint.slice(prefix.length) : null;
}

export { getIndexedDatabaseName };
export type {
  SurrealInspectorSource,
  SurrealMigrationFile,
  SurrealMigrationManifest,
  SurrealMigrationStage,
};
