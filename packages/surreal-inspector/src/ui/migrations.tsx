import { tv } from "ui/tv";

import { inspectMigrations, type SurrealDriftEntry } from "../core/migrations";
import type { SurrealInspectorSource } from "../core/source";
import { Empty, Notice, Panel, Section, Stat, StatRow } from "./chrome";
import type { SurrealInspection } from "./use-inspection";

/** The panel compares live definitions with the manifest. It does not reconstruct history. */

const migrations = tv({
  slots: {
    entry: "flex items-baseline gap-2 rounded-md bg-card px-2.5 py-1.5",
    entryId: "min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground/85",
    entryOrigin: "shrink-0 font-mono text-[10px] text-muted-foreground",
    stage: "flex items-baseline gap-2 rounded-lg bg-card px-3 py-2",
    stageCount: "shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground",
    stageFiles: "min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground",
    stageName: "shrink-0 text-[12px] text-foreground",
  },
});

const styles = migrations();

function DriftRow({ entry }: Readonly<{ entry: SurrealDriftEntry }>) {
  return (
    <div className={styles.entry()}>
      <span className={styles.entryId()}>{entry.definition.id}</span>
      <span className={styles.entryOrigin()}>{entry.origin ?? "database only"}</span>
    </div>
  );
}

function Migrations({
  inspection,
  source,
}: Readonly<{ inspection: SurrealInspection; source: SurrealInspectorSource }>) {
  const { catalogue } = inspection;
  const { manifest } = source;

  if (manifest === undefined) {
    return (
      <Panel>
        <Notice>
          This source declares no manifest. Drift is a comparison against the SurQL a host installs,
          so with nothing to compare against there is nothing here that would be true — the database
          itself records no migration history.
        </Notice>
      </Panel>
    );
  }

  if (catalogue === null) {
    return (
      <Panel>
        <Empty>{inspection.error ?? "Reading the schema…"}</Empty>
      </Panel>
    );
  }

  const report = inspectMigrations(catalogue, manifest);

  return (
    <Panel>
      <Section title={`Manifest v${String(manifest.version)}`}>
        <StatRow>
          <Stat label="Stages" value={report.stages.length} />
          <Stat
            label="Declared"
            value={report.stages.reduce((total, stage) => total + stage.declared, 0)}
          />
          <Stat label="Missing" value={report.missing.length} />
          <Stat
            label="Redefined"
            note="type differs from the source"
            value={report.redefined.length}
          />
          <Stat
            label="Undeclared"
            note="in the database, in no file"
            value={report.undeclared.length}
          />
        </StatRow>
        {report.stages.map((stage) => (
          <div className={styles.stage()} key={stage.name}>
            <span className={styles.stageName()}>{stage.name}</span>
            <span className={styles.stageFiles()}>{stage.files.join(", ")}</span>
            <span className={styles.stageCount()}>
              {stage.declared} declared
              {stage.missing === 0 ? "" : ` · ${String(stage.missing)} missing`}
            </span>
          </div>
        ))}
      </Section>

      {report.redefined.length === 0 ? null : (
        <Section
          hint="The field exists on both sides with two different types. A DEFINE guarded by IF NOT EXISTS does nothing over a field that already exists, so editing a type in the source and reopening the app leaves the old one in place — which is what this catches."
          title={`Redefined (${String(report.redefined.length)})`}
        >
          {report.redefined.map((entry) => (
            <div className={styles.entry()} key={entry.id}>
              <span className={styles.entryId()}>
                {entry.id} — source says {entry.declared}, database has {entry.live}
              </span>
              <span className={styles.entryOrigin()}>{entry.origin}</span>
            </div>
          ))}
        </Section>
      )}

      {report.missing.length === 0 ? (
        <Notice tone="positive">
          Everything the manifest declares is present in the database.
        </Notice>
      ) : (
        <Section
          hint="Declared by a manifest file and absent from the database. Either the file did not run, or something removed its effect afterwards."
          title={`Missing (${String(report.missing.length)})`}
        >
          {report.missing.map((entry) => (
            <DriftRow entry={entry} key={entry.definition.id} />
          ))}
        </Section>
      )}

      {report.undeclared.length === 0 ? null : (
        <Section
          hint="In the database, declared by no manifest file. A fresh database built from the manifest alone would not have these."
          title={`Undeclared (${String(report.undeclared.length)})`}
        >
          {report.undeclared.map((entry) => (
            <DriftRow entry={entry} key={entry.definition.id} />
          ))}
        </Section>
      )}

      {report.derived.length === 0 ? null : (
        <Section
          hint="Put there by the engine rather than by a file: a relation table's in and out, an array field's items. A database built from the manifest alone would have these too, so they are not drift — they are listed only so nothing is dropped without saying so."
          title={`Engine-derived (${String(report.derived.length)})`}
        >
          {report.derived.map((entry) => (
            <DriftRow entry={entry} key={entry.definition.id} />
          ))}
        </Section>
      )}

      {report.unmodelled.length === 0 ? null : (
        <Notice>
          {report.unmodelled.join(", ")} carry `REMOVE` statements. The scan reads `DEFINE` only, so
          anything those files take away is not reflected above.
        </Notice>
      )}
    </Panel>
  );
}

export { Migrations };
