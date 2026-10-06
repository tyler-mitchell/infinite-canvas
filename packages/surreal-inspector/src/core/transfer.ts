import type { Surreal, SqlExportOptions } from "surrealdb";

import { measureTextBytes } from "./bytes.ts";
import { getErrorMessage } from "./reads.ts";

/** Import writes SurQL to the live database. */

type SurrealExport = Readonly<{
  bytes: number;
  options: Partial<SqlExportOptions>;
  takenAt: number;
  text: string;
}>;

/** The default options export all sections except record versions. */
const FULL_EXPORT: Partial<SqlExportOptions> = {
  accesses: true,
  analyzers: true,
  functions: true,
  params: true,
  records: true,
  tables: true,
  users: true,
  versions: false,
};

async function exportSurql(
  client: Surreal,
  options: Partial<SqlExportOptions> = FULL_EXPORT,
): Promise<SurrealExport> {
  const text = await client.export(options);

  return { bytes: measureTextBytes(text), options, takenAt: Date.now(), text };
}

type SurrealImportOutcome = Readonly<{
  bytes: number;
  durationMs: number;
  error: string | null;
}>;

async function importSurql(client: Surreal, text: string): Promise<SurrealImportOutcome> {
  const startedAt = performance.now();

  try {
    await client.import(text);

    return {
      bytes: measureTextBytes(text),
      durationMs: performance.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      bytes: measureTextBytes(text),
      durationMs: performance.now() - startedAt,
      error: getErrorMessage(error),
    };
  }
}

/** A blob URL prevents a second in-memory copy of a large export. */
function downloadSurql(input: Readonly<{ filename: string; text: string }>) {
  const url = URL.createObjectURL(new Blob([input.text], { type: "application/surrealql" }));
  const anchor = document.createElement("a");

  anchor.download = input.filename;
  anchor.href = url;
  anchor.click();

  URL.revokeObjectURL(url);
}

export { downloadSurql, exportSurql, FULL_EXPORT, importSurql };
export type { SurrealExport, SurrealImportOutcome };
