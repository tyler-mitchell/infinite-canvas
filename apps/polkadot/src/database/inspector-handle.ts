import { installSurrealInspectorHandle, type SurrealInspectorSource } from "surreal-inspector";

import { installedSurql, localDatabaseEndpoint } from "./local-database";

/**
 * Exposes `window.__surreal` in development: `report()`, `integrity()`, `query(surql)`.
 *
 * Installed at startup so querying does not require navigating to the inspector route. `connect`
 * is a thunk, so the WASM engine still loads only on the first read.
 */
const source: SurrealInspectorSource = {
  connect: async () => (await import("./database.client")).openLocalDatabase(),
  database: localDatabaseEndpoint.database,
  endpoint: localDatabaseEndpoint.endpoint,
  id: localDatabaseEndpoint.endpoint,
  label: localDatabaseEndpoint.endpoint,
  manifest: installedSurql,
  namespace: localDatabaseEndpoint.namespace,
};

const localDatabaseSources: readonly SurrealInspectorSource[] = [source];

function installLocalDatabaseHandle() {
  if (!import.meta.env.DEV) {
    return;
  }

  installSurrealInspectorHandle(localDatabaseSources);
}

export { installLocalDatabaseHandle, localDatabaseSources };
