import type { Surreal } from "surrealdb";

/** The source uses the host connection to prevent a second IndexedDB writer. */
type SurrealInspectorSource = Readonly<{
  connect: () => Promise<Surreal>;
  database: string;
  /** This value is a connection label from the host, for example `indxdb://polkadot`. */
  endpoint: string;
  id: string;
  label: string;
  /** This field contains the SurQL that the host expects in this database. */
  manifest?: SurrealMigrationManifest;
  namespace: string;
}>;

/** The manifest lists the SurQL files that the host installs in order. */
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
