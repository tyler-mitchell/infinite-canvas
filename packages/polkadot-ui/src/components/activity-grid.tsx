import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { tv } from "../tv.ts";

const DAYS_PER_WEEK = 7;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_COLUMN = 28;
const LABEL_GAP = 6;
const PLOT_INSET = WEEKDAY_COLUMN + LABEL_GAP;

const activityGrid = tv({
  slots: {
    root: "flex min-h-0 min-w-0 flex-1 flex-col gap-1 outline-none",
    body: "grid min-h-0 flex-none",
    months: "relative col-start-2 row-start-1 h-3",
    month: "absolute top-0 font-pk-mono text-[9px] leading-3 whitespace-nowrap text-pk-ink-faint",
    weekdays: "col-start-1 row-start-2 grid grid-rows-7 justify-items-end",
    weekday: "font-pk-mono text-[9px] whitespace-nowrap text-pk-ink-faint",
    grid: "col-start-2 row-start-2 grid min-w-0 grid-flow-col grid-rows-7",
    cell: "rounded-[3px] transition-transform duration-(--pk-duration-hover) ease-pk-swift data-hot:scale-125 data-hot:ring-1 data-hot:ring-pk-ink-bright/70",
    footer: "flex flex-none items-center justify-between gap-2",
    legend: "flex items-center gap-1",
    swatch: "size-2.5 rounded-[3px]",
  },
});

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

/** Lower bounds for levels one to four. Suits commits per day. */
const DEFAULT_THRESHOLDS: readonly number[] = [1, 3, 6, 10];

const level = (count: number, thresholds: readonly number[] = DEFAULT_THRESHOLDS) =>
  thresholds.filter((bound) => count >= bound).length;

/** Whole weeks that fit at a cell size a pointer can hit. Drops history, never the cell size. */
const weeksThatFit = (width: number, cell: number, gap: number, wanted: number) =>
  width <= 0 ? wanted : Math.max(6, Math.min(wanted, Math.floor((width + gap) / (cell + gap))));

/** Trailing `weeks` columns, first column padded so every column starts on a Sunday. */
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
  /** Lower bounds for levels one to four. Defaults suit commits per day. */
  readonly thresholds?: readonly number[];
  /** Rendered beside the legend; receives the focused day, or `undefined` when nothing is. */
  readonly children?: (day: ActivityDay | undefined) => React.ReactNode;
}

function ActivityGrid({
  days,
  weeks = 26,
  cellSize = 11,
  thresholds = DEFAULT_THRESHOLDS,
  className,
  children,
  ...props
}: ActivityGridProps) {
  const styles = activityGrid();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const width = useElementWidth(root);
  const gap = 4;

  const columns = useMemo(
    () => toColumns(days, weeksThatFit(width - PLOT_INSET, cellSize, gap, weeks)),
    [days, width, cellSize, weeks],
  );

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

  const summary = useMemo(() => {
    const shown = columns.filter((day) => day !== null);
    const first = shown[0]?.date.toDateString();
    const last = shown.at(-1)?.date.toDateString();
    const total = shown.reduce((sum, day) => sum + day.count, 0);
    return `${shown.length} days, ${first} to ${last}, ${total} in total`;
  }, [columns]);

  return (
    <div
      data-slot="activity-grid"
      role="group"
      aria-label="Activity"
      tabIndex={0}
      ref={setRoot}
      className={styles.root({ className })}
      onKeyDown={onKeyDown}
      onBlur={() => setCursor(undefined)}
      {...props}
    >
      <div
        role="img"
        aria-label={summary}
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
                data-slot="activity-day"
                data-index={index}
                data-hot={cursor === index ? "" : undefined}
                className={`${styles.cell()} ${LEVEL_CLASS[level(day.count, thresholds)]}`}
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
export { toColumns, weeksThatFit };
