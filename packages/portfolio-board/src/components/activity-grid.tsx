import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { Observable } from "@legendapp/state";
import { Computed, useObservable, useValue } from "@legendapp/state/react";
import { useMeasure } from "@legendapp/state/react-hooks/useMeasure";
import { memo, useCallback, useMemo, useRef } from "react";
import { tv } from "../tv.ts";
import { ParticleField } from "./particle-field.tsx";
import { Readout } from "./text.tsx";
import { useActivityPlayback, type ActivityPlaybackOptions } from "./activity-playback.ts";

const DAYS_PER_WEEK = 7;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_COLUMN = 28;
const LABEL_GAP = 8;
const PLOT_INSET = WEEKDAY_COLUMN + LABEL_GAP;

const activityGrid = tv({
  slots: {
    root: "flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-clip rounded-pk-control-inner outline-none focus-visible:ring-2 focus-visible:ring-pk-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(color:--pk-ring-seat)",
    body: "grid min-h-0 flex-none",
    months: "relative col-start-2 row-start-1 h-4",
    month:
      "absolute top-0 font-pk-mono text-pk-mono-sm leading-4 whitespace-nowrap text-pk-ink-faint/80",
    weekdays: "col-start-1 row-start-2 grid grid-rows-7 justify-items-end",
    weekday: "font-pk-mono text-pk-mono-sm whitespace-nowrap text-pk-ink-faint/80",
    grid: "relative col-start-2 row-start-2 grid min-w-0 grid-flow-col grid-rows-7",
    cell: "relative overflow-clip rounded-[3px] transition-[scale] duration-(--pk-duration-hover) ease-pk-swift data-hot:scale-125 data-hot:ring-1 data-hot:ring-pk-ink-bright/70 data-hot:ring-offset-1 data-hot:ring-offset-(color:--pk-ring-seat)",
    footer: "flex min-h-4 flex-none items-center justify-between gap-2",
    readout: "min-w-0 truncate",
    legend: "flex items-center gap-1",
    swatch: "size-2.5 rounded-[3px]",
  },
  variants: {
    tone: {
      0: { cell: "bg-pk-level-0", swatch: "bg-pk-level-0 shadow-pk-cell" },
      1: { cell: "bg-pk-level-1", swatch: "bg-pk-level-1" },
      2: { cell: "bg-pk-level-2", swatch: "bg-pk-level-2" },
      3: { cell: "bg-pk-level-3", swatch: "bg-pk-level-3" },
      4: { cell: "bg-pk-level-4", swatch: "bg-pk-level-4" },
    },
  },
});

const TONES = [0, 1, 2, 3, 4] as const;
const CELL = activityGrid().cell({ tone: 0 });

function ActivityGridRoot({
  phase$,
  loading,
  render,
  ref,
  ...props
}: useRender.ComponentProps<"div"> & { phase$: Observable<string>; loading: boolean }) {
  const phase = useValue(phase$);
  return useRender({
    render,
    ref,
    props: { ...props, "data-playback": loading ? "loading" : phase },
  });
}

export interface ActivityDay {
  readonly date: Date;
  readonly count: number;
}

/** Lower bounds for levels one to four. Suits commits per day. */
const DEFAULT_THRESHOLDS: readonly number[] = [1, 3, 6, 10];

const DEFAULT_CELL = 11;

const DEFAULT_LABEL = "activity";

const cellOrDefault = (cellSize: number) =>
  Number.isFinite(cellSize) && cellSize > 0 ? cellSize : DEFAULT_CELL;

const counted = (count: number) => (Number.isFinite(count) ? count : 0);

/** Describes the focused day. */
export function dayReadout(
  day: { readonly count: number; readonly date: Date } | undefined,
  label: string,
) {
  return day ? `${counted(day.count)} ${label} · ${day.date.toDateString().slice(0, 10)}` : "";
}

const level = (count: number, thresholds: readonly number[] = DEFAULT_THRESHOLDS) => {
  const bounds = thresholds.length > 0 ? thresholds : DEFAULT_THRESHOLDS;

  return TONES[Math.min(bounds.filter((bound) => count >= bound).length, TONES.length - 1)]!;
};

const ActivityCell = memo(function ActivityCell({
  day,
  index,
  thresholds,
  selection$,
}: {
  day: ActivityDay;
  index: number;
  thresholds: readonly number[];
  selection$: Observable<Partial<Record<number, true>>>;
}) {
  const selected = useValue(selection$[index]);
  const tone = level(day.count, thresholds);
  return (
    <div
      data-slot="activity-day"
      data-index={index}
      data-hot={selected ? "" : undefined}
      onPointerEnter={() => selection$.set({ [index]: true })}
      className={CELL}
    >
      <span
        data-slot="activity-fill"
        data-level={tone}
        aria-hidden
        className="absolute inset-0 rounded-[inherit] shadow-pk-cell"
        style={{ backgroundColor: `var(--pk-level-${tone})` }}
      />
      <span data-slot="activity-cursor" aria-hidden />
      {tone === 4 && (
        <span data-slot="activity-flash" aria-hidden>
          <span data-slot="activity-core" />
        </span>
      )}
    </div>
  );
});

/** Shows whole weeks that fit without reducing cell size. */
const weeksThatFit = (width: number, cell: number, gap: number, wanted: number) =>
  width <= 0 ? wanted : Math.max(0, Math.min(wanted, Math.floor((width + gap) / (cell + gap))));

/** Pads the opening week and keeps the requested trailing columns. */
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

/** Clamps keyboard navigation to populated cells. */
const cursorAfter = (current: number | undefined, step: number, firstDay: number, days: number) =>
  Math.max(firstDay, Math.min(days - 1, (current ?? days - 1) + step));

export interface ActivityGridProps extends Omit<useRender.ComponentProps<"div">, "children"> {
  readonly days: readonly ActivityDay[];
  readonly playback?: boolean | ActivityPlaybackOptions;
  readonly loading?: boolean;
  readonly replayKey?: string | number;
  readonly loadingLabel?: string;
  /** Weeks to show when they fit. Fewer are shown rather than smaller cells. */
  readonly weeks?: number;
  readonly cellSize?: number;
  /** Lower bounds for levels one to four. Defaults suit commits per day. */
  readonly thresholds?: readonly number[];
  /** Names the series for a reader who cannot see it. Two grids on a page need two names. */
  readonly label?: string;
  /** Replaces the day readout. Return a live region to announce keyboard selection. */
  readonly children?: (day: ActivityDay | undefined) => React.ReactNode;
}

function ActivityGrid({
  days,
  playback = true,
  loading = false,
  replayKey,
  loadingLabel = "Loading activity",
  weeks = 26,
  cellSize = DEFAULT_CELL,
  thresholds = DEFAULT_THRESHOLDS,
  label = DEFAULT_LABEL,
  className,
  children,
  ref,
  render,
  ...props
}: ActivityGridProps) {
  const styles = activityGrid();
  const selection$ = useObservable<Partial<Record<number, true>>>({});
  const measure = useRef<HTMLDivElement | null>(null);
  // Legend v3's ref declaration predates nullable React 19 refs.
  const size$ = useMeasure(measure as Parameters<typeof useMeasure>[0]);
  const gap = 4;
  const cell = cellOrDefault(cellSize);
  const width = useValue(size$.width) ?? 0;
  const visibleWeeks =
    width > 0 && width <= PLOT_INSET ? 0 : weeksThatFit(width - PLOT_INSET, cell, gap, weeks);
  const columnsForSnapshot = useCallback(
    (snapshot: readonly ActivityDay[]) => toColumns(snapshot, visibleWeeks),
    [visibleWeeks],
  );

  const animation = useActivityPlayback({
    days,
    playback,
    loading,
    replayKey,
    columns: columnsForSnapshot,
    cellSize: cell,
    gap,
    ready: width > 0,
    thresholds: thresholds.length ? thresholds : DEFAULT_THRESHOLDS,
  });
  const columns = animation.columns;
  const cells = useMemo(
    () =>
      columns.map((day, index) =>
        day ? (
          <ActivityCell
            key={day.date.toISOString()}
            day={day}
            index={index}
            selection$={selection$}
            thresholds={thresholds}
          />
        ) : (
          <div key={index} aria-hidden />
        ),
      ),
    [columns, selection$, thresholds],
  );

  const firstDay = Math.max(
    0,
    columns.findIndex((day) => day !== null),
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      const current = Object.keys(selection$.peek())[0];
      const index = cursorAfter(
        current === undefined ? undefined : Number(current),
        step,
        firstDay,
        columns.length,
      );
      selection$.set({ [index]: true });
    },
    [columns.length, firstDay, selection$],
  );

  const monthMarks = useMemo(() => {
    const pitch = cell + gap;
    const seen = new Set<number>();
    return columns.flatMap((day, index) => {
      if (!day || day.date.getDate() > 7) return [];
      const month = day.date.getMonth();
      const stamp = day.date.getFullYear() * 12 + month;
      if (seen.has(stamp)) return [];
      seen.add(stamp);
      return [{ month, stamp, left: Math.floor(index / DAYS_PER_WEEK) * pitch }];
    });
  }, [columns, cell]);

  const summary = useMemo(() => {
    const shown = columns.filter((day) => day !== null);
    if (shown.length === 0) return "no days";

    const first = shown[0]?.date.toDateString();
    const last = shown.at(-1)?.date.toDateString();
    const total = shown.reduce((sum, day) => sum + counted(day.count), 0);
    return `${shown.length} days, ${first} to ${last}, ${total} in total`;
  }, [columns]);

  return useRender({
    defaultTagName: "div",
    render: <ActivityGridRoot phase$={animation.phase$} loading={loading} render={render} />,
    ref: [measure, ref ?? null],
    props: {
      ...mergeProps<"div">(
        {
          role: "group",
          "aria-label": label.trim() || DEFAULT_LABEL,
          "aria-keyshortcuts": "ArrowLeft ArrowRight ArrowUp ArrowDown",
          tabIndex: 0,
          onKeyDown,
          onBlur: () => selection$.set({}),
        },
        props,
      ),
      "data-slot": "activity-grid",
      "aria-busy": loading,
      className: styles.root({ className }),
      children: (
        <>
          <div
            role="img"
            aria-label={summary}
            className={styles.body()}
            style={{
              gridTemplateColumns: `${WEEKDAY_COLUMN}px minmax(0, 1fr)`,
              gridTemplateRows: `auto ${7 * cell + 6 * gap}px`,
              columnGap: `${LABEL_GAP}px`,
              rowGap: "6px",
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
              ref={animation.plot}
              className={styles.grid()}
              onPointerLeave={() => selection$.set({})}
              style={{ gridAutoColumns: `${cell}px`, gap: `${gap}px` }}
            >
              <ParticleField
                groups={animation.particleGroups}
                count={
                  typeof playback === "object" && playback.particles ? playback.particles.count : 12
                }
              />
              {cells}
            </div>
          </div>

          <div className={styles.footer()}>
            <Computed>
              {() => {
                const cursor = Object.keys(selection$.get())[0];
                const focused =
                  cursor === undefined ? undefined : (columns[Number(cursor)] ?? undefined);
                if (loading)
                  return (
                    <Readout data-loading="" className={styles.readout()}>
                      {loadingLabel}
                    </Readout>
                  );
                return children ? (
                  children(focused)
                ) : (
                  <Readout className={styles.readout()}>{dayReadout(focused, label)}</Readout>
                );
              }}
            </Computed>
            <div className={styles.legend()}>
              {TONES.map((tone) => (
                <span key={tone} className={styles.swatch({ tone })} />
              ))}
            </div>
          </div>
        </>
      ),
    },
  });
}

export { ActivityGrid, activityGrid as activityGridVariants, level as activityLevel };
export { cursorAfter, toColumns, weeksThatFit };
