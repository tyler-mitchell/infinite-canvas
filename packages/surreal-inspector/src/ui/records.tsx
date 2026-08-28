import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { formatBytes, formatCount } from "../core/bytes";
import { getErrorMessage } from "../core/reads";
import { countRecords, PAGE_SIZE, readRecordPage, type SurrealRecordPage } from "../core/records";
import { Code, Empty, Notice, Panel } from "./chrome";
import type { SurrealInspection } from "./use-inspection";

/**
 * Browses records a page at a time, rendered as JSON rather than a grid. SurrealDB rows are not
 * rectangular — `FLEXIBLE` objects, nested arrays, record links, and datetimes share a row — and a
 * grid would have to flatten or truncate them.
 */

const records = tv({
  slots: {
    chip: "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] transition-colors duration-100",
    chips: "flex flex-wrap gap-1",
    pager: "flex items-center gap-2",
    pagerLabel: "flex-1 font-mono text-[11px] tabular-nums text-muted-foreground",
    row: "rounded-lg bg-card p-2.5",
    rowId: "mb-1 font-mono text-[11px] text-primary/85",
  },
  variants: {
    selected: {
      false: { chip: "bg-card text-muted-foreground hover:bg-accent hover:text-foreground" },
      true: { chip: "bg-primary/15 text-primary" },
    },
  },
});

const styles = records();

/** `.json()` returns record ids as strings, so a non-string `id` is not one. */
function readRecordId(row: unknown) {
  const id =
    typeof row === "object" && row !== null ? (row as Readonly<{ id?: unknown }>).id : undefined;

  return typeof id === "string" ? id : "";
}

function Records({ inspection }: Readonly<{ inspection: SurrealInspection }>) {
  const tables = inspection.catalogue?.tables ?? [];
  const [table, setTable] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [page, setPage] = useState<SurrealRecordPage | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = table ?? tables[0]?.name ?? null;
  const { reader } = inspection;

  useEffect(() => {
    if (reader === null || selected === null) {
      return;
    }

    const cancelled = { value: false };

    setPage(null);
    setError(null);

    void (async () => {
      try {
        const [read, counted] = await Promise.all([
          readRecordPage(reader, { start, table: selected }),
          countRecords(reader, selected),
        ]);

        if (!cancelled.value) {
          setPage(read);
          setTotal(counted);
        }
      } catch (cause) {
        if (!cancelled.value) {
          setError(getErrorMessage(cause));
        }
      }
    })();

    return () => {
      cancelled.value = true;
    };
  }, [inspection.revision, reader, selected, start]);

  if (tables.length === 0) {
    return (
      <Panel>
        <Empty>{inspection.error ?? "Reading the schema…"}</Empty>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className={styles.chips()}>
        {tables.map((entry) => (
          <button
            className={records({ selected: entry.name === selected }).chip()}
            key={entry.name}
            onClick={() => {
              setTable(entry.name);
              setStart(0);
              setTotal(null);
            }}
            type="button"
          >
            {entry.name}
          </button>
        ))}
      </div>

      <div className={styles.pager()}>
        <Button
          aria-label="Previous page"
          disabled={start === 0}
          onClick={() => {
            setStart(Math.max(0, start - PAGE_SIZE));
          }}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronLeft />
        </Button>
        <Button
          aria-label="Next page"
          disabled={total !== null && start + PAGE_SIZE >= total}
          onClick={() => {
            setStart(start + PAGE_SIZE);
          }}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronRight />
        </Button>
        <span className={styles.pagerLabel()}>
          {page === null
            ? "…"
            : `${formatCount(start + 1)}–${formatCount(start + page.rows.length)} of ${formatCount(total)} · ${formatBytes(page.bytes)} on the wire`}
        </span>
      </div>

      {error === null ? null : <Notice tone="danger">{error}</Notice>}

      {page === null ? (
        <Empty>Reading…</Empty>
      ) : page.rows.length === 0 ? (
        <Empty>No records on this page.</Empty>
      ) : (
        page.rows.map((row, index) => (
          <div className={styles.row()} key={readRecordId(row) || String(start + index)}>
            <p className={styles.rowId()}>{readRecordId(row) || "(no id)"}</p>
            <Code>{JSON.stringify(row, null, 2)}</Code>
          </div>
        ))
      )}
    </Panel>
  );
}

export { Records };
