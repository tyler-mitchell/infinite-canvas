import { createFileRoute } from "@tanstack/react-router";
import {
  ActivityGrid,
  type ActivityGridProps,
  Bars,
  barsLabel,
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
  tv,
} from "polkadot-ui";

import { Api } from "../api.tsx";
import { Props } from "../props.tsx";
import {
  ACTIVITY,
  COMMIT_WEEKS,
  FRAME_BUDGET,
  INSTALLS,
  INSTALLS_SMALL,
  RELEASES,
  LATENCY,
  LEVELS,
  READING,
} from "../fixtures.ts";

const INSTALL_CEILING = Math.max(...INSTALLS);

const COMMIT_PEAK = Math.max(...COMMIT_WEEKS);
const COMMIT_PEAK_WEEK = COMMIT_WEEKS.indexOf(COMMIT_PEAK);
const LATEST_FRAME = FRAME_BUDGET[FRAME_BUDGET.length - 1];
const LATEST_LATENCY = `${LATENCY[LATENCY.length - 1]}ms`;
/* Three readings beside these charts were typed out, and a typed reading outlives its series. */
const LATEST_INSTALLS = INSTALLS[INSTALLS.length - 1]!.toLocaleString("en-US");
const LATEST_ICONS = INSTALLS_SMALL[INSTALLS_SMALL.length - 1]!.toLocaleString("en-US");
/* The two release charts state nothing else, so the name is the only place their figures land. */
const RELEASE_READINGS = barsLabel(RELEASES);

/**
 * The most weeks to ask for. The grid draws fewer when the width cannot hold them, and it states
 * the span it actually drew in its own label, so nothing here counts the days.
 */
const CONTRIBUTION_WEEKS = 26;

const readouts = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(min(236px,100%),1fr))] gap-3",
    barBox: "flex h-[64px] flex-col",
    activity: "max-w-[600px]",
  },
});

export const Route = createFileRoute("/readouts")({
  component: Readouts,
});

function Readouts() {
  const styles = readouts();

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
              <Label>{`commits · ${COMMIT_WEEKS.length} weeks`}</Label>
              <Meta>{`${COMMIT_PEAK} · wk ${COMMIT_PEAK_WEEK}`}</Meta>
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
              size="lg"
              caption={LATEST_LATENCY}
              label={`p95 latency over 96 hours, latest ${LATEST_LATENCY}`}
            />
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>frame budget</Label>
              <Meta>{`${LATEST_FRAME} ms`}</Meta>
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
        <Api name="sparkline" of={sparklineVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>a series with nothing in it</Kind>
          <Meta>one reading, and none</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>first deploy</Label>
              <Meta>1 reading</Meta>
            </Row>
            <Sparkline values={[42]} />
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>not yet measured</Label>
              <Meta>0 readings</Meta>
            </Row>
            <Sparkline values={[]} />
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          One reading is a series at rest, so it draws level across the whole width rather than as a
          dot against the left edge. An empty one draws nothing at all, and neither reports a bound
          it does not have: the name a screen reader hears is &ldquo;no readings&rdquo;, never a
          count of zero followed by a value that is not there.
        </Prose>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>activity grid</Kind>
          <Meta>weeks are columns · width drops history</Meta>
        </Row>
        <Surface tone="card" className={styles.activity()}>
          <Row>
            <Label>contributions</Label>
            <Meta>weeks fit to the width</Meta>
          </Row>
          <ActivityGrid days={ACTIVITY} weeks={CONTRIBUTION_WEEKS} label="contributions">
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
            {
              name: "children",
              note: "replaces the plot's own readout; whatever it returns has to announce",
            },
            {
              name: "label",
              fallback: "activity",
              note: "names the series for a reader who cannot see it; two grids on a page need two names",
            },
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
          <ActivityGrid
            days={READING}
            weeks={18}
            cellSize={13}
            thresholds={[1, 30, 60, 120]}
            label="minutes read"
          />
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
              <Readout>{LATEST_INSTALLS}</Readout>
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
        <Api name="bars" of={barsVariants} />
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
              <Readout>{LATEST_INSTALLS}</Readout>
            </Row>
            <div className={styles.barBox()}>
              <Bars values={INSTALLS} max={INSTALL_CEILING} label="weekly installs, polkadot-ui" />
            </div>
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>polkadot-icons</Label>
              <Readout>{LATEST_ICONS}</Readout>
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
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>releases</Label>
              <Meta>a floor under an empty week</Meta>
            </Row>
            <div className={styles.barBox()}>
              <Bars
                values={RELEASES}
                label={`releases a week, with a floor: ${RELEASE_READINGS}`}
              />
            </div>
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>releases</Label>
              <Meta>no floor</Meta>
            </Row>
            <div className={styles.barBox()}>
              <Bars
                values={RELEASES}
                minHeight={0}
                label={`releases a week, with no floor: ${RELEASE_READINGS}`}
              />
            </div>
          </Surface>
        </div>
        <Prose className={styles.lede()}>
          A week with nothing in it still happened, and a chart that draws it as no bar at all reads
          as a week that is missing rather than empty. The floor keeps a mark there. Set it to zero
          and the two empty weeks disappear, which is the same series telling a different story.
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
            <Readout>{`${LATEST_FRAME} ms`}</Readout>
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
