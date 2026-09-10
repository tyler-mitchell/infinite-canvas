import { createFileRoute } from "@tanstack/react-router";
import {
  Display,
  Kind,
  Label,
  Meta,
  Prose,
  Row,
  Separator,
  Surface,
  textVariants,
  Title,
  tv,
} from "polkadot-ui";

import { Api } from "../api.tsx";

const foundations = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    swatches: "grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2",
    swatch: "flex flex-col gap-2",
    chip: "h-12 rounded-pk-chip border border-pk-line",
    caption: "flex flex-col gap-px",
    ramp: "flex gap-1",
    rampStep: "h-8 flex-1 rounded-[3px]",
    radii: "flex flex-wrap items-end gap-3",
    radius: "flex flex-col items-center gap-2",
    radiusBox: "size-16 border border-pk-line bg-pk-surface-inner",
    lines: "flex flex-col gap-3",
    lineRow: "flex flex-wrap items-center gap-x-3 gap-y-1",
    lineName: "w-[84px] flex-none",
    lineRule: "h-px w-[150px] flex-none",
    curve: "h-7 w-[56px] flex-none overflow-visible",
    curveTrace: "fill-none stroke-pk-accent [stroke-linecap:round] [stroke-width:1.5]",
    curveFloor: "stroke-pk-line-strong [stroke-width:1]",
    spacer: "flex-1",
    scale: "flex flex-col gap-4",
    scaleRow: "flex flex-col gap-1",
  },
});

const GROUNDS = [
  ["--pk-ground", "ground", "the board itself"],
  ["--pk-surface", "surface", "a card on it"],
  ["--pk-surface-sunken", "surface-sunken", "a well"],
  ["--pk-surface-deep", "surface-deep", "behind the board"],
  ["--pk-surface-inner", "surface-inner", "inside a card"],
  ["--pk-recess", "recess", "a cut opening"],
] as const;

const INKS = [
  ["--pk-ink-bright", "ink-bright", "19.18"],
  ["--pk-ink", "ink", "16.38"],
  ["--pk-ink-muted", "ink-muted", "12.01"],
  ["--pk-ink-soft", "ink-soft", "7.26"],
  ["--pk-ink-dim", "ink-dim", "5.66"],
  ["--pk-ink-faint", "ink-faint", "4.95"],
] as const;

const PAPER = [
  ["--pk-paper-ink", "paper-ink", "13.48 → 12.03"],
  ["--pk-paper-label", "paper-label", "5.76 → 5.14"],
  ["--pk-paper-rule", "paper-rule", "1.73 → 1.54"],
] as const;

const LINES = [
  ["--pk-line", "line", "1.19:1 · every card edge"],
  ["--pk-line-hover", "line-hover", "1.54:1 · the edge under a pointer"],
  ["--pk-line-strong", "line-strong", "1.92:1 · a raised rail"],
  ["--pk-line-inner", "line-inner", "1.08:1 · a rule inside a card"],
] as const;

const LEVELS = [
  "--pk-level-0",
  "--pk-level-1",
  "--pk-level-2",
  "--pk-level-3",
  "--pk-level-4",
] as const;

const RADII = [
  ["--pk-radius-widget", "widget", "20"],
  ["--pk-radius-card", "card", "16"],
  ["--pk-radius-inner", "inner", "14"],
  ["--pk-radius-tray", "tray", "12"],
  ["--pk-radius-chip", "chip", "7"],
] as const;

const EASINGS = [
  ["--pk-ease-swift", "swift", "state · 160ms", "cubic-bezier(0.32, 0.72, 0, 1)"],
  ["--pk-ease-settle", "settle", "movement", "cubic-bezier(0.23, 1, 0.32, 1)"],
] as const;

/**
 * The curve as a path, in a unit box with y running up. The four numbers are the control points a
 * `cubic-bezier` already carries, so the drawing and the printed value cannot disagree.
 */
const curvePath = (curve: string) => {
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = (curve.match(/[\d.]+/g) ?? []).map(Number);

  return `M0,1 C${x1},${1 - y1} ${x2},${1 - y2} 1,0`;
};

export const Route = createFileRoute("/foundations")({
  component: Foundations,
});

function Foundations() {
  const styles = foundations();

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Display>foundations</Display>
        <Prose className={styles.lede()}>
          Every colour, radius and curve the kit draws with. The dim inks are a floor: darkening any
          ink or lightening any surface breaks the tightest pair first.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>grounds</Kind>
          <Meta>six · every edge is a line</Meta>
        </Row>
        <div className={styles.swatches()}>
          {GROUNDS.map(([token, name, note]) => (
            <div key={token} className={styles.swatch()}>
              <div className={styles.chip()} style={{ background: `var(${token})` }} />
              <div className={styles.caption()}>
                <Label>{name}</Label>
                <Meta>{note}</Meta>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>ink</Kind>
          <Meta>contrast on surface, measured</Meta>
        </Row>
        <div className={styles.swatches()}>
          {INKS.map(([token, name, ratio]) => (
            <div key={token} className={styles.swatch()}>
              <div className={styles.chip()} style={{ background: `var(${token})` }} />
              <div className={styles.caption()}>
                <Label>{name}</Label>
                <Meta>{ratio}:1</Meta>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>paper</Kind>
          <Meta>the one inverted ground · top of its gradient → foot</Meta>
        </Row>
        <div className={styles.swatches()}>
          {PAPER.map(([token, name, ratio]) => (
            <div key={token} className={styles.swatch()}>
              <div className={styles.chip()} style={{ background: `var(${token})` }} />
              <div className={styles.caption()}>
                <Label>{name}</Label>
                <Meta>{ratio}</Meta>
              </div>
            </div>
          ))}
        </div>
        <Prose className={styles.lede()}>
          Paper is a gradient, so every figure here is a range: the foot is the darker end and the
          one that has to clear. The label used to land at 4.54 there, four hundredths above the
          threshold, which is not a margin on a colour that a designer may nudge.
        </Prose>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>hairlines</Kind>
          <Meta>separations, not contrasts</Meta>
        </Row>
        <Surface tone="card">
          <div className={styles.lines()}>
            {LINES.map(([token, name, note]) => (
              <div key={token} className={styles.lineRow()}>
                <Label className={styles.lineName()}>{name}</Label>
                <div className={styles.lineRule()} style={{ background: `var(${token})` }} />
                <Meta>{note}</Meta>
              </div>
            ))}
          </div>
        </Surface>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>activity scale</Kind>
          <Meta>least to most · zero is a mark</Meta>
        </Row>
        <div className={styles.ramp()}>
          {LEVELS.map((token) => (
            <div
              key={token}
              className={styles.rampStep()}
              style={{ background: `var(${token})` }}
            />
          ))}
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>radii</Kind>
          <Meta>larger frames, softer corners</Meta>
        </Row>
        <div className={styles.radii()}>
          {RADII.map(([token, name, px]) => (
            <div key={token} className={styles.radius()}>
              <div className={styles.radiusBox()} style={{ borderRadius: `var(${token})` }} />
              <Label>{name}</Label>
              <Meta>{px}px</Meta>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>easings</Kind>
          <Meta>one for state, one for movement</Meta>
        </Row>
        <Surface tone="card">
          <div className={styles.lines()}>
            {EASINGS.map(([token, name, job, curve]) => (
              <div key={token} className={styles.lineRow()}>
                <Label className={styles.lineName()}>{name}</Label>
                <svg
                  aria-hidden
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  className={styles.curve()}
                >
                  <path
                    d="M0,1 L1,1"
                    className={styles.curveFloor()}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={curvePath(curve)}
                    className={styles.curveTrace()}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <Separator orientation="vertical" />
                <Meta>{job}</Meta>
                <div className={styles.spacer()} />
                <Meta>{curve}</Meta>
              </div>
            ))}
          </div>
        </Surface>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>type</Kind>
          <Meta>roles, not sizes · sans is the interface</Meta>
        </Row>
        <Surface tone="card">
          <div className={styles.scale()}>
            <div className={styles.scaleRow()}>
              <Display render={<span />}>Display · 21px semibold</Display>
              <Meta>the page names itself once</Meta>
            </div>
            <div className={styles.scaleRow()}>
              <Title>Title · 15px medium</Title>
              <Meta>a widget names itself once</Meta>
            </div>
            <div className={styles.scaleRow()}>
              <Label>Label · 11px medium</Label>
              <Meta>names a section: frame budget, inbox</Meta>
            </div>
            <div className={styles.scaleRow()}>
              <Kind>Kind · 10px caps</Kind>
              <Meta>tags what a thing is: gist, issue</Meta>
            </div>
            <div className={styles.scaleRow()}>
              <Prose>
                Prose · 13px. For a sentence that has to be read rather than scanned, which is why
                it is the only role with a measure.
              </Prose>
            </div>
            <div className={styles.scaleRow()}>
              <Meta>Meta · 11px — the line beside a heading, and the default role</Meta>
            </div>
          </div>
        </Surface>
        <Api name="text" of={textVariants} />
      </section>
    </div>
  );
}
