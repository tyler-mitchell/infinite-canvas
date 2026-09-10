import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { tv } from "../tv.ts";

const accordion = tv({
  slots: {
    root: "flex w-full flex-col",
    item: "border-t border-pk-line-inner last:border-b",
    header: "flex",
    trigger:
      "group/row flex w-full cursor-pointer items-baseline justify-between gap-[14px] border-0 bg-transparent px-0 py-3 text-left outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none after:size-[5px] after:flex-none after:translate-y-px after:self-center after:rotate-45 after:border-r after:border-b after:border-pk-ink-faint after:transition-transform after:duration-(--pk-duration-hover) after:ease-pk-swift after:content-[''] focus-visible:ring-2 focus-visible:ring-pk-accent/50 group-hover/row:after:border-pk-ink-muted data-disabled:pointer-events-none data-disabled:opacity-40 data-panel-open:after:rotate-[225deg] data-panel-open:after:border-pk-accent",
    title:
      "flex-1 font-pk-sans text-[14px] leading-[1.35] tracking-[-0.015em] text-pk-ink-muted transition-colors duration-(--pk-duration-hover) ease-pk-swift group-hover/row:text-pk-ink-bright",
    meta: "flex-none font-pk-mono text-pk-mono text-pk-ink-faint",
    panel:
      "h-(--accordion-panel-height) overflow-hidden transition-[height] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:h-0 data-starting-style:h-0",
    body: "pb-3 font-pk-sans text-pk-note text-pk-ink-faint text-pretty",
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

export type AccordionTriggerProps = WithClassName<AccordionPrimitive.Trigger.Props>;

function AccordionTrigger({ className, ...props }: AccordionTriggerProps) {
  const styles = accordion();

  return (
    <AccordionPrimitive.Header className={styles.header()}>
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={styles.trigger({ className })}
        {...props}
      />
    </AccordionPrimitive.Header>
  );
}

function AccordionTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="accordion-title" className={accordion().title({ className })} {...props} />
  );
}

function AccordionMeta({ className, ...props }: React.ComponentProps<"span">) {
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
Accordion.Trigger = AccordionTrigger;
Accordion.Title = AccordionTitle;
Accordion.Meta = AccordionMeta;
Accordion.Panel = AccordionPanel;

export {
  Accordion,
  AccordionItem,
  AccordionMeta,
  AccordionPanel,
  AccordionTitle,
  AccordionTrigger,
  accordion as accordionVariants,
};
