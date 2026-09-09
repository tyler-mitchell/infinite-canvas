import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tv } from "tailwind-variants";

import { Button } from "#/components/button.tsx";
import { Collapsible } from "#/components/collapsible.tsx";
import { ScrollArea } from "#/components/scroll-area.tsx";
import { Separator } from "#/components/separator.tsx";
import { Slider } from "#/components/slider.tsx";
import { Switch } from "#/components/switch.tsx";
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
    control: "max-w-[260px]",
    scroller: "h-[92px] max-w-[360px] rounded-pk-card border border-pk-line bg-pk-surface p-3",
    scrollBody: "flex flex-col gap-2",
  },
});

const CATEGORIES = ["stack", "work", "words", "life"] as const;

const COMMITS = [
  "a1f9c2  fix(snap): resolve gap guides before edges",
  "7e04b1  feat(groups): accordion axis labels",
  "c92d55  perf(raster): skip offscreen window bodies",
  "3b7a19  refactor(camera): one conversion boundary",
  "d40c81  fix(hud): keep every surface inside the root",
  "8fe2a0  chore(deps): bump base-ui to 1.5.0",
] as const;

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
        <p className={styles.label()}>switch</p>
        <div className={styles.row()}>
          <Switch defaultChecked />
          <Switch />
          <Switch disabled />
        </div>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>slider</p>
        <div className={styles.control()}>
          <Slider label="intensity" defaultValue={40} />
        </div>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>scroll area</p>
        <ScrollArea className={styles.scroller()}>
          <div className={styles.scrollBody()}>
            {COMMITS.map((commit) => (
              <p key={commit} className={styles.meta()}>
                {commit}
              </p>
            ))}
          </div>
        </ScrollArea>
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
