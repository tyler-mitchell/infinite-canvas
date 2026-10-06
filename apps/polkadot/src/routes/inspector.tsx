import { createFileRoute } from "@tanstack/react-router";
import { SurrealInspector } from "surreal-inspector";

import { localDatabaseSources } from "../database/inspector-handle";

// This route uses the app origin so it can inspect the same IndexedDB database.
export const Route = createFileRoute("/inspector")({ component: InspectorRoute });

function InspectorRoute() {
  return <SurrealInspector sources={localDatabaseSources} />;
}
