import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { tv } from "tailwind-variants";

const DAYS_PER_WEEK = 7;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/* Fixed, so the label column never participates in the measurement the plot width depends on. */
const WEEKDAY_COLUMN = 28;
const LABEL_GAP = 6;
const PLOT_INSET = WEEKDAY_COLUMN + LABEL_GAP;

const activityGrid = tv({
  slots: {
    root: "flex min-h-0 min-w-0 flex-1 flex-col gap-1 outline-none",
    /*
     * Two columns: labels, then the plot. The month strip and the cells share the plot column, so
     * a month sits over its own week by layout. Positioning the strip against the root instead put
     * every label a label-column to the left of the week it named.
     */
    body: "grid min-h-0 flex-none",
    months: "relative col-start-2 row-start-1 h-3",
    month: "absolute top-0 font-pk-mono text-[9px] leading-3 whitespace-nowrap text-pk-ink-faint",
    weekdays: "col-start-1 row-start-2 grid grid-rows-7 justify-items-end",
    weekday: "font-pk-mono text-[9px] whitespace-nowrap text-pk-ink-faint",
    /* Columns are weeks, rows are weekdays. Grid owns the pitch, so nothing computes offsets. */
    grid: "col-start-2 row-start-2 grid min-w-0 grid-flow-col grid-rows-7",
    cell: "rounded-[3px] transition-transform duration-(--pk-duration-hover) ease-pk-swift data-hot:scale-125 data-hot:ring-1 data-hot:ring-pk-ink-bright/70",
    footer: "flex flex-none items-center justify-between gap-2",
    legend: "flex items-center gap-1",
    swatch: "size-2.5 rounded-[3px]",
  },
});

/** Least to most. Zero carries an inset hairline so an empty day is a mark, not a hole. */
const LEVEL_CLASS = [
  "bg-pk-level-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.045)]",
  "bg-pk-level-1",
  "bg-pk-level-2",
  "bg-pk-level-3",
  "bg-pk-level-4",
] as const;

export interface ActivityDay {
  readonly date: Date;
  readonly count: number;
}

const level = (count: number) =>
  count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;

/**
 * How many whole weeks fit at a cell size a pointer can actually hit.
 *
 * The design's key call: drop history before shrinking cells. A four-pixel cell nobody can click is
 * worse than six honest months, so width chooses the week count and never the cell size.
 */
const weeksThatFit = (width: number, cell: number, gap: number, wanted: number) =>
  width <= 0 ? wanted : Math.max(6, Math.min(wanted, Math.floor((width + gap) / (cell + gap))));

/** Trailing `weeks` columns, with the first column padded so every column starts on a Sunday. */
const toColumns = (days: readonly ActivityDay[], weeks: number) => {
  const slots = weeks * DAYS_PER_WEEK;
  const taken = days.slice(-slots);
  const leading = taken.length > 0 ? (taken[0] as ActivityDay).date.getDay() : 0;
  return [...Array.from({ length: leading }, () => null), ...taken];
};

const useElementWidth = (element: HTMLElement | null) => {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!element) return () => {};
      const observer = new ResizeObserver(notify);
      observer.observe(element);
      return () => observer.disconnect();
    },
    [element],
  );
  return useSyncExternalStore(
    subscribe,
    () => element?.clientWidth ?? 0,
    () => 0,
  );
};

export interface ActivityGridProps extends Omit<React.ComponentProps<"div">, "children"> {
  readonly days: readonly ActivityDay[];
  /** Weeks to show when they fit. Fewer are shown rather than smaller cells. */
  readonly weeks?: number;
  readonly cellSize?: number;
  /** Rendered beside the legend; receives the focused day, or `undefined` when nothing is. */
  readonly children?: (day: ActivityDay | undefined) => React.ReactNode;
}

function ActivityGrid({
  days,
  weeks = 26,
  cellSize = 11,
  className,
  children,
  ...props
}: ActivityGridProps) {
  const styles = activityGrid();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  /*
   * The root is measured, never the grid. The grid's own columns size it, so observing the grid
   * would feed the measurement back into the layout that produced it and the week count would
   * never drop.
   */
  const width = useElementWidth(root);
  const gap = 4;

  const columns = useMemo(
    () => toColumns(days, weeksThatFit(width - PLOT_INSET, cellSize, gap, weeks)),
    [days, width, cellSize, weeks],
  );

  /* One listener for every cell. The index rides on the element, so no per-cell closure exists. */
  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const index = (event.target as HTMLElement).dataset.index;
    setCursor(index === undefined ? undefined : Number(index));
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      setCursor((current) =>
        Math.max(0, Math.min(columns.length - 1, (current ?? columns.length - 1) + step)),
      );
    },
    [columns.length],
  );

  const focused = cursor === undefined ? undefined : (columns[cursor] ?? undefined);

  /* A month label sits at the column where that month actually starts. */
  const monthMarks = useMemo(() => {
    const pitch = cellSize + gap;
    const seen = new Set<number>();
    return columns.flatMap((day, index) => {
      if (!day || day.date.getDate() > 7) return [];
      const month = day.date.getMonth();
      if (seen.has(month)) return [];
      seen.add(month);
      return [{ month, left: Math.floor(index / DAYS_PER_WEEK) * pitch }];
    });
  }, [columns, cellSize]);

  return (
    <div
      data-slot="activity-grid"
      role="grid"
      aria-label="Activity"
      tabIndex={0}
      ref={setRoot}
      className={styles.root({ className })}
      onKeyDown={onKeyDown}
      onBlur={() => setCursor(undefined)}
      {...props}
    >
      <div
        className={styles.body()}
        style={{
          gridTemplateColumns: `${WEEKDAY_COLUMN}px minmax(0, 1fr)`,
          gridTemplateRows: `auto ${7 * cellSize + 6 * gap}px`,
          columnGap: `${LABEL_GAP}px`,
          rowGap: `${gap}px`,
        }}
      >
        <div className={styles.months()}>
          {monthMarks.map(({ month, left }) => (
            <span key={month} className={styles.month()} style={{ left: `${left}px` }}>
              {MONTHS[month]}
            </span>
          ))}
        </div>

        <div className={styles.weekdays()} style={{ gap: `${gap}px` }}>
          {WEEKDAYS.map((day, index) => (
            <span key={day} className={styles.weekday()} style={{ lineHeight: `${cellSize}px` }}>
              {index % 2 === 1 ? day : ""}
            </span>
          ))}
        </div>

        <div
          className={styles.grid()}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setCursor(undefined)}
          style={{ gridAutoColumns: `${cellSize}px`, gap: `${gap}px` }}
        >
          {columns.map((day, index) =>
            day ? (
              <div
                key={index}
                role="gridcell"
                data-index={index}
                data-hot={cursor === index ? "" : undefined}
                aria-label={`${day.count} on ${day.date.toDateString()}`}
                className={`${styles.cell()} ${LEVEL_CLASS[level(day.count)]}`}
              />
            ) : (
              <div key={index} aria-hidden />
            ),
          )}
        </div>
      </div>

      <div className={styles.footer()}>
        {children?.(focused)}
        <div className={styles.legend()}>
          {LEVEL_CLASS.map((tone, index) => (
            <span key={index} className={`${styles.swatch()} ${tone}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export { ActivityGrid, activityGrid as activityGridVariants, level as activityLevel };
/* Not part of the kit's surface. Exported so the sizing rule can be pinned without a layout. */
export { toColumns, weeksThatFit };
