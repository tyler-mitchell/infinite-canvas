import {
  Sections,
  useCanvasScroll,
} from "@hyphened/infinite-canvas/next/react";

import { tv } from "../tv.ts";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.tsx";

const sectionRail = tv({
  slots: {
    root: "pointer-events-none absolute z-20 flex",
    list: "pointer-events-auto flex",
    item: "group flex size-6 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat)",
    dot: "size-1.5 rounded-full bg-pk-ink/30 transition-colors duration-(--pk-duration-hover) ease-pk-swift group-hover:bg-pk-ink group-focus-visible:bg-pk-ink group-aria-[current=true]:bg-pk-accent",
  },
  variants: {
    axis: {
      vertical: { root: "inset-y-0 right-0 items-center px-1", list: "flex-col" },
      horizontal: { root: "inset-x-0 bottom-0 justify-center py-1", list: "flex-row" },
    },
  },
});

const tooltipSide = { vertical: "left", horizontal: "top" } as const;

export type CanvasSectionRailProps = { className?: string };

export function CanvasSectionRail({ className }: CanvasSectionRailProps) {
  const { axis } = useCanvasScroll();
  const styles = sectionRail({ axis });
  return (
    <div
      data-canvas-control
      className={styles.root({ className })}
    >
      <Tooltip.Provider>
        <Sections.Root className={styles.list()}>
          {(section) => (
            <Tooltip key={section.id}>
              <TooltipTrigger
                render={<Sections.Item section={section} className={styles.item()} />}
              >
                <span aria-hidden="true" className={styles.dot()} />
              </TooltipTrigger>
              <TooltipContent side={tooltipSide[axis]}>{section.title}</TooltipContent>
            </Tooltip>
          )}
        </Sections.Root>
      </Tooltip.Provider>
    </div>
  );
}

export { sectionRail as canvasSectionRailVariants };
