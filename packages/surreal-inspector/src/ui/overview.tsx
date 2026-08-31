import { useEffect, useState } from "react";
import { tv } from "ui/tv";

import { readEngineArtifacts, type SurrealArtifact } from "../core/artifacts";
import { formatBytes, formatDuration } from "../core/bytes";
import { getErrorMessage } from "../core/reads";
import type { SurrealInspectorSource } from "../core/source";
import { Code, Notice, Panel, Section, Stat, StatRow } from "./chrome";
import type { SurrealInspection } from "./use-inspection";

const overview = tv({
  slots: {
    artifact: "flex items-baseline gap-2 rounded-md bg-card px-2.5 py-1.5 text-[11px]",
    artifactName: "min-w-0 flex-1 truncate font-mono text-foreground/80",
    artifactSize: "shrink-0 font-mono tabular-nums text-muted-foreground",
    event: "flex items-baseline gap-2 px-1 py-0.5 font-mono text-[11px]",
    eventKey: "min-w-0 flex-1 truncate text-foreground/70",
    eventOutcome: "w-14 shrink-0",
    eventTime: "w-16 shrink-0 text-right tabular-nums text-muted-foreground",
    tag: "shrink-0 rounded-sm px-1 py-px text-[10px] tracking-wide uppercase",
  },
  variants: {
    outcome: {
      cached: { eventOutcome: "text-primary" },
      failed: { eventOutcome: "text-destructive" },
      queried: { eventOutcome: "text-muted-foreground" },
    },
  },
});

const styles = overview();

function ArtifactRow({ artifact }: Readonly<{ artifact: SurrealArtifact }>) {
  return (
    <div className={styles.artifact()}>
      <span className={styles.artifactName()}>{new URL(artifact.name).pathname}</span>
      {artifact.fromCache ? (
        <span className={overview({ outcome: "cached" }).tag()}>cache</span>
      ) : null}
      <span className={styles.artifactSize()}>
        {formatBytes(artifact.decodedBytes)} · {formatDuration(artifact.durationMs)}
      </span>
    </div>
  );
}

function Overview({
  inspection,
  source,
}: Readonly<{ inspection: SurrealInspection; source: SurrealInspectorSource }>) {
  const [version, setVersion] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<readonly SurrealArtifact[]>([]);
  const { client } = inspection;

  useEffect(() => {
    setArtifacts(readEngineArtifacts());

    if (client === null) {
      return;
    }

    const cancelled = { value: false };

    void client
      .version()
      .then((info) => {
        if (!cancelled.value) {
          setVersion(typeof info.version === "string" ? info.version : JSON.stringify(info));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled.value) {
          setVersion(getErrorMessage(error));
        }
      });

    return () => {
      cancelled.value = true;
    };
  }, [client, inspection.revision]);

  const ledger = inspection.reader?.ledger() ?? null;
  const catalogue = inspection.catalogue;
  const cacheTotal = ledger === null ? 0 : ledger.cached + ledger.queried;

  return (
    <Panel>
      <Section title="Connection">
        <StatRow>
          <Stat
            label="Endpoint"
            note={`${source.namespace} / ${source.database}`}
            value={source.endpoint}
          />
          <Stat label="Engine" value={version ?? "…"} />
          <Stat
            label="Tables"
            value={catalogue === null ? "…" : catalogue.tables.length}
            note={
              catalogue === null ? undefined : `${String(catalogue.functions.length)} functions`
            }
          />
          <Stat
            label="Status"
            value={inspection.error === null ? (catalogue === null ? "opening" : "open") : "failed"}
          />
        </StatRow>
        {inspection.error === null ? null : <Notice tone="danger">{inspection.error}</Notice>}
      </Section>

      <Section
        hint="Sizes and durations from the browser's own resource timeline. “cache” means the browser served it without touching the network — an HTTP cache hit, which is not the same thing as the read cache below. The WebAssembly binary itself is fetched inside the worker, and a page's timeline does not record another thread's requests, so it will not appear here."
        title="Engine artifacts"
      >
        {artifacts.length === 0 ? (
          <Notice>
            Nothing matching the engine is in this page's resource timeline. The buffer is finite
            and the engine loads once, so this is expected on a long-running page.
          </Notice>
        ) : (
          artifacts.map((artifact) => <ArtifactRow artifact={artifact} key={artifact.name} />)
        )}
      </Section>

      <Section
        hint="The inspector's own cache, in front of the engine. SurrealDB publishes no cache statistics, so nothing here describes the database's internals — for the engine's own choices, read a query's plan in the Query panel."
        title="Reads"
      >
        <StatRow>
          <Stat label="Served from cache" value={ledger?.cached ?? 0} />
          <Stat label="Queried" value={ledger?.queried ?? 0} />
          <Stat label="Failed" value={ledger?.failed ?? 0} />
          <Stat
            label="Hit rate"
            note={cacheTotal === 0 ? "no reads yet" : `over ${String(cacheTotal)} reads`}
            value={
              cacheTotal === 0 ? "—" : `${((100 * (ledger?.cached ?? 0)) / cacheTotal).toFixed(0)}%`
            }
          />
        </StatRow>
        {ledger === null || ledger.events.length === 0 ? null : (
          <Code>
            {ledger.events.slice(0, 12).map((event) => (
              <span className={styles.event()} key={`${String(event.at)}-${event.key}`}>
                <span className={overview({ outcome: event.outcome }).eventOutcome()}>
                  {event.outcome}
                </span>
                <span className={styles.eventKey()}>{event.key}</span>
                <span className={styles.eventTime()}>{formatDuration(event.durationMs)}</span>
              </span>
            ))}
          </Code>
        )}
      </Section>
    </Panel>
  );
}

export { Overview };
