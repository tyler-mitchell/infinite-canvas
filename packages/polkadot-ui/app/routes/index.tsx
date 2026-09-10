import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tv } from "tailwind-variants";

import {
  ActivityFeed,
  Aurora,
  Avatar,
  Badge,
  Bars,
  Binding,
  Breakdown,
  Button,
  CommitRow,
  ContactCard,
  Display,
  IconTile,
  Kind,
  Label,
  LayoutPreview,
  ListItem,
  Meta,
  MetricTile,
  NumberTicker,
  PendingCard,
  Prose,
  Readout,
  Receipt,
  Row,
  Separator,
  Sparkline,
  Stat,
  StatusDot,
  Surface,
  SwipeDeck,
  Title,
} from "polkadot-ui";

import {
  BINDINGS,
  BUILDING,
  COMMIT_WEEKS,
  ELSEWHERE,
  INBOX,
  INSTALLS,
  LANGUAGES,
  LATEST_COMMITS,
  RUNS,
  SPLIT_PANES,
} from "../fixtures.ts";

const overview = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
    widgets:
      "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-start gap-3 [grid-auto-flow:row_dense]",
    widget: "col-span-1 min-w-0 sm:col-span-2",
    identity: "col-span-1 min-w-0 sm:col-span-2",
    aurora: "col-span-1 h-[190px] min-w-0 sm:col-span-2",
    small: "col-span-1 min-w-0",
    wide: "col-span-1 min-w-0 sm:col-span-2",
    recipe: "col-span-1 h-[210px] min-w-0",
    deck: "col-span-1 h-[300px] min-w-0 sm:col-span-2",
    hint: "flex-none self-center",
    bindings: "flex flex-col gap-2",
    commits: "flex flex-col gap-[11px]",
    metrics: "grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[6px]",
    repoName: "text-pk-head",
    identityRow: "gap-4 flex-nowrap",
    who: "flex min-w-0 flex-1 flex-col gap-[5px]",
    role: "font-pk-sans text-pk-lede text-pk-ink-soft",
    bay: "flex justify-center rounded-b-pk-tray bg-pk-tray px-4 pt-0.5 pb-4 shadow-pk-tray",
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
  const [pinned, setPinned] = useState<string[]>([]);

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Display>polkadot-ui</Display>
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
        <div className={styles.widgets()}>
          <Surface tone="rim" padding="snug" className={styles.identity()}>
            <Row align="center" className={styles.identityRow()}>
              <Avatar size="lg" name="Tyler Mitchell" />
              <div className={styles.who()}>
                <Display>Tyler Mitchell</Display>
                <span className={styles.role()}>Spatial interface engineer</span>
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

          <Surface tone="card" padding="roomy" className={styles.widget()}>
            <Row>
              <Badge tone="outline">wasm</Badge>
              <Meta>318 ★</Meta>
            </Row>
            <Title className={styles.repoName()}>surrealdb-wasm</Title>
            <Prose>
              An embedded graph store compiled to WebAssembly, with a live inspector for spatial
              documents.
            </Prose>

            <div className={styles.metrics()}>
              <MetricTile label="queries served">2.1M in-browser</MetricTile>
              <MetricTile label="schema">typed · versioned</MetricTile>
              <MetricTile label="size">1.8 MB wasm</MetricTile>
            </div>

            <Row align="baseline">
              <Label>weekly installs</Label>
              <Readout render={<NumberTicker value={4182} locale />} />
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

          <Surface tone="card" className={styles.widget()}>
            <Row>
              <Label>résumé</Label>
              <Button tone="ghost" size="sm">
                new copy
              </Button>
            </Row>
            <div className={styles.bay()}>
              <Receipt>
                <Receipt.Head mark="TM" wordmark="hyphened.dev" />
                <Receipt.Rule />
                <Receipt.Line name="résumé.pdf" amount="0.00" />
                <Receipt.Note>one page · 148 kB · a4</Receipt.Note>
                <Receipt.Rule />
                <Receipt.Line total name="total paid" amount="0.00" />
                <Receipt.Rule />
                <Receipt.Line name="order" amount="RES-2048" />
                <Receipt.Barcode value="RES-2048" />
                <Receipt.Action>↓ download .pdf</Receipt.Action>
                <Receipt.Sign>** thank you **</Receipt.Sign>
              </Receipt>
            </div>
          </Surface>

          <Aurora
            label="light"
            headline="Software that behaves like a place"
            className={styles.aurora()}
          />

          <ActivityFeed entries={RUNS} className={styles.widget()} />

          <Surface tone="card" padding="snug" className={styles.small()}>
            <Row>
              <Label>elsewhere</Label>
            </Row>
            {ELSEWHERE.map(([service, handle, href]) => (
              <ListItem
                key={service}
                look="nav"
                trail={handle}
                render={<a href={href} rel="me noreferrer" target="_blank" />}
              >
                {service}
              </ListItem>
            ))}
          </Surface>

          <Surface tone="card" className={styles.wide()}>
            <Label>latest commits</Label>
            <div className={styles.commits()}>
              {LATEST_COMMITS.map(([sha, subject, age]) => (
                <CommitRow key={sha} sha={sha} subject={subject} age={age} />
              ))}
            </div>
          </Surface>

          <PendingCard
            className={styles.wide()}
            title="p%T!+?_H#$1Q +ONP"
            body="a T!+?_H $1Q=+ONP $SYM RF=/F 4BC5 E^ R CG8## 4F1TSK P3?_3 D?2 HLK? V3ODYY=^ _9 TB# H495"
          />

          <ContactCard
            className={styles.identity()}
            label="say hello"
            address="tyler@hyphened.dev"
            note="usually replies the same day"
          />

          <Surface tone="card" padding="tight" className={styles.wide()}>
            <Row>
              <Label>building</Label>
            </Row>
            {BUILDING.map(([name, span]) => (
              <ListItem key={name} trail={span}>
                {name}
              </ListItem>
            ))}
          </Surface>

          <Surface tone="sunken" padding="snug" className={styles.deck()}>
            <Row align="baseline">
              <Label>inbox</Label>
              <Meta>{`${INBOX.length - pinned.length} left`}</Meta>
            </Row>
            <SwipeDeck items={INBOX} onSettle={(item) => setPinned((seen) => [...seen, item.id])} />
            <Meta className={styles.hint()}>← skip · pin → · drag or swipe</Meta>
          </Surface>

          <Surface tone="card" padding="snug" className={styles.small()}>
            <Row>
              <Label>bindings</Label>
            </Row>
            <div className={styles.bindings()}>
              {BINDINGS.map(([keys, action]) => (
                <Binding key={action} keys={keys} action={action} />
              ))}
            </div>
          </Surface>

          <Surface tone="card" padding="snug" className={styles.recipe()}>
            <Row>
              <Label>layout recipes</Label>
              <Button tone="outline" size="sm">
                arrange
              </Button>
            </Row>
            <LayoutPreview panes={SPLIT_PANES} label="split, three panes" />
            <Meta>split · 3 panes</Meta>
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
