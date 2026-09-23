import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { VariantProps } from "tailwind-variants";

import { MOTION } from "../motion.ts";
import { tv } from "../tv.ts";
import { buttonVariants } from "./button.tsx";

const menu = tv({
  slots: {
    positioner: "z-50",
    popup: `z-50 max-h-(--available-height) max-w-(--available-width) min-w-[168px] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-pk-inner border border-pk-line bg-pk-surface p-1 text-pk-ink shadow-pk-card outline-none [--pk-ring-seat:var(--pk-surface)] ${MOTION.overlay}`,
    item: "flex cursor-pointer items-center justify-between gap-4 rounded-pk-chip px-2 py-1.5 font-pk-sans text-pk-control whitespace-nowrap text-pk-ink-muted outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 data-highlighted:bg-pk-accent/15 data-highlighted:text-pk-ink-bright",
    groupLabel: "px-2 pt-2 pb-1 font-pk-sans text-pk-micro break-words text-pk-ink-faint uppercase",
    separator: "my-1 h-px bg-pk-line-inner",
    shortcut: "font-pk-mono text-pk-mono-sm text-pk-ink-faint",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type MenuProps = MenuPrimitive.Root.Props;

function Menu(props: MenuProps) {
  return <MenuPrimitive.Root {...props} />;
}

export type MenuTriggerProps = WithClassName<MenuPrimitive.Trigger.Props> &
  VariantProps<typeof buttonVariants>;

/**
 * The trigger is the button, which is how Base UI writes one and how the toolbar and the select
 * draw theirs. For a trigger that is not a button, pass `render` with its own `className`.
 */
function MenuTrigger({ tone = "soft", size, className, ...props }: MenuTriggerProps) {
  return (
    <MenuPrimitive.Trigger
      data-slot="menu-trigger"
      className={buttonVariants({ tone, size, className })}
      {...props}
    />
  );
}

export type MenuContentProps = WithClassName<MenuPrimitive.Popup.Props> &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

/**
 * Base UI's Portal, Positioner and Popup collapsed into one part. Keyboard navigation moves a
 * highlight rather than focus, so an item is styled through `data-highlighted`, not `:focus`.
 */
function MenuContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  ...props
}: MenuContentProps) {
  const styles = menu();

  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={styles.positioner()}
      >
        <MenuPrimitive.Popup
          data-slot="menu-content"
          className={styles.popup({ className })}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export type MenuItemProps = WithClassName<MenuPrimitive.Item.Props>;

function MenuItem({ className, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item data-slot="menu-item" className={menu().item({ className })} {...props} />
  );
}

export type MenuGroupProps = MenuPrimitive.Group.Props;

function MenuGroup(props: MenuGroupProps) {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

export type MenuGroupLabelProps = WithClassName<MenuPrimitive.GroupLabel.Props>;

function MenuGroupLabel({ className, ...props }: MenuGroupLabelProps) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="menu-group-label"
      className={menu().groupLabel({ className })}
      {...props}
    />
  );
}

export type MenuSeparatorProps = WithClassName<MenuPrimitive.Separator.Props>;

function MenuSeparator({ className, ...props }: MenuSeparatorProps) {
  return (
    <MenuPrimitive.Separator
      data-slot="menu-separator"
      className={menu().separator({ className })}
      {...props}
    />
  );
}

export type MenuShortcutProps = React.ComponentProps<"span">;

/**
 * The key binding drawn beside an item, for the eye only.
 *
 * A `menuitem` takes its name from its own content, so a visible `⌘1` became part of that name and
 * the four items on the menu page announced as "split ⌘1", "stack ⌘2" and so on — the glyph read
 * out as the character it is rather than as a key. Hidden here, the item is named by its words, and
 * the binding belongs on the item as `aria-keyshortcuts`, which is where this kit states keys
 * everywhere else.
 */
function MenuShortcut({ className, ...props }: MenuShortcutProps) {
  return (
    <span
      data-slot="menu-shortcut"
      aria-hidden
      className={menu().shortcut({ className })}
      {...props}
    />
  );
}

Menu.Trigger = MenuTrigger;
Menu.Content = MenuContent;
Menu.Item = MenuItem;
Menu.Group = MenuGroup;
Menu.GroupLabel = MenuGroupLabel;
Menu.Separator = MenuSeparator;
Menu.Shortcut = MenuShortcut;

export {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
  menu as menuVariants,
};
