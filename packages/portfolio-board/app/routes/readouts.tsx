import { createFileRoute } from "@tanstack/react-router";
import { useObservable, useValue } from "@legendapp/state/react";
import {
  ActivityGrid,
  type ActivityGridProps,
  Bars,
  Button,
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
} from "portfolio-board";

import { Api } from "../api.tsx";
import { Props } from "../props.tsx";
import portfolioDocument from "../../portfolio/document.json";
import {
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

const CONTRIBUTIONS = portfolioDocument.content.windows.contributions.data;
const CONTRIBUTION_DAYS = CONTRIBUTIONS.weeks.flatMap((week) =>
  week.contributionDays.map((day) => ({
    date: new Date(`${day.date}T00:00`),
    count: day.contributionCount,
  })),
);

const readouts = tv({
  slots: {
    page: "flex max-w-pk-page flex-col gap-9",
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
  const playback$ = useObservable({ replayKey: 0, loading: false, loop: false });
  const playback = useValue(playback$);

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
            <Sparkline values={COMMIT_WEEKS} label="commits per week" />
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>p95 latency</Label>
              <Meta>96h window</Meta>
            </Row>
            <Sparkline values={LATENCY} size="lg" caption={LATEST_LATENCY} label="p95 latency" />
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>frame budget</Label>
              <Meta>{`${LATEST_FRAME} ms`}</Meta>
            </Row>
            <Sparkline values={FRAME_BUDGET} size="sm" label="frame time in ms" />
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
            <Meta>{CONTRIBUTIONS.totalContributions.toLocaleString()} in the last year</Meta>
          </Row>
          <ActivityGrid
            days={CONTRIBUTION_DAYS}
            weeks={CONTRIBUTIONS.weeks.length}
            thresholds={[1, 5, 12, 25]}
            label="contributions"
            replayKey={playback.replayKey}
            loading={playback.loading}
            playback={{ loop: playback.loop }}
          />
        </Surface>
        <Row>
          <Button onClick={() => playback$.replayKey.set((value) => value + 1)}>
            Replay activity
          </Button>
          <Button
            aria-pressed={playback.loading}
            onClick={() => playback$.loading.set((value) => !value)}
          >
            {playback.loading ? "Resume activity" : "Show loading"}
          </Button>
          <Button
            aria-pressed={playback.loop}
            onClick={() => playback$.loop.set((value) => !value)}
          >
            {playback.loop ? "Stop looping" : "Loop activity"}
          </Button>
        </Row>
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
              name: "playback",
              fallback: "true",
              note: "duration, loop, impact, and particle settings",
            },
            {
              name: "loading",
              fallback: "false",
              note: "pauses the current pass and shows loading status",
            },
            { name: "replayKey", note: "change to fade out and replay" },
            { name: "loadingLabel", fallback: "Loading activity", note: "loading status text" },
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
              <Bars values={INSTALLS} label="weekly installs" />
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
              <Label>portfolio-board</Label>
              <Readout>{LATEST_INSTALLS}</Readout>
            </Row>
            <div className={styles.barBox()}>
              <Bars
                values={INSTALLS}
                max={INSTALL_CEILING}
                label="weekly installs, portfolio-board"
              />
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
              <Bars values={RELEASES} label="releases a week, with a floor" />
            </div>
          </Surface>
          <Surface tone="card">
            <Row>
              <Label>releases</Label>
              <Meta>no floor</Meta>
            </Row>
            <div className={styles.barBox()}>
              <Bars values={RELEASES} minHeight={0} label="releases a week, with no floor" />
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
