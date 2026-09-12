import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { MOTION } from "../motion.ts";
import { tv } from "../tv.ts";

const collapsible = tv({
  slots: {
    root: "flex flex-col",
    /*
     * The padding is a hit area and the negative margin gives it back to the layout, so the
     * label sits where it did while the thing you tap is 27px rather than the 11px of its text.
     * The accordion's trigger is 43px for the same job, and this was a quarter of it.
     */
    /*
     * The trigger fades and stops taking a pointer, not the panel: a disabled collapsible that is
     * open still has to be readable, and the control is the only part that is off.
     */
    trigger:
      "-my-2 flex cursor-pointer items-center justify-between gap-2 border-0 bg-transparent px-0 py-2 font-pk-sans text-pk-label text-pk-ink-dim outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none hover:text-pk-ink-bright focus-visible:ring-2 focus-visible:ring-pk-accent/50 data-disabled:pointer-events-none data-disabled:opacity-40",
    panel: `h-(--collapsible-panel-height) overflow-hidden ${MOTION.panel}`,
    body: "pt-3",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type CollapsibleProps = WithClassName<CollapsiblePrimitive.Root.Props>;

function Collapsible({ className, ...props }: CollapsibleProps) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="collapsible"
      className={collapsible().root({ className })}
      {...props}
    />
  );
}

export type CollapsibleTriggerProps = WithClassName<CollapsiblePrimitive.Trigger.Props>;

function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={collapsible().trigger({ className })}
      {...props}
    />
  );
}

export type CollapsiblePanelProps = WithClassName<CollapsiblePrimitive.Panel.Props>;

function CollapsiblePanel({ className, children, ...props }: CollapsiblePanelProps) {
  const styles = collapsible();

  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-panel"
      className={styles.panel({ className })}
      {...props}
    >
      <div className={styles.body()}>{children}</div>
    </CollapsiblePrimitive.Panel>
  );
}

Collapsible.Trigger = CollapsibleTrigger;
Collapsible.Panel = CollapsiblePanel;

export { Collapsible, CollapsiblePanel, CollapsibleTrigger, collapsible as collapsibleVariants };
