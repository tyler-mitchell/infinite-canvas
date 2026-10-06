import { Play } from "lucide-react";
import { useState } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { formatDuration } from "../core/bytes";
import {
  explainStatement,
  INDEX_OPERATIONS,
  runStatement,
  type SurrealPlan,
  type SurrealQueryOutcome,
} from "../core/query";
import { Code, Empty, Notice, Panel, Section } from "./chrome";
import type { SurrealInspection } from "./use-inspection";

/** The panel separates query plans from cache activity. Statements can write. */

const query = tv({
  slots: {
    editor:
      "min-h-24 w-full resize-y rounded-lg bg-card p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
    row: "flex items-center gap-2",
    status: "flex-1 font-mono text-[11px] tabular-nums text-muted-foreground",
    step: "flex items-baseline gap-2 py-0.5 font-mono text-[11px]",
    stepDetail: "min-w-0 flex-1 truncate text-muted-foreground",
    stepName: "w-28 shrink-0",
  },
  variants: {
    scan: {
      false: { stepName: "text-primary" },
      true: { stepName: "text-foreground/70" },
    },
  },
});

const styles = query();

const STARTER = "SELECT * FROM type::table($table) LIMIT 10;";

function Query({ inspection }: Readonly<{ inspection: SurrealInspection }>) {
  const [statement, setStatement] = useState(STARTER);
  const [outcome, setOutcome] = useState<SurrealQueryOutcome | null>(null);
  const [plan, setPlan] = useState<SurrealPlan | null>(null);
  const [running, setRunning] = useState(false);

  const { reader } = inspection;

  const run = async () => {
    if (reader === null) {
      return;
    }

    setRunning(true);

    const [result, explained] = await Promise.all([
      runStatement(reader, statement),
      explainStatement(reader, statement),
    ]);

    setOutcome(result);
    setPlan(explained);
    setRunning(false);
  };

  return (
    <Panel>
      <textarea
        className={styles.editor()}
        onChange={(event) => {
          setStatement(event.target.value);
        }}
        onKeyDown={(event) => {
          // The handler keeps editor shortcuts from reaching the canvas.
          event.stopPropagation();

          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            void run();
          }
        }}
        placeholder="SurQL — ⌘↵ to run"
        spellCheck={false}
        value={statement}
      />

      <div className={styles.row()}>
        <Button
          disabled={running || reader === null}
          onClick={() => {
            void run();
          }}
          size="sm"
          variant="secondary"
        >
          <Play />
          Run
        </Button>
        <span className={styles.status()}>
          {outcome === null
            ? "⌘↵ to run"
            : `${String(outcome.results.length)} statement${outcome.results.length === 1 ? "" : "s"} · ${formatDuration(outcome.durationMs)}`}
        </span>
      </div>

      {outcome?.error === undefined || outcome.error === null ? null : (
        <Notice tone="danger">{outcome.error}</Notice>
      )}

      {plan === null ? null : (
        <Section
          hint="The engine's own plan, from EXPLAIN. This is the database reporting what it did, not the inspector guessing."
          title={
            plan.unavailable === null
              ? plan.usesIndex
                ? "Plan — index used"
                : "Plan — table scan"
              : "Plan"
          }
        >
          {plan.text !== null ? (
            <Code>{plan.text}</Code>
          ) : plan.unavailable === null ? (
            plan.steps.map((step, index) => (
              <div className={styles.step()} key={`${step.operation}-${String(index)}`}>
                <span
                  className={query({ scan: !INDEX_OPERATIONS.has(step.operation) }).stepName()}
                  style={{ marginInlineStart: step.depth * 12 }}
                >
                  {step.operation}
                </span>
                <span className={styles.stepDetail()}>{JSON.stringify(step.detail)}</span>
              </div>
            ))
          ) : (
            <Notice>{plan.unavailable}</Notice>
          )}
        </Section>
      )}

      {outcome === null ? (
        <Empty>Nothing run yet.</Empty>
      ) : (
        <Section title="Results">
          <Code>{JSON.stringify(outcome.results, null, 2)}</Code>
        </Section>
      )}
    </Panel>
  );
}

export { Query };
