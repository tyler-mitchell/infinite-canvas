import { Download, Upload } from "lucide-react";
import { useState } from "react";
import type { SqlExportOptions } from "surrealdb";
import { Button } from "ui";
import { tv } from "ui/tv";

import { formatBytes, formatDuration } from "../core/bytes";
import {
  downloadSurql,
  exportSurql,
  FULL_EXPORT,
  importSurql,
  type SurrealExport,
  type SurrealImportOutcome,
} from "../core/transfer";
import { Code, Notice, Panel, Section, Stat, StatRow } from "./chrome";
import type { SurrealInspection } from "./use-inspection";

/**
 * Exports the database as SurQL and imports SurQL back. The export is shown on screen as well as
 * offered as a file, so it can be read as a schema dump.
 *
 * Import is destructive and gated behind a second press. It adds to the database rather than
 * replacing it, so importing over populated tables will collide with existing records. The panel
 * states this next to the button.
 */

const transfer = tv({
  slots: {
    editor:
      "min-h-32 w-full resize-y rounded-lg bg-card p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
    option: "flex items-center gap-1.5 text-[11px] text-muted-foreground",
    options: "flex flex-wrap gap-x-3 gap-y-1",
    row: "flex flex-wrap items-center gap-2",
  },
});

const styles = transfer();

/** Export sections that can be toggled off to shrink the output or reduce it to a schema. */
const TOGGLES = ["records", "tables", "functions", "params", "analyzers", "users"] as const;

function Transfer({ inspection }: Readonly<{ inspection: SurrealInspection }>) {
  const [options, setOptions] = useState<Partial<SqlExportOptions>>(FULL_EXPORT);
  const [taken, setTaken] = useState<SurrealExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState("");
  const [armed, setArmed] = useState(false);
  const [outcome, setOutcome] = useState<SurrealImportOutcome | null>(null);

  const { client } = inspection;

  const take = async () => {
    if (client === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      setTaken(await exportSurql(client, options));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }

    setBusy(false);
  };

  const send = async () => {
    if (client === null) {
      return;
    }

    setBusy(true);
    setOutcome(await importSurql(client, incoming));
    setArmed(false);
    setBusy(false);
    inspection.refresh();
  };

  return (
    <Panel>
      <Section
        hint="SurrealDB's own export: the statements that would rebuild what is here."
        title="Export"
      >
        <div className={styles.options()}>
          {TOGGLES.map((key) => (
            <label className={styles.option()} key={key}>
              <input
                checked={options[key] === true}
                onChange={(event) => {
                  setOptions({ ...options, [key]: event.target.checked });
                }}
                type="checkbox"
              />
              {key}
            </label>
          ))}
        </div>
        <div className={styles.row()}>
          <Button
            disabled={busy || client === null}
            onClick={() => {
              void take();
            }}
            size="sm"
            variant="secondary"
          >
            <Download />
            {busy ? "Exporting…" : "Export"}
          </Button>
          {taken === null ? null : (
            <Button
              onClick={() => {
                downloadSurql({
                  filename: `surreal-export-${String(taken.takenAt)}.surql`,
                  text: taken.text,
                });
              }}
              size="sm"
              variant="ghost"
            >
              Save as file
            </Button>
          )}
        </div>
        {error === null ? null : <Notice tone="danger">{error}</Notice>}
        {taken === null ? null : (
          <>
            <StatRow>
              <Stat label="Size" value={formatBytes(taken.bytes)} />
              <Stat label="Lines" value={taken.text.split("\n").length} />
            </StatRow>
            <Code>{taken.text.slice(0, 20_000)}</Code>
            {taken.text.length > 20_000 ? (
              <Notice>
                Showing the first 20,000 characters of {formatBytes(taken.bytes)}. Save the file for
                the rest.
              </Notice>
            ) : null}
          </>
        )}
      </Section>

      <Section
        hint="Statements run against the live database. This adds to what is there — it does not replace it — so a dump imported over populated tables will collide with the records already in them."
        title="Import"
      >
        <textarea
          className={styles.editor()}
          onChange={(event) => {
            setIncoming(event.target.value);
            setArmed(false);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          placeholder="Paste SurQL, or choose a file"
          spellCheck={false}
          value={incoming}
        />
        <div className={styles.row()}>
          <input
            accept=".surql,.sql,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];

              setArmed(false);

              void file?.text().then(setIncoming);
            }}
            type="file"
          />
        </div>
        <div className={styles.row()}>
          {armed ? (
            <>
              <Button
                disabled={busy}
                onClick={() => {
                  void send();
                }}
                size="sm"
                variant="destructive"
              >
                <Upload />
                {busy ? "Importing…" : `Yes — write ${formatBytes(new Blob([incoming]).size)}`}
              </Button>
              <Button
                onClick={() => {
                  setArmed(false);
                }}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              disabled={busy || client === null || incoming.trim() === ""}
              onClick={() => {
                setArmed(true);
              }}
              size="sm"
              variant="secondary"
            >
              <Upload />
              Import
            </Button>
          )}
        </div>
        {outcome === null ? null : outcome.error === null ? (
          <Notice tone="positive">
            Imported {formatBytes(outcome.bytes)} in {formatDuration(outcome.durationMs)}. The
            schema has been re-read.
          </Notice>
        ) : (
          <Notice tone="danger">{outcome.error}</Notice>
        )}
      </Section>
    </Panel>
  );
}

export { Transfer };
