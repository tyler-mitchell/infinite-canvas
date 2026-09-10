import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { tv } from "../tv.ts";

const tabs = tv({
  slots: {
    root: "flex min-h-0 flex-col gap-3 data-[orientation=vertical]:flex-row",
    list: "relative flex flex-none items-center gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
    tab: "relative cursor-pointer rounded-pk-control-inner border-0 bg-transparent px-2.5 py-2 font-pk-sans text-pk-control whitespace-nowrap text-pk-ink-dim outline-none transition-colors duration-(--pk-duration-hover) ease-pk-swift select-none hover:text-pk-ink-muted focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-pk-ground data-disabled:pointer-events-none data-disabled:opacity-40 data-selected:text-pk-ink-bright",
    indicator:
      "absolute left-0 rounded-pk-pill bg-pk-accent transition-[translate,width,height] duration-(--pk-duration-detail) ease-pk-swift data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:h-[1.5px] data-[orientation=horizontal]:w-(--active-tab-width) data-[orientation=horizontal]:translate-x-(--active-tab-left) data-[orientation=vertical]:top-0 data-[orientation=vertical]:h-(--active-tab-height) data-[orientation=vertical]:w-[1.5px] data-[orientation=vertical]:translate-y-(--active-tab-top)",
    panel: "min-h-0 flex-1 outline-none",
  },
});

type WithClassName<T> = Omit<T, "className"> & { className?: string };

export type TabsProps = WithClassName<TabsPrimitive.Root.Props>;

function Tabs({ className, ...props }: TabsProps) {
  return <TabsPrimitive.Root data-slot="tabs" className={tabs().root({ className })} {...props} />;
}

export type TabsListProps = WithClassName<TabsPrimitive.List.Props>;

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
