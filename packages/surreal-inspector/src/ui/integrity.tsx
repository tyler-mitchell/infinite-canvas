import { useState } from "react";
import { Button } from "ui";
import { tv } from "ui/tv";

import { inspectIntegrity, OFFENDER_LIMIT, type SurrealIntegrityReport } from "../core/integrity";
import { Empty, Notice, Panel, Section, Stat, StatRow } from "./chrome";
import type { SurrealInspection } from "./use-inspection";

/**
 * Runs the integrity checks on request rather than on open, because each one queries a real table.
 *
 * Checks the engine refused are listed under Gaps with the error, never counted as clean, so
 * "checked and found nothing" stays distinct from "did not check".
 */

const integrity = tv({
  slots: {
    finding: "flex flex-col gap-1 rounded-lg bg-card px-3 py-2",
    findingDetail: "font-mono text-[11.5px] text-foreground/85",
    findingReason: "text-[11px] leading-relaxed text-muted-foreground",
    offender: "font-mono text-[11px] text-muted-foreground",
    offenders: "flex flex-wrap gap-x-3 gap-y-0.5",
    tag: "w-fit rounded-sm px-1 py-px text-[10px] tracking-wide uppercase",
  },
  variants: {
    tone: {
      danger: { tag: "bg-destructive/15 text-destructive" },
      neutral: { tag: "bg-primary/12 text-primary" },
    },
  },
});

const styles = integrity();

function Integrity({ inspection }: Readonly<{ inspection: SurrealInspection }>) {
  const [report, setReport] = useState<SurrealIntegrityReport | null>(null);
  const [running, setRunning] = useState(false);

  const { catalogue, reader } = inspection;

  const run = async () => {
    if (reader === null || catalogue === null) {
      return;
    }

    setRunning(true);
    setReport(await inspectIntegrity(reader, catalogue));
    setRunning(false);
  };

  return (
    <Panel>
      <Section
        hint="Dangling record links, graph edges with a missing end, and records that predate a field being made required. Each is a query; none of it is derived from the schema alone."
        title="Checks"
      >
        <StatRow>
          <Stat label="Checks planned" value={report === null ? "—" : report.checked} />
          <Stat label="Findings" value={report?.findings.length ?? "—"} />
          <Stat
            label="Gaps"
            note={report === null ? undefined : "checks that could not run"}
            value={report?.gaps.length ?? "—"}
          />
        </StatRow>
        <Button
          disabled={running || reader === null || catalogue === null}
          onClick={() => {
            void run();
          }}
          size="sm"
          variant="secondary"
        >
          {running ? "Checking…" : "Run checks"}
        </Button>
      </Section>

      {report === null ? (
        <Empty>Nothing checked yet.</Empty>
      ) : report.findings.length === 0 ? (
        <Notice tone="positive">
          {report.checked - report.gaps.length} of {report.checked} checks ran and found nothing.
          {report.gaps.length === 0 ? "" : " The rest are listed below."}
        </Notice>
      ) : (
        <Section title={`Findings (${String(report.findings.length)})`}>
          {report.findings.map((finding) => (
            <div className={styles.finding()} key={`${finding.check}-${finding.detail}`}>
              <span className={integrity({ tone: "danger" }).tag()}>{finding.check}</span>
              <span className={styles.findingDetail()}>{finding.detail}</span>
              <div className={styles.offenders()}>
                {finding.offenders.map((offender) => (
                  <span className={styles.offender()} key={offender}>
                    {offender}
                  </span>
                ))}
              </div>
              {finding.truncated ? (
                <span className={styles.findingReason()}>
                  More than {OFFENDER_LIMIT} records match; these are the first found.
                </span>
              ) : null}
            </div>
          ))}
        </Section>
      )}

      {report === null || report.gaps.length === 0 ? null : (
        <Section
          hint="These checks did not run. They are not passes."
          title={`Gaps (${String(report.gaps.length)})`}
        >
          {report.gaps.map((gap) => (
            <div className={styles.finding()} key={`${gap.check}-${gap.detail}`}>
              <span className={integrity({ tone: "neutral" }).tag()}>{gap.check}</span>
              <span className={styles.findingDetail()}>{gap.detail}</span>
              <span className={styles.findingReason()}>{gap.reason}</span>
            </div>
          ))}
        </Section>
      )}
    </Panel>
  );
}

export { Integrity };
