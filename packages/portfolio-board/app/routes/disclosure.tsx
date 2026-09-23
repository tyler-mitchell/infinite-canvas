import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  type AccordionPanelProps,
  type AccordionProps,
  Collapsible,
  type CollapsibleProps,
  Display,
  Kind,
  Meta,
  Prose,
  Row,
  Surface,
  type TabPanelProps,
  Tabs,
  type TabsProps,
  tv,
} from "portfolio-board";

import { COMMIT_WEEKS } from "../fixtures.ts";
import { Props } from "../props.tsx";
import { WRITING } from "../fixtures.ts";

const disclosure = tv({
  slots: {
    page: "flex max-w-pk-page flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    measure: "max-w-[540px]",
    tabs: "max-w-[340px]",
  },
});

/* Read from the series the tab describes, so the figure cannot drift away from it. */
const COMMIT_TOTAL = COMMIT_WEEKS.reduce((sum, week) => sum + week, 0);

export const Route = createFileRoute("/disclosure")({
  component: Disclosure,
});

function Disclosure() {
  const styles = disclosure();

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Display>disclosure</Display>
        <Prose className={styles.lede()}>
          Base UI measures each panel and publishes its height as a CSS variable, so opening one is
          a single compositor-owned transition rather than a per-frame measurement.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>accordion</Kind>
          <Meta>one open at a time · find a closed blurb and it opens</Meta>
        </Row>
        {/* Base UI gives the root and every panel `role="region"`, which is a landmark, and leaves
            the names to the consumer. Four unnamed ones read as four "region" entries in the list a
            reader navigates by, so each says what it holds. */}
        <Accordion aria-label="writing" className={styles.measure()}>
          {WRITING.map(([title, blurb, date]) => (
            <Accordion.Item key={title}>
              {/* Second-level: these items sit straight under the page's own heading. */}
              <Accordion.Header render={<h2 />}>
                <Accordion.Trigger>
                  <Accordion.Title>{title}</Accordion.Title>
                  <Accordion.Meta>{date}</Accordion.Meta>
                </Accordion.Trigger>
              </Accordion.Header>
              {/* Find-in-page reaches a closed blurb and opens the item that holds it. */}
              <Accordion.Panel hiddenUntilFound aria-label={title}>
                {blurb}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
        <Props<AccordionProps>
          name="accordion"
          rows={[
            { name: "multiple", fallback: "false", note: "lets more than one item stand open" },
            { name: "defaultValue", note: "the items open to begin with, by their item value" },
            { name: "disabled", fallback: "false", note: "closes the whole group to interaction" },
            {
              name: "loopFocus",
              fallback: "true",
              note: "whether arrow keys wrap from the last trigger back to the first",
            },
          ]}
        />
        <Props<AccordionPanelProps>
          name="accordion panel"
          rows={[
            {
              name: "hiddenUntilFound",
              fallback: "false",
              note: "keeps the closed panel findable by the browser's own find-in-page, which then opens it",
            },
            {
              name: "keepMounted",
              fallback: "false",
              note: "leaves the panel in the DOM while closed",
            },
          ]}
        />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>collapsible</Kind>
          <Meta>one panel, no group</Meta>
        </Row>
        <Surface tone="card" className={styles.measure()}>
          <Collapsible defaultOpen>
            <Collapsible.Trigger>readme.md</Collapsible.Trigger>
            <Collapsible.Panel>
              <Prose>
                The panel animates its own height from the variable Base UI sets, which is why it
                can open to content it has never rendered at that width before.
              </Prose>
            </Collapsible.Panel>
          </Collapsible>
        </Surface>
        <Props<CollapsibleProps>
          name="collapsible"
          rows={[
            { name: "defaultOpen", fallback: "false", note: "open on first render" },
            { name: "open", note: "drive it from outside, with onOpenChange" },
            { name: "onOpenChange", note: "called with the next open state" },
            { name: "disabled", fallback: "false", note: "the trigger stops responding" },
          ]}
        />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>tabs</Kind>
          <Meta>an underline that travels between tabs</Meta>
        </Row>
        <Tabs defaultValue="commits" className={styles.measure()}>
          {/* A tablist announces itself, and this page draws two of them. */}
          <Tabs.List aria-label="repository">
            <Tabs.Tab value="commits">commits</Tabs.Tab>
            <Tabs.Tab value="issues">issues</Tabs.Tab>
            <Tabs.Tab value="readme">readme</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="commits">
            <Meta>{`${COMMIT_TOTAL} across ${COMMIT_WEEKS.length} weeks`}</Meta>
          </Tabs.Panel>
          <Tabs.Panel value="issues">
            <Meta>12 open · 4 labelled snap</Meta>
          </Tabs.Panel>
          <Tabs.Panel value="readme">
            <Meta>4.9 kB · MIT</Meta>
          </Tabs.Panel>
        </Tabs>

        <Row rule="below">
          <Kind>tabs · vertical</Kind>
          <Meta>the same indicator, turned to a rail</Meta>
        </Row>
        <Tabs defaultValue="commits" orientation="vertical" className={styles.tabs()}>
          <Tabs.List aria-label="repository, vertical rail">
            <Tabs.Tab value="commits">commits</Tabs.Tab>
            <Tabs.Tab value="issues">issues</Tabs.Tab>
            <Tabs.Tab value="readme">readme</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="commits">
            <Meta>{`${COMMIT_TOTAL} across ${COMMIT_WEEKS.length} weeks`}</Meta>
          </Tabs.Panel>
          <Tabs.Panel value="issues">
            <Meta>12 open · 4 labelled snap</Meta>
          </Tabs.Panel>
          <Tabs.Panel value="readme">
            <Meta>4.9 kB · MIT</Meta>
          </Tabs.Panel>
        </Tabs>
        <Props<TabsProps>
          name="tabs"
          rows={[
            { name: "defaultValue", note: "the tab selected to begin with" },
            { name: "value", note: "drive the selection from outside, with onValueChange" },
            {
              name: "orientation",
              values: ["vertical"],
              fallback: "horizontal",
              note: "turns the indicator into a rail and moves it with the up and down keys",
            },
          ]}
        />
        <Props<TabPanelProps>
          name="tab panel"
          rows={[
            { name: "value", note: "the tab this panel belongs to" },
            {
              name: "keepMounted",
              fallback: "false",
              note: "leaves every panel in the DOM, so an unselected one keeps its scroll and its state",
            },
          ]}
        />
      </section>
    </div>
  );
}
