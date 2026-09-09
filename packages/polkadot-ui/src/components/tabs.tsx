import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { tv } from "tailwind-variants";

const tabs = tv({
  slots: {
    /*
     * Each part reads its own `data-orientation`, which Base UI sets on all of them. Written for
     * the horizontal case alone, a vertical Tabs kept a row of tabs and an underline that measured
     * the active tab's width while the axis it needed was its height.
     */
    root: "flex min-h-0 flex-col gap-3 data-[orientation=vertical]:flex-row",
    list: "relative flex flex-none items-center gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
    tab: "relative cursor-pointer rounded-pk-chip border-0 bg-transparent px-2 py-[6px] font-pk-sans text-[11px] leading-none font-medium tracking-[0.02em] whitespace-nowrap text-pk-ink-dim outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none hover:text-pk-ink-muted focus-visible:ring-2 focus-visible:ring-pk-accent/50 data-disabled:pointer-events-none data-disabled:opacity-40 data-selected:text-pk-ink-bright",
    /*
     * Base UI measures the active tab and publishes its box as CSS variables, so the marker slides
     * between tabs as one transition instead of a layout animation per tab.
     */
    indicator:
      "absolute left-0 bg-pk-accent transition-[translate,width,height] duration-(--pk-duration-detail) ease-pk-swift data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-(--active-tab-width) data-[orientation=horizontal]:translate-x-(--active-tab-left) data-[orientation=vertical]:top-0 data-[orientation=vertical]:h-(--active-tab-height) data-[orientation=vertical]:w-px data-[orientation=vertical]:translate-y-(--active-tab-top)",
    panel: "min-h-0 flex-1 outline-none",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type TabsProps = WithClassName<TabsPrimitive.Root.Props>;

function Tabs({ className, ...props }: TabsProps) {
  return <TabsPrimitive.Root data-slot="tabs" className={tabs().root({ className })} {...props} />;
}

export type TabsListProps = WithClassName<TabsPrimitive.List.Props>;

/** The underline marker is part of the list, not a separate part a consumer has to remember. */
function TabsList({ className, children, ...props }: TabsListProps) {
  const styles = tabs();

  return (
    <TabsPrimitive.List data-slot="tabs-list" className={styles.list({ className })} {...props}>
      {children}
      <TabsPrimitive.Indicator className={styles.indicator()} />
    </TabsPrimitive.List>
  );
}

export type TabProps = WithClassName<TabsPrimitive.Tab.Props>;

function Tab({ className, ...props }: TabProps) {
  return <TabsPrimitive.Tab data-slot="tab" className={tabs().tab({ className })} {...props} />;
}

export type TabPanelProps = WithClassName<TabsPrimitive.Panel.Props>;

function TabPanel({ className, ...props }: TabPanelProps) {
  return (
    <TabsPrimitive.Panel data-slot="tab-panel" className={tabs().panel({ className })} {...props} />
  );
}

Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;

export { Tab, TabPanel, Tabs, TabsList, tabs as tabsVariants };
