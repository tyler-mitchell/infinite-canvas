import { installSurrealInspectorHandle, type SurrealInspectorSource } from "surreal-inspector";

import { installedSurql, localDatabaseEndpoint } from "./local-database";

// Development installs window.__surreal without opening the WASM engine.
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
