import { createFileRoute } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import { Accordion } from "#/components/accordion.tsx";
import { Collapsible } from "#/components/collapsible.tsx";
import { Row } from "#/components/row.tsx";
import { Surface } from "#/components/surface.tsx";
import { Tabs } from "#/components/tabs.tsx";
import { Kind, Meta, Prose, Title } from "#/components/text.tsx";

import { WRITING } from "../fixtures.ts";

const disclosure = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    measure: "max-w-[540px]",
    tabs: "max-w-[340px]",
  },
});

export const Route = createFileRoute("/disclosure")({
  component: Disclosure,
});

function Disclosure() {
  const styles = disclosure();

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Title>disclosure</Title>
        <Prose className={styles.lede()}>
          Base UI measures each panel and publishes its height as a CSS variable, so opening one is
          a single compositor-owned transition rather than a per-frame measurement.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>accordion</Kind>
          <Meta>one open at a time · title and date on one line</Meta>
        </Row>
        <Accordion className={styles.measure()}>
          {WRITING.map(([title, blurb, date]) => (
            <Accordion.Item key={title}>
              <Accordion.Trigger>
                <Accordion.Title>{title}</Accordion.Title>
                <Accordion.Meta>{date}</Accordion.Meta>
              </Accordion.Trigger>
              <Accordion.Panel>{blurb}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
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
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>tabs</Kind>
          <Meta>an underline that travels between tabs</Meta>
        </Row>
        <Tabs defaultValue="commits" className={styles.tabs()}>
          <Tabs.List>
            <Tabs.Tab value="commits">commits</Tabs.Tab>
            <Tabs.Tab value="issues">issues</Tabs.Tab>
            <Tabs.Tab value="readme">readme</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="commits">
            <Meta>1,243 across 64 weeks</Meta>
          </Tabs.Panel>
          <Tabs.Panel value="issues">
            <Meta>12 open · 4 labelled snap</Meta>
          </Tabs.Panel>
          <Tabs.Panel value="readme">
            <Meta>4.9 kB · MIT</Meta>
          </Tabs.Panel>
        </Tabs>
      </section>
    </div>
  );
}
