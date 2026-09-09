import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { tv } from "tailwind-variants";

const menu = tv({
  slots: {
    positioner: "z-50",
    popup:
      "z-50 min-w-[168px] origin-(--transform-origin) rounded-pk-inner border border-pk-line bg-pk-surface p-1 text-pk-ink shadow-pk-card outline-none transition-[transform,opacity] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0",
    /*
     * Highlight is Base UI's keyboard-and-pointer cursor, so hover and arrow keys land identically.
     *
     * The tint is alpha on the accent rather than a token of its own: `bg-pk-accent-wash` named a
     * token this theme never defined, so it generated no CSS at all and the highlight was a text
     * colour change on nothing.
     */
    item: "flex cursor-pointer items-center justify-between gap-4 rounded-pk-chip px-2 py-[6px] font-pk-sans text-[12px] leading-none whitespace-nowrap text-pk-ink-muted outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-40 data-highlighted:bg-pk-accent/15 data-highlighted:text-pk-ink-bright",
    groupLabel:
      "px-2 pt-2 pb-1 font-pk-sans text-[10px] leading-none font-medium tracking-[0.06em] text-pk-ink-faint uppercase",
    separator: "my-1 h-px bg-pk-line-inner",
    shortcut: "font-pk-mono text-[10.5px] text-pk-ink-faint",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type MenuProps = MenuPrimitive.Root.Props;

function Menu(props: MenuProps) {
  return <MenuPrimitive.Root {...props} />;
}

export type MenuTriggerProps = MenuPrimitive.Trigger.Props;

function MenuTrigger(props: MenuTriggerProps) {
  return <MenuPrimitive.Trigger data-slot="menu-trigger" {...props} />;
}

export type MenuContentProps = WithClassName<MenuPrimitive.Popup.Props> &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">;

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

/** The keystroke beside an item. Mono, because it is a key name rather than a word. */
function MenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="menu-shortcut" className={menu().shortcut({ className })} {...props} />;
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
