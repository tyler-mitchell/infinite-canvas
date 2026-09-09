import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tv } from "tailwind-variants";

import { Button } from "#/components/button.tsx";
import { Separator } from "#/components/separator.tsx";
import { ToggleGroup } from "#/components/toggle-group.tsx";
import { Widget } from "#/components/widget.tsx";

const showcase = tv({
  slots: {
    page: "min-h-dvh bg-pk-ground px-8 py-10 font-pk-sans text-pk-ink",
    heading: "mb-1 font-pk-sans text-[19px] font-semibold tracking-[-0.03em] text-pk-ink-bright",
    caption: "mb-10 font-pk-mono text-[11px] text-pk-ink-faint",
    section: "mb-10",
    sectionLabel:
      "mb-4 font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] text-pk-ink-dim",
    row: "flex flex-wrap items-center gap-3",
    /* Widgets are sized by their container here; the packer is not wired into this page. */
    grid: "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3",
    cell: "h-[180px]",
  },
});

const CATEGORIES = ["stack", "work", "words", "life"] as const;

export const Route = createFileRoute("/")({
  component: Showcase,
});

function Showcase() {
  const styles = showcase();
  const [categories, setCategories] = useState<string[]>([]);

  return (
    <div className={styles.page()}>
      <h1 className={styles.heading()}>polkadot-ui</h1>
      <p className={styles.caption()}>base ui primitives · tailwind-variants slots · widget kit</p>

      <section className={styles.section()}>
        <p className={styles.sectionLabel()}>button</p>
        <div className={styles.row()}>
          <Button tone="chip">everything</Button>
          <Button tone="quiet">clone</Button>
          <Button tone="accent">print</Button>
          <Button tone="bare" mono>
            flatline
          </Button>
          <Button tone="quiet" size="xs" mono>
            3m
          </Button>
          <Button tone="quiet" disabled>
            disabled
          </Button>
        </div>
      </section>

      <section className={styles.section()}>
        <p className={styles.sectionLabel()}>toggle group · multiple</p>
        <ToggleGroup multiple value={categories} onValueChange={setCategories}>
          {CATEGORIES.map((category) => (
            <ToggleGroup.Item key={category} value={category}>
              {category}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </section>

      <section className={styles.section()}>
        <p className={styles.sectionLabel()}>widget · tones</p>
        <div className={styles.grid()}>
          <Widget className={styles.cell()} tone="card">
            <Widget.Header>
              <Widget.Label>frame budget</Widget.Label>
              <Widget.Meta>8.2 ms</Widget.Meta>
            </Widget.Header>
            <Widget.Body>
              <Widget.Title>card</Widget.Title>
              <Widget.Subtitle>
                The default surface: hairline, flat fill, soft lift.
              </Widget.Subtitle>
            </Widget.Body>
            <Widget.Footer>
              <Widget.Meta>v0.2.0</Widget.Meta>
              <Button tone="bare" mono size="xs">
                clone
              </Button>
            </Widget.Footer>
          </Widget>

          <Widget className={styles.cell()} tone="rim" padding="roomy">
            <Widget.Header>
              <Widget.Label>hover me</Widget.Label>
              <Widget.Badge>rim</Widget.Badge>
            </Widget.Header>
            <Widget.Body>
              <Widget.Title>rim</Widget.Title>
              <Widget.Subtitle>A conic specular edge that sweeps on hover.</Widget.Subtitle>
            </Widget.Body>
          </Widget>

          <Widget className={styles.cell()} tone="sunken" padding="snug">
            <Widget.Header>
              <Widget.Label>inbox</Widget.Label>
              <Widget.Meta>4 left</Widget.Meta>
            </Widget.Header>
            <Separator />
            <Widget.Body>
              <Widget.Title>sunken</Widget.Title>
              <Widget.Subtitle>A container for things that sit inside it.</Widget.Subtitle>
            </Widget.Body>
          </Widget>

          <Widget className={styles.cell()} tone="pending">
            <Widget.Header>
              <Widget.Label>presentation mode</Widget.Label>
              <Widget.Badge>soon</Widget.Badge>
            </Widget.Header>
            <Widget.Body>
              <Widget.Subtitle>
                A dashed edge says unbuilt. It should not read as a card.
              </Widget.Subtitle>
            </Widget.Body>
          </Widget>
        </div>
      </section>

      <section className={styles.section()}>
        <p className={styles.sectionLabel()}>widget.title · render prop retargets the element</p>
        {/* `render` comes from Base UI's useRender, so a part can become any element. */}
        <Widget tone="bare" padding="none">
          <Widget.Title render={<h2 />}>this title is an h2</Widget.Title>
        </Widget>
      </section>
    </div>
  );
}
