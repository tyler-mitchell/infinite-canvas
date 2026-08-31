import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { tv } from "ui/tv";

import { formatBytes, formatCount } from "../core/bytes";
import type { SurrealTableDefinition } from "../core/catalogue";
import { getErrorMessage } from "../core/reads";
import { weighTable, type SurrealTableWeight } from "../core/records";
import { Code, Empty, Notice, Panel, Section } from "./chrome";
import type { SurrealInspection } from "./use-inspection";

/** The panel shows `DEFINE` statements and reads counts only for expanded tables. */

const schema = tv({
  slots: {
    definition: "mt-1.5",
    detail: "flex flex-col gap-2.5 px-2.5 pt-1 pb-3",
    disclosure: "size-3 shrink-0 transition-transform duration-150",
    field:
      "grid items-baseline gap-2 py-0.5 [grid-template-columns:minmax(0,1fr)_minmax(0,1.2fr)_auto]",
    fieldFlag: "shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase",
    fieldKind: "min-w-0 truncate font-mono text-[11px] text-primary/85",
    fieldName: "min-w-0 truncate font-mono text-[11.5px] text-foreground/85",
    heading: "text-[11px] tracking-wide text-muted-foreground uppercase",
    row: "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-100 hover:bg-accent",
    rowCount: "shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground",
    rowName: "min-w-0 flex-1 truncate text-[12.5px] text-foreground",
    tag: "shrink-0 rounded-sm bg-primary/12 px-1 py-px font-mono text-[10px] text-primary",
    table: "rounded-lg bg-card",
  },
  variants: {
    expanded: { true: { disclosure: "rotate-90" } },
  },
});

const styles = schema();

function TableEntry({
  inspection,
  table,
}: Readonly<{ inspection: SurrealInspection; table: SurrealTableDefinition }>) {
  const [expanded, setExpanded] = useState(false);
  const [weight, setWeight] = useState<SurrealTableWeight | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    const next = !expanded;

    setExpanded(next);

    if (!next || weight !== null || inspection.reader === null) {
      return;
    }

    void weighTable(inspection.reader, { table: table.name })
      .then(setWeight)
      .catch((cause: unknown) => {
        setError(getErrorMessage(cause));
      });
  };

  return (
    <div className={styles.table()}>
      <button aria-expanded={expanded} className={styles.row()} onClick={open} type="button">
        <ChevronRight className={schema({ expanded }).disclosure()} />
        <span className={styles.rowName()}>{table.name}</span>
        {table.isRelation ? <span className={styles.tag()}>relation</span> : null}
        <span className={styles.rowCount()}>
          {table.fields.length} fields
          {weight === null ? "" : ` · ${formatCount(weight.records)} records`}
        </span>
      </button>
      {expanded ? (
        <div className={styles.detail()}>
          {error === null ? null : <Notice tone="danger">{error}</Notice>}
          {weight === null ? null : (
            <p className={styles.heading()}>
              {formatCount(weight.records)} records · {formatBytes(weight.sampleBytes)} over a{" "}
              {formatCount(weight.sampledRecords)}-record sample, as JSON on the wire
            </p>
          )}
          {table.fields.length === 0 ? (
            <p className={styles.heading()}>Schemaless — no declared fields</p>
          ) : (
            <div>
              <p className={styles.heading()}>Fields</p>
              {table.fields.map((field) => (
                <div className={styles.field()} key={field.name}>
                  <span className={styles.fieldName()}>{field.name}</span>
                  <span className={styles.fieldKind()}>{field.kind ?? "—"}</span>
                  <span className={styles.fieldFlag()}>
                    {[field.readonly ? "readonly" : null, field.flexible ? "flexible" : null]
                      .filter((flag) => flag !== null)
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          )}
          {table.indexes.length === 0 ? null : (
            <div>
              <p className={styles.heading()}>Indexes</p>
              <Code>{table.indexes.join("\n")}</Code>
            </div>
          )}
          {table.events.length === 0 ? null : (
            <div>
              <p className={styles.heading()}>Events</p>
              <Code>{table.events.join("\n")}</Code>
            </div>
          )}
          <div className={styles.definition()}>
            <p className={styles.heading()}>Definition</p>
            <Code>
              {[table.definition, ...table.fields.map((field) => field.definition)]
                .filter((definition) => definition !== "")
                .join("\n")}
            </Code>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Schema({ inspection }: Readonly<{ inspection: SurrealInspection }>) {
  const { catalogue } = inspection;

  if (catalogue === null) {
    return (
      <Panel>
        <Empty>{inspection.error ?? "Reading the schema…"}</Empty>
      </Panel>
    );
  }

  return (
    <Panel>
      <Section
        hint="Open a table to count its records and read its declarations."
        title={`Tables (${String(catalogue.tables.length)})`}
      >
        {catalogue.tables.length === 0 ? (
          <Empty>This database defines no tables.</Empty>
        ) : (
          catalogue.tables.map((table) => (
            <TableEntry inspection={inspection} key={table.name} table={table} />
          ))
        )}
      </Section>

      {catalogue.functions.length === 0 ? null : (
        <Section title={`Functions (${String(catalogue.functions.length)})`}>
          <Code>{catalogue.functions.join("\n\n")}</Code>
        </Section>
      )}

      {catalogue.params.length === 0 ? null : (
        <Section title={`Parameters (${String(catalogue.params.length)})`}>
          <Code>{catalogue.params.join("\n")}</Code>
        </Section>
      )}

      {catalogue.analyzers.length === 0 ? null : (
        <Section title={`Analyzers (${String(catalogue.analyzers.length)})`}>
          <Code>{catalogue.analyzers.join("\n")}</Code>
        </Section>
      )}
    </Panel>
  );
}

export { Schema };
