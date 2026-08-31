import { useEffect, useState } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { formatBytes, formatCount } from "../core/bytes";
import { getErrorMessage } from "../core/reads";
import { getIndexedDatabaseName, type SurrealInspectorSource } from "../core/source";
import {
  measureDatabasePayload,
  surveyStorage,
  type SurrealPayloadMeasurement,
  type SurrealStorageSurvey,
} from "../core/storage";
import { Empty, Notice, Panel, Section, Stat, StatRow } from "./chrome";

/** The panel reads browser storage and does not start a SurrealDB engine. */

const storage = tv({
  slots: {
    database: "flex flex-col gap-1 rounded-lg bg-card px-3 py-2",
    name: "flex items-baseline gap-2",
    nameText: "min-w-0 flex-1 truncate font-mono text-[12px] text-foreground",
    store: "flex items-baseline gap-2 py-px font-mono text-[11px]",
    storeCount: "shrink-0 tabular-nums text-muted-foreground",
    storeName: "min-w-0 flex-1 truncate text-muted-foreground",
    tag: "shrink-0 rounded-sm bg-primary/12 px-1 py-px text-[10px] tracking-wide text-primary uppercase",
    version: "shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground",
    weight: "pt-0.5 font-mono text-[11px] text-foreground/75",
  },
});

const styles = storage();

/** The panel reads every entry only after the user requests an exact payload size. */
function Payload({ name }: Readonly<{ name: string }>) {
  const [measured, setMeasured] = useState<SurrealPayloadMeasurement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (measured !== null) {
    return (
      <p className={styles.weight()}>
        {formatBytes(measured.keyBytes + measured.valueBytes)} across{" "}
        {formatCount(measured.entries)} entries — {formatBytes(measured.valueBytes)} values,{" "}
        {formatBytes(measured.keyBytes)} keys.{" "}
        {measured.exact
          ? "Exact logical payload; disk is larger."
          : "Approximate: some entries are not byte arrays."}
      </p>
    );
  }

  return (
    <div>
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void measureDatabasePayload(name)
            .then(setMeasured)
            .catch((cause: unknown) => {
              setError(getErrorMessage(cause));
            })
            .finally(() => {
              setBusy(false);
            });
        }}
        size="xs"
        variant="ghost"
      >
        {busy ? "Measuring…" : "Measure payload"}
      </Button>
      {error === null ? null : <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

function Storage({ sources }: Readonly<{ sources: readonly SurrealInspectorSource[] }>) {
  const [survey, setSurvey] = useState<SurrealStorageSurvey | null>(null);

  useEffect(() => {
    const cancelled = { value: false };

    void surveyStorage().then((result) => {
      if (!cancelled.value) {
        setSurvey(result);
      }
    });

    return () => {
      cancelled.value = true;
    };
  }, []);

  if (survey === null) {
    return (
      <Panel>
        <Empty>Surveying storage…</Empty>
      </Panel>
    );
  }

  const known = new Map(
    sources.flatMap((source) => {
      const name = getIndexedDatabaseName(source.endpoint);

      return name === null ? [] : [[name, source.label] as const];
    }),
  );
  const backends = survey.usageByBackend;

  return (
    <Panel>
      <Section
        hint="Origin-wide and approximate by specification: the browser deliberately obscures exact figures, and this covers every storage backend the origin uses, not only SurrealDB."
        title="Origin"
      >
        <StatRow>
          <Stat label="Used" value={formatBytes(survey.usageBytes)} />
          <Stat label="Quota" value={formatBytes(survey.quotaBytes)} />
          <Stat
            label="Share of quota"
            value={
              survey.usageBytes === null || survey.quotaBytes === null || survey.quotaBytes === 0
                ? "—"
                : `${((100 * survey.usageBytes) / survey.quotaBytes).toFixed(1)}%`
            }
          />
          <Stat
            label="Persisted"
            note={survey.persisted === false ? "eviction is permitted" : undefined}
            value={survey.persisted === null ? "—" : survey.persisted ? "yes" : "no"}
          />
        </StatRow>
        {backends === null ? (
          <Notice>
            This browser does not break usage down by backend — `usageDetails` is a Chromium
            extension to the standard, so its absence is a missing measurement rather than a zero.
          </Notice>
        ) : (
          <StatRow>
            {Object.entries(backends).map(([backend, bytes]) => (
              <Stat key={backend} label={backend} value={formatBytes(bytes)} />
            ))}
          </StatRow>
        )}
      </Section>

      <Section
        hint="Every IndexedDB database in this origin, whether or not anything has opened it. Entry counts are exact; IndexedDB reports no byte size per store, so none is shown."
        title="IndexedDB"
      >
        {!survey.enumerable ? (
          <Notice tone="danger">{survey.unreadable ?? "Databases could not be enumerated."}</Notice>
        ) : survey.databases.length === 0 ? (
          <Empty>No IndexedDB databases in this origin.</Empty>
        ) : (
          survey.databases.map((database) => (
            <div className={styles.database()} key={database.name}>
              <div className={styles.name()}>
                <span className={styles.nameText()}>{database.name}</span>
                {known.has(database.name) ? <span className={styles.tag()}>attached</span> : null}
                <span className={styles.version()}>
                  {database.version === null ? "" : `v${String(database.version)}`}
                </span>
              </div>
              {database.unreadable === null ? (
                database.stores.length === 0 ? (
                  <p className={styles.storeName()}>No object stores.</p>
                ) : (
                  <>
                    {database.stores.map((store) => (
                      <div className={styles.store()} key={store.name}>
                        <span className={styles.storeName()}>{store.name}</span>
                        <span className={styles.storeCount()}>
                          {formatCount(store.entries)} entries
                        </span>
                      </div>
                    ))}
                    <Payload name={database.name} />
                  </>
                )
              ) : (
                <Notice tone="danger">{database.unreadable}</Notice>
              )}
            </div>
          ))
        )}
      </Section>
    </Panel>
  );
}

export { Storage };
