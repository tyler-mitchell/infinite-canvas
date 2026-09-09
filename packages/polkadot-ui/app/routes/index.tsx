import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tv } from "tailwind-variants";

import { Button } from "#/components/button.tsx";
import { Collapsible } from "#/components/collapsible.tsx";
import { Separator } from "#/components/separator.tsx";
import { ToggleGroup } from "#/components/toggle-group.tsx";
import { Tooltip } from "#/components/tooltip.tsx";

const showcase = tv({
  slots: {
    page: "min-h-dvh bg-pk-ground px-8 py-10 font-pk-sans text-pk-ink",
    heading: "mb-1 font-pk-sans text-[19px] font-semibold tracking-[-0.03em] text-pk-ink-bright",
    caption: "mb-10 font-pk-mono text-[11px] text-pk-ink-faint",
    section: "mb-10",
    label:
      "mb-4 font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] text-pk-ink-dim",
    row: "flex flex-wrap items-center gap-3",
    panelBody: "pt-3 font-pk-sans text-[13px] leading-[1.5] text-pk-ink-soft",
    meta: "font-pk-mono text-[11px] text-pk-ink-faint",
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
      <p className={styles.caption()}>base ui primitives · tailwind-variants slots</p>

      <section className={styles.section()}>
        <p className={styles.label()}>button</p>
        <div className={styles.row()}>
          <Button tone="chip">everything</Button>
          <Button tone="quiet">clone</Button>
          <Button tone="accent">print</Button>
          <Button tone="bare" mono>
            flatline
          </Button>
          <Button tone="quiet" disabled>
            disabled
          </Button>
        </div>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>toggle group</p>
        <ToggleGroup multiple value={categories} onValueChange={setCategories}>
          {CATEGORIES.map((category) => (
            <ToggleGroup.Item key={category} value={category}>
              {category}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>separator</p>
        <div className={styles.row()}>
          <span className={styles.meta()}>edge</span>
          <Separator orientation="vertical" />
          <span className={styles.meta()}>iad</span>
        </div>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>collapsible</p>
        <Collapsible defaultOpen>
          <Collapsible.Trigger>readme.md</Collapsible.Trigger>
          <Collapsible.Panel>
            <p className={styles.panelBody()}>
              Base UI measures the panel and publishes the height as a CSS variable, so this is one
              compositor-owned transition.
            </p>
          </Collapsible.Panel>
        </Collapsible>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>tooltip</p>
        <Tooltip.Provider>
          <Tooltip>
            <Tooltip.Trigger render={<Button tone="quiet" />}>hover me</Tooltip.Trigger>
            <Tooltip.Content>2.1M queries served</Tooltip.Content>
          </Tooltip>
        </Tooltip.Provider>
      </section>
    </div>
  );
}
