import { createFileRoute } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import {
  ActivityGrid,
  type ActivityGridProps,
  Bars,
  type BarsProps,
  barsVariants,
  Display,
  Kind,
  Label,
  Meta,
  Prose,
  Readout,
  Row,
  Sparkline,
  type SparklineProps,
  sparklineVariants,
  Surface,
} from "polkadot-ui";

import { Api } from "../api.tsx";
import { Props } from "../props.tsx";
import {
  ACTIVITY,
  COMMIT_WEEKS,
  FRAME_BUDGET,
  INSTALLS,
  INSTALLS_SMALL,
  LATENCY,
  LEVELS,
  READING,
} from "../fixtures.ts";

const INSTALL_CEILING = Math.max(...INSTALLS);

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
        <Display>readouts</Display>
        <Prose className={styles.lede()}>
          Values drawn in the DOM rather than a canvas, so a change is a compositor transition and
          the numbers survive a document that is not producing frames.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>sparkline</Kind>
          <Meta>a trace with a live head · three series shapes</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>commits · 64 weeks</Label>
              <Meta>11 · wk 7</Meta>
            </Row>
            <Sparkline values={COMMIT_WEEKS} label="commits per week over 64 weeks" />
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>p95 latency</Label>
              <Meta>96h window</Meta>
            </Row>
            <Sparkline
              values={LATENCY}
              caption={`${LATENCY[LATENCY.length - 1]}ms`}
              label="p95 latency over 96 hours"
            />
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>frame budget</Label>
              <Meta>15.9 ms</Meta>
            </Row>
            <Sparkline values={FRAME_BUDGET} size="sm" label="frame time over 72 frames" />
          </Surface>
        </div>
        <Props<SparklineProps>
          name="sparkline"
          rows={[
            { name: "values", note: "oldest first, and the last one is the head" },
            { name: "caption", note: "a badge at the head, in the dot's place" },
            { name: "label", note: "names the series for a reader who cannot see it" },
          ]}
        />
        <Api of={sparklineVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>activity grid</Kind>
          <Meta>weeks are columns · width drops history</Meta>
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
        <Props<ActivityGridProps>
          name="activity grid"
          rows={[
            { name: "days", note: "one entry per day, oldest first" },
            { name: "weeks", fallback: "26", note: "the most it will show, never a minimum" },
            { name: "cellSize", fallback: "11", note: "an input, never a result" },
            {
              name: "thresholds",
              fallback: "1 · 3 · 6 · 10",
              note: "the counts each level starts at",
            },
            { name: "children", note: "a render prop for the readout under the plot" },
          ]}
        />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>level bounds</Kind>
          <Meta>the scale belongs to the series</Meta>
        </Row>
        <Surface tone="card" className={styles.activity()}>
          <Row>
            <Label>minutes read</Label>
            <Meta>1 · 30 · 60 · 120</Meta>
          </Row>
          <ActivityGrid days={READING} weeks={18} thresholds={[1, 30, 60, 120]}>
            {(day) => (
              <Readout>
                {day
                  ? `${day.count || "no"} minutes · ${day.date.toDateString().slice(0, 10)}`
                  : "hover a day"}
              </Readout>
            )}
          </ActivityGrid>
        </Surface>
        <Prose className={styles.lede()}>
          The defaults suit commits per day. Give the same component minutes and every non-zero
          value clears the top bound, so the year arrives in a single colour unless the series
          brings its own scale.
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
        <Props<BarsProps>
          name="bars"
          rows={[
            { name: "values", note: "raw numbers, oldest first" },
            { name: "max", fallback: "the largest value", note: "give it to share a ceiling" },
            { name: "minHeight", fallback: "0.08", note: "so an empty bucket is still a mark" },
            { name: "label", note: "names the series for a reader who cannot see it" },
          ]}
        />
        <Api of={barsVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>one scale</Kind>
          <Meta>two series · one ceiling</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>polkadot-ui</Label>
              <Readout>4,182</Readout>
            </Row>
            <div className={styles.barBox()}>
              <Bars values={INSTALLS} max={INSTALL_CEILING} label="weekly installs, polkadot-ui" />
            </div>
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>polkadot-icons</Label>
              <Readout>510</Readout>
            </Row>
            <div className={styles.barBox()}>
              <Bars
                values={INSTALLS_SMALL}
                max={INSTALL_CEILING}
                label="weekly installs, polkadot-icons"
              />
            </div>
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          Bars scale to their own tallest value unless told otherwise, which is right for a lone
          chart and wrong for a pair. Without a shared ceiling the smaller package would draw
          exactly the same shape as the larger, and the comparison a reader takes from the page
          would be false.
        </Prose>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>readout</Kind>
          <Meta>announces, because it changes in place</Meta>
        </Row>
        <Surface tone="card" className={styles.activity()}>
          <Row>
            <Label>frame budget</Label>
            <Readout>8.2 ms</Readout>
          </Row>
          <Prose>
            The only text role that is more than a class: it carries a live region, so a value that
            updates in place is still reachable by someone who cannot see it change.
          </Prose>
        </Surface>
      </section>
    </div>
  );
}
