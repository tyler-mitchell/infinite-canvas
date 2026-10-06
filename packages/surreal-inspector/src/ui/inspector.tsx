import { Database, RotateCw } from "lucide-react";
import { useState } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "ui";
import { tv } from "ui/tv";

import type { SurrealInspectorSource } from "../core/source";
import { Integrity } from "./integrity";
import { Migrations } from "./migrations";
import { Overview } from "./overview";
import { Query } from "./query";
import { Records } from "./records";
import { Schema } from "./schema";
import { Storage } from "./storage";
import { Transfer } from "./transfer";
import { useSurrealInspection } from "./use-inspection";

/** The inspector uses the host connection to prevent a second IndexedDB writer. */

const inspector = tv({
  slots: {
    header: "flex shrink-0 items-center gap-2 px-3 pt-3",
    root: "flex h-full min-h-0 w-full flex-col bg-background text-foreground",
    source: "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] transition-colors duration-100",
    sources: "flex min-w-0 flex-1 flex-wrap items-center gap-1",
    strip: "shrink-0 px-3 pt-2",
    title: "flex shrink-0 items-center gap-1.5 pr-1 text-[12px] text-muted-foreground",
  },
  variants: {
    selected: {
      false: { source: "bg-card text-muted-foreground hover:bg-accent hover:text-foreground" },
      true: { source: "bg-primary/15 text-primary" },
    },
  },
});

const styles = inspector();

const PANELS = [
  { label: "Overview", value: "overview" },
  { label: "Schema", value: "schema" },
  { label: "Records", value: "records" },
  { label: "Query", value: "query" },
  { label: "Storage", value: "storage" },
  { label: "Integrity", value: "integrity" },
  { label: "Migrations", value: "migrations" },
  { label: "Transfer", value: "transfer" },
] as const;

function SurrealInspector({ sources }: Readonly<{ sources: readonly SurrealInspectorSource[] }>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const source = sources.find((entry) => entry.id === selectedId) ?? sources[0];

  if (source === undefined) {
    throw new Error("SurrealInspector needs at least one source");
  }

  return <Inspection key={source.id} onSelect={setSelectedId} source={source} sources={sources} />;
}

/** A source change remounts this subtree and clears source-specific state. */
function Inspection({
  onSelect,
  source,
  sources,
}: Readonly<{
  onSelect: (id: string) => void;
  source: SurrealInspectorSource;
  sources: readonly SurrealInspectorSource[];
}>) {
  const inspection = useSurrealInspection(source);

  return (
    <div className={styles.root()}>
      <div className={styles.header()}>
        <span className={styles.title()}>
          <Database size={13} />
          SurrealDB
        </span>
        <div className={styles.sources()}>
          {sources.map((entry) => (
            <button
              className={inspector({ selected: entry.id === source.id }).source()}
              key={entry.id}
              onClick={() => {
                onSelect(entry.id);
              }}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
        <Button
          aria-label="Re-read"
          onClick={inspection.refresh}
          size="icon-sm"
          title="Drop the cache and re-read"
          variant="ghost"
        >
          <RotateCw />
        </Button>
      </div>

      <Tabs className={styles.root()} defaultValue="overview">
        <div className={styles.strip()}>
          <TabsList variant="line">
            {PANELS.map((panel) => (
              <TabsTrigger key={panel.value} value={panel.value}>
                {panel.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <Overview inspection={inspection} source={source} />
        </TabsContent>
        <TabsContent value="schema">
          <Schema inspection={inspection} />
        </TabsContent>
        <TabsContent value="records">
          <Records inspection={inspection} />
        </TabsContent>
        <TabsContent value="query">
          <Query inspection={inspection} />
        </TabsContent>
        <TabsContent value="storage">
          <Storage sources={sources} />
        </TabsContent>
        <TabsContent value="integrity">
          <Integrity inspection={inspection} />
        </TabsContent>
        <TabsContent value="migrations">
          <Migrations inspection={inspection} source={source} />
        </TabsContent>
        <TabsContent value="transfer">
          <Transfer inspection={inspection} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { SurrealInspector };
