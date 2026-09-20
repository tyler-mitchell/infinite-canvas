import { Sections } from "@hyphened/infinite-canvas/next/react";
import type { ComponentProps } from "react";
import type { VariantProps } from "tailwind-variants";

import { tv } from "../tv.ts";

const sectionRail = tv({
  slots: {
    root: "flex gap-2",
    item: "group relative flex items-center justify-end rounded p-1 focus-visible:outline-none",
    dot: "size-1.5 shrink-0 rounded-full bg-pk-ink/30 transition-colors group-hover:bg-pk-ink group-aria-[current=true]:bg-pk-accent",
    label:
      "pointer-events-none absolute rounded border border-pk-line bg-pk-surface px-2 py-1 text-[11px] whitespace-nowrap text-pk-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100",
  },
  variants: {
    orientation: {
      horizontal: { root: "flex-row", label: "bottom-full left-1/2 mb-2 -translate-x-1/2" },
      vertical: { root: "flex-col items-end gap-1", label: "right-full mr-2" },
    },
    labels: {
      shown: {},
      hidden: { label: "hidden" },
    },
  },
  defaultVariants: { orientation: "vertical", labels: "shown" },
});

export type CanvasSectionRailProps = Omit<ComponentProps<typeof Sections.Root>, "children"> &
  VariantProps<typeof sectionRail> & {
    classNames?: { item?: string; dot?: string; label?: string };
  };

export function CanvasSectionRail({
  orientation,
  labels,
  className,
  classNames,
  ...props
}: CanvasSectionRailProps) {
  const styles = sectionRail({ orientation, labels });
  return (
    <Sections.Root className={styles.root({ className })} {...props}>
      {(section) => (
        <Sections.Item
          key={section.id}
          section={section.id}
          className={styles.item({ className: classNames?.item })}
        >
          <span aria-hidden="true" className={styles.dot({ className: classNames?.dot })} />
          <span className={styles.label({ className: classNames?.label })}>{section.title}</span>
        </Sections.Item>
      )}
    </Sections.Root>
  );
}

export { sectionRail as canvasSectionRailVariants };
