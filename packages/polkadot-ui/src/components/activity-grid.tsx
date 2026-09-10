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
    root: "flex min-h-0 min-w-0 flex-1 flex-col gap-1 rounded-pk-control-inner outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat)",
    body: "grid min-h-0 flex-none",
    months: "relative col-start-2 row-start-1 h-3",
    month: "absolute top-0 font-pk-mono text-[9px] leading-3 whitespace-nowrap text-pk-ink-faint",
    weekdays: "col-start-1 row-start-2 grid grid-rows-7 justify-items-end",
    weekday: "font-pk-mono text-[9px] whitespace-nowrap text-pk-ink-faint",
    grid: "col-start-2 row-start-2 grid min-w-0 grid-flow-col grid-rows-7",
    /*
     * The ring sits off the cell by a hairline of the seat, so it reads against the surface rather
     * than against the cell. A bright ring on the busiest cell is otherwise 1.36:1 and invisible.
     */
    cell: "rounded-[3px] transition-transform duration-(--pk-duration-hover) ease-pk-swift data-hot:scale-125 data-hot:ring-1 data-hot:ring-pk-ink-bright/70 data-hot:ring-offset-1 data-hot:ring-offset-(color:--pk-ring-seat)",
    footer: "flex flex-none items-center justify-between gap-2",
    legend: "flex items-center gap-1",
    swatch: "size-2.5 rounded-[3px]",
  },
  variants: {
    tone: {
      0: { cell: "bg-pk-level-0 shadow-pk-cell", swatch: "bg-pk-level-0 shadow-pk-cell" },
      1: { cell: "bg-pk-level-1", swatch: "bg-pk-level-1" },
      2: { cell: "bg-pk-level-2", swatch: "bg-pk-level-2" },
      3: { cell: "bg-pk-level-3", swatch: "bg-pk-level-3" },
      4: { cell: "bg-pk-level-4", swatch: "bg-pk-level-4" },
    },
  },
});

/** The scale a level indexes. Bounds past the last colour land on it rather than off the end. */
const TONES = [0, 1, 2, 3, 4] as const;

export interface ActivityDay {
  readonly date: Date;
  readonly count: number;
}

/** Lower bounds for levels one to four. Suits commits per day. */
const DEFAULT_THRESHOLDS: readonly number[] = [1, 3, 6, 10];

const DEFAULT_CELL = 11;

/** One source for the name, so a blank one falls back to what the signature already promises. */
const DEFAULT_LABEL = "activity";

/**
 * The cell size the plot draws at. A size that is not a usable number falls back to the default,
 * the way the bars fall back to a computed ceiling: it reaches four separate lengths, and each one
 * it spoils is a declaration the browser drops rather than a fault anything reports.
 */
const cellOrDefault = (cellSize: number) =>
  Number.isFinite(cellSize) && cellSize > 0 ? cellSize : DEFAULT_CELL;

const level = (count: number, thresholds: readonly number[] = DEFAULT_THRESHOLDS) =>
  TONES[Math.min(thresholds.filter((bound) => count >= bound).length, TONES.length - 1)]!;

/**
 * Whole weeks that fit at a cell size a pointer can hit. Drops history, never the cell size, down
 * to a floor of six weeks: narrower than that it is not a grid, so it keeps the six and overflows
 * rather than shrinking a cell below the size a finger needs.
 */
const weeksThatFit = (width: number, cell: number, gap: number, wanted: number) =>
  width <= 0 ? wanted : Math.max(6, Math.min(wanted, Math.floor((width + gap) / (cell + gap))));

/**
 * Trailing `weeks` columns, the last of them the week in progress, every column starting on a
 * Sunday.
 *
 * The window is counted back from the last day rather than taken as whole weeks, because a pad
 * ahead of the first day needs a column to sit in. Taking `weeks` whole weeks and then padding
 * asks for one column more than the caller measured room for, and the plot draws past its box.
 */
const toColumns = (days: readonly ActivityDay[], weeks: number) => {
  const columns = Number.isFinite(weeks) ? Math.max(0, Math.floor(weeks)) : 0;
  const last = days.at(-1);
  if (columns === 0 || !last) return [];

  const cells = columns * DAYS_PER_WEEK;
  const taken = days.slice(-((columns - 1) * DAYS_PER_WEEK + last.date.getDay() + 1));
  const opening = (taken[0] as ActivityDay).date.getDay();
  /* Only reachable on a short series: a part-week that still needs its own column is dropped. */
  const kept =
    opening + taken.length > cells && taken.length > DAYS_PER_WEEK - opening
      ? taken.slice(DAYS_PER_WEEK - opening)
      : taken;
  const pad = kept[0]?.date.getDay() ?? 0;

  return [...Array.from({ length: pad }, () => null), ...kept];
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
  /** Names the series for a reader who cannot see it. Two grids on a page need two names. */
  readonly label?: string;
  /** Rendered beside the legend; receives the focused day, or `undefined` when nothing is. */
  readonly children?: (day: ActivityDay | undefined) => React.ReactNode;
}

/**
 * Weeks are columns. Narrowed, it drops history rather than shrinking cells, because the cell size
 * is an input and never a result. The default thresholds suit commits per day; a series in another
 * unit should bring its own, or every non-zero value lands on the top level.
 */
function ActivityGrid({
  days,
  weeks = 26,
  cellSize = DEFAULT_CELL,
  thresholds = DEFAULT_THRESHOLDS,
  label = DEFAULT_LABEL,
  className,
  children,
  ...props
}: ActivityGridProps) {
  const styles = activityGrid();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const width = useElementWidth(root);
  const gap = 4;
  const cell = cellOrDefault(cellSize);

  const columns = useMemo(
    () => toColumns(days, weeksThatFit(width - PLOT_INSET, cell, gap, weeks)),
    [days, width, cell, weeks],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const index = (event.target as HTMLElement).dataset.index;
    setCursor(index === undefined ? undefined : Number(index));
  }, []);

  /*
   * A week that opens mid-week is padded with blanks, and they are real cells: the cursor could
   * stop on one, where there is no day to name and no cell to mark, so the arrow read as broken.
   * The walk stops at the first day instead of at the first cell.
   */
  const firstDay = Math.max(
    0,
    columns.findIndex((day) => day !== null),
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      setCursor((current) =>
        Math.max(firstDay, Math.min(columns.length - 1, (current ?? columns.length - 1) + step)),
      );
    },
    [columns.length, firstDay],
  );

  const focused = cursor === undefined ? undefined : (columns[cursor] ?? undefined);

  const monthMarks = useMemo(() => {
    const pitch = cell + gap;
    const seen = new Set<number>();
    return columns.flatMap((day, index) => {
      if (!day || day.date.getDate() > 7) return [];
      const month = day.date.getMonth();
      /* Held apart by the year as well: a window longer than a year carries each month twice, and
       * on the month alone the second one matched the first and drew nothing. */
      const stamp = day.date.getFullYear() * 12 + month;
      if (seen.has(stamp)) return [];
      seen.add(stamp);
      return [{ month, stamp, left: Math.floor(index / DAYS_PER_WEEK) * pitch }];
    });
  }, [columns, cell]);

  const summary = useMemo(() => {
    const shown = columns.filter((day) => day !== null);
    /* The plot empties on an empty series and on a week count that is not a usable number. This
     * label is the whole of what a reader who cannot see it is given, so it says the plot is
     * empty rather than naming a first and last day that are not there. */
    if (shown.length === 0) return "no days";

    const first = shown[0]?.date.toDateString();
    const last = shown.at(-1)?.date.toDateString();
    /* One count that is not a number would otherwise be the whole total, which is the only figure
     * a reader who cannot see the plot is given. */
    const total = shown.reduce((sum, day) => sum + (Number.isFinite(day.count) ? day.count : 0), 0);
    return `${shown.length} days, ${first} to ${last}, ${total} in total`;
  }, [columns]);

  return (
    <div
      data-slot="activity-grid"
      role="group"
      aria-label={label.trim() || DEFAULT_LABEL}
      tabIndex={0}
      /* It takes the focus and the arrows walk it, so it says which arrows, as the deck does. */
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
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
          gridTemplateRows: `auto ${7 * cell + 6 * gap}px`,
          columnGap: `${LABEL_GAP}px`,
          rowGap: `${gap}px`,
        }}
      >
        <div className={styles.months()}>
          {monthMarks.map(({ month, stamp, left }) => (
            <span key={stamp} className={styles.month()} style={{ left: `${left}px` }}>
              {MONTHS[month]}
            </span>
          ))}
        </div>

        <div className={styles.weekdays()} style={{ gap: `${gap}px` }}>
          {WEEKDAYS.map((day, index) => (
            <span key={day} className={styles.weekday()} style={{ lineHeight: `${cell}px` }}>
              {index % 2 === 1 ? day : ""}
            </span>
          ))}
        </div>

        <div
          className={styles.grid()}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setCursor(undefined)}
          style={{ gridAutoColumns: `${cell}px`, gap: `${gap}px` }}
        >
          {columns.map((day, index) =>
            day ? (
              <div
                key={index}
                data-slot="activity-day"
                data-index={index}
                data-hot={cursor === index ? "" : undefined}
                className={styles.cell({ tone: level(day.count, thresholds) })}
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
          {TONES.map((tone) => (
            <span key={tone} className={styles.swatch({ tone })} />
          ))}
        </div>
      </div>
    </div>
  );
}

export { ActivityGrid, activityGrid as activityGridVariants, level as activityLevel };
export { toColumns, weeksThatFit };
