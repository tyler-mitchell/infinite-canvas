import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";
import { inputVariants } from "./input.tsx";
import { menuVariants } from "./menu.tsx";

/*
 * Only what a combobox adds. The field is laid over the input's look and the list over the menu's,
 * the same way the select does it, so all three stay one control drawn three ways.
 */
const combobox = tv({
  slots: {
    positioner: "z-50",
    popup: "max-h-[min(20rem,var(--available-height))] min-w-(--anchor-width) overflow-y-auto",
    item: "data-selected:text-pk-ink-bright",
    indicator: "size-3 flex-none text-pk-accent",
    empty: "px-2 py-1.5 font-pk-sans text-pk-control text-pk-ink-faint",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type ComboboxProps = ComboboxPrimitive.Root.Props<string>;

/**
 * A list narrowed by typing. The field is the form control, so it takes its name from a `Field`
 * around it, the same way the checkbox, the radio group, the input and the select do.
 */
function Combobox(props: ComboboxProps) {
  return <ComboboxPrimitive.Root {...props} />;
}

export type ComboboxInputProps = WithClassName<ComboboxPrimitive.Input.Props> &
  VariantProps<typeof inputVariants>;

function ComboboxInput({ tone, className, ...props }: ComboboxInputProps) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={inputVariants({ tone, className })}
      {...props}
    />
  );
}

export type ComboboxContentProps = WithClassName<ComboboxPrimitive.Popup.Props> &
  Pick<ComboboxPrimitive.Positioner.Props, "align" | "side" | "sideOffset">;

/** Base UI's Portal, Positioner and Popup collapsed into one part, the way the menu does it. */
function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  ...props
}: ComboboxContentProps) {
  const styles = combobox();

  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        className={styles.positioner()}
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={menuVariants().popup({ className: styles.popup({ className }) })}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

export type ComboboxListProps = WithClassName<ComboboxPrimitive.List.Props>;

/**
 * The filtered collection. Its children are a function of one item, not a written-out list: Base
 * UI filters `items` on the root and hands each survivor here, so a hand-written list is not
 * narrowed by anything and the popup never opens.
 */
function ComboboxList({ className, ...props }: ComboboxListProps) {
  return <ComboboxPrimitive.List data-slot="combobox-list" className={className} {...props} />;
}

export type ComboboxItemProps = WithClassName<ComboboxPrimitive.Item.Props>;

function ComboboxItem({ className, children, ...props }: ComboboxItemProps) {
  const styles = combobox();

  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={menuVariants().item({ className: styles.item({ className }) })}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className={styles.indicator()}>
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

export type ComboboxEmptyProps = WithClassName<ComboboxPrimitive.Empty.Props>;

/** What the list says when the query matches nothing. It draws only then. */
function ComboboxEmpty({ className, ...props }: ComboboxEmptyProps) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={combobox().empty({ className })}
      {...props}
    />
  );
}

Combobox.Input = ComboboxInput;
Combobox.Content = ComboboxContent;
Combobox.List = ComboboxList;
Combobox.Item = ComboboxItem;
Combobox.Empty = ComboboxEmpty;

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  combobox as comboboxVariants,
};
