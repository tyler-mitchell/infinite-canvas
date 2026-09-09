import { createFileRoute } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

/* The lab imports the kit by name, so the published entry is what every page here runs on. */
import {
  Avatar,
  Badge,
  Bars,
  Breakdown,
  Button,
  IconTile,
  Kind,
  Label,
  Meta,
  Prose,
  Readout,
  Row,
  Separator,
  Sparkline,
  Stat,
  StatusDot,
  Surface,
  Title,
} from "polkadot-ui";

import { COMMIT_WEEKS, INSTALLS, LANGUAGES } from "../fixtures.ts";

const overview = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
    widgets: "flex flex-wrap items-start gap-3",
    widget: "w-[360px] max-w-full",
    identity: "w-[360px] max-w-full",
    who: "flex flex-col gap-1.5",
    owner: "text-pk-ink-faint",
    chart: "flex h-[58px] flex-col",
    tiles: "flex items-center gap-1.5",
    monogram:
      "flex size-full items-center justify-center rounded-[4px] bg-pk-surface-inner font-pk-mono text-[9px] leading-none text-pk-ink-soft",
  },
});

const BUILT_WITH = [
  ["TS", "TypeScript"],
  ["RE", "React"],
  ["WG", "WebGPU"],
] as const;

/*
 * The rules the kit is built on, each one counted in the design source rather than asserted. They
 * are on the first page because they explain every later decision.
 */
const RULES = [
  {
    kind: "edges",
    title: "A hairline, never a step",
    body: "Surface against surface differs by about 1.05:1 on this ground, which nobody can see. Every edge in the kit is a line.",
  },
  {
    kind: "type",
    title: "Sans is the interface, mono is a value",
    body: "Every size, line height, tracking and weight is a token taken from the design source. Mono is kept for a figure being read, never for a control or a description.",
  },
  {
    kind: "density",
    title: "Drop history, never the target",
    body: "When a readout runs out of width it shows fewer weeks at a size a pointer can hit, rather than shrinking cells to four pixels.",
  },
  {
    kind: "depth",
    title: "Relatedness is depth",
    body: "Bringing related widgets forward and pushing the rest back. Dimming the others instead flattened the board into one grey wash.",
  },
] as const;

export const Route = createFileRoute("/")({
  component: Overview,
});

function Overview() {
  const styles = overview();

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Title>polkadot-ui</Title>
        <Prose className={styles.lede()}>
          Compound components for an infinite canvas, built on Base UI primitives and styled only
          through tailwind-variants slots. Every page here is composed from the kit itself.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>a widget, composed</Kind>
          <Meta>seven parts, no new css</Meta>
        </Row>
        {/* The point of the kit in one object: the pages after this take it back apart. */}
        <div className={styles.widgets()}>
          {/* The rim tone is the design's own treatment for the one card that is a person. */}
          <Surface tone="rim" padding="roomy" className={styles.identity()}>
            <Row align="center">
              <Avatar size="lg" name="Tyler Mitchell" />
              <div className={styles.who()}>
                <Title>Tyler Mitchell</Title>
                <Meta>Spatial interface engineer</Meta>
                <StatusDot>open to one project</StatusDot>
              </div>
            </Row>
          </Surface>

          <Surface tone="card" className={styles.widget()}>
            <Row>
              <Label className={styles.owner()}>hyphened /</Label>
              <Badge look="label" tone="outline">
                public
              </Badge>
            </Row>
            <Title>infinite-canvas</Title>
            <Prose>
              A spatial window manager for the web. Pan, zoom, snap, group, dock and undo — on an
              unbounded plane.
            </Prose>

            <Breakdown parts={LANGUAGES} />

            <Row>
              <Stat value="1,243" label="stars" />
              <Stat value="68" label="forks" />
              <Stat value="12" label="open issues" />
              <Stat value="MIT" label="license" />
            </Row>

            <Row rule="above" align="baseline">
              <Label>commits · 64 weeks</Label>
              <Meta>11 commits · wk 7</Meta>
            </Row>
            <Sparkline values={COMMIT_WEEKS} label="commits per week over 64 weeks" />
          </Surface>

          <Surface tone="card" className={styles.widget()}>
            <Row>
              <Kind>package</Kind>
              <Meta>mit</Meta>
            </Row>
            <Title>surrealdb-wasm</Title>
            <Prose>An embedded graph store compiled to WebAssembly, with a live inspector.</Prose>

            <Row align="baseline">
              <Label>weekly installs</Label>
              <Readout>4,182</Readout>
            </Row>
            <div className={styles.chart()}>
              <Bars values={INSTALLS} label="weekly installs over eight weeks" />
            </div>

            <Row rule="above">
              <div className={styles.tiles()}>
                {BUILT_WITH.map(([mark, name]) => (
                  <IconTile
                    key={name}
                    size="sm"
                    label={name}
                    icon={<span className={styles.monogram()}>{mark}</span>}
                  />
                ))}
              </div>
              <Row align="center">
                <Meta>v2.1.0</Meta>
                <Separator orientation="vertical" />
                <Button tone="ghost" size="sm">
                  clone
                </Button>
              </Row>
            </Row>
          </Surface>
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>house rules</Kind>
          <Meta>counted, not asserted</Meta>
        </Row>
        <div className={styles.grid()}>
          {RULES.map((rule) => (
            <Surface key={rule.kind} tone="card">
              <Row align="start">
                <Kind>{rule.kind}</Kind>
              </Row>
              <Label>{rule.title}</Label>
              <Prose>{rule.body}</Prose>
            </Surface>
          ))}
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>surface tones</Kind>
          <Meta>the frame, with no opinion on contents</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>frame budget</Label>
              <Readout>8.2 ms</Readout>
            </Row>
            <Prose>A label names a section. A readout announces, because it changes.</Prose>
          </Surface>

          <Surface tone="rim" padding="roomy">
            <Row>
              <Label>hover me</Label>
            </Row>
            <Title>rim</Title>
            <Prose>A specular conic edge that sweeps while the pointer is over it.</Prose>
          </Surface>

          <Surface tone="sunken">
            <Row>
              <Label>recessed</Label>
              <Meta>inset</Meta>
            </Row>
            <Prose>A well, for anything that reads as set into the board.</Prose>
          </Surface>

          <Surface tone="pending">
            <Row align="start">
              <Kind>soon</Kind>
            </Row>
            <Prose>A dashed edge says unbuilt. It must not read as a finished card.</Prose>
          </Surface>
        </div>
      </section>
    </div>
  );
}
