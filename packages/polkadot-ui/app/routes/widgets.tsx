import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tv } from "tailwind-variants";

import {
  ActivityFeed,
  Aurora,
  Avatar,
  avatarVariants,
  Badge,
  badgeVariants,
  Binding,
  Breakdown,
  Button,
  CommitRow,
  ContactCard,
  Display,
  Keycap,
  Kind,
  Label,
  LayoutPreview,
  ListItem,
  listItemVariants,
  Meta,
  MetricTile,
  NumberTicker,
  type NumberTickerProps,
  PendingCard,
  Prose,
  Readout,
  Receipt,
  receiptVariants,
  Row,
  Stat,
  StatusDot,
  statusDotVariants,
  statVariants,
  Surface,
  SwipeDeck,
  Terminal,
  terminalVariants,
} from "polkadot-ui";

import { Api } from "../api.tsx";
import { Props } from "../props.tsx";
import {
  BINDINGS,
  BUILDING,
  INBOX,
  LANGUAGES,
  LATEST_COMMITS,
  RUNS,
  SPLIT_PANES,
} from "../fixtures.ts";

const widgets = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
    pairs: "grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3",
    paper: "max-w-[300px]",
    marks: "flex flex-wrap items-center gap-4",
    stack: "flex flex-col gap-2",
    tall: "min-h-[300px]",
    aurora: "min-h-[190px]",
    recipe: "min-h-[210px]",
    bay: "flex justify-center rounded-b-pk-tray bg-pk-tray px-4 pt-0.5 pb-4 shadow-pk-tray",
    monogram:
      "flex size-full items-center justify-center rounded-[5px] bg-pk-surface-inner font-pk-mono text-[10px] leading-none text-pk-ink-soft",
  },
});

export const Route = createFileRoute("/widgets")({
  component: Widgets,
});

function Widgets() {
  const styles = widgets();
  const [settled, setSettled] = useState<string[]>([]);
  const [installs, setInstalls] = useState(9_562);

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Display>widgets</Display>
        <Prose className={styles.lede()}>
          The composed pieces: a card that carries a whole idea, and the marks that go inside one.
          Each is built from the same slots as the primitives, with no CSS of its own.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>marks</Kind>
          <Meta>the small parts a card is assembled from</Meta>
        </Row>
        <div className={styles.marks()}>
          <Avatar name="Tyler Mitchell" />
          <Avatar size="lg" name="Tyler Mitchell" />
          <StatusDot>open to one project</StatusDot>
          <Badge tone="outline">wasm</Badge>
          <Badge look="label" tone="outline">
            public
          </Badge>
          <Keycap>⌘</Keycap>
          <Keycap>K</Keycap>
          <Stat value="1,243" label="stars" />
          <Readout render={<NumberTicker value={installs} locale />} />
          <Button tone="ghost" size="sm" onClick={() => setInstalls((n) => n + 819)}>
            roll
          </Button>
        </div>
        <Props<NumberTickerProps>
          name="number ticker"
          rows={[
            { name: "value", note: "the number to roll to" },
            { name: "locale", fallback: "false", note: "thousands separators" },
            {
              name: "pad",
              fallback: "0",
              note: "least digits to keep, so a falling value holds width",
            },
            { name: "duration", fallback: "600", note: "ms for one digit" },
            { name: "stagger", fallback: "40", note: "ms between places, units first" },
          ]}
        />
        <Api name="avatar" of={avatarVariants} />
        <Api name="badge" of={badgeVariants} />
        <Api name="stat" of={statVariants} />
        <Api name="status dot" of={statusDotVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>rows</Kind>
          <Meta>a list row, a binding, a commit</Meta>
        </Row>
        <Surface tone="card">
          {BUILDING.map(([name, span]) => (
            <ListItem key={name} trail={span}>
              {name}
            </ListItem>
          ))}
        </Surface>
        <Surface tone="card">
          <div className={styles.stack()}>
            {BINDINGS.map(([keys, action]) => (
              <Binding key={action} keys={keys} action={action} />
            ))}
          </div>
        </Surface>
        <Surface tone="card">
          {LATEST_COMMITS.map(([sha, subject, age]) => (
            <CommitRow key={sha} sha={sha} subject={subject} age={age} />
          ))}
        </Surface>
        <Api name="list item" of={listItemVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>readouts in a card</Kind>
          <Meta>a language split, three figures, a terminal</Meta>
        </Row>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Breakdown parts={LANGUAGES} />
          </Surface>
          <MetricTile label="queries served">2.1M in-browser</MetricTile>
          <MetricTile label="schema">typed · versioned</MetricTile>
        </div>
        <Surface tone="card">
          <Terminal>
            <Terminal.Command>pnpm exec vp check</Terminal.Command>
            <Terminal.Command running>pnpm exec vp run -r test</Terminal.Command>
            <Terminal.Output>412 tests passed · 0 lint · 8.4s</Terminal.Output>
            <Terminal.Output>compositor: 6 passes registered</Terminal.Output>
          </Terminal>
        </Surface>
        <Api name="terminal command" of={terminalVariants} />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>cards</Kind>
          <Meta>each one carries a whole idea</Meta>
        </Row>
        <div className={styles.pairs()}>
          <Aurora
            className={styles.aurora()}
            label="light"
            headline="Software that behaves like a place"
          />
          <PendingCard
            title="p%T!+?_H#$1Q +ONP"
            body="a T!+?_H $1Q=+ONP $SYM RF=/F 4BC5 E^ R CG8## 4F1TSK P3?_3 D?2 HLK?"
          />
          <ContactCard
            label="say hello"
            address="tyler@hyphened.dev"
            note="usually replies the same day"
          />
          <Surface tone="card" padding="snug" className={styles.recipe()}>
            <Row>
              <Label>layout recipes</Label>
            </Row>
            <LayoutPreview panes={SPLIT_PANES} label="split, three panes" />
            <Meta>split · 3 panes</Meta>
          </Surface>
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>cards that hold a queue</Kind>
          <Meta>a deck you sort, a feed of runs</Meta>
        </Row>
        <div className={styles.pairs()}>
          <Surface tone="sunken" padding="snug" className={styles.tall()}>
            <Row align="baseline">
              <Label>inbox</Label>
              <Meta>{`${INBOX.length - settled.length} left`}</Meta>
            </Row>
            <SwipeDeck items={INBOX} onSettle={(item) => setSettled((s) => [...s, item.id])} />
            <Meta>← skip · pin → · drag or swipe</Meta>
          </Surface>
          <ActivityFeed entries={RUNS} />
        </div>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>print</Kind>
          <Meta>paper is its own ground, with its own ink</Meta>
        </Row>
        <Surface tone="card" className={styles.paper()}>
          <Row>
            <Label>résumé</Label>
            <Meta>a4 · 148 kB</Meta>
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
        <Api name="receipt line" of={receiptVariants} />
      </section>
    </div>
  );
}
