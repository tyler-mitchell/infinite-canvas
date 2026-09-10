import { createFileRoute } from "@tanstack/react-router";
import {
  Button,
  Dialog,
  type DialogProps,
  Display,
  Kind,
  Menu,
  type MenuContentProps,
  type MenuItemProps,
  type MenuProps,
  Meta,
  Popover,
  type PopoverContentProps,
  type PopoverProps,
  Prose,
  Row,
  Tooltip,
  type TooltipContentProps,
  type TooltipProps,
  type TooltipProviderProps,
  tv,
} from "polkadot-ui";

import { Props } from "../props.tsx";

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
        <Display>overlays</Display>
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
              <Tooltip.Trigger aria-label="queries, 2.1M served" render={<Button tone="soft" />}>
                queries
              </Tooltip.Trigger>
              <Tooltip.Content>2.1M served</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger aria-label="region, edge, 42 ms" render={<Button tone="soft" />}>
                region
              </Tooltip.Trigger>
              <Tooltip.Content>edge · 42 ms</Tooltip.Content>
            </Tooltip>
          </div>
        </Tooltip.Provider>
        <Props<TooltipProviderProps>
          name="tooltip provider"
          rows={[
            { name: "delay", note: "milliseconds a pointer must rest before the first one opens" },
            { name: "closeDelay", note: "milliseconds before it closes again" },
            {
              name: "timeout",
              fallback: "400",
              note: "how long the group stays warm, so a second tooltip opens at once",
            },
          ]}
        />
        <Props<TooltipProps>
          name="tooltip"
          rows={[
            { name: "disabled", fallback: "false", note: "the trigger stops opening one" },
            {
              name: "trackCursorAxis",
              values: ["none", "x", "y", "both"],
              fallback: "none",
              note: "lets it follow the pointer along an axis",
            },
            {
              name: "disableHoverablePopup",
              fallback: "false",
              note: "closes it when the pointer moves onto the tooltip itself",
            },
          ]}
        />
        <Props<TooltipContentProps>
          name="tooltip content"
          rows={[
            { name: "side", fallback: "top", values: ["bottom", "right", "left"] },
            { name: "align", fallback: "center", values: ["start", "end"] },
            { name: "sideOffset", fallback: "6", note: "pixels from the trigger" },
            { name: "alignOffset", fallback: "0", note: "pixels along the trigger" },
          ]}
        />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>popover</Kind>
          <Meta>title and description, anchored to the trigger</Meta>
        </Row>
        <div className={styles.inline()}>
          <Popover>
            <Popover.Trigger render={<Button tone="soft" />}>details</Popover.Trigger>
            <Popover.Content>
              <Popover.Title>surrealdb-wasm</Popover.Title>
              <Popover.Description>
                Below the trigger and centred on it, the default.
              </Popover.Description>
            </Popover.Content>
          </Popover>

          <Popover>
            <Popover.Trigger render={<Button tone="soft" />}>beside it</Popover.Trigger>
            <Popover.Content side="right" align="start" sideOffset={10}>
              <Popover.Title>side · align</Popover.Title>
              <Popover.Description>
                To the right, with its top edge on the trigger&rsquo;s.
              </Popover.Description>
            </Popover.Content>
          </Popover>
        </div>
        <Props<PopoverContentProps>
          name="popover content"
          rows={[
            { name: "side", fallback: "bottom", values: ["top", "right", "left"] },
            { name: "align", fallback: "center", values: ["start", "end"] },
            { name: "sideOffset", fallback: "8", note: "pixels from the trigger" },
            { name: "alignOffset", fallback: "0", note: "pixels along the trigger" },
          ]}
        />
        <Props<PopoverProps>
          name="popover"
          rows={[
            { name: "defaultOpen", fallback: "false", note: "open on first render" },
            { name: "open", note: "drive it from outside, with onOpenChange" },
            { name: "onOpenChange", note: "called with the next open state" },
            {
              name: "modal",
              values: ["true", "trap-focus"],
              fallback: "false",
              note: "true locks the page behind it; trap-focus only holds focus",
            },
          ]}
        />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>popover · parts</Kind>
          <Meta>title · description · close</Meta>
        </Row>
        <Popover>
          <Popover.Trigger render={<Button tone="soft" />}>parts</Popover.Trigger>
          <Popover.Content>
            <Popover.Title>surrealdb-wasm</Popover.Title>
            <Popover.Description>
              An embedded graph store compiled to WebAssembly, with a live inspector.
            </Popover.Description>
            <Row rule="above">
              <Meta>v2.1.0</Meta>
              <Popover.Close render={<Button tone="ghost" size="sm" />}>close</Popover.Close>
            </Row>
          </Popover.Content>
        </Popover>
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>dialog</Kind>
          <Meta>modal · the footer is a part, so actions align</Meta>
        </Row>
        <Dialog>
          <Dialog.Trigger render={<Button tone="soft" />}>remove canvas</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Remove this canvas?</Dialog.Title>
            <Dialog.Description>
              Six windows and their layout go with it. Notes stay in the project.
            </Dialog.Description>
            <Dialog.Footer>
              <Dialog.Close render={<Button tone="ghost" />}>cancel</Dialog.Close>
              <Dialog.Close render={<Button tone="solid" />}>remove</Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
        <Props<DialogProps>
          name="dialog"
          rows={[
            { name: "defaultOpen", fallback: "false", note: "open on first render" },
            { name: "open", note: "drive it from outside, with onOpenChange" },
            { name: "onOpenChange", note: "called with the next open state" },
            {
              name: "modal",
              values: ["trap-focus"],
              fallback: "true",
              note: "true makes the page behind it inert; trap-focus only holds focus",
            },
            {
              name: "disablePointerDismissal",
              fallback: "false",
              note: "a click outside no longer closes it, for a choice that must be made",
            },
          ]}
        />
      </section>

      <section className={styles.section()}>
        <Row rule="below">
          <Kind>menu</Kind>
          <Meta>groups · labels · shortcuts</Meta>
        </Row>
        <Menu>
          <Menu.Trigger render={<Button tone="soft" />}>arrange</Menu.Trigger>
          <Menu.Content>
            <Menu.Group>
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
        <Props<MenuProps>
          name="menu"
          rows={[
            { name: "modal", fallback: "true", note: "whether the page behind it goes inert" },
            {
              name: "loopFocus",
              fallback: "true",
              note: "whether the highlight wraps from the last item to the first",
            },
            {
              name: "highlightItemOnHover",
              fallback: "true",
              note: "whether the pointer moves the highlight as well as the arrow keys",
            },
            { name: "disabled", fallback: "false", note: "the trigger stops opening it" },
          ]}
        />
        <Props<MenuContentProps>
          name="menu content"
          rows={[
            { name: "side", fallback: "bottom", values: ["top", "right", "left"] },
            { name: "align", fallback: "start", values: ["center", "end"] },
            { name: "sideOffset", fallback: "6", note: "pixels from the trigger" },
            { name: "alignOffset", fallback: "0", note: "pixels along the trigger" },
          ]}
        />
        <Props<MenuItemProps>
          name="menu item"
          rows={[
            {
              name: "closeOnClick",
              fallback: "true",
              note: "false keeps the menu open, for an item that toggles something",
            },
            { name: "disabled", fallback: "false", note: "skipped by the arrow keys" },
            { name: "label", note: "what it is called when the item's own text is not plain" },
          ]}
        />
      </section>
    </div>
  );
}
