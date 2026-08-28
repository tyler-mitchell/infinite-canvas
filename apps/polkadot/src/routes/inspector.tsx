import { createFileRoute } from "@tanstack/react-router";
import { SurrealInspector } from "surreal-inspector";

import { localDatabaseSources } from "../database/inspector-handle";

/**
 * UI over the same core `window.__surreal` exposes. A route rather than a canvas window so it
 * still works when the canvas itself is the thing being diagnosed.
 *
 * Lives in this app because IndexedDB is origin-scoped: an inspector served from another port
 * could not see this database. It reuses `openLocalDatabase`'s client, since two engines on one
 * store can corrupt it.
 */
export const Route = createFileRoute("/inspector")({ component: InspectorRoute });

function InspectorRoute() {
  return <SurrealInspector sources={localDatabaseSources} />;
}
