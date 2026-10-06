/** Core exports do not depend on React. */

export { readEngineArtifacts } from "./artifacts.ts";
export type { SurrealArtifact } from "./artifacts.ts";
export {
  formatBytes,
  formatCount,
  formatDuration,
  measureJsonBytes,
  measureTextBytes,
} from "./bytes.ts";
export { readCatalogue, readTopology } from "./catalogue.ts";
export type {
  SurrealCatalogue,
  SurrealFieldDefinition,
  SurrealTableDefinition,
  SurrealTopology,
} from "./catalogue.ts";
export { inspectIntegrity, OFFENDER_LIMIT } from "./integrity.ts";
export type {
  SurrealIntegrityCheck,
  SurrealIntegrityFinding,
  SurrealIntegrityGap,
  SurrealIntegrityReport,
} from "./integrity.ts";
export {
  diffDefinitions,
  inspectExportedMigrations,
  inspectMigrations,
  scanDefinitions,
} from "./migrations.ts";
export type {
  SurrealDefinition,
  SurrealDefinitionKind,
  SurrealDriftEntry,
  SurrealMigrationReport,
  SurrealMigrationStageReport,
  SurrealRedefinition,
} from "./migrations.ts";
export { explainStatement, INDEX_OPERATIONS, runStatement, toExplainable } from "./query.ts";
export type { SurrealPlan, SurrealPlanStep, SurrealQueryOutcome } from "./query.ts";
export { createSurrealReader, getErrorMessage } from "./reads.ts";
export type {
  SurrealReader,
  SurrealReadEvent,
  SurrealReadLedger,
  SurrealReadOutcome,
} from "./reads.ts";
export { countRecords, PAGE_SIZE, readRecordPage, weighTable } from "./records.ts";
export type { SurrealRecordPage, SurrealTableWeight } from "./records.ts";
export { inspectSurrealDatabase } from "./report.ts";
export type {
  SurrealConnectionReport,
  SurrealInspectorReport,
  SurrealTableCount,
  SurrealUnavailable,
} from "./report.ts";
export { getIndexedDatabaseName } from "./source.ts";
export type {
  SurrealInspectorSource,
  SurrealMigrationFile,
  SurrealMigrationManifest,
  SurrealMigrationStage,
} from "./source.ts";
export { measureDatabasePayload, surveyStorage } from "./storage.ts";
export type {
  SurrealDatabaseSurvey,
  SurrealObjectStoreSurvey,
  SurrealPayloadMeasurement,
  SurrealStorageSurvey,
} from "./storage.ts";
export { downloadSurql, exportSurql, FULL_EXPORT, importSurql } from "./transfer.ts";
export type { SurrealExport, SurrealImportOutcome } from "./transfer.ts";
