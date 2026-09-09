import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { tv } from "tailwind-variants";

import { Accordion } from "#/components/accordion.tsx";
import { Button } from "#/components/button.tsx";
import { Row } from "#/components/row.tsx";
import { Surface } from "#/components/surface.tsx";
import { Kind, Label, Meta, Prose, Readout, Title } from "#/components/text.tsx";
import { Collapsible } from "#/components/collapsible.tsx";
import { Dialog } from "#/components/dialog.tsx";
import { Menu } from "#/components/menu.tsx";
import { Popover } from "#/components/popover.tsx";
import { ScrollArea } from "#/components/scroll-area.tsx";
import { Separator } from "#/components/separator.tsx";
import { Slider } from "#/components/slider.tsx";
import { Switch } from "#/components/switch.tsx";
import { Tabs } from "#/components/tabs.tsx";
import { Toolbar } from "#/components/toolbar.tsx";
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
    grid: "grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3",
    writing: "max-w-[520px]",
  },
});

const WRITING = [
  [
    "Why the pure core cannot import React",
    "Geometry as pure functions, enforced by a test that fails when the boundary moves.",
    "08.26",
  ],
  [
    "Snapping is a resolver, not a heuristic",
    "Candidates in, one committed rect out. The guides are the resolver's own reasoning made visible.",
    "06.26",
  ],
  [
    "Semantic summaries at far zoom",
    "What a window should say at eight percent scale, when its body is smaller than its own title.",
    "04.26",
  ],
] as const;

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
        <p className={styles.label()}>surface · row · vocabulary</p>
        <div className={styles.grid()}>
          <Surface tone="card">
            <Row>
              <Label>frame budget</Label>
              <Readout>8.2 ms</Readout>
            </Row>
            <Prose>A label names a section. A readout announces, because it changes.</Prose>
          </Surface>

          <Surface tone="card">
            <Row align="start">
              <Kind>gist</Kind>
              <Meta>04</Meta>
            </Row>
            <Title>field-shader.wgsl</Title>
            <Row rule="above">
              <Meta>82 lines · wgsl</Meta>
              <Meta>sent by @jane</Meta>
            </Row>
          </Surface>

          <Surface tone="rim" padding="roomy">
            <Row>
              <Label>hover me</Label>
            </Row>
            <Title>rim</Title>
          </Surface>

          <Surface tone="pending">
            <Row align="start">
              <Kind>soon</Kind>
            </Row>
            <Prose>A dashed edge says unbuilt. It should not read as a card.</Prose>
          </Surface>
        </div>
      </section>

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
        <p className={styles.label()}>accordion</p>
        <Accordion className={styles.writing()}>
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
        <p className={styles.label()}>tabs</p>
        <Tabs defaultValue="commits" className={styles.control()}>
          <Tabs.List>
            <Tabs.Tab value="commits">commits</Tabs.Tab>
            <Tabs.Tab value="issues">issues</Tabs.Tab>
            <Tabs.Tab value="readme">readme</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="commits">
            <p className={styles.meta()}>1,243 across 64 weeks</p>
          </Tabs.Panel>
          <Tabs.Panel value="issues">
            <p className={styles.meta()}>12 open · 4 labelled snap</p>
          </Tabs.Panel>
          <Tabs.Panel value="readme">
            <p className={styles.meta()}>4.9 kB · MIT</p>
          </Tabs.Panel>
        </Tabs>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>toolbar</p>
        <Toolbar>
          <Toolbar.Group>
            <Toolbar.Button render={<Button tone="bare" size="icon" />}>−</Toolbar.Button>
            <Toolbar.Button render={<Button tone="bare" size="sm" mono />}>100%</Toolbar.Button>
            <Toolbar.Button render={<Button tone="bare" size="icon" />}>+</Toolbar.Button>
          </Toolbar.Group>
          <Toolbar.Separator />
          <Toolbar.Group>
            <Toolbar.Button render={<Button tone="bare" size="sm" />}>fit</Toolbar.Button>
            <Toolbar.Button render={<Button tone="bare" size="sm" />}>group</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar>
      </section>

      <section className={styles.section()}>
        <p className={styles.label()}>dialog · popover · menu</p>
        <div className={styles.row()}>
          <Dialog>
            <Dialog.Trigger render={<Button tone="quiet" />}>remove canvas</Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Title>Remove this canvas?</Dialog.Title>
              <Dialog.Description>
                Six windows and their layout go with it. Notes stay in the project.
              </Dialog.Description>
              <Dialog.Footer>
                <Dialog.Close render={<Button tone="bare" />}>cancel</Dialog.Close>
                <Dialog.Close render={<Button tone="accent" />}>remove</Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>

          <Popover>
            <Popover.Trigger render={<Button tone="quiet" />}>details</Popover.Trigger>
            <Popover.Content>
              <Popover.Title>surrealdb-wasm</Popover.Title>
              <Popover.Description>
                An embedded graph store compiled to WebAssembly, with a live inspector.
              </Popover.Description>
            </Popover.Content>
          </Popover>

          <Menu>
            <Menu.Trigger render={<Button tone="quiet" />}>arrange</Menu.Trigger>
            <Menu.Content>
              <Menu.Group>
                {/* GroupLabel reads MenuGroupContext, so it must sit inside Group, not beside it. */}
                <Menu.GroupLabel>layout</Menu.GroupLabel>
                <Menu.Item>
                  split <Menu.Shortcut>⌘1</Menu.Shortcut>
                </Menu.Item>
                <Menu.Item>
                  stack <Menu.Shortcut>⌘2</Menu.Shortcut>
                </Menu.Item>
                <Menu.Item>
                  master <Menu.Shortcut>⌘3</Menu.Shortcut>
                </Menu.Item>
              </Menu.Group>
              <Menu.Separator />
              <Menu.Item disabled>
                tabs <Menu.Shortcut>⌘4</Menu.Shortcut>
              </Menu.Item>
            </Menu.Content>
          </Menu>
        </div>
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
