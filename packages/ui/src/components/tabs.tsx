import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "../lib/utils";

const tabs = tv({
  slots: {
    content: "flex-1 text-sm outline-none",
    list: "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
    root: "group/tabs flex gap-2 data-horizontal:flex-col",
    trigger:
      "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  },
  variants: {
    variant: {
      default: {
        list: "bg-muted",
      },
      line: {
        list: "gap-1 bg-transparent",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  const styles = tabs();

  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(styles.root(), className)}
      {...props}
    />
  );
}

function tabsList({
  className,
  variant = "default",
}: VariantProps<typeof tabs> & { className?: string } = {}) {
  return tabs({ variant }).list({ className });
}

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabs>) {
  const styles = tabs({ variant });

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={mergeClassName(styles.list(), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const styles = tabs();

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={mergeClassName(styles.trigger(), className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  const styles = tabs();

  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={mergeClassName(styles.content(), className)}
      {...props}
    />
  );
}

function mergeClassName<State>(
  baseClassName: string,
  className: string | ((state: State) => string | undefined) | undefined,
) {
  if (typeof className === "function") {
    return (state: State) => cn(baseClassName, className(state));
  }

  return cn(baseClassName, className);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsList as tabsListVariants };
