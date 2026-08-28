export { createSurrealInspectorHandle, installSurrealInspectorHandle } from "./handle.ts";
export type { SurrealInspectorHandle } from "./handle.ts";
export { inspectSurrealDatabase } from "./core/report.ts";
export type {
  SurrealConnectionReport,
  SurrealInspectorReport,
  SurrealTableCount,
  SurrealUnavailable,
} from "./core/report.ts";
export type {
  SurrealInspectorSource,
  SurrealMigrationFile,
  SurrealMigrationManifest,
  SurrealMigrationStage,
} from "./core/source.ts";
export { SurrealInspector } from "./ui/inspector.tsx";
export { useSurrealInspection } from "./ui/use-inspection.ts";
export type { SurrealInspection } from "./ui/use-inspection.ts";
