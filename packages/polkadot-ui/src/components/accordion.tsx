import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { MOTION } from "../motion.ts";
import { tv } from "../tv.ts";

const accordion = tv({
  slots: {
    root: "flex w-full flex-col",
    item: "border-t border-pk-line-inner last:border-b",
    header: "flex",
    trigger:
      "group/row flex w-full cursor-pointer items-baseline justify-between gap-3.5 border-0 bg-transparent px-0 py-3 text-left outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none after:size-[5px] after:flex-none after:translate-y-px after:self-center after:rotate-45 after:border-r after:border-b after:border-pk-ink-faint after:transition-transform after:duration-(--pk-duration-hover) after:ease-pk-swift after:content-[''] focus-visible:ring-2 focus-visible:ring-pk-accent/50 group-hover/row:after:border-pk-ink-muted data-disabled:pointer-events-none data-disabled:opacity-40 data-panel-open:after:rotate-[225deg] data-panel-open:after:border-pk-accent",
    title:
      "min-w-0 flex-1 font-pk-sans text-pk-item break-words text-pk-ink-muted transition-colors duration-(--pk-duration-hover) ease-pk-swift group-hover/row:text-pk-ink-bright",
    meta: "min-w-0 font-pk-mono text-pk-mono break-words text-pk-ink-faint",
    panel: `h-(--accordion-panel-height) overflow-hidden ${MOTION.panel}`,
    body: "pb-3 font-pk-sans text-pk-note break-words text-pk-ink-faint text-pretty",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

/** Vertical only: a horizontal accordion would animate width and rule the other edge. */
export type AccordionProps = Omit<WithClassName<AccordionPrimitive.Root.Props>, "orientation">;

function Accordion({ className, ...props }: AccordionProps) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={accordion().root({ className })}
      {...props}
    />
  );
}

export type AccordionItemProps = WithClassName<AccordionPrimitive.Item.Props>;

function AccordionItem({ className, ...props }: AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={accordion().item({ className })}
      {...props}
    />
  );
}

export type AccordionHeaderProps = WithClassName<AccordionPrimitive.Header.Props>;

/**
 * The heading that labels a panel, an `h3` as Base UI draws it. Reach for `render` where the
 * accordion's items are not third-level sections — directly under a page's `h1` they are second,
 * and a reader navigating by heading meets a gap otherwise.
 *
 * It is a part rather than something the trigger wraps, because the trigger has a `render` of its
 * own and a wrapper leaves nowhere to put the heading's. Every other heading in this kit is a part
 * you can render into the tag you want, and this was the one you could not reach.
 */
function AccordionHeader({ className, ...props }: AccordionHeaderProps) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className={accordion().header({ className })}
      {...props}
    />
  );
}

export type AccordionTriggerProps = WithClassName<AccordionPrimitive.Trigger.Props>;

function AccordionTrigger({ className, ...props }: AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={accordion().trigger({ className })}
      {...props}
    />
  );
}

export type AccordionTitleProps = React.ComponentProps<"span">;

function AccordionTitle({ className, ...props }: AccordionTitleProps) {
  return (
    <span data-slot="accordion-title" className={accordion().title({ className })} {...props} />
  );
}

export type AccordionMetaProps = React.ComponentProps<"span">;

function AccordionMeta({ className, ...props }: AccordionMetaProps) {
  return <span data-slot="accordion-meta" className={accordion().meta({ className })} {...props} />;
}

export type AccordionPanelProps = WithClassName<AccordionPrimitive.Panel.Props>;

function AccordionPanel({ className, children, ...props }: AccordionPanelProps) {
  const styles = accordion();

  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={styles.panel({ className })}
      {...props}
    >
      <div className={styles.body()}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

Accordion.Item = AccordionItem;
Accordion.Header = AccordionHeader;
Accordion.Trigger = AccordionTrigger;
Accordion.Title = AccordionTitle;
Accordion.Meta = AccordionMeta;
Accordion.Panel = AccordionPanel;

export {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionMeta,
  AccordionPanel,
  AccordionTitle,
  AccordionTrigger,
  accordion as accordionVariants,
};
