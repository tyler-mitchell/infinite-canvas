import { measureJsonBytes } from "./bytes.ts";
import type { SurrealReader } from "./reads.ts";

/**
 * Reads rows a page at a time. Table names are bound through `type::table` rather than spliced
 * into the statement, because they come from `INFO FOR DB` and are not developer-supplied.
 */

const PAGE_SIZE = 50;

type SurrealRecordPage = Readonly<{
  /** Size of this page as JSON. A wire figure, not a storage figure. */
  bytes: number;
  rows: readonly unknown[];
  start: number;
}>;

async function countRecords(reader: SurrealReader, table: string) {
  const result = await reader.read("SELECT count() AS total FROM type::table($table) GROUP ALL;", {
    table,
  });
  const [row] = Array.isArray(result) ? (result as readonly unknown[]) : [];
  const total =
    typeof row === "object" && row !== null ? (row as Readonly<{ total?: unknown }>).total : 0;

  return typeof total === "number" ? total : 0;
}

async function readRecordPage(
  reader: SurrealReader,
  input: Readonly<{ limit?: number; start: number; table: string }>,
): Promise<SurrealRecordPage> {
  const limit = input.limit ?? PAGE_SIZE;
  const result = await reader.read("SELECT * FROM type::table($table) LIMIT $limit START $start;", {
    limit,
    start: input.start,
    table: input.table,
  });
  const rows = Array.isArray(result) ? (result as readonly unknown[]) : [];

  return { bytes: measureJsonBytes(rows), rows, start: input.start };
}

/**
 * Measures a table's wire size over a bounded sample rather than scanning it fully. Sample size
 * and row count are reported separately; their product is not a table size.
 */
type SurrealTableWeight = Readonly<{
  records: number;
  sampleBytes: number;
  sampledRecords: number;
  table: string;
}>;

async function weighTable(
  reader: SurrealReader,
  input: Readonly<{ sample?: number; table: string }>,
): Promise<SurrealTableWeight> {
  const sample = input.sample ?? PAGE_SIZE;
  const records = await countRecords(reader, input.table);
  const page = await readRecordPage(reader, { limit: sample, start: 0, table: input.table });

  return {
    records,
    sampleBytes: page.bytes,
    sampledRecords: page.rows.length,
    table: input.table,
  };
}

export { countRecords, PAGE_SIZE, readRecordPage, weighTable };
export type { SurrealRecordPage, SurrealTableWeight };
