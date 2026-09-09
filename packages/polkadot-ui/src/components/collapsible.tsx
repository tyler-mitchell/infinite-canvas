import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { tv } from "tailwind-variants";

const collapsible = tv({
  slots: {
    root: "flex flex-col",
    trigger:
      "flex cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] text-pk-ink-dim outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none hover:text-pk-ink-bright focus-visible:ring-2 focus-visible:ring-pk-accent/50",
    /*
     * Base UI measures the panel and publishes `--collapsible-panel-height`, so the tween is one
     * compositor-owned CSS transition. A per-frame JS height loop is what this avoids.
     */
    panel:
      "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-(--pk-duration-detail) ease-pk-swift data-ending-style:h-0 data-starting-style:h-0",
    /*
     * The gap under the trigger, on an inner element rather than the panel. Base UI publishes the
     * measured content height and the panel is border-box, so padding on the panel itself would be
     * subtracted from the content and clip the last line. Spacing only — the panel takes any child,
     * so it does not impose a type role the way the accordion's body does.
     */
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
