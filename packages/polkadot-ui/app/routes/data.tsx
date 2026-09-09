import { createFileRoute } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import { ActivityGrid } from "#/components/activity-grid.tsx";
import { Bars, barsVariants } from "#/components/bars.tsx";
import { Row } from "#/components/row.tsx";
import { Surface } from "#/components/surface.tsx";
import { Kind, Label, Meta, Prose, Readout, Title } from "#/components/text.tsx";

import { Api } from "../api.tsx";
import { ACTIVITY, INSTALLS, LEVELS } from "../fixtures.ts";

const data = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
    barBox: "flex h-[64px] flex-col",
    activity: "max-w-[600px]",
  },
});

export const Route = createFileRoute("/data")({
  component: Data,
});

function Data() {
  const styles = data();

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Title>readouts</Title>
        <Prose className={styles.lede()}>
          Values drawn in the DOM rather than a canvas, so a change is a compositor transition and
          the numbers survive a document that is not producing frames.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>activity grid</Kind>
          <Meta>weeks are columns · width drops history, never cell size</Meta>
        </Row>
        <Surface tone="card" className={styles.activity()}>
          <Row>
            <Label>contributions</Label>
            <Meta>371 days</Meta>
          </Row>
          <ActivityGrid days={ACTIVITY}>
            {(day) => (
              <Readout>
                {day
                  ? `${day.count || "no"} contribution${day.count === 1 ? "" : "s"} · ${day.date.toDateString().slice(0, 10)}`
                  : "hover a day"}
              </Readout>
            )}
          </ActivityGrid>
        </Surface>
        <Prose className={styles.lede()}>
          Narrow the window and it shows fewer weeks at a size a pointer can still hit, rather than
          shrinking every cell towards four pixels.
        </Prose>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>bars</Kind>
          <Meta>2 shapes · the newest value carries the accent</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>weekly installs</Label>
              <Readout>4,182</Readout>
            </Row>
            <div className={styles.barBox()}>
              <Bars values={INSTALLS} label="weekly installs over eight weeks" />
            </div>
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>now playing</Label>
              <Meta>aphex twin</Meta>
            </Row>
            <div className={styles.barBox()}>
              <Bars values={LEVELS} shape="column" gap="tight" emphasis="none" label="levels" />
            </div>
          </Surface>
        </div>
        <Api of={barsVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>readout</Kind>
          <Meta>announces, because it changes without a layout change</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>frame budget</Label>
              <Readout>8.2 ms</Readout>
            </Row>
            <Prose>
              The only text role that is more than a class: it carries a live region, so a value
              that updates in place is still reachable by someone who cannot see it change.
            </Prose>
          </Surface>
        </div>
      </section>
    </div>
  );
}
