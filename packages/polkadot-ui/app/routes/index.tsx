import { createFileRoute } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import { Row } from "#/components/row.tsx";
import { Surface } from "#/components/surface.tsx";
import { Kind, Label, Meta, Prose, Readout, Title } from "#/components/text.tsx";

const overview = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    grid: "grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3",
  },
});

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
    kind: "metadata",
    title: "Mono carries the facts",
    body: "Mono metadata appears 49 times across the design's 45 widgets — more than once per widget. It is the default text role, not an option.",
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
