import { createFileRoute } from "@tanstack/react-router";
import { tv } from "tailwind-variants";

import { Button } from "#/components/button.tsx";
import { Dialog } from "#/components/dialog.tsx";
import { Menu } from "#/components/menu.tsx";
import { Popover } from "#/components/popover.tsx";
import { Row } from "#/components/row.tsx";
import { Kind, Meta, Prose, Title } from "#/components/text.tsx";
import { Tooltip } from "#/components/tooltip.tsx";

const overlays = tv({
  slots: {
    page: "flex max-w-[880px] flex-col gap-9",
    head: "flex flex-col gap-2",
    lede: "max-w-[560px]",
    section: "flex flex-col gap-4",
    inline: "flex flex-wrap items-center gap-3",
  },
});

export const Route = createFileRoute("/overlays")({
  component: Overlays,
});

function Overlays() {
  const styles = overlays();

  return (
    <div className={styles.page()}>
      <div className={styles.head()}>
        <Title>overlays</Title>
        <Prose className={styles.lede()}>
          Each of these collapses Base UI's Portal, Positioner and Popup into one Content part. The
          three are always arranged the same way in this kit, and separating them only moves the
          arrangement into every consumer.
        </Prose>
      </div>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>tooltip</Kind>
          <Meta>one provider · one open delay</Meta>
        </Row>
        <Tooltip.Provider>
          <div className={styles.inline()}>
            <Tooltip>
              <Tooltip.Trigger render={<Button tone="quiet" />}>queries</Tooltip.Trigger>
              <Tooltip.Content>2.1M served</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger render={<Button tone="quiet" />}>region</Tooltip.Trigger>
              <Tooltip.Content>iad · 42 ms</Tooltip.Content>
            </Tooltip>
          </div>
        </Tooltip.Provider>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>popover</Kind>
          <Meta>title and description, anchored to the trigger</Meta>
        </Row>
        <Popover>
          <Popover.Trigger render={<Button tone="quiet" />}>details</Popover.Trigger>
          <Popover.Content>
            <Popover.Title>surrealdb-wasm</Popover.Title>
            <Popover.Description>
              An embedded graph store compiled to WebAssembly, with a live inspector.
            </Popover.Description>
          </Popover.Content>
        </Popover>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>dialog</Kind>
          <Meta>modal · the footer is a part, so actions align</Meta>
        </Row>
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
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>menu</Kind>
          <Meta>groups · labels · shortcuts</Meta>
        </Row>
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
      </section>
    </div>
  );
}
